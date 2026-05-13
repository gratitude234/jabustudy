import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "../../../../../lib/studyAdmin/scope";
import { notifyBulkMaterialsApproved } from "../../../../../lib/studyAdmin/notifyUploader";
import { triggerMaterialIndex } from "../../../../../lib/studyMaterialIndexTrigger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { scope, userId: moderatorId } = await requireStudyModeratorFromRequest(req);

    const body = (await req.json().catch(() => null)) as any;
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === "string").slice(0, 200) : [];
    if (!ids.length) return NextResponse.json({ ok: false, error: "No ids provided" }, { status: 400 });

    const admin = createSupabaseAdminClient();

    // If not super, scope-check all items first
    if (scope.role !== "super") {
      const { data: rows, error } = await admin
        .from("study_materials")
        .select("id, course_id, study_courses:course_id(faculty_id, department_id, level)")
        .in("id", ids);

      if (error) throw error;

      for (const r of rows || []) {
        const course = (r as any).study_courses;
        const ok = isWithinScope(scope, {
          faculty_id: course?.faculty_id ?? null,
          department_id: course?.department_id ?? null,
          level: course?.level ?? null,
        });
        if (!ok) return NextResponse.json({ ok: false, error: "Forbidden (scope mismatch)" }, { status: 403 });
      }
    }

    // Fetch the linked courses for all materials so we can re-sync denormalized columns.
    const { data: matsForCourses } = await admin
      .from("study_materials")
      .select("id, course_id")
      .in("id", ids);

    const courseIds = [
      ...new Set(
        (matsForCourses ?? []).map((m: any) => m.course_id).filter(Boolean)
      ),
    ] as string[];

    const courseMap = new Map<string, any>();
    if (courseIds.length) {
      const { data: courseRows } = await admin
        .from("study_courses")
        .select("id, course_code, department, department_id, faculty, faculty_id, level, semester")
        .in("id", courseIds);
      for (const cr of courseRows ?? []) courseMap.set((cr as any).id, cr);
    }

    const nowIso = new Date().toISOString();

    // Build per-material updates with denormalized fields re-synced from course
    const matCourseIdMap = new Map<string, string>(
      (matsForCourses ?? []).map((m: any) => [m.id, m.course_id])
    );

    // Apply a single bulk update for approved + updated_at (common to all),
    // then patch denormalized fields per material (only those that have a course row).
    const { error: updErr } = await admin
      .from("study_materials")
      .update({ approved: true, upload_status: "live", updated_at: nowIso, approved_by: moderatorId, approved_at: nowIso })
      .in("id", ids);
    if (!updErr) {
      // Re-sync denormalized fields per material — individual updates, fire-and-forget style
      for (const id of ids) {
        const courseId = matCourseIdMap.get(id);
        const cr = courseId ? courseMap.get(courseId) : null;
        if (cr) {
          await admin
            .from("study_materials")
            .update({
              course_code:   cr.course_code   ?? null,
              department:    cr.department    ?? null,
              department_id: cr.department_id ?? null,
              faculty:       cr.faculty       ?? null,
              faculty_id:    cr.faculty_id    ?? null,
              level:         cr.level != null ? String(cr.level) : null,
              semester:      cr.semester      ?? null,
            })
            .eq("id", id);
        }
      }
    }

    if (updErr) throw updErr; // throw after the denorm re-sync attempt

    // Fetch uploader_id + title for all approved materials so we can
    // send each person a single grouped notification (fire-and-forget).
    const { data: notifyRows } = await admin
      .from("study_materials")
      .select("id, title, uploader_id")
      .in("id", ids);

    if (notifyRows?.length) {
      await notifyBulkMaterialsApproved(
        (notifyRows as any[]).map((r) => ({
          id: String(r.id),
          title: String(r.title ?? "Untitled"),
          uploader_id: r.uploader_id ? String(r.uploader_id) : null,
        }))
      );
    }

    // Fire dept notifications + AI summary per approved material — fire-and-forget
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");
      for (const id of ids) {
        fetch(`${baseUrl}/api/study/notify-new-material`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ material_id: id }),
        }).catch(() => {});
        fetch(`${baseUrl}/api/ai/summarize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ material_id: id }),
        }).catch(() => {});
        triggerMaterialIndex(id);
      }
    } catch {}

    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
