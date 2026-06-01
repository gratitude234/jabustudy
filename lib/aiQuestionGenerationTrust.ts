import "server-only";

import { createHash } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  aiLimitFromEnv,
  checkAiUsageLimit,
  type AiLimitResult,
} from "@/lib/aiUsage";
import type { StudyGenerationIntent } from "@/lib/studyQuestionGeneration";

const MAX_QUESTION_COUNT = 20;
const DEFAULT_CREDIT_BALANCE = 0;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

type QuestionFormat = "mcq" | "mixed" | "written";
type Difficulty = "easy" | "mixed" | "hard";

const GENERATION_INTENTS = new Set<StudyGenerationIntent>([
  "weak_areas",
  "untested_sections",
  "application",
  "hard",
  "topic",
  "past_question_style",
]);

export type QuestionGenerationRequest = {
  materialId: string;
  requestedQuestionCount: number;
  questionCount: number;
  creditCost: number;
  difficulty: Difficulty;
  effectiveDifficulty: Difficulty;
  questionFormat: QuestionFormat;
  generationIntent: StudyGenerationIntent | null;
  focus: string | null;
  topicId: string | null;
  subtopicId: string | null;
  signature: string;
  signaturePayload: Record<string, unknown>;
};

export type GenerationDraftSummary = {
  setId: string;
  title: string | null;
  questionsCount: number;
  createdAt: string | null;
  expiresAt: string | null;
  requestSignature: string | null;
  attempt: {
    id: string;
    status: string | null;
    updatedAt: string | null;
  } | null;
};

type DraftSetRow = {
  id: string;
  title: string | null;
  questions_count: number | null;
  created_at: string | null;
  draft_expires_at: string | null;
  generation_config: unknown;
};

type AttemptRow = {
  id: string;
  set_id: string;
  status: string | null;
  updated_at: string | null;
};

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeQuestionFormat(value: unknown): QuestionFormat {
  return value === "mcq" || value === "written" || value === "mixed" ? value : "mixed";
}

function normalizeDifficulty(value: unknown): Difficulty {
  return value === "easy" || value === "hard" || value === "mixed" ? value : "mixed";
}

function normalizeGenerationIntent(value: unknown): StudyGenerationIntent | null {
  return typeof value === "string" && GENERATION_INTENTS.has(value as StudyGenerationIntent)
    ? (value as StudyGenerationIntent)
    : null;
}

function cleanOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanSignatureText(value: string | null) {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() || null;
}

