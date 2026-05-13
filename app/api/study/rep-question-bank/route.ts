import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { getBankState, jsonError, requireScopedCourse } from "@/lib/repQuestionBank";

export async function GET(req: NextRequest) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const courseId = new URL(req.url).searchParams.get("courseId");
    if (!courseId) return jsonError("Missing courseId.", 400, "MISSING_COURSE_ID");

    await requireScopedCourse(courseId, scope);

    const { data: run, error } = await adminSupabase
      .from("study_question_bank_runs")
      .select("id,status,created_at")
      .eq("course_id", courseId)
      .in("status", ["draft", "ready", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!run?.id) return NextResponse.json({ ok: true, bank: null });

    const bank = await getBankState(String(run.id));
    return NextResponse.json({ ok: true, bank });
  } catch (e: any) {
    return jsonError(e?.message || "Failed to load question bank.", Number(e?.status) || 500, e?.code);
  }
}
