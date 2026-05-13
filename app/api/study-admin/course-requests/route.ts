import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../lib/studyAdmin/requireStudyModeratorFromRequest";

export async function GET(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "pending") as
      | "pending"
      | "approved"
      | "rejected"
      | "all";
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(100, Math.max(5, Number(url.searchParams.get("limit") || 30)));

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("study_course_requests")
      .select(
        [
          "id",
          "created_at",
          "updated_at",
          "faculty",
          "department",
          "faculty_id",
          "department_id",
          "level",
          "semester",
          "course_code",
          "course_title",
          "status",
          "admin_note",
          "user_id",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") query = query.eq("status", status);

    // Non-super moderators are scoped (department is required by auth layer).
    if (scope.role !== "super") {
      if (scope.departmentId) query = query.eq("department_id", scope.departmentId);
      if (scope.facultyId) query = query.eq("faculty_id", scope.facultyId);

      // Only course reps are level-scoped; dept librarians see all levels.
      if (scope.role === "course_rep" && scope.levels && scope.levels.length) {
        query = query.in("level", scope.levels);
      }
    }

    if (q) {
      const like = `%${q.replace(/%/g, "").replace(/_/g, "").toLowerCase()}%`;
      query = query.or(`course_code.ilike.${like},course_title.ilike.${like},department.ilike.${like}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
