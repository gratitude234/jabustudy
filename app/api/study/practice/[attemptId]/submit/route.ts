import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { awardCappedStudyPoints, STUDY_POINT_RULES } from "@/lib/studyPoints";
import { notifyStreakMilestone, notifyPracticePerfectScore } from "@/lib/studyNotify";
import { getPracticeAccess } from "@/lib/studyBilling";

type SubmitBody = {
  answers?: Record<string, string>;
  writtenAnswers?: Record<string, string>;
  questionIds?: string[];
  reason?: "manual" | "timeup";
  timeSpentSeconds?: number | null;
};

type QuestionRow = {
  id: string;
  set_id: string;
  prompt: string | null;
  question_type: string | null;
  study_quiz_options?: Array<{
    id: string;
    question_id: string;
    is_correct: boolean | null;
  }> | null;
};

type ActivityRow = {
  attempts_count: number | null;
};

type WeakQuestionRow = {
  question_id: string;
  miss_count: number | null;
  correct_streak: number | null;
  last_missed_at: string | null;
};

type AttemptAnswerGradeRow = {
  id: string | null;
  question_id: string | null;
  text_answer: string | null;
  ai_grade_score: number | string | null;
  ai_grade_max_score: number | null;
  ai_grade_verdict: string | null;
  ai_grade_answer_hash: string | null;
  ai_graded_at: string | null;
};

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function watDateFromIso(iso: string) {
  return new Date(new Date(iso).getTime() + 3_600_000).toISOString().slice(0, 10);
}

function cleanRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== "string" || typeof raw !== "string") continue;
    const k = key.trim();
    const v = raw.trim();
    if (k && v) out[k] = v;
  }
  return out;
}

function cleanQuestionIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
}

function isWrittenQuestion(row: QuestionRow) {
  return row.question_type === "short_answer" || row.question_type === "theory";
}

function normalizeAnswerForHash(answer: string) {
  return answer.trim().replace(/\s+/g, " ").toLowerCase();
}

function answerHash(answer: string) {
  return createHash("sha256").update(normalizeAnswerForHash(answer)).digest("hex");
}

function normalizeWrittenScore(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(10, n)) * 10) / 10;
}

function writtenAnswerPracticePoints(score: number) {
  if (score >= 9) return 2;
  if (score >= 7) return 1;
  return 0;
}

