import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateJson, userMessage } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WrittenAnswerGrade, WrittenAnswerGradeVerdict } from "@/lib/types";

export const maxDuration = 60;

type RawGrade = {
  score?: unknown;
  maxScore?: unknown;
  verdict?: unknown;
  feedback?: unknown;
  matchedPoints?: unknown;
  missingPoints?: unknown;
  improvedAnswer?: unknown;
};

const MAX_SCORE = 10;
const VERDICTS = new Set<WrittenAnswerGradeVerdict>([
  "correct",
  "mostly_correct",
  "partially_correct",
  "incorrect",
  "unanswered",
]);

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function cleanString(value: unknown, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanArray(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, 500))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeAnswerForHash(answer: string) {
  return answer.trim().replace(/\s+/g, " ").toLowerCase();
}

function answerHash(answer: string) {
  return createHash("sha256").update(normalizeAnswerForHash(answer)).digest("hex");
}

function normalizeScore(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(MAX_SCORE, n)) * 10) / 10;
}

function normalizeVerdict(value: unknown, score: number): WrittenAnswerGradeVerdict {
  if (typeof value === "string" && VERDICTS.has(value as WrittenAnswerGradeVerdict)) {
    return value as WrittenAnswerGradeVerdict;
  }
  if (score >= 9) return "correct";
  if (score >= 7) return "mostly_correct";
  if (score >= 4) return "partially_correct";
  return "incorrect";
}

function gradeFromRow(row: Record<string, any>): WrittenAnswerGrade | null {
  const score = normalizeScore(row.ai_grade_score);
  const gradedAt = cleanString(row.ai_graded_at, 80);
  const feedback = cleanString(row.ai_grade_feedback, 3000);
  if (!gradedAt || !feedback || row.ai_grade_score == null) return null;

  return {
    score,
    maxScore: Number(row.ai_grade_max_score) || MAX_SCORE,
    verdict: normalizeVerdict(row.ai_grade_verdict, score),
    feedback,
    matchedPoints: cleanArray(row.ai_grade_matched_points),
    missingPoints: cleanArray(row.ai_grade_missing_points),
    improvedAnswer: cleanString(row.ai_grade_improved_answer, 3000) || null,
    gradedAt,
    provider: cleanString(row.ai_grade_provider, 80) || null,
    model: cleanString(row.ai_grade_model, 120) || null,
  };
}

function normalizeGrade(raw: RawGrade, provider: string | undefined, model: string | undefined): WrittenAnswerGrade | null {
  const score = normalizeScore(raw.score);
  const feedback = cleanString(raw.feedback, 3000);
  if (!feedback) return null;

  return {
    score,
    maxScore: MAX_SCORE,
    verdict: normalizeVerdict(raw.verdict, score),
    feedback,
    matchedPoints: cleanArray(raw.matchedPoints),
    missingPoints: cleanArray(raw.missingPoints),
    improvedAnswer: cleanString(raw.improvedAnswer, 3000) || null,
    gradedAt: new Date().toISOString(),
    provider: provider ?? null,
    model: model ?? null,
  };
}

