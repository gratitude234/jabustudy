// app/api/study/materials/[id]/download/route.ts
// Returns a signed download URL (redirect) for approved materials.
// For unapproved materials, only uploader or scoped moderators can download.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModerator } from "@/lib/studyAdmin/requireStudyModerator";
import { isWithinScope } from "@/lib/studyAdmin/scope";

export const dynamic = "force-dynamic";

const BUCKET = "study-materials";
const EXPIRES_IN_SECONDS = 10 * 60;

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const materialId = String(id || "").trim();
  if (!materialId) return jsonError("Missing id", 400, "BAD_REQUEST");
  const preview = new URL(req.url).searchParams.get("preview") === "1";

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;
  if (userErr || !userId) return jsonError("Unauthorized", 401, "NO_SESSION");

  const admin = createSupabaseAdminClient();

  // Load material + course scope info (for moderators)
  const { data: row, error } = await admin
    .from("study_materials")
    .select("id, approved, uploader_id, file_path, course_id")
    .eq("id", materialId)
    .maybeSingle();

  if (error) return jsonError(error.message || "DB error", 500, "DB_ERROR");
  if (!row?.id) return jsonError("Not found", 404, "NOT_FOUND");

  const approved = Boolean((row as any).approved);
  const uploader_id = (row as any).uploader_id as string | null;
  const file_path = (row as any).file_path as string | null;
  const course_id = (row as any).course_id as string | null;

  if (!file_path) return jsonError("File not ready", 409, "FILE_NOT_READY");

  // Access control for unapproved materials
  if (!approved) {
    const isUploader = uploader_id && uploader_id === userId;
    if (!isUploader) {
      // Must be an approved moderator AND within scope of the course
      const { scope } = await requireStudyModerator();

      if (!course_id) return jsonError("Forbidden", 403, "FORBIDDEN");

      const { data: course, error: courseErr } = await admin
        .from("study_courses")
        .select("faculty_id, department_id, level")
        .eq("id", course_id)
        .maybeSingle();

      if (courseErr) return jsonError(courseErr.message || "DB error", 500, "DB_ERROR");

      const ok = isWithinScope(scope, {
        faculty_id: (course as any)?.faculty_id ?? null,
        department_id: (course as any)?.department_id ?? null,
        level: (course as any)?.level ?? null,
      });

      if (!ok) return jsonError("Forbidden", 403, "FORBIDDEN");
    }
  }

  const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUrl(file_path, EXPIRES_IN_SECONDS);
  if (signErr) return jsonError(signErr.message || "Failed to sign download", 500, "SIGN_DOWNLOAD_FAILED");

  const url = (signed as any)?.signedUrl as string | undefined;
  if (!url) return jsonError("Failed to sign download", 500, "SIGN_DOWNLOAD_FAILED");

  if (preview) {
    return NextResponse.json({ ok: true, url });
  }

  // Fire-and-forget atomic increment — never blocks the redirect
  void (async () => { try { await admin.rpc("increment_material_downloads", { p_id: materialId }); } catch {} })();

  return NextResponse.redirect(url, { status: 302 });
}
