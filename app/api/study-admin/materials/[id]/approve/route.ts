import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "../../../../../../lib/studyAdmin/scope";
import { notifyMaterialApproved } from "../../../../../../lib/studyAdmin/notifyUploader";
import { triggerMaterialIndex } from "../../../../../../lib/studyMaterialIndexTrigger";

function idFromUrl(req: Request) {
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    // .../materials/<id>/approve
    return parts.length >= 2 ? parts[parts.length - 2] : "";
  } catch {
    return "";
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { scope, userId: moderatorId } = await requireStudyModeratorFromRequest(req);
    const resolvedParams = await params;

    // Prefer dynamic route param, but fall back to body.id for resilience
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const id = resolvedParams?.id || (typeof body?.id === "string" ? body.id : "") || idFromUrl(req);
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const admin = createSupabaseAdminClient();

    // Enforce scoped moderator permissions before approving
    if (scope.role !== "super") {
      const { data: matRow, error: matErr } = await admin
        .from("study_materials")
        .select("id, course_id, study_courses:course_id(faculty_id, department_id, level)")
        .eq("id", id)
        .maybeSingle();

      if (matErr) throw matErr;
      if (!matRow?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

      const course = (matRow as any).study_courses;
      const ok = isWithinScope(scope, {
        faculty_id: course?.faculty_id ?? null,
        department_id: course?.department_id ?? null,
        level: course?.level ?? null,
      });
      if (!ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Fetch the material's course row to re-sync denormalized columns.
    const { data: matForCourse } = await admin
      .from("study_materials")
      .select("course_id")
      .eq("id", id)
      .maybeSingle();

    const courseId = (matForCourse as any)?.course_id ?? null;
    let courseRow: any = null;
    if (courseId) {
      const { data: cr } = await admin
        .from("study_courses")
        .select("course_code, department, department_id, faculty, faculty_id, level, semester")
        .eq("id", courseId)
        .maybeSingle();
      courseRow = cr ?? null;
    }

    const nowIso = new Date().toISOString();
    const patch = {
      approved: true,
      upload_status: "live",
      updated_at: nowIso,
      approved_by: moderatorId,
      approved_at: nowIso,
      // Re-sync denormalized fields from the linked course
      ...(courseRow ? {
        course_code:   courseRow.course_code   ?? null,
        department:    courseRow.department    ?? null,
        department_id: courseRow.department_id ?? null,
        faculty:       courseRow.faculty       ?? null,
        faculty_id:    courseRow.faculty_id    ?? null,
        level:         courseRow.level != null ? String(courseRow.level) : null,
        semester:      courseRow.semester      ?? null,
      } : {}),
    };

    const { data, error } = await admin
      .from("study_materials")
      .update(patch)
      .eq("id", id)
      .select("id, approved, uploader_id, title")
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    // Fire notification — best-effort, must not block the response
    const row = data as any;
    if (row?.uploader_id && row?.title) {
      await notifyMaterialApproved(id, String(row.title), String(row.uploader_id));
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    // Fire department notifications — fire-and-forget, never blocks approval
    fetch(`${baseUrl}/api/study/notify-new-material`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ material_id: id }),
    }).catch(() => {});

    // Fire AI summary generation — fire-and-forget, never blocks approval
    try {
      const { data: matForSummary } = await admin
        .from("study_materials")
        .select("title, description, material_type, course_code")
        .eq("id", id)
        .maybeSingle();

      if (matForSummary?.title) {
        fetch(`${baseUrl}/api/ai/summarize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            materialId: id,
            title: String(matForSummary.title),
            description: (matForSummary as any).description ?? null,
            courseCode: (matForSummary as any).course_code ?? null,
            materialType: (matForSummary as any).material_type ?? "other",
          }),
        }).catch(() => {});
      }
    } catch {}

    triggerMaterialIndex(id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
