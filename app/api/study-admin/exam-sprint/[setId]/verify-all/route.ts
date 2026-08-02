import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { EXAM_CAMPAIGN_KEY } from "@/lib/examSprint/config";

function httpError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  try {
    const auth = await requireStudyModeratorFromRequest(req);
    if (!auth.isSuper) throw httpError("Only a super admin can bulk-verify paid exam questions.", 403, "SUPER_ADMIN_REQUIRED");

    const body = await req.json().catch(() => ({})) as { confirmed?: unknown };
    if (body.confirmed !== true) {
      throw httpError("Confirm that you reviewed the complete bank before bulk verification.", 400, "REVIEW_CONFIRMATION_REQUIRED");
    }

    const { setId } = await params;
    const { data: set, error: setError } = await adminSupabase
      .from("study_quiz_sets")
      .select("id,title,delivery_mode,exam_campaign_key")
      .eq("id", setId)
      .maybeSingle();
    if (setError) throw setError;
    if (!set || set.delivery_mode !== "mock_exam" || set.exam_campaign_key !== EXAM_CAMPAIGN_KEY) {
      throw httpError("Exam Sprint bank not found.", 404, "EXAM_SET_NOT_FOUND");
    }

    const { data: questions, error: questionError } = await adminSupabase
      .from("study_quiz_questions")
      .select("id,prompt,explanation,question_type,study_quiz_options(id,text,is_correct)")
      .eq("set_id", setId)
      .order("position", { ascending: true });
    if (questionError) throw questionError;
    if (!questions?.length) throw httpError("Add questions before verifying this bank.", 422, "EMPTY_EXAM_BANK");

    for (const [index, question] of questions.entries()) {
      const options = Array.isArray(question.study_quiz_options) ? question.study_quiz_options : [];
      const distinct = new Set(options.map((option) => String(option.text ?? "").trim().toLowerCase()).filter(Boolean));
      if (question.question_type !== "mcq") {
        throw httpError(`Question ${index + 1} is not an MCQ.`, 422, "WRITTEN_QUESTION_NOT_ALLOWED");
      }
      if (!String(question.prompt ?? "").trim() || !String(question.explanation ?? "").trim()) {
        throw httpError(`Question ${index + 1} needs a prompt and explanation.`, 422, "INCOMPLETE_QUESTION");
      }
      if (options.length !== 4 || distinct.size !== 4 || options.filter((option) => option.is_correct).length !== 1) {
        throw httpError(`Question ${index + 1} must have four distinct options and exactly one correct answer.`, 422, "INVALID_OPTIONS");
      }
    }

    const verifiedAt = new Date().toISOString();
    const { data: verified, error: updateError } = await adminSupabase
      .from("study_quiz_questions")
      .update({ exam_verified_by: auth.userId, exam_verified_at: verifiedAt })
      .eq("set_id", setId)
      .select("id");
    if (updateError) throw updateError;
    if ((verified ?? []).length !== questions.length) {
      throw httpError("Not every question was updated. No publication change was made.", 500, "BULK_VERIFY_INCOMPLETE");
    }

    return NextResponse.json({ ok: true, verifiedAt, verifiedCount: verified!.length });
  } catch (error) {
    const value = error as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: value.code || "BULK_VERIFY_FAILED", message: value.message || "Could not bulk-verify this exam bank." },
      { status: Number(value.status) || 500 },
    );
  }
}
