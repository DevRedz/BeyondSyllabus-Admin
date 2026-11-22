import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createAuthClient, isAdminEmail } from "@/lib/supabase/server";

async function authorize() {
  const auth = await createAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  return user && isAdminEmail(user.email) ? createAdminClient() : null;
}

export async function GET(request: NextRequest) {
  const admin = await authorize();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(params.get("perPage")) || 50));
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const field = params.get("field") ?? "all";
  const status = params.get("status") ?? "all";
  const createdRange = params.get("createdRange") ?? "all";
  if (!["all", "email", "name"].includes(field)) {
    return NextResponse.json({ error: "Invalid user search field." }, { status: 400 });
  }
  if (!["all", "active", "banned"].includes(status)) {
    return NextResponse.json({ error: "Invalid account status filter." }, { status: 400 });
  }
  if (!["all", "30", "90", "365"].includes(createdRange)) {
    return NextResponse.json({ error: "Invalid signup date filter." }, { status: 400 });
  }

  const allUsers = [];
  for (let userPage = 1; ; userPage += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: userPage,
      perPage: 1000,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    allUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }[] = [];
  for (let start = 0; start < allUsers.length; start += 500) {
    const ids = allUsers.slice(start, start + 500).map((user) => user.id);
    const { data, error } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profiles.push(...(data ?? []));
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const now = Date.now();
  const cutoff =
    createdRange === "all" ? null : now - Number(createdRange) * 86_400_000;
  const filtered = allUsers
    .map((user) => {
      const profile = profilesById.get(user.id);
      return {
        id: user.id,
        email: user.email ?? profile?.email ?? "",
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        banned_until: user.banned_until ?? null,
        is_banned: Boolean(
          user.banned_until && new Date(user.banned_until).getTime() > now,
        ),
      };
    })
    .filter((user) => {
      if (search) {
        const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.toLowerCase();
        const matchesEmail = user.email.toLowerCase().includes(search);
        const matchesName = name.includes(search);
        if (field === "email" && !matchesEmail) return false;
        if (field === "name" && !matchesName) return false;
        if (field === "all" && !matchesEmail && !matchesName) return false;
      }
      if (status === "active" && user.is_banned) return false;
      if (status === "banned" && !user.is_banned) return false;
      if (cutoff !== null && new Date(user.created_at).getTime() < cutoff) return false;
      return true;
    })
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const from = (page - 1) * perPage;
  const pageUsers = filtered.slice(from, from + perPage);
  const pageUserIds = pageUsers.map((user) => user.id);
  const generationCounts = new Map<string, number>();
  const courseCounts = new Map<string, number>();
  if (pageUserIds.length) {
    const generationRows: { user_id: string }[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await admin
        .from("ai_generations")
        .select("user_id")
        .in("user_id", pageUserIds)
        .order("id", { ascending: true })
        .range(start, start + 999);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      generationRows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const courseRows: { user_id: string }[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await admin
        .from("user_courses")
        .select("user_id")
        .in("user_id", pageUserIds)
        .order("id", { ascending: true })
        .range(start, start + 999);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      courseRows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    for (const generation of generationRows) {
      generationCounts.set(
        generation.user_id,
        (generationCounts.get(generation.user_id) ?? 0) + 1,
      );
    }
    for (const course of courseRows) {
      courseCounts.set(course.user_id, (courseCounts.get(course.user_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    rows: pageUsers.map((user) => ({
      ...user,
      generation_count: generationCounts.get(user.id) ?? 0,
      course_count: courseCounts.get(user.id) ?? 0,
    })),
    page,
    perPage,
    total: filtered.length,
  });
}
