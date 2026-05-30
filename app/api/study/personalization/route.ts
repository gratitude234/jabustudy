import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileStatus = "complete" | "incomplete" | "missing";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function semesterToDb(value: unknown) {
  const raw = cleanString(value).toLowerCase();
  if (raw === "1st" || raw === "first") return "first";
  if (raw === "2nd" || raw === "second") return "second";
  if (raw === "summer") return "summer";
  return raw;
}

function isFiniteLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user ?? null;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("study_preferences")
      .select(
        "faculty,department,level,faculty_id,department_id,semester,session," +
          " faculty_rel:study_faculties(name), department_rel:study_departments(name)"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const row = (data as any) ?? null;
    const missingFields: string[] = [];

    if (!row) {
      missingFields.push("faculty_id", "department_id", "level", "semester", "session");
    } else {
      if (!cleanString(row.faculty_id)) missingFields.push("faculty_id");
      if (!cleanString(row.department_id)) missingFields.push("department_id");
      if (!isFiniteLevel(row.level)) missingFields.push("level");
      if (!cleanString(row.semester)) missingFields.push("semester");
      if (!cleanString(row.session)) missingFields.push("session");
    }

    const profileStatus: ProfileStatus = !row
      ? "missing"
      : missingFields.length === 0
        ? "complete"
        : "incomplete";

    const departmentName =
      cleanString(row?.department_rel?.name) || cleanString(row?.department) || null;
    const facultyName = cleanString(row?.faculty_rel?.name) || cleanString(row?.faculty) || null;

    const prefs = row
      ? {
          faculty: facultyName,
          department: departmentName,
          level: isFiniteLevel(row.level) ? row.level : null,
          faculty_id: cleanString(row.faculty_id) || null,
          department_id: cleanString(row.department_id) || null,
          semester: cleanString(row.semester) || null,
          session: cleanString(row.session) || null,
        }
      : null;

    let courses: Array<{
      id: string;
      course_code: string;
      course_title: string | null;
      level: number | null;
      semester: string | null;
    }> = [];

    if (profileStatus === "complete" && prefs) {
      const { data: courseRows, error: coursesError } = await supabase
        .from("study_courses")
        .select("id,course_code,course_title,level,semester")
        .eq("status", "approved")
        .eq("department_id", prefs.department_id)
        .eq("level", prefs.level)
        .eq("semester", semesterToDb(prefs.semester))
        .order("course_code", { ascending: true })
        .limit(80);

      if (!coursesError && Array.isArray(courseRows)) {
        courses = courseRows
          .filter((course: any) => cleanString(course.course_code))
          .map((course: any) => ({
            id: String(course.id),
            course_code: cleanString(course.course_code).toUpperCase(),
            course_title: cleanString(course.course_title) || null,
            level: isFiniteLevel(course.level) ? course.level : null,
            semester: cleanString(course.semester) || null,
          }));
      }

    }

    // GNS (General Studies) sets are university-wide — every student at a given
    // level takes them regardless of department. Collect their course codes from
    // actual published sets so the "For you" filter includes them even when the
    // student's department hasn't registered those courses.
    let gnsCourseCodes: string[] = [];
    if (profileStatus === "complete" && prefs && isFiniteLevel(prefs.level)) {
      const { data: gnsSets } = await supabase
        .from("study_quiz_sets")
        .select("course_code")
        .ilike("course_code", "GNS%")
        .eq("published", true)
        .eq("level", prefs.level);

      if (Array.isArray(gnsSets)) {
        const existingCodes = new Set(courses.map((c) => c.course_code));
        const seen = new Set<string>();
        for (const s of gnsSets) {
          const code = cleanString(s.course_code).toUpperCase();
          if (code && !existingCodes.has(code) && !seen.has(code)) {
            seen.add(code);
            gnsCourseCodes.push(code);
          }
        }
      }
    }

    const scopeBits = [
      departmentName,
      isFiniteLevel(row?.level) ? `${row.level}L` : null,
      cleanString(row?.semester)
        ? `${semesterToDb(row.semester) === "first" ? "1st" : semesterToDb(row.semester) === "second" ? "2nd" : row.semester} semester`
        : null,
    ].filter(Boolean);

    return NextResponse.json({
      ok: true,
      profileStatus,
      prefs,
      missingFields,
      scopeLabel: scopeBits.length ? scopeBits.join(" - ") : null,
      courses,
      courseIds: courses.map((course) => course.id),
      courseCodes: [...courses.map((course) => course.course_code), ...gnsCourseCodes],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Could not load personalization" },
      { status: 500 }
    );
  }
}
