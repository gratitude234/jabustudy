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

function normalizedCourseCode(value: unknown) {
  return cleanString(value).toUpperCase();
}

function normalizedDepartmentName(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(department|dept)\s+of\s+/, "")
    .replace(/^department\s+/, "")
    .trim();
}

function practiceSetTargetsDepartment(row: any, departmentName: string | null, departmentId: string | null) {
  const config = row?.generation_config;
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;

  const expectedName = normalizedDepartmentName(departmentName);
  const expectedId = cleanString(departmentId).toLowerCase();
  const configDeptId = cleanString(config.department_id ?? config.target_department_id).toLowerCase();

  if (expectedId && configDeptId && expectedId === configDeptId) return true;

  const candidates: unknown[] = [
    config.department,
    config.department_name,
    config.target_department,
    config.audience_department,
  ];

  if (Array.isArray(config.departments)) {
    for (const item of config.departments) {
      if (typeof item === "string") {
        candidates.push(item);
      } else if (item && typeof item === "object") {
        candidates.push(
          (item as any).name,
          (item as any).department,
          (item as any).department_name,
          (item as any).id,
          (item as any).department_id
        );
      }
    }
  }

  return candidates.some((candidate) => {
    const normalized = normalizedDepartmentName(candidate);
    return Boolean(normalized && expectedName && normalized === expectedName);
  });
}

function isUniversalPracticeSet(row: any) {
  const config = row?.generation_config;
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;

  const scope = cleanString(
    config.scope ??
      config.audience ??
      config.visibility_scope ??
      config.department_scope
  ).toLowerCase();

  if (
    scope === "universal" ||
    scope === "university" ||
    scope === "all" ||
    scope === "all_departments" ||
    scope === "cross_department" ||
    scope === "cross-department"
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(config, "department") &&
    (config.department === null || cleanString(config.department).toLowerCase() === "all")
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(config, "department_id") &&
    (config.department_id === null || cleanString(config.department_id).toLowerCase() === "all")
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(config, "departments") &&
    Array.isArray(config.departments) &&
    config.departments.length === 0
  ) {
    return true;
  }

  return false;
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
      const semester = semesterToDb(prefs.semester);
      const buildCourseQuery = (withSemester: boolean) => {
        let query = supabase
          .from("study_courses")
          .select("id,course_code,course_title,level,semester")
          .eq("status", "approved")
          .eq("department_id", prefs.department_id)
          .eq("level", prefs.level)
          .order("course_code", { ascending: true })
          .limit(80);

        if (withSemester && semester) query = query.eq("semester", semester);
        return query;
      };

      let { data: courseRows, error: coursesError } = await buildCourseQuery(Boolean(semester));

      if (!coursesError && semester && Array.isArray(courseRows) && courseRows.length === 0) {
        const fallback = await buildCourseQuery(false);
        courseRows = fallback.data;
        coursesError = fallback.error;
      }

      if (!coursesError && Array.isArray(courseRows)) {
        courses = courseRows
          .filter((course: any) => cleanString(course.course_code))
          .map((course: any) => ({
            id: String(course.id),
            course_code: normalizedCourseCode(course.course_code),
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
          const code = normalizedCourseCode(s.course_code);
          if (code && !existingCodes.has(code) && !seen.has(code)) {
            seen.add(code);
            gnsCourseCodes.push(code);
          }
        }
      }
    }

    // Cross-department practice sets: if a published set is marked as universal
    // in generation_config, include its course code for every matching level and
    // semester. This supports shared 100L courses like PHY 122 without duplicating
    // the same quiz set into every department.
    let universalCourseCodes: string[] = [];
    if (profileStatus === "complete" && prefs && isFiniteLevel(prefs.level)) {
      let universalSetsQuery = supabase
        .from("study_quiz_sets")
        .select("course_code,semester,generation_config")
        .eq("published", true)
        .eq("level", prefs.level);

      const semester = semesterToDb(prefs.semester);
      if (semester) {
        universalSetsQuery = universalSetsQuery.or(`semester.eq.${semester},semester.is.null`);
      }

      const { data: universalSets } = await universalSetsQuery.limit(200);

      if (Array.isArray(universalSets)) {
        const existingCodes = new Set([
          ...courses.map((c) => c.course_code),
          ...gnsCourseCodes,
        ]);
        const seen = new Set<string>();

        for (const set of universalSets) {
          if (!isUniversalPracticeSet(set)) continue;

          const code = normalizedCourseCode((set as any).course_code);
          if (code && !existingCodes.has(code) && !seen.has(code)) {
            seen.add(code);
            universalCourseCodes.push(code);
          }
        }
      }
    }

    // Some useful practice sets are intentionally not registered as current
    // courses because the official course name/code has changed. If their
    // metadata still targets the student's department, include them in For You.
    let metadataCourseCodes: string[] = [];
    if (profileStatus === "complete" && prefs && isFiniteLevel(prefs.level)) {
      let metadataSetsQuery = supabase
        .from("study_quiz_sets")
        .select("course_code,semester,generation_config")
        .eq("published", true)
        .eq("level", prefs.level);

      const semester = semesterToDb(prefs.semester);
      if (semester) {
        metadataSetsQuery = metadataSetsQuery.or(`semester.eq.${semester},semester.is.null`);
      }

      const { data: metadataSets } = await metadataSetsQuery.limit(200);

      if (Array.isArray(metadataSets)) {
        const existingCodes = new Set([
          ...courses.map((c) => c.course_code),
          ...gnsCourseCodes,
          ...universalCourseCodes,
        ]);
        const seen = new Set<string>();

        for (const set of metadataSets) {
          if (!practiceSetTargetsDepartment(set, departmentName, prefs.department_id)) continue;

          const code = normalizedCourseCode((set as any).course_code);
          if (code && !existingCodes.has(code) && !seen.has(code)) {
            seen.add(code);
            metadataCourseCodes.push(code);
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
      courseCodes: [
        ...courses.map((course) => course.course_code),
        ...gnsCourseCodes,
        ...universalCourseCodes,
        ...metadataCourseCodes,
      ],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Could not load personalization" },
      { status: 500 }
    );
  }
}
