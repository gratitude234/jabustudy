import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyStudentCreatedCourse } from "@/lib/studyNotify";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, error: message, message }, { status });
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function codeKey(value: unknown) {
  return normalizeCode(value).replace(/\s+/g, "");
}

function normalizeSemester(value: unknown): "first" | "second" | "summer" | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "first" || s === "1st") return "first";
  if (s === "second" || s === "2nd") return "second";
  if (s === "summer") return "summer";
  return null;
}

function asLevel(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData?.user) return jsonError("Unauthorized", 401, "NO_SESSION");

    const userId = userData.user.id;
    const uploaderEmail = userData.user.email ?? null;
    const body = await req.json().catch(() => ({}));

    const courseCode = normalizeCode(body?.course_code);
    const courseTitle =
      typeof body?.course_title === "string" && body.course_title.trim()
        ? body.course_title.trim().slice(0, 120)
        : null;
    const requestedLevel = asLevel(body?.level);
    const semester = normalizeSemester(body?.semester);

    if (!courseCode || codeKey(courseCode).length < 3) {
      return jsonError("Course code is required.", 400, "MISSING_COURSE_CODE");
    }
    if (!requestedLevel || ![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(requestedLevel)) {
      return jsonError("Select a valid level.", 400, "INVALID_LEVEL");
    }
    if (!semester) return jsonError("Select a valid semester.", 400, "INVALID_SEMESTER");

    const admin = createSupabaseAdminClient();
    const { data: prefs, error: prefsErr } = await admin
      .from("study_preferences")
      .select("faculty_id, department_id, level")
      .eq("user_id", userId)
      .maybeSingle();
    if (prefsErr) throw prefsErr;

    const departmentId = (prefs as any)?.department_id as string | null;
    const prefsLevel = asLevel((prefs as any)?.level);
    if (!departmentId || !prefsLevel) {
      return jsonError("Set your department and level before adding a course.", 400, "PREFS_REQUIRED");
    }
    if (requestedLevel !== prefsLevel) {
      return jsonError("You can only add courses for your saved study level.", 403, "LEVEL_OUT_OF_SCOPE");
    }

    const { data: dept, error: deptErr } = await admin
      .from("study_departments")
      .select("id, name, faculty_id")
      .eq("id", departmentId)
      .maybeSingle();
    if (deptErr) throw deptErr;
    if (!dept?.id) return jsonError("Department not found.", 400, "INVALID_DEPARTMENT");

    const facultyId = ((prefs as any)?.faculty_id ?? (dept as any).faculty_id ?? null) as string | null;
    let facultyName = "";
    if (facultyId) {
      const { data: faculty, error: facultyErr } = await admin
        .from("study_faculties")
        .select("name")
        .eq("id", facultyId)
        .maybeSingle();
      if (facultyErr) throw facultyErr;
      facultyName = (faculty as any)?.name ?? "";
    }

    const { data: existingRows, error: existingErr } = await admin
      .from("study_courses")
      .select("id, course_code, course_title, level, semester, faculty_id, department_id, status, course_review_status")
      .eq("department_id", departmentId)
      .eq("level", requestedLevel)
      .eq("semester", semester);
    if (existingErr) throw existingErr;

    const duplicate = ((existingRows ?? []) as any[]).find((row) => codeKey(row.course_code) === codeKey(courseCode));
    if (duplicate?.id) {
      if (duplicate.status === "rejected" || duplicate.course_review_status === "removed") {
        return jsonError("That course was removed and needs admin attention.", 409, "COURSE_REMOVED");
      }
      return NextResponse.json({
        ok: true,
        reused: true,
        course: {
          id: duplicate.id,
          faculty_id: duplicate.faculty_id ?? facultyId,
          department_id: duplicate.department_id ?? departmentId,
          level: duplicate.level,
          course_code: duplicate.course_code,
          course_title: duplicate.course_title,
          semester: duplicate.semester,
          course_review_status: duplicate.course_review_status ?? "approved",
          created_from_upload: false,
        },
      });
    }

    const now = new Date().toISOString();
    const { data: created, error: createErr } = await admin
      .from("study_courses")
      .insert({
        faculty: facultyName,
        faculty_id: facultyId,
        department: (dept as any).name ?? "",
        department_id: departmentId,
        level: requestedLevel,
        semester,
        course_code: courseCode,
        course_title: courseTitle,
        status: "approved",
        course_review_status: "pending",
        created_from_upload: true,
        created_by: userId,
        approved_by: null,
        approved_at: null,
        updated_at: now,
      })
      .select("id, faculty_id, department_id, level, course_code, course_title, semester, course_review_status, created_from_upload")
      .maybeSingle();

    if (createErr) throw createErr;
    if (!created?.id) return jsonError("Course could not be created.", 500, "CREATE_FAILED");

    notifyStudentCreatedCourse({
      courseId: String((created as any).id),
      courseCode,
      courseTitle,
      departmentId,
      level: requestedLevel,
      creatorEmail: uploaderEmail,
    }).catch(() => {});

    return NextResponse.json({ ok: true, reused: false, course: created });
  } catch (e: any) {
    return jsonError(e?.message || "Server error", Number(e?.status) || 500, e?.code || "SERVER_ERROR");
  }
}
