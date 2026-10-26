import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createAuthClient, isAdminEmail } from "@/lib/supabase/server";

const BUCKET = "syllabi";
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorize() {
  const auth = await createAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  return user && isAdminEmail(user.email)
    ? { client: createAdminClient(), userId: user.id }
    : null;
}

export async function GET() {
  const admin = await authorize();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { data, error } = await admin.client
    .from("syllabi")
    .select("id, offering_id, storage_path, file_type, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const fileResults = await Promise.all(
    (data ?? []).map(async (file) => {
      const { data: signed, error: signedError } = await admin.client.storage
        .from(BUCKET)
        .createSignedUrl(file.storage_path, 60 * 5);
      if (signedError) return { error: signedError.message };
      return { file, url: signed.signedUrl };
    }),
  );
  const signingFailure = fileResults.find((result) => "error" in result);
  if (signingFailure && "error" in signingFailure) {
    return NextResponse.json({ error: signingFailure.error }, { status: 500 });
  }
  const files = fileResults.map((result) => {
    if ("error" in result) return null;
    return {
      id: result.file.id,
      name: result.file.storage_path,
      size: 0,
      offering_id: result.file.offering_id,
      file_type: result.file.file_type,
      created_at: result.file.created_at,
      url: result.url,
    };
  }).filter((file) => file !== null);
  return NextResponse.json({ files });
}

export async function POST(request: NextRequest) {
  const admin = await authorize();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const offeringId = String(form.get("offering_id") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (!UUID_PATTERN.test(offeringId)) {
    return NextResponse.json({ error: "Enter a valid course offering UUID." }, { status: 400 });
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Files must be between 1 byte and 4 MB." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
  }
  const pdfHeader = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (pdfHeader !== "%PDF-") {
    return NextResponse.json({ error: "The selected file is not a valid PDF." }, { status: 400 });
  }

  const path = `${admin.userId}/${offeringId}/${randomUUID()}.pdf`;
  const { error: uploadError } = await admin.client.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { error: insertError } = await admin.client.from("syllabi").insert({
    offering_id: offeringId,
    uploaded_by: admin.userId,
    storage_path: path,
    file_type: file.type,
    processing_status: "completed",
  });
  if (insertError) {
    const { error: cleanupError } = await admin.client.storage.from(BUCKET).remove([path]);
    const cleanupMessage = cleanupError
      ? ` Uploaded file cleanup failed: ${cleanupError.message}`
      : "";
    return NextResponse.json(
      { error: `Could not save the syllabus record: ${insertError.message}.${cleanupMessage}` },
      { status: 400 },
    );
  }
  return NextResponse.json({ name: path }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const admin = await authorize();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Invalid syllabus ID." }, { status: 400 });
  const { data: syllabus, error: lookupError } = await admin.client
    .from("syllabi")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!syllabus) return NextResponse.json({ error: "Syllabus not found." }, { status: 404 });

  const { error: deleteRowError } = await admin.client
    .from("syllabi")
    .delete()
    .eq("id", id);
  if (deleteRowError) return NextResponse.json({ error: deleteRowError.message }, { status: 400 });
  const { error: storageError } = await admin.client.storage
    .from(BUCKET)
    .remove([syllabus.storage_path]);
  if (storageError) {
    return NextResponse.json(
      { error: `Syllabus record deleted, but its storage file could not be removed: ${storageError.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