function requestSignature(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function normalizeQuestionGenerationRequest(args: {
  materialId: unknown;
  count?: unknown;
  difficulty?: unknown;
  questionFormat?: unknown;
  generationIntent?: unknown;
  focus?: unknown;
  topicId?: unknown;
  subtopicId?: unknown;
  forceQuestionCount?: boolean;
}): QuestionGenerationRequest | null {
  const materialId = cleanOptionalString(args.materialId);
  if (!materialId) return null;

  const requestedQuestionCount = Math.max(
    1,
    Math.min(MAX_QUESTION_COUNT, parsePositiveInt(args.count, 10))
  );
  const questionFormat = normalizeQuestionFormat(args.questionFormat);
  const questionCount = args.forceQuestionCount ? requestedQuestionCount : questionFormat === "mcq"
    ? Math.min(requestedQuestionCount, aiLimitFromEnv("AI_MAX_MCQ_QUESTIONS_PER_REQUEST", 6))
    : requestedQuestionCount;
  const difficulty = normalizeDifficulty(args.difficulty);
  const generationIntent = normalizeGenerationIntent(args.generationIntent);
  const effectiveDifficulty = generationIntent === "hard" || generationIntent === "past_question_style"
    ? "hard"
    : difficulty;
  const focus = cleanOptionalString(args.focus);
  const topicId = cleanOptionalString(args.topicId);
  const subtopicId = cleanOptionalString(args.subtopicId);

  const signaturePayload = {
    version: 1,
    materialId,
    count: questionCount,
    questionFormat,
    difficulty: effectiveDifficulty,
    focus: cleanSignatureText(focus),
    generationIntent,
    topicId,
    subtopicId,
  };

  return {
    materialId,
    requestedQuestionCount,
    questionCount,
    creditCost: Math.ceil(questionCount / 5),
    difficulty,
    effectiveDifficulty,
    questionFormat,
    generationIntent,
    focus,
    topicId,
    subtopicId,
    signaturePayload,
    signature: requestSignature(signaturePayload),
  };
}

function signatureFromGenerationConfig(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const config = value as { request?: { signature?: unknown } };
  return typeof config.request?.signature === "string" ? config.request.signature : null;
}

export async function ensureStudyCreditBalance(userId: string) {
  await adminSupabase
    .from("study_user_credits")
    .upsert(
      { user_id: userId, balance: DEFAULT_CREDIT_BALANCE, updated_at: new Date().toISOString() },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  const { data } = await adminSupabase
    .from("study_user_credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  return typeof data?.balance === "number" ? data.balance : DEFAULT_CREDIT_BALANCE;
}

export async function spendStudyCredits(args: { userId: string; cost: number }) {
  if (args.cost <= 0) {
    return { ok: true, balance: await ensureStudyCreditBalance(args.userId), code: "NO_CHARGE" };
  }

  const { data, error } = await adminSupabase.rpc("spend_study_user_credits", {
    p_user_id: args.userId,
    p_cost: args.cost,
    p_default_balance: DEFAULT_CREDIT_BALANCE,
  });

  if (error) {
    console.error("[spendStudyCredits] RPC spend_study_user_credits failed", {
      userId: args.userId,
      cost: args.cost,
      pgCode: (error as { code?: unknown }).code,
      pgMessage: (error as { message?: unknown }).message,
      pgDetails: (error as { details?: unknown }).details,
      pgHint: (error as { hint?: unknown }).hint,
    });
    throw Object.assign(new Error("Credit charge could not be completed. No credits were charged."), {
      code: "CREDIT_SPEND_FAILED",
      cause: error,
    });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: Boolean(row?.ok),
    balance: typeof row?.balance === "number" ? row.balance : 0,
    code: typeof row?.code === "string" ? row.code : "UNKNOWN",
  };
}

export async function discardDraftSet(setId: string) {
  await adminSupabase
    .from("study_quiz_sets")
    .update({ draft_status: "discarded", draft_expires_at: new Date().toISOString() })
    .eq("id", setId);
}

export async function getQuestionGenerationLimit(userId: string): Promise<AiLimitResult> {
  return checkAiUsageLimit({
    userId,
    endpoint: "generate-questions",
    limit: aiLimitFromEnv("AI_LIMIT_GENERATE_QUESTIONS_PER_DAY", 4),
    windowMs: DAILY_WINDOW_MS,
    statuses: ["success"],
  });
}

export async function getActiveGenerationDrafts(args: {
  userId: string;
  materialId: string;
  signature: string;
}): Promise<{ matchingDraft: GenerationDraftSummary | null; latestDraft: GenerationDraftSummary | null }> {
  const now = new Date().toISOString();
  const { data, error } = await adminSupabase
    .from("study_quiz_sets")
    .select("id,title,questions_count,created_at,draft_expires_at,generation_config")
    .eq("created_by", args.userId)
    .eq("source_material_id", args.materialId)
    .eq("source", "ai_generated")
    .eq("draft_status", "draft")
    .gt("draft_expires_at", now)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.warn("[generate-questions] draft lookup failed:", error.message);
    return { matchingDraft: null, latestDraft: null };
  }

  const rows = (data ?? []) as DraftSetRow[];
  const setIds = rows.map((row) => row.id);
  const attemptsBySet = new Map<string, GenerationDraftSummary["attempt"]>();

  if (setIds.length > 0) {
    const { data: attempts } = await adminSupabase
      .from("study_practice_attempts")
      .select("id,set_id,status,updated_at")
      .eq("user_id", args.userId)
      .eq("status", "in_progress")
      .in("set_id", setIds)
      .order("updated_at", { ascending: false });

    for (const attempt of (attempts ?? []) as AttemptRow[]) {
      if (attemptsBySet.has(attempt.set_id)) continue;
      attemptsBySet.set(attempt.set_id, {
        id: attempt.id,
        status: attempt.status,
        updatedAt: attempt.updated_at,
      });
    }
  }

  const drafts = rows.map<GenerationDraftSummary>((row) => {
    const requestSignature = signatureFromGenerationConfig(row.generation_config);
    return {
      setId: row.id,
      title: row.title,
      questionsCount: row.questions_count ?? 0,
      createdAt: row.created_at,
      expiresAt: row.draft_expires_at,
      requestSignature,
      attempt: attemptsBySet.get(row.id) ?? null,
    };
  });

  return {
    matchingDraft: drafts.find((draft) => draft.requestSignature === args.signature) ?? null,
    latestDraft: drafts[0] ?? null,
  };
}

export function generationReceipt(args: {
  savedCount: number;
  creditCost: number;
  creditsRemaining: number;
  reusedDraft?: boolean;
}) {
  if (args.reusedDraft) return "Saved draft ready - no credits charged.";
  return `${args.savedCount} question${args.savedCount === 1 ? "" : "s"} saved - ${args.creditCost} credit${args.creditCost === 1 ? "" : "s"} used - ${args.creditsRemaining} left.`;
}
