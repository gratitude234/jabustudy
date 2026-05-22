import { NextRequest, NextResponse } from "next/server";
import { generateJson, userMessage } from "@/lib/ai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WrittenAnswerGrade, WrittenAnswerGradeVerdict } from "@/lib/types";
import {
  aiLimitFromEnv,
  checkAiUsageLimit,
  recordBlockedAiUsage,
  withAiUsageContext,
} from "@/lib/aiUsage";

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
  "missingPoints": ["important points the student missed"],
  "improvedAnswer": "a concise improved answer, or null"
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

  const questionType = body.questionType === "short_answer" || body.questionType === "theory"
    ? body.questionType
    : null;
  const prompt = cleanString(body.question, 6000);
  const modelAnswer = cleanString(body.modelAnswer, 6000);
  const markingPoints = cleanArray(body.markingPoints, 20);
  const answer = cleanString(body.answer, 12000);

  if (!questionType) return jsonError("questionType must be short_answer or theory.", 400, "INVALID_QUESTION_TYPE");
  if (!prompt) return jsonError("Question is required.", 400, "MISSING_QUESTION");
  if (!modelAnswer && markingPoints.length === 0) {
    return jsonError("A model answer or marking points are required.", 400, "MISSING_MARK_SCHEME");
  }
  if (answer.length < 5) return jsonError("Write a little more before asking AI to grade it.", 400, "ANSWER_TOO_SHORT");

  const usageContext = {
    userId: user.id,
    endpoint: "grade-generated-written-answer",
    route: "/api/ai/grade-generated-written-answer",
    metadata: { questionType, answerChars: answer.length },
  };
  const limit = await checkAiUsageLimit({
    userId: user.id,
    endpoint: usageContext.endpoint,
    limit: aiLimitFromEnv("AI_LIMIT_GRADE_GENERATED_WRITTEN_PER_DAY", 30),
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    await recordBlockedAiUsage(usageContext, "Daily generated written-answer grading limit reached.");
    return jsonError(`AI limit reached (${limit.used}/${limit.limit}). Try again later.`, 429, "AI_RATE_LIMITED");
  }

  const result = await withAiUsageContext(usageContext, () => generateJson<RawGrade>({
    messages: [userMessage(buildPrompt({
      questionType,
      prompt,
      modelAnswer,
      markingPoints,
      studentAnswer: answer,
    }))],
    temperature: 0.1,
    maxTokens: 700,
    timeoutMs: 45_000,
    modelRole: "fast",
  }));

  if (!result.ok) return jsonError(result.error, 502, "AI_ERROR");

  const grade = normalizeGrade(result.data, result.provider, result.model);
  if (!grade) return jsonError("AI returned a malformed grade.", 502, "MALFORMED_AI_GRADE");

  return NextResponse.json({ ok: true, grade });
}
