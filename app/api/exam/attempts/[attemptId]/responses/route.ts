import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  attemptExpired,
  examHttpError,
  finalizeExamAttempt,
  getOwnedExamAttempt,
  parseExamSnapshot,
} from "@/lib/examSprint/server";
import { requireExamDeviceSession } from "@/lib/examSprint/deviceSession";

function jsonError(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: value.code || "ANSWER_SAVE_FAILED", message: value.message || "Could not save this response." },
    { status: Number(value.status) || 500 },
  );
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw examHttpError("Sign in to continue.", 401, "UNAUTHORIZED");
    await requireExamDeviceSession(req, user.id);
    const { attemptId } = await params;
    const attempt = await getOwnedExamAttempt(user.id, attemptId);
    if (attempt.status !== "in_progress") throw examHttpError("This attempt has been submitted.", 409, "ATTEMPT_SUBMITTED");
    if (attemptExpired(attempt)) {
      await finalizeExamAttempt(attempt, "timeup");
      throw examHttpError("Time is up. Your saved answers were submitted.", 409, "ATTEMPT_EXPIRED");
    }

    const body = await req.json().catch(() => null) as {
      questionId?: unknown;
      selectedOptionId?: unknown;
      flagged?: unknown;
    } | null;
    const questionId = typeof body?.questionId === "string" ? body.questionId.trim() : "";
    if (!questionId) throw examHttpError("questionId is required.", 400, "INVALID_REQUEST");
    const snapshot = parseExamSnapshot(attempt.delivery_snapshot);
    const question = snapshot.questions.find((item) => item.id === questionId);
    if (!question) throw examHttpError("This question is not part of the attempt.", 400, "INVALID_QUESTION");

    const hasSelected = Object.prototype.hasOwnProperty.call(body ?? {}, "selectedOptionId");
    const requestedOptionId = typeof body?.selectedOptionId === "string" ? body.selectedOptionId.trim() : null;
    if (hasSelected && requestedOptionId && !question.options.some((option) => option.id === requestedOptionId)) {
      throw examHttpError("This option is not valid for the question.", 400, "INVALID_OPTION");
    }
    const hasFlag = typeof body?.flagged === "boolean";
    if (!hasSelected && !hasFlag) throw examHttpError("No response change was provided.", 400, "INVALID_REQUEST");

    const { data: existing, error: existingError } = await adminSupabase
      .from("study_attempt_answers")
      .select("selected_option_id,flagged")
      .eq("attempt_id", attempt.id)
      .eq("question_id", questionId)
      .maybeSingle();
    if (existingError) throw examHttpError(existingError.message, 500, "ANSWER_LOAD_FAILED");

    const savedAt = new Date().toISOString();
    const { error: saveError } = await adminSupabase
      .from("study_attempt_answers")
      .upsert({
        attempt_id: attempt.id,
        question_id: questionId,
        selected_option_id: hasSelected ? requestedOptionId : existing?.selected_option_id ?? null,
        flagged: hasFlag ? body!.flagged : Boolean(existing?.flagged),
        answered_at: savedAt,
      }, { onConflict: "attempt_id,question_id" });
    if (saveError?.message.includes("ATTEMPT_CLOSED")) {
      const latest = await getOwnedExamAttempt(user.id, attempt.id);
      if (latest.status === "in_progress") await finalizeExamAttempt(latest, "timeup");
      throw examHttpError("Time is up. Your saved answers were submitted.", 409, "ATTEMPT_EXPIRED");
    }
    if (saveError) throw examHttpError(saveError.message, 500, "ANSWER_SAVE_FAILED");
    await adminSupabase
      .from("study_practice_attempts")
      .update({ updated_at: savedAt })
      .eq("id", attempt.id)
      .eq("status", "in_progress");

    return NextResponse.json({ ok: true, savedAt });
  } catch (error) {
    return jsonError(error);
  }
}
