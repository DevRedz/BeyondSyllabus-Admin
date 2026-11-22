import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createAuthClient, isAdminEmail } from "@/lib/supabase/server";

async function authorize() {
  const auth = await createAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  return user && isAdminEmail(user.email) ? createAdminClient() : null;
}

type CourseRecord = {
  id: string;
  course_code: string;
  title: string;
  department_id: string;
};

export async function GET(request: NextRequest) {
  const admin = await authorize();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const courseId = request.nextUrl.searchParams.get("course_id");
  if (courseId) {
    const { data: course, error: courseError } = await admin
      .from("courses")
      .select("id, course_code, title, department_id")
      .eq("id", courseId)
      .maybeSingle();
    if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 });
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

    const { data: generations, error: generationError } = await admin
      .from("ai_generations")
      .select(
        "id, target_role, generated_resume_bullet, generated_skillset, generated_text, item_type, category, evidence, created_at, is_public",
      )
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (generationError) {
      return NextResponse.json({ error: generationError.message }, { status: 500 });
    }
    const generationIds = (generations ?? []).map((generation) => generation.id);
    const votesByGeneration = new Map<string, number>();
    if (generationIds.length) {
      const { data: votes, error: voteError } = await admin
        .from("votes")
        .select("generation_id")
        .eq("vote_value", 1)
        .in("generation_id", generationIds);
      if (voteError) return NextResponse.json({ error: voteError.message }, { status: 500 });
      for (const vote of votes ?? []) {
        votesByGeneration.set(
          vote.generation_id,
          (votesByGeneration.get(vote.generation_id) ?? 0) + 1,
        );
      }
    }

    return NextResponse.json({
      course,
      outputs: (generations ?? []).map((generation) => ({
        ...generation,
        positive_votes: votesByGeneration.get(generation.id) ?? 0,
      })),
    });
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("perPage")) || 50),
  );
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
  const allCourses: CourseRecord[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await admin
      .from("courses")
      .select("id, course_code, title, department_id")
      .order("course_code", { ascending: true })
      .range(start, start + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    allCourses.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const voteCounts = new Map<string, number>();
  for (let start = 0; ; start += 1000) {
    const { data, error } = await admin
      .from("votes")
      .select("generation_id, ai_generations!inner(course_id)")
      .eq("vote_value", 1)
      .order("id", { ascending: true })
      .range(start, start + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const vote of data ?? []) {
      const relatedGenerations = vote.ai_generations;
      const generations = Array.isArray(relatedGenerations)
        ? relatedGenerations
        : relatedGenerations
          ? [relatedGenerations]
          : [];
      for (const generation of generations) {
        if (generation.course_id) {
          voteCounts.set(
            generation.course_id,
            (voteCounts.get(generation.course_id) ?? 0) + 1,
          );
        }
      }
    }
    if (!data || data.length < 1000) break;
  }

  const departmentIds = Array.from(
    new Set(allCourses.map((course) => course.department_id)),
  );
  const { data: departments, error: departmentError } = departmentIds.length
    ? await admin.from("departments").select("id, name").in("id", departmentIds)
    : { data: [], error: null };
  if (departmentError) {
    return NextResponse.json({ error: departmentError.message }, { status: 500 });
  }
  const departmentNames = new Map(
    (departments ?? []).map((department) => [department.id, department.name]),
  );

  const filtered = allCourses
    .map((course) => ({
      ...course,
      department: departmentNames.get(course.department_id) ?? "Unknown department",
      positive_votes: voteCounts.get(course.id) ?? 0,
    }))
    .filter((course) =>
      `${course.course_code} ${course.title} ${course.department}`
        .toLowerCase()
        .includes(search),
    )
    .sort(
      (a, b) =>
        b.positive_votes - a.positive_votes ||
        a.course_code.localeCompare(b.course_code),
    );
  const from = (page - 1) * perPage;

  return NextResponse.json({
    rows: filtered.slice(from, from + perPage),
    page,
    perPage,
    total: filtered.length,
  });
}