function computeNextDue(missCount: number, fromIso: string): string {
  const daysMap: Record<number, number> = { 1: 1, 2: 1 };
  const days = daysMap[missCount] ?? Math.min(Math.pow(2, missCount - 2), 30);
  return new Date(new Date(fromIso).getTime() + days * 86_400_000).toISOString();
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

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return jsonError("Invalid JSON body.", 400, "INVALID_JSON");
  }

  const answers = cleanRecord(body.answers);
  const writtenAnswers = cleanRecord(body.writtenAnswers);
  const submittedQuestionIds = cleanQuestionIds(body.questionIds);
  const submittedIso = new Date().toISOString();
  const admin = createSupabaseAdminClient();

  const { data: attempt, error: attemptError } = await admin
    .from("study_practice_attempts")
    .select("id,user_id,set_id,status,started_at,submitted_at,score,total_questions,scored_questions_count")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) return jsonError(attemptError.message, 500, "DB_ERROR");
  if (!attempt?.id) return jsonError("Attempt not found.", 404, "ATTEMPT_NOT_FOUND");
  if (attempt.user_id !== user.id) return jsonError("You can only submit your own attempt.", 403, "FORBIDDEN");

  if (attempt.status === "submitted") {
    const { data: rankPreview } = await admin
      .from("study_leaderboard_v")
      .select("points,rank")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      attempt,
      pointsAwarded: 0,
      practicePointsAwarded: 0,
      writtenPointsAwarded: 0,
      rankPreview: rankPreview ?? null,
      weakSummary: [],
    });
  }

  const setId = String(attempt.set_id);
  let effectiveQuestionIds = submittedQuestionIds;
  if (effectiveQuestionIds.length === 0) {
    effectiveQuestionIds = Array.from(
      new Set([...Object.keys(answers), ...Object.keys(writtenAnswers)])
    );
  }

  let questionsQuery = admin
    .from("study_quiz_questions")
    .select("id,set_id,prompt,question_type,study_quiz_options(id,question_id,is_correct)")
    .eq("set_id", setId)
    .order("position", { ascending: true });

  if (effectiveQuestionIds.length > 0) {
    questionsQuery = questionsQuery.in("id", effectiveQuestionIds);
  }

  const { data: questionData, error: questionError } = await questionsQuery;
  if (questionError) return jsonError(questionError.message, 500, "QUESTION_LOAD_FAILED");

  const questions = ((questionData ?? []) as QuestionRow[]).filter((row) => row?.id);
  if (questions.length === 0) return jsonError("No questions were found for this attempt.", 400, "NO_QUESTIONS");

  const knownQuestionIds = new Set(questions.map((q) => q.id));
  const requestedIds = effectiveQuestionIds.length > 0 ? effectiveQuestionIds : questions.map((q) => q.id);
  const unknownIds = requestedIds.filter((id) => !knownQuestionIds.has(id));
  if (unknownIds.length > 0) {
    return jsonError("One or more submitted questions do not belong to this attempt.", 400, "INVALID_QUESTION_IDS");
  }

  const orderedQuestions = requestedIds.length > 0
    ? requestedIds.map((id) => questions.find((q) => q.id === id)).filter(Boolean) as QuestionRow[]
    : questions;

  const practiceAccess = await getPracticeAccess(user.id, orderedQuestions.length);
  if (!practiceAccess.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "PRACTICE_LIMIT_REACHED",
        message: "You've used today's free practice questions. Upgrade to keep practicing.",
        practice: {
          limit: practiceAccess.limit,
          used: practiceAccess.used,
          remaining: practiceAccess.remaining,
          activityDate: practiceAccess.activityDate,
        },
      },
      { status: 402 }
    );
  }

  const scoredQuestions = orderedQuestions.filter((q) => !isWrittenQuestion(q));
  const writtenQuestions = orderedQuestions.filter(isWrittenQuestion);
  const writtenAnswered = writtenQuestions.filter((q) => Boolean(writtenAnswers[q.id]?.trim())).length;

  let correct = 0;
  const answerRows: Array<Record<string, unknown>> = [];
  for (const question of scoredQuestions) {
    const selectedOptionId = answers[question.id];
    if (!selectedOptionId) continue;
    const option = (question.study_quiz_options ?? []).find((row) => row.id === selectedOptionId);
    if (!option || option.question_id !== question.id) {
      return jsonError("One or more selected answers are invalid.", 400, "INVALID_ANSWER");
    }
    if (option.is_correct) correct += 1;
    answerRows.push({
      attempt_id: attemptId,
      question_id: question.id,
      selected_option_id: selectedOptionId,
      answered_at: submittedIso,
    });
  }

  for (const question of writtenQuestions) {
    answerRows.push({
      attempt_id: attemptId,
      question_id: question.id,
      text_answer: writtenAnswers[question.id] ?? "",
      answered_at: submittedIso,
    });
  }

  if (answerRows.length > 0) {
    const { error: answersError } = await admin
      .from("study_attempt_answers")
      .upsert(answerRows, { onConflict: "attempt_id,question_id" });
    if (answersError) return jsonError(answersError.message, 500, "ANSWER_SAVE_FAILED");
  }

  const timeSpent = typeof body.timeSpentSeconds === "number" && Number.isFinite(body.timeSpentSeconds)
    ? Math.max(0, Math.round(body.timeSpentSeconds))
    : null;

  const attemptUpdate = {
    status: "submitted",
    submitted_at: submittedIso,
    score: correct,
    total_questions: orderedQuestions.length,
    scored_questions_count: scoredQuestions.length,
    written_questions_count: writtenQuestions.length,
    written_answered_count: writtenAnswered,
    time_spent_seconds: timeSpent,
  };

  const { data: updatedAttempt, error: updateError } = await admin
    .from("study_practice_attempts")
    .update(attemptUpdate)
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .neq("status", "submitted")
    .select("id,user_id,set_id,status,started_at,submitted_at,score,total_questions,scored_questions_count,written_questions_count,written_answered_count,time_spent_seconds")
    .maybeSingle();

  if (updateError) return jsonError(updateError.message, 500, "ATTEMPT_UPDATE_FAILED");
  if (!updatedAttempt?.id) {
    return NextResponse.json({
      ok: true,
      attempt,
      pointsAwarded: 0,
      practicePointsAwarded: 0,
      writtenPointsAwarded: 0,
      rankPreview: null,
      weakSummary: [],
    });
  }

  const pct = scoredQuestions.length > 0 ? (correct / scoredQuestions.length) * 100 : 0;
  const daysAhead = pct >= 80 ? 3 : pct >= 60 ? 2 : 1;
  void admin
    .from("study_quiz_sets")
    .update({ due_at: new Date(Date.now() + daysAhead * 86_400_000).toISOString() })
    .eq("id", setId);

  const activityDate = watDateFromIso(submittedIso);
  const { data: existingActivity } = await admin
    .from("study_daily_activity")
    .select("attempts_count")
    .eq("user_id", user.id)
    .eq("activity_date", activityDate)
    .maybeSingle() as { data: ActivityRow | null; error: unknown };

  await admin.rpc("increment_study_daily_activity", {
    p_user_id: user.id,
    p_activity_date: activityDate,
    p_questions_answered: orderedQuestions.length,
    p_correct_answers: correct,
    p_updated_at: submittedIso,
  });

  // Streak milestone — only check on the first submission of a given day
  if (!existingActivity || (existingActivity.attempts_count ?? 0) === 0) {
    void notifyStreakMilestone({ userId: user.id });
  }

  // Perfect score — only for MCQ-heavy sets (5+ scored questions)
  if (scoredQuestions.length >= 5 && correct === scoredQuestions.length) {
    void notifyPracticePerfectScore({ userId: user.id, setId, score: correct });
  }

  const rawPracticePoints = correct + STUDY_POINT_RULES.practiceCompletion;
  const practicePointsAwarded = await awardCappedStudyPoints({
    userId: user.id,
    eventType: "practice_attempt_scored",
    sourceTable: "study_practice_attempts",
    sourceId: attemptId,
    points: rawPracticePoints,
    dailyCap: STUDY_POINT_RULES.practiceDailyCap,
    occurredAt: submittedIso,
    metadata: {
      setId,
      correct,
      scoredQuestions: scoredQuestions.length,
      completionBonus: STUDY_POINT_RULES.practiceCompletion,
      reason: body.reason ?? "manual",
    },
  });

  let writtenPointsAwarded = 0;
  const writtenQuestionIds = writtenQuestions.map((q) => q.id);
  if (writtenQuestionIds.length > 0) {
    const { data: writtenAnswerRows, error: writtenRowsError } = await admin
      .from("study_attempt_answers")
      .select("id,question_id,text_answer,ai_grade_score,ai_grade_max_score,ai_grade_verdict,ai_grade_answer_hash,ai_graded_at")
      .eq("attempt_id", attemptId)
      .in("question_id", writtenQuestionIds);

    if (writtenRowsError) {
      console.warn("[practice submit] written point award skipped:", writtenRowsError.message);
    } else {
      for (const row of (writtenAnswerRows ?? []) as AttemptAnswerGradeRow[]) {
        const questionId = row.question_id ? String(row.question_id) : "";
        const submittedAnswer = writtenAnswers[questionId]?.trim() ?? "";
        if (!row.id || !questionId || !submittedAnswer || !row.ai_graded_at || row.ai_grade_score == null) {
          continue;
        }

        const savedHash = row.ai_grade_answer_hash?.trim();
        if (savedHash && savedHash !== answerHash(submittedAnswer)) {
          continue;
        }

        const score = normalizeWrittenScore(row.ai_grade_score);
        const points = writtenAnswerPracticePoints(score);
        if (points <= 0) continue;

        writtenPointsAwarded += await awardCappedStudyPoints({
          userId: user.id,
          eventType: "practice_attempt_scored",
          sourceTable: "study_attempt_answers",
          sourceId: row.id,
          points,
          dailyCap: STUDY_POINT_RULES.practiceDailyCap,
          occurredAt: submittedIso,
          metadata: {
            kind: "written_answer_grade",
            setId,
            attemptId,
            questionId,
            score,
            maxScore: row.ai_grade_max_score ?? 10,
            verdict: row.ai_grade_verdict,
            rule: "score>=9:+2, score>=7:+1",
          },
        });
      }
    }
  }

  const pointsAwarded = practicePointsAwarded + writtenPointsAwarded;

  const weakSummary: Array<{
    questionId: string;
    prompt: string;
    missCount: number;
    nextDueAt: string;
    wasCorrect: boolean;
    reviewReason?: "missed";
  }> = [];

  try {
    const questionIds = scoredQuestions.map((q) => q.id);
    const { data: existingRows } = questionIds.length
      ? await admin
          .from("study_weak_questions")
          .select("question_id,miss_count,correct_streak,last_missed_at")
          .eq("user_id", user.id)
          .in("question_id", questionIds)
      : { data: [] as WeakQuestionRow[] };

    const existingMap = new Map<string, { miss_count: number; correct_streak: number; last_missed_at: string | null }>();
    for (const row of (existingRows ?? []) as WeakQuestionRow[]) {
      existingMap.set(String(row.question_id), {
        miss_count: Number(row.miss_count ?? 0),
        correct_streak: Number(row.correct_streak ?? 0),
        last_missed_at: row.last_missed_at ?? null,
      });
    }

    const srsUpserts: Array<Record<string, unknown>> = [];
    for (const question of scoredQuestions) {
      const selectedOptionId = answers[question.id];
      const option = selectedOptionId
        ? (question.study_quiz_options ?? []).find((row) => row.id === selectedOptionId)
        : null;
      const isCorrect = Boolean(option?.is_correct);
      const existing = existingMap.get(question.id);

      if (isCorrect && !existing) {
        weakSummary.push({
          questionId: question.id,
          prompt: question.prompt ?? "",
          missCount: 0,
          nextDueAt: "",
          wasCorrect: true,
        });
        continue;
      }

      if (isCorrect && existing) {
        const newStreak = existing.correct_streak + 1;
        const graduated = newStreak >= 3;
        srsUpserts.push({
          user_id: user.id,
          question_id: question.id,
          miss_count: existing.miss_count,
          last_missed_at: existing.last_missed_at,
          next_due_at: computeNextDue(existing.miss_count, submittedIso),
          correct_streak: newStreak,
          graduated_at: graduated ? submittedIso : null,
          updated_at: submittedIso,
        });
        weakSummary.push({
          questionId: question.id,
          prompt: question.prompt ?? "",
          missCount: existing.miss_count,
          nextDueAt: "",
          wasCorrect: true,
        });
        continue;
      }

      const newMiss = (existing?.miss_count ?? 0) + 1;
      const nextDueAt = computeNextDue(newMiss, submittedIso);
      srsUpserts.push({
        user_id: user.id,
        question_id: question.id,
        miss_count: newMiss,
        last_missed_at: submittedIso,
        next_due_at: nextDueAt,
        correct_streak: 0,
        graduated_at: null,
        updated_at: submittedIso,
      });
      weakSummary.push({
        questionId: question.id,
        prompt: question.prompt ?? "",
        missCount: newMiss,
        nextDueAt,
        wasCorrect: false,
        reviewReason: "missed",
      });
    }

    if (srsUpserts.length > 0) {
      await admin.from("study_weak_questions").upsert(srsUpserts, { onConflict: "user_id,question_id" });
    }
  } catch (error) {
    console.warn("[practice submit] SRS update skipped:", error instanceof Error ? error.message : error);
  }

  const { data: rankPreview } = await admin
    .from("study_leaderboard_v")
    .select("points,rank")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    attempt: updatedAttempt,
    pointsAwarded,
    practicePointsAwarded,
    writtenPointsAwarded,
    rankPreview: rankPreview ?? null,
    weakSummary: weakSummary.filter((row) => row.reviewReason || row.missCount > 0),
  });
}
