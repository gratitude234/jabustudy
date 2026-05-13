import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { getBankState, jsonError, requireScopedCourse } from "@/lib/repQuestionBank";

export async function POST(
  req: NextRequest,
  { params }: { params: { runId: string } | Promise<{ runId: string }> }
) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const { runId } = await params;
    if (!runId) return jsonError("Missing runId.", 400, "MISSING_RUN_ID");

    const { data: run, error: runErr } = await adminSupabase
      .from("study_question_bank_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (runErr) throw runErr;
    if (!run) return jsonError("Question bank run not found.", 404, "RUN_NOT_FOUND");

    await requireScopedCourse(String((run as any).course_id), scope);

    const { count } = await adminSupabase
      .from("study_quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("set_id", (run as any).quiz_set_id);

    if ((count ?? 0) <= 0) {
      return jsonError("Generate at least one question before publishing.", 422, "EMPTY_SET");
    }

    const now = new Date().toISOString();
    const [{ error: setErr }, { error: runUpdateErr }] = await Promise.all([
      adminSupabase
        .from("study_quiz_sets")
        .update({ published: true, visibility: "public", questions_count: count })
        .eq("id", (run as any).quiz_set_id),
      adminSupabase
        .from("study_question_bank_runs")
        .update({ status: "completed", updated_at: now })
        .eq("id", runId),
    ]);

    if (setErr) throw setErr;
    if (runUpdateErr) throw runUpdateErr;

    return NextResponse.json({ ok: true, bank: await getBankState(runId) });
  } catch (e: any) {
    return jsonError(e?.message || "Failed to publish question bank.", Number(e?.status) || 500, e?.code);
  }
}
