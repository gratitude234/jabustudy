import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { awardCappedStudyPoints, STUDY_POINT_RULES } from "@/lib/studyPoints";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId: rawAttemptId } = await params;
  const attemptId = rawAttemptId?.trim();
  if (!attemptId) return jsonError("Missing attempt id.", 400, "MISSING_ATTEMPT_ID");

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return jsonError("Sign in first.", 401, "UNAUTHORIZED");

  let body: { questionId?: unknown; selectedOptionId?: unknown };
  try {
    body = (await req.json()) as { questionId?: unknown; selectedOptionId?: unknown };
  } catch {
    return jsonError("Invalid JSON body.", 400, "INVALID_JSON");
  }

  const questionId = typeof body.questionId === "string" ? body.questionId.trim() : "";
  const selectedOptionId = typeof body.selectedOptionId === "string" ? body.selectedOptionId.trim() : "";
  if (!questionId || !selectedOptionId) {
    return jsonError("questionId and selectedOptionId are required.", 400, "MISSING_FIELDS");
  }

  const admin = createSupabaseAdminClient();

  const { data: attempt, error: attemptError } = await admin
    .from("study_practice_attempts")
    .select("id, user_id, set_id, status, experience")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError || !attempt) return jsonError("Attempt not found.", 404, "NOT_FOUND");
  if (attempt.user_id !== user.id) return jsonError("Forbidden.", 403, "FORBIDDEN");
  if ((attempt.experience ?? "practice") !== "practice") {
    return jsonError("Exam Sprint answers must use the exam response endpoint.", 400, "INVALID_ATTEMPT_TYPE");
  }
  if (attempt.status !== "in_progress") return jsonError("Attempt is not in progress.", 409, "NOT_IN_PROGRESS");

  const { data: question, error: questionError } = await admin
    .from("study_quiz_questions")
    .select("id")
    .eq("id", questionId)
    .eq("set_id", attempt.set_id)
    .maybeSingle();
  if (questionError || !question) {
    return jsonError("Question not found in this practice set.", 400, "INVALID_QUESTION");
  }

  const { data: quizSet } = await admin
    .from("study_quiz_sets")
    .select("delivery_mode")
    .eq("id", attempt.set_id)
    .maybeSingle();
  if (quizSet?.delivery_mode === "mock_exam") {
    return jsonError("Exam Sprint answers must use the exam response endpoint.", 400, "INVALID_ATTEMPT_TYPE");
  }

  const { data: option, error: optionError } = await admin
    .from("study_quiz_options")
    .select("id, is_correct")
    .eq("id", selectedOptionId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (optionError || !option) {
    return jsonError("Option not found for this question.", 400, "INVALID_OPTION");
  }

  const { data: answerRow, error: upsertError } = await admin
    .from("study_attempt_answers")
    .upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        selected_option_id: selectedOptionId,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id,question_id" }
    )
    .select("id")
    .single();

  if (upsertError || !answerRow?.id) {
    return jsonError("Failed to save answer.", 500, "UPSERT_FAILED");
  }

  const answeredAt = new Date().toISOString();
  await admin
    .from("study_practice_attempts")
    .update({ updated_at: answeredAt })
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .eq("status", "in_progress");

  let pointAwarded = 0;
  if (option.is_correct) {
    pointAwarded = await awardCappedStudyPoints({
      userId: user.id,
      eventType: "practice_question_correct",
      sourceTable: "study_attempt_answers",
      sourceId: String(answerRow.id),
      points: 1,
      dailyCap: STUDY_POINT_RULES.practiceDailyCap,
      metadata: { attemptId, questionId },
    });
  }

  return NextResponse.json({ ok: true, pointAwarded });
}
