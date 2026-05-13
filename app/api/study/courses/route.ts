import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModerator } from "@/lib/studyAdmin/requireStudyModerator";
import { isWithinScope } from "@/lib/studyAdmin/scope";


function isUuid(v: any): boolean {
  if (typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function normalizeUuid(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  return isUuid(s) ? s : null;
}

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
  return Math.trunc(n);
}

export async function POST(req: Request) {
  try {
    const { userId, scope } = await requireStudyModerator();
    const body = await req.json().catch(() => ({}));
    const facultyId = normalizeUuid((scope as any)?.facultyId ?? (scope as any)?.faculty_id);
    const departmentId = normalizeUuid((scope as any)?.departmentId ?? (scope as any)?.department_id);

    if (!departmentId) {
      return NextResponse.json(
        { ok: false, code: "SCOPE_MISSING", error: "Your account has no department scope. Please apply/approve rep access again." },
        { status: 403 }
      );
    }
    if (!facultyId) {
      return NextResponse.json(
        { ok: false, code: "SCOPE_MISSING", error: "Your account has no faculty scope. Please apply/approve rep access again." },
        { status: 403 }
      );
    }

    const rawCode = typeof body?.course_code === "string" ? body.course_code : "";
    const rawTitle = typeof body?.course_title === "string" ? body.course_title : "";

    const level = asLevel(body?.level);
    const semester = normalizeSemester(body?.semester);

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
      faculty_id: facultyId,
      department_id: departmentId,
      level,
    });
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // These human-readable columns are NOT NULL in `study_courses` (faculty, department),
    // so we must populate them alongside faculty_id/department_id.
    const [{ data: facRow, error: facErr }, { data: deptRow, error: deptErr }] = await Promise.all([
      admin.from("study_faculties").select("name").eq("id", facultyId).maybeSingle(),
      admin.from("study_departments").select("name").eq("id", departmentId).maybeSingle(),
    ]);

    if (facErr) throw facErr;
    if (deptErr) throw deptErr;

    const facultyName = facRow?.name ?? null;
    const departmentName = deptRow?.name ?? null;

    if (!facultyName) {
      return NextResponse.json({ ok: false, error: "Faculty name not found for your scope." }, { status: 400 });
    }
    if (!departmentName) {
      return NextResponse.json({ ok: false, error: "Department name not found for your scope." }, { status: 400 });
    }

    // Duplicate blocker
    const { data: existingCourse, error: existingErr } = await admin
      .from("study_courses")
      .select("id")
      .eq("department_id", departmentId)
      .eq("level", level)
      .eq("semester", semester)
      .eq("course_code", course_code)
      .maybeSingle();

    if (existingErr) throw existingErr;
    if (existingCourse?.id) {
      return NextResponse.json(
        { ok: false, code: "COURSE_EXISTS", error: "That course already exists." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const { data: created, error: createErr } = await admin
      .from("study_courses")
      .insert({
        faculty: facultyName,
        department: departmentName,
        faculty_id: facultyId,
        department_id: departmentId,
        level,
        semester,
        course_code,
        course_title,
        status: "approved",
        created_by: userId,
        approved_by: userId,
        approved_at: now,
        updated_at: now,
      })
      .select("id, faculty_id, department_id, level, course_code, course_title, semester")
      .maybeSingle();

    if (createErr) throw createErr;

    return NextResponse.json({ ok: true, course: created }, { status: 200 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status });
  }
}