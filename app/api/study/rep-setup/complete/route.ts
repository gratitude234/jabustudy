import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModerator } from "@/lib/studyAdmin/requireStudyModerator";

export async function POST() {
  try {
    const { userId, scope } = await requireStudyModerator();

    const { role, departmentId, levels } = scope;

    if (!departmentId) {
      return NextResponse.json({ ok: false, code: "SCOPE_MISSING", error: "No department scope." }, { status: 403 });
    }

    if (role !== "course_rep") {
      // dept_librarians are always considered done — just mark and return
      const admin = createSupabaseAdminClient();
      await admin.from("study_reps").update({ courses_setup_done: true }).eq("user_id", userId);
      return NextResponse.json({ ok: true });
    }

    if (!levels || levels.length === 0) {
      return NextResponse.json({ ok: false, code: "NO_LEVELS", error: "No levels in your scope." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Verify each level has at least one course
    const { data: courses, error: coursesErr } = await admin
      .from("study_courses")
      .select("level")
      .eq("department_id", departmentId)
      .in("level", levels);

    if (coursesErr) throw coursesErr;

    const coveredLevels = new Set((courses ?? []).map((c) => c.level));
    const missingLevels = levels.filter((l) => !coveredLevels.has(l));

    if (missingLevels.length > 0) {
      const labels = missingLevels.map((l) => `${l} Level`).join(", ");
      return NextResponse.json(
        { ok: false, code: "LEVELS_INCOMPLETE", error: `Add at least one course for: ${labels}`, missingLevels },
        { status: 422 }
      );
    }

    const { error: updateErr } = await admin
      .from("study_reps")
      .update({ courses_setup_done: true })
      .eq("user_id", userId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status });
  }
}
