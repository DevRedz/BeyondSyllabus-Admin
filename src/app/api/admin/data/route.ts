import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_RESOURCES } from "@/lib/admin-resources";
import { createAdminClient, createAuthClient, isAdminEmail } from "@/lib/supabase/server";

async function authorize() {
  const auth = await createAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!isAdminEmail(user?.email)) return null;
  return createAdminClient();
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getResource(value: string | null) {
  return value ? ADMIN_RESOURCES[value] : undefined;
}

function getRowKey(resource: NonNullable<ReturnType<typeof getResource>>, row: unknown) {
  if (!resource.table || !row || typeof row !== "object") return null;
  const field = resource.key ?? "id";
  const value = (row as Record<string, unknown>)[field];
  if (typeof value !== "string" && typeof value !== "number") return null;
  return { field, value };
}

export async function GET(request: NextRequest) {
  const supabase = await authorize();
  if (!supabase) return jsonError("Admin access required.", 403);
  const resourceName = request.nextUrl.searchParams.get("resource");
  const resource = getResource(resourceName);
  if (!resource) return jsonError("Unknown admin resource.", 400);

  if (resourceName === "users") {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({
      rows: data.users.map(({ id, email, created_at, last_sign_in_at, banned_until }) => ({
        id,
        email,
        created_at,
        last_sign_in_at,
        banned_until,
      })),
    });
  }

  const { data, error } = await supabase
    .from(resource.table!)
    .select("*")
    .limit(100);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await authorize();
  if (!supabase) return jsonError("Admin access required.", 403);
  const body = await request.json().catch(() => null);
  const resource = getResource(body?.resource);
  if (!resource?.table || resource.readOnly) return jsonError("This resource cannot be modified.", 403);
  if (!body.record || typeof body.record !== "object" || Array.isArray(body.record)) {
    return jsonError("Record must be a JSON object.", 400);
  }
  const { data, error } = await supabase
    .from(resource.table)
    .insert(body.record)
    .select()
    .single();
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ row: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await authorize();
  if (!supabase) return jsonError("Admin access required.", 403);
  const body = await request.json().catch(() => null);
  const resource = getResource(body?.resource);
  if (!resource?.table || resource.readOnly) return jsonError("This resource cannot be modified.", 403);
  if (!body.record || typeof body.record !== "object" || Array.isArray(body.record)) {
    return jsonError("Record must be a JSON object.", 400);
  }
  const key = getRowKey(resource, body.original);
  if (!key) return jsonError(`The original record must include ${resource.key}.`, 400);
  const { data, error } = await supabase
    .from(resource.table)
    .update(body.record)
    .eq(key.field, key.value)
    .select()
    .maybeSingle();
  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("No matching record was found.", 404);
  return NextResponse.json({ row: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await authorize();
  if (!supabase) return jsonError("Admin access required.", 403);
  const body = await request.json().catch(() => null);
  const resource = getResource(body?.resource);
  if (!resource?.table || resource.readOnly) return jsonError("This resource cannot be modified.", 403);
  const key = getRowKey(resource, body.original);
  if (!key) return jsonError(`The record must include ${resource.key}.`, 400);
  const { data, error } = await supabase
    .from(resource.table)
    .delete()
    .eq(key.field, key.value)
    .select()
    .maybeSingle();
  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("No matching record was found.", 404);
  return NextResponse.json({ ok: true });
}
