import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { assertQuizSetNotDuplicateForCourse, duplicateGateErrorResponse } from "@/lib/studyDuplicateGate";
import { EXAM_BANK_MINIMUM, EXAM_CAMPAIGN_KEY, findExamCourse } from "@/lib/examSprint/config";

function errorResponse(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  if (value.code === "DUPLICATE_QUESTION") {
    return NextResponse.json(duplicateGateErrorResponse(error), { status: Number(value.status) || 422 });
  }
  return NextResponse.json({ ok: false, code: value.code || "EXAM_PUBLISH_FAILED", message: value.message || "Could not update publication." }, { status: Number(value.status) || 500 });
}

function httpError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  try {
    const auth = await requireStudyModeratorFromRequest(req);
    if (!auth.isSuper) throw httpError("Only a super study admin can publish paid exam content.", 403, "SUPER_ADMIN_REQUIRED");
    const { setId } = await params;
    const body = await req.json().catch(() => ({})) as { action?: unknown };
    const action = body.action === "unpublish" ? "unpublish" : "publish";
    const { data: set, error: setError } = await adminSupabase
      .from("study_quiz_sets")
      .select("id,title,course_code,delivery_mode,exam_campaign_key,time_limit_minutes")
      .eq("id", setId)
      .maybeSingle();
    if (setError) throw setError;
    if (!set || set.delivery_mode !== "mock_exam" || set.exam_campaign_key !== EXAM_CAMPAIGN_KEY) {
      throw httpError("Exam Sprint set not found.", 404, "EXAM_SET_NOT_FOUND");
    }
    if (!findExamCourse(set.course_code)) throw httpError("This set does not match the campaign timetable.", 422, "UNKNOWN_EXAM_COURSE");

    if (action === "unpublish") {
      const { error } = await adminSupabase.from("study_quiz_sets").update({ published: false, visibility: "private" }).eq("id", setId);
      if (error) throw error;
      return NextResponse.json({ ok: true, published: false });
    }

    const { data: questions, error: questionError } = await adminSupabase
      .from("study_quiz_questions")
      .select("id,prompt,explanation,question_type,exam_verified_at,ai_generated,source_chunk_id,study_ref,study_quiz_options(id,text,is_correct)")
      .eq("set_id", setId);
    if (questionError) throw questionError;
    if ((questions ?? []).length < EXAM_BANK_MINIMUM) {
      throw httpError(`Add at least ${EXAM_BANK_MINIMUM} questions before publishing.`, 422, "EXAM_BANK_TOO_SMALL");
    }
    for (const [index, question] of (questions ?? []).entries()) {
      const options = Array.isArray(question.study_quiz_options) ? question.study_quiz_options : [];
      const distinct = new Set(options.map((option) => String(option.text ?? "").trim().toLowerCase()).filter(Boolean));
      const sourceRef = question.study_ref && typeof question.study_ref === "object" ? question.study_ref as Record<string, unknown> : null;
      if (question.question_type !== "mcq") throw httpError(`Question ${index + 1} is not an MCQ.`, 422, "WRITTEN_QUESTION_NOT_ALLOWED");
      if (!String(question.prompt ?? "").trim() || !String(question.explanation ?? "").trim()) throw httpError(`Question ${index + 1} needs a prompt and explanation.`, 422, "INCOMPLETE_QUESTION");
      if (options.length !== 4 || distinct.size !== 4 || options.filter((option) => option.is_correct).length !== 1) throw httpError(`Question ${index + 1} must have four distinct options and one correct answer.`, 422, "INVALID_OPTIONS");
      if (!question.exam_verified_at) throw httpError(`Question ${index + 1} has not been human-verified.`, 422, "UNVERIFIED_QUESTION");
      if (question.ai_generated && !question.source_chunk_id && !sourceRef?.chunkId) throw httpError(`AI question ${index + 1} has no verified source.`, 422, "UNGROUNDED_AI_QUESTION");
    }
    if (!Number(set.time_limit_minutes) || Number(set.time_limit_minutes) <= 0) throw httpError("Set a valid mock time limit.", 422, "INVALID_TIME_LIMIT");
    await assertQuizSetNotDuplicateForCourse(setId);
    const now = new Date().toISOString();
    const { error } = await adminSupabase
      .from("study_quiz_sets")
      .update({ published: true, visibility: "public", access_tier: "plus_monthly", questions_count: questions!.length, exam_published_by: auth.userId, exam_published_at: now, updated_at: now })
      .eq("id", setId);
    if (error) throw error;
    return NextResponse.json({ ok: true, published: true });
  } catch (error) {
    return errorResponse(error);
  }
}
