import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModerator } from "@/lib/studyAdmin/requireStudyModerator";

export async function GET() {
  try {
    const { scope } = await requireStudyModerator();

    const departmentId = scope.departmentId;
    const levels = scope.levels;

    if (!departmentId) {
      return NextResponse.json({ ok: false, code: "SCOPE_MISSING", error: "No department scope." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("study_courses")
      .select("id, course_code, course_title, level, semester")
      .eq("department_id", departmentId)
      .order("level", { ascending: true })
      .order("semester", { ascending: true })
      .order("course_code", { ascending: true });

    if (levels && levels.length > 0) {
      query = query.in("level", levels);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, courses: data ?? [] });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status });
  }
}
