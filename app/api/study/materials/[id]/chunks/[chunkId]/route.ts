// app/api/study/materials/[id]/chunks/[chunkId]/route.ts
// Returns one indexed material chunk for source-backed guided reading.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModerator } from "@/lib/studyAdmin/requireStudyModerator";
import { isWithinScope } from "@/lib/studyAdmin/scope";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; chunkId: string }> }
) {
  const { id, chunkId } = await params;
  const materialId = String(id || "").trim();
  const sourceChunkId = String(chunkId || "").trim();

  if (!materialId || !sourceChunkId) {
    return jsonError("Missing material or chunk id", 400, "BAD_REQUEST");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;
  if (userErr || !userId) return jsonError("Unauthorized", 401, "NO_SESSION");

  const admin = createSupabaseAdminClient();

  const { data: material, error: materialErr } = await admin
    .from("study_materials")
    .select("id, approved, uploader_id, course_id")
    .eq("id", materialId)
    .maybeSingle();

  if (materialErr) return jsonError(materialErr.message || "DB error", 500, "DB_ERROR");
  if (!material?.id) return jsonError("Not found", 404, "NOT_FOUND");

  const approved = Boolean((material as any).approved);
  const uploaderId = (material as any).uploader_id as string | null;
  const courseId = (material as any).course_id as string | null;

  if (!approved) {
    const isUploader = uploaderId && uploaderId === userId;
    if (!isUploader) {
      const { scope } = await requireStudyModerator();
      if (!courseId) return jsonError("Forbidden", 403, "FORBIDDEN");

      const { data: course, error: courseErr } = await admin
        .from("study_courses")
        .select("faculty_id, department_id, level")
        .eq("id", courseId)
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

  const { data: chunk, error: chunkErr } = await admin
    .from("study_material_chunks")
    .select("id, page_number, text")
    .eq("id", sourceChunkId)
    .eq("material_id", materialId)
    .maybeSingle();

  if (chunkErr) return jsonError(chunkErr.message || "DB error", 500, "DB_ERROR");
  if (!chunk?.id) return jsonError("Chunk not found", 404, "NOT_FOUND");

  return NextResponse.json({
    ok: true,
    chunk: {
      id: String((chunk as any).id),
      page_number: (chunk as any).page_number ?? null,
      text: String((chunk as any).text ?? ""),
    },
  });
}
