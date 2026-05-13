import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "../../../../../../lib/studyAdmin/scope";

function normCode(code: string) {
  return code.trim().replace(/\s+/g, " ").toUpperCase();
}

function idFromUrl(req: Request) {
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    // .../course-requests/<id>/approve
    return parts.length >= 2 ? parts[parts.length - 2] : "";
  } catch {
    return "";
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { userId, scope } = await requireStudyModeratorFromRequest(req);
    // Prefer dynamic route param, but fall back to body.id for resilience
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const id =
      resolvedParams?.id ||
      (typeof body?.id === "string" ? body.id : "") ||
      idFromUrl(req);
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 400) : null;

    const admin = createSupabaseAdminClient();

    const { data: requestRow, error: reqErr } = await admin
      .from("study_course_requests")
      .select(
        "id, faculty, department, faculty_id, department_id, level, semester, course_code, course_title, status"
      )
      .eq("id", id)
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!requestRow?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    // Scoped moderators can only approve requests within their assigned scope
    if (scope.role !== "super") {
      const ok = isWithinScope(scope, {
        faculty_id: requestRow.faculty_id,
        department_id: requestRow.department_id,
        level: requestRow.level,
      });
      if (!ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (requestRow.status !== "pending") {
      return NextResponse.json({ ok: false, error: "Request is not pending" }, { status: 409 });
    }

    const course_code = normCode(requestRow.course_code);

    // Avoid duplicates: if a course already exists for the same department+level+semester+code, reuse it.
    const { data: existingCourse, error: existingErr } = await admin
      .from("study_courses")
      .select("id")
      .eq("course_code", course_code)
      .eq("level", requestRow.level)
      .eq("semester", requestRow.semester)
      .eq("department_id", requestRow.department_id)
      .maybeSingle();
    if (existingErr) throw existingErr;

    let courseId = existingCourse?.id as string | undefined;

    if (!courseId) {
      const { data: created, error: createErr } = await admin
        .from("study_courses")
        .insert({
          faculty: requestRow.faculty,
          department: requestRow.department,
          faculty_id: requestRow.faculty_id,
          department_id: requestRow.department_id,
          level: requestRow.level,
          semester: requestRow.semester,
          course_code,
          course_title: requestRow.course_title,
          status: "approved",
          created_by: userId,
          approved_by: userId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (createErr) throw createErr;
      courseId = created?.id;
    }

    const { error: updateErr } = await admin
      .from("study_course_requests")
      .update({
        status: "approved",
        admin_note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true, courseId: courseId ?? null });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
