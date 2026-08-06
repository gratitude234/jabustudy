import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  attemptExpired,
  attemptKind,
  examHttpError,
  finalizeExamAttempt,
  getOwnedExamAttempt,
  parseExamSnapshot,
} from "@/lib/examSprint/server";
import { requireExamDeviceSession } from "@/lib/examSprint/deviceSession";

function jsonError(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: value.code || "ATTEMPT_LOAD_FAILED", message: value.message || "Could not load this attempt." },
    { status: Number(value.status) || 500 },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw examHttpError("Sign in to continue.", 401, "UNAUTHORIZED");
    await requireExamDeviceSession(req, user.id);
    const { attemptId } = await params;
    let attempt = await getOwnedExamAttempt(user.id, attemptId);
    if (attempt.status === "in_progress" && attemptExpired(attempt)) {
      attempt = await finalizeExamAttempt(attempt, "timeup");
    }
    if (attempt.status === "submitted") {
      return NextResponse.json({
        ok: false,
        code: "ATTEMPT_SUBMITTED",
        message: "This attempt has been submitted.",
        resultUrl: `/exam/result/${encodeURIComponent(attempt.id)}`,
      }, { status: 409 });
    }
    if (attempt.status !== "in_progress") throw examHttpError("This attempt is no longer active.", 409, "ATTEMPT_SUBMITTED");

    const snapshot = parseExamSnapshot(attempt.delivery_snapshot);
    const { data: rows, error } = await adminSupabase
      .from("study_attempt_answers")
      .select("question_id,selected_option_id,flagged,answered_at")
      .eq("attempt_id", attempt.id);
    if (error) throw examHttpError(error.message, 500, "ANSWER_LOAD_FAILED");
    const responses = Object.fromEntries((rows ?? []).map((row) => [String(row.question_id), {
      selectedOptionId: row.selected_option_id ? String(row.selected_option_id) : null,
      flagged: Boolean(row.flagged),
      savedAt: row.answered_at,
    }]));

    return NextResponse.json({
      ok: true,
      attempt: {
        id: attempt.id,
        setId: snapshot.setId,
        setTitle: snapshot.setTitle,
        courseCode: snapshot.courseCode,
        kind: attemptKind(attempt.experience),
        startedAt: attempt.started_at,
        deadlineAt: attempt.deadline_at,
        questions: snapshot.questions.map((question, index) => ({
          id: question.id,
          position: index + 1,
          prompt: question.prompt,
          options: question.options,
        })),
        responses,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
