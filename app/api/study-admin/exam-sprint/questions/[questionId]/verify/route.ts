import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { EXAM_CAMPAIGN_KEY } from "@/lib/examSprint/config";

export async function POST(req: NextRequest, { params }: { params: Promise<{ questionId: string }> }) {
  try {
    const auth = await requireStudyModeratorFromRequest(req);
    if (!auth.isSuper) return NextResponse.json({ ok: false, code: "SUPER_ADMIN_REQUIRED", message: "Only a super admin can verify paid exam questions." }, { status: 403 });
    const { questionId } = await params;
    const { data: question, error } = await adminSupabase
      .from("study_quiz_questions")
      .select("id,prompt,explanation,question_type,study_quiz_options(id,text,is_correct),study_quiz_sets!inner(delivery_mode,exam_campaign_key)")
      .eq("id", questionId)
      .maybeSingle();
    if (error) throw error;
    const set = question?.study_quiz_sets as unknown as { delivery_mode?: string; exam_campaign_key?: string } | null;
    if (!question || set?.delivery_mode !== "mock_exam" || set.exam_campaign_key !== EXAM_CAMPAIGN_KEY) return NextResponse.json({ ok: false, code: "QUESTION_NOT_FOUND", message: "Exam question not found." }, { status: 404 });
    const options = Array.isArray(question.study_quiz_options) ? question.study_quiz_options : [];
    const distinct = new Set(options.map((option) => String(option.text ?? "").trim().toLowerCase()).filter(Boolean));
    if (question.question_type !== "mcq" || !String(question.prompt ?? "").trim() || !String(question.explanation ?? "").trim() || options.length !== 4 || distinct.size !== 4 || options.filter((option) => option.is_correct).length !== 1) {
      return NextResponse.json({ ok: false, code: "QUESTION_NOT_READY", message: "Save a prompt, explanation, four distinct options and exactly one correct answer first." }, { status: 422 });
    }
    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await adminSupabase.from("study_quiz_questions").update({ exam_verified_by: auth.userId, exam_verified_at: verifiedAt }).eq("id", questionId);
    if (updateError) throw updateError;
    return NextResponse.json({ ok: true, verifiedAt });
  } catch (error) {
    const value = error as { message?: string; status?: number; code?: string };
    return NextResponse.json({ ok: false, code: value.code || "VERIFY_FAILED", message: value.message || "Could not verify this question." }, { status: Number(value.status) || 500 });
  }
}
