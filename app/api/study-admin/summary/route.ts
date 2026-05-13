import { NextResponse } from "next/server";
import { requireStudyModeratorFromRequest } from "../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const SETUP_LEVELS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const SETUP_SEMESTERS = ["first", "second", "summer"] as const;

export async function GET(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const admin = createSupabaseAdminClient();

    // Pending course requests
    let reqQuery = admin
      .from("study_course_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    // Non-super moderators are scoped (department is required by our auth layer)
    if (scope.role !== "super") {
      if (scope.departmentId) reqQuery = reqQuery.eq("department_id", scope.departmentId);
      if (scope.facultyId) reqQuery = reqQuery.eq("faculty_id", scope.facultyId);
    }
    const { count: pendingRequests, error: reqErr } = await reqQuery;
    if (reqErr) throw reqErr;

    // Pending materials (approved=false)
    // Scope via inner join to course.
    let matQuery = admin
      .from("study_materials")
      .select("id, study_courses!inner(id, faculty_id, department_id)", { count: "exact", head: true })
      .eq("approved", false);

    if (scope.role !== "super") {
      if (scope.departmentId) matQuery = matQuery.eq("study_courses.department_id", scope.departmentId);
      if (scope.facultyId) matQuery = matQuery.eq("study_courses.faculty_id", scope.facultyId);
    }

    const { count: pendingMaterials, error: matErr } = await matQuery;
    if (matErr) throw matErr;

    let courseSetup: Array<{
      facultyId: string | null;
      departmentId: string | null;
      level: number;
      semester: string;
      courseCount: number;
      status: "in_progress" | "complete";
      completedAt: string | null;
    }> = [];

    if (scope.role !== "super" && scope.departmentId) {
      const levels =
        scope.role === "course_rep"
          ? scope.levels ?? []
          : SETUP_LEVELS;

      if (levels.length > 0) {
        const [{ data: courses, error: courseErr }, { data: setupRows, error: setupErr }] =
          await Promise.all([
            admin
              .from("study_courses")
              .select("id, faculty_id, department_id, level, semester")
              .eq("department_id", scope.departmentId)
              .in("level", levels)
              .eq("status", "approved"),
            admin
              .from("study_course_setup_status")
              .select("faculty_id, department_id, level, semester, status, completed_at")
              .eq("department_id", scope.departmentId)
              .in("level", levels),
          ]);
        if (courseErr) throw courseErr;
        if (setupErr) throw setupErr;

        const countByKey = new Map<string, number>();
        const facultyByKey = new Map<string, string | null>();
        for (const course of (courses ?? []) as any[]) {
          const key = `${course.level}:${course.semester}`;
          countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
          if (!facultyByKey.has(key)) facultyByKey.set(key, course.faculty_id ?? scope.facultyId ?? null);
        }

        const setupByKey = new Map<string, any>();
        for (const row of (setupRows ?? []) as any[]) {
          setupByKey.set(`${row.level}:${row.semester}`, row);
        }

        courseSetup = levels.flatMap((level) =>
          SETUP_SEMESTERS.map((semester) => {
            const key = `${level}:${semester}`;
            const setup = setupByKey.get(key);
            return {
              facultyId: setup?.faculty_id ?? facultyByKey.get(key) ?? scope.facultyId ?? null,
              departmentId: scope.departmentId,
              level,
              semester,
              courseCount: countByKey.get(key) ?? 0,
              status: setup?.status === "complete" ? "complete" : "in_progress",
              completedAt: setup?.completed_at ?? null,
            };
          })
        );
      }
    }

    return NextResponse.json({
      scope,
      pendingMaterials: pendingMaterials ?? 0,
      pendingRequests: pendingRequests ?? 0,
      courseSetup,
    });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