function buildPrompt(args: {
  questionType: "short_answer" | "theory";
  prompt: string;
  modelAnswer: string;
  markingPoints: string[];
  studentAnswer: string;
}) {
  const markingPoints = args.markingPoints.length
    ? args.markingPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")
    : "No explicit marking points were provided. Grade against the model answer.";

  return `You are grading a Nigerian university student's written practice answer.

Use ONLY the question, model answer, and marking points below. Be fair to equivalent wording, but do not award credit for claims not supported by the model answer or marking points.

Question type: ${args.questionType}

QUESTION:
${args.prompt}

MODEL ANSWER:
${args.modelAnswer || "No model answer provided."}

MARKING POINTS:
${markingPoints}

STUDENT ANSWER:
${args.studentAnswer}

Return ONLY valid JSON with this exact shape:
{
  "score": 0,
  "maxScore": 10,
  "verdict": "correct" | "mostly_correct" | "partially_correct" | "incorrect" | "unanswered",
  "feedback": "2-3 concise sentences explaining the score.",
  "matchedPoints": ["specific correct points the student included"],
  "missingPoints": ["important points the student missed"]
}

The score must be between 0 and 10.`;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorized", 401, "NO_SESSION");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const attemptId = cleanString(body.attemptId, 80);
  const questionId = cleanString(body.questionId, 80);
  const answer = cleanString(body.answer, 12000);

  if (!attemptId || !questionId) return jsonError("attemptId and questionId are required.", 400, "MISSING_FIELDS");
  if (answer.length < 5) return jsonError("Write a little more before asking AI to grade it.", 400, "ANSWER_TOO_SHORT");

  const admin = adminSupabase;
  const { data: attempt, error: attemptError } = await admin
    .from("study_practice_attempts")
    .select("id,set_id,user_id")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (attemptError) return jsonError(attemptError.message || "Could not load attempt.", 500, "DB_ERROR");
  if (!attempt?.id) return jsonError("Attempt not found.", 404, "ATTEMPT_NOT_FOUND");

  const hash = answerHash(answer);
  const [questionResult, existingAnswerResult] = await Promise.all([
    admin
      .from("study_quiz_questions")
      .select("id,set_id,prompt,question_type,model_answer,marking_points")
      .eq("id", questionId)
      .eq("set_id", attempt.set_id)
      .maybeSingle(),
    admin
      .from("study_attempt_answers")
      .select([
        "question_id",
        "ai_grade_score",
        "ai_grade_max_score",
        "ai_grade_verdict",
        "ai_grade_feedback",
        "ai_grade_matched_points",
        "ai_grade_missing_points",
        "ai_grade_improved_answer",
        "ai_grade_provider",
        "ai_grade_model",
        "ai_grade_answer_hash",
        "ai_graded_at",
      ].join(","))
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .maybeSingle(),
  ]);

  const { data: question, error: questionError } = questionResult;
  const { data: existingAnswer, error: answerError } = existingAnswerResult;

  if (questionError) return jsonError(questionError.message || "Could not load question.", 500, "DB_ERROR");
  if (!question?.id) return jsonError("Question not found for this attempt.", 404, "QUESTION_NOT_FOUND");

  const questionType = question.question_type === "short_answer" || question.question_type === "theory"
    ? question.question_type
    : "mcq";
  if (questionType === "mcq") return jsonError("AI grading is only available for written questions.", 400, "NOT_WRITTEN");

  if (answerError) return jsonError(answerError.message || "Could not load answer.", 500, "DB_ERROR");
  const existingAnswerRow = existingAnswer as Record<string, any> | null;
  if (existingAnswerRow?.ai_grade_answer_hash === hash) {
    const cachedGrade = gradeFromRow(existingAnswerRow);
    if (cachedGrade) return NextResponse.json({ ok: true, grade: cachedGrade, cached: true });
  }

  const result = await generateJson<RawGrade>({
    messages: [userMessage(buildPrompt({
      questionType,
      prompt: cleanString(question.prompt, 6000),
      modelAnswer: cleanString(question.model_answer, 6000),
      markingPoints: cleanArray(question.marking_points, 20),
      studentAnswer: answer,
    }))],
    temperature: 0.1,
    maxTokens: 500,
    timeoutMs: 45_000,
    modelRole: "fast",
  });

  if (!result.ok) return jsonError(result.error, 502, "AI_ERROR");

  const grade = normalizeGrade(result.data, result.provider, result.model);
  if (!grade) return jsonError("AI returned a malformed grade.", 502, "MALFORMED_AI_GRADE");

  const { data: saved, error: saveError } = await admin
    .from("study_attempt_answers")
    .upsert({
      attempt_id: attemptId,
      question_id: questionId,
      text_answer: answer,
      ai_grade_score: grade.score,
      ai_grade_max_score: grade.maxScore,
      ai_grade_verdict: grade.verdict,
      ai_grade_feedback: grade.feedback,
      ai_grade_matched_points: grade.matchedPoints,
      ai_grade_missing_points: grade.missingPoints,
      ai_grade_improved_answer: grade.improvedAnswer,
      ai_grade_provider: grade.provider,
      ai_grade_model: grade.model,
      ai_grade_answer_hash: hash,
      ai_graded_at: grade.gradedAt,
    } as any, { onConflict: "attempt_id,question_id" })
    .select("ai_graded_at")
    .maybeSingle();

  if (saveError) return jsonError(saveError.message || "Could not save AI grade.", 500, "SAVE_FAILED");
  const savedRow = saved as Record<string, any> | null;
  if (savedRow?.ai_graded_at) grade.gradedAt = String(savedRow.ai_graded_at);

  return NextResponse.json({ ok: true, grade, cached: false });
}
