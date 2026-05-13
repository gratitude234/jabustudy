import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModerator } from "@/lib/studyAdmin/requireStudyModerator";
import { isWithinScope } from "@/lib/studyAdmin/scope";

function normCode(code: string) {
  return code.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeSemester(v: any): "first" | "second" | "summer" {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "first" || s === "1st") return "first";
  if (s === "second" || s === "2nd") return "second";
  if (s === "summer" || s === "sum") return "summer";
  return "first";
}

function asLevel(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const i = Math.trunc(n);
  return i;
}

export async function POST(req: Request) {
  try {
    const { userId, scope } = await requireStudyModerator();

    const body = await req.json().catch(() => ({}));
    const rawCode = typeof body?.course_code === "string" ? body.course_code : "";
    const rawTitle = typeof body?.course_title === "string" ? body.course_title : "";
    const level = asLevel(body?.level);
    const semester = normalizeSemester(body?.semester);
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 400) : null;

    const course_code = normCode(rawCode);
    const course_title = rawTitle.trim().slice(0, 120) || null;

    if (!course_code || course_code.length < 3) {
      return NextResponse.json({ ok: false, error: "Course code is required." }, { status: 400 });
    }
    if (![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(level)) {
      return NextResponse.json({ ok: false, error: "Select a valid level." }, { status: 400 });
    }

    // Must be within moderator scope (dept is enforced by requireStudyModerator)
    const ok = isWithinScope(scope as any, {
      faculty_id: scope.facultyId ?? null,
      department_id: scope.departmentId ?? null,
      level,
    });
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // If course already exists, don't create a request
    const { data: existingCourse } = await admin
      .from("study_courses")
      .select("id")
      .eq("department_id", scope.departmentId)
      .eq("level", level)
      .eq("semester", semester)
      .eq("course_code", course_code)
      .maybeSingle();

    if (existingCourse?.id) {
      return NextResponse.json(
        { ok: false, code: "COURSE_EXISTS", error: "That course already exists. Try searching again." },
        { status: 409 }
      );
    }

    // Avoid duplicate pending requests
    const { data: existingReq } = await admin
      .from("study_course_requests")
      .select("id, status, created_at")
      .eq("department_id", scope.departmentId)
      .eq("level", level)
      .eq("semester", semester)
      .eq("course_code", course_code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingReq?.id && existingReq.status === "pending") {
      return NextResponse.json(
        { ok: true, requested: false, already_pending: true, id: existingReq.id },
        { status: 200 }
      );
    }

    const { data: inserted, error: insErr } = await admin
      .from("study_course_requests")
      .insert({
        requester_id: userId,
        faculty_id: scope.facultyId,
        department_id: scope.departmentId,
        level,
        semester,
        course_code,
        course_title,
        status: "pending",
        note,
      })
      .select("id, created_at")
      .maybeSingle();

    if (insErr) throw insErr;

    return NextResponse.json({ ok: true, requested: true, id: inserted?.id ?? null });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = typeof e?.code === "string" ? e.code : undefined;
    return NextResponse.json({ ok: false, error: e?.message || "Failed to create request", code }, { status });
  }
}
