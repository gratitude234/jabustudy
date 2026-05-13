// app/api/study/materials/me/route.ts
// Returns the authenticated user's uploads (pending/approved), for a simple "My uploads" screen.

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function resolveUserId(req: Request): Promise<string | null> {
  // Prefer cookie-based auth
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (uid) return uid;
  } catch {
    // ignore and try bearer
  }

  // Fallback: bearer token
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data?.user?.id ?? null;
}

export async function GET(req: Request) {
  try {
    const uid = await resolveUserId(req);
    if (!uid) return NextResponse.json({ ok: false, code: "NO_SESSION", error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("study_materials")
      .select(
        "id, title, material_type, session, approved, upload_status, created_at, updated_at, file_url, file_path, description, study_courses:course_id(course_code, course_title, level, semester)"
      )
      .eq("uploader_id", uid)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({ ok: true, items: data || [] });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
