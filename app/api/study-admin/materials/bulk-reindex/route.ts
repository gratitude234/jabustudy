import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "../../../../../lib/studyAdmin/scope";
import { isIndexableMaterialPath } from "../../../../../lib/studyMaterialIndexEligibility";
import { triggerMaterialIndex } from "../../../../../lib/studyMaterialIndexTrigger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const body = (await req.json().catch(() => null)) as { ids?: unknown[] } | null;
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((id) => String(id).trim()).filter(Boolean).slice(0, 200)
      : [];

    if (!ids.length) return NextResponse.json({ ok: false, error: "No ids provided" }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: rows, error } = await admin
      .from("study_materials")
      .select("id, approved, file_path, study_courses:course_id(faculty_id, department_id, level)")
      .in("id", ids);

    if (error) throw error;

    const foundIds = new Set((rows ?? []).map((row: any) => String(row.id)));
    const missing = ids.filter((id) => !foundIds.has(id)).length;

    if (scope.role !== "super") {
      for (const row of rows ?? []) {
        const course = (row as any).study_courses;
        const ok = isWithinScope(scope, {
          faculty_id: course?.faculty_id ?? null,
          department_id: course?.department_id ?? null,
          level: course?.level ?? null,
        });
        if (!ok) return NextResponse.json({ ok: false, error: "Forbidden (scope mismatch)" }, { status: 403 });
      }
    }

    const eligible = (rows ?? []).filter((row: any) => Boolean(row.approved) && isIndexableMaterialPath(row.file_path));
    for (const row of eligible) {
      triggerMaterialIndex(String((row as any).id));
    }

    return NextResponse.json({
      ok: true,
      queued: eligible.length,
      skipped: Math.max(0, ids.length - eligible.length - missing),
      missing,
    });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
