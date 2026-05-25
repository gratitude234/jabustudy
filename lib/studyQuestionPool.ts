import "server-only";

import { adminSupabase } from "@/lib/supabase/admin";
import type { GeneratedPracticeQuestion } from "@/lib/aiGeneratedPractice";

type QuestionFormat = "mcq" | "mixed" | "written";
type Difficulty = "easy" | "mixed" | "hard";

type PoolOptionRow = {
  id: string;
  text: string | null;
  is_correct: boolean | null;
  position: number | null;
};

type PoolQuestionRow = {
  id: string;
  source_material_id: string;
  source_chunk_id: string | null;
  prompt: string | null;
  explanation: string | null;
  question_type: "mcq" | "short_answer" | "theory" | string | null;
  answer_key: "A" | "B" | "C" | "D" | string | null;
  model_answer: string | null;
  marking_points: unknown;
  study_ref: unknown;
  question_kind: string | null;
  difficulty_level: string | null;
  cognitive_level: string | null;
  source_topic: string | null;
  question_fingerprint: string | null;
  generation_meta: unknown;
  quality_status: string | null;
  usage_count: number | null;
  study_material_question_pool_options?: PoolOptionRow[] | null;
};

type ExistingPoolRow = {
  id: string;
  quality_status: string | null;
};

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 12);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string | null | undefined) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((word) => word.length > 2)
  );
}

function intersects(a: Set<string>, b: Set<string>) {
  for (const item of a) {
    if (b.has(item)) return true;
  }
  return false;
}

function questionTypeMatches(questionType: string | null, format: QuestionFormat) {
  if (format === "mcq") return questionType === "mcq";
  if (format === "written") return questionType === "short_answer" || questionType === "theory";
  return questionType === "mcq" || questionType === "short_answer" || questionType === "theory";
}

function correctAnswerFromOptions(options: PoolOptionRow[]) {
  const correct = options
    .filter((option) => option.is_correct)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
  const position = correct?.position ?? 0;
  return (["A", "B", "C", "D"][position] ?? "A") as "A" | "B" | "C" | "D";
}

function rowToGeneratedQuestion(row: PoolQuestionRow): GeneratedPracticeQuestion | null {
  const question = cleanString(row.prompt);
  const questionType = row.question_type === "short_answer" || row.question_type === "theory"
    ? row.question_type
    : "mcq";
  if (!question) return null;

  const common = {
    poolQuestionId: row.id,
    question,
    explanation: row.explanation ?? "",
    questionKind: row.question_kind ?? undefined,
    difficultyLevel: row.difficulty_level ?? undefined,
    cognitiveLevel: row.cognitive_level ?? undefined,
    sourceTopic: row.source_topic ?? undefined,
    questionFingerprint: row.question_fingerprint ?? undefined,
    generationMeta: cleanJsonObject(row.generation_meta),
    studyRef: cleanJsonObject(row.study_ref) as GeneratedPracticeQuestion["studyRef"],
    sourceChunkId: row.source_chunk_id ?? undefined,
  };

  if (questionType === "short_answer" || questionType === "theory") {
    const modelAnswer = cleanString(row.model_answer);
    if (!modelAnswer) return null;
    return {
      ...common,
      question_type: questionType,
      model_answer: modelAnswer,
      marking_points: cleanStringArray(row.marking_points),
    };
  }

  const options = [...(row.study_material_question_pool_options ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .slice(0, 4);
  if (options.length !== 4 || options.some((option) => !cleanString(option.text))) return null;
  return {
    ...common,
    question_type: "mcq",
    options: {
      A: options[0].text ?? "",
      B: options[1].text ?? "",
      C: options[2].text ?? "",
      D: options[3].text ?? "",
    },
    answer: (row.answer_key === "A" || row.answer_key === "B" || row.answer_key === "C" || row.answer_key === "D")
      ? row.answer_key
      : correctAnswerFromOptions(options),
  };
}

function poolScore(args: {
  row: PoolQuestionRow;
  focusTokens: Set<string>;
  difficulty: Difficulty;
}) {
  let score = 0;
  if (args.row.quality_status === "verified") score += 30;
  if (args.focusTokens.size > 0 && intersects(args.focusTokens, tokenSet(args.row.source_topic))) score += 25;
  const difficulty = normalizeText(args.row.difficulty_level);
  const kind = normalizeText(args.row.question_kind);
  if (args.difficulty === "hard" && (difficulty.includes("hard") || kind.includes("exam"))) score += 10;
  if (args.difficulty === "easy" && (difficulty.includes("easy") || kind.includes("recall"))) score += 8;
  score -= Math.min(20, args.row.usage_count ?? 0);
  return score;
}

export async function selectReusablePoolQuestions(args: {
  userId: string;
  materialId: string;
  count: number;
  questionFormat: QuestionFormat;
  difficulty: Difficulty;
  focus?: string | null;
  coveredQuestions?: string[];
}) {
  if (args.count <= 0) return [];

  const { data: seenRows } = await adminSupabase
    .from("study_user_question_pool_seen")
    .select("pool_question_id")
    .eq("user_id", args.userId)
    .eq("source_material_id", args.materialId)
    .limit(2000);
  const seenIds = new Set((seenRows ?? []).map((row) => String((row as { pool_question_id: string }).pool_question_id)));
  const covered = new Set((args.coveredQuestions ?? []).map(normalizeText).filter(Boolean));
  const focusTokens = tokenSet(args.focus);

  const { data, error } = await adminSupabase
    .from("study_material_question_pool")
    .select(
      "id,source_material_id,source_chunk_id,prompt,explanation,question_type,answer_key,model_answer,marking_points,study_ref,question_kind,difficulty_level,cognitive_level,source_topic,question_fingerprint,generation_meta,quality_status,usage_count,study_material_question_pool_options(id,text,is_correct,position)"
    )
    .eq("source_material_id", args.materialId)
    .in("quality_status", ["active", "verified"])
    .order("usage_count", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(Math.max(args.count * 6, 40));

  if (error) {
    console.warn("[studyQuestionPool] reusable lookup failed:", error.message);
    return [];
  }

  const rows = ((data ?? []) as unknown as PoolQuestionRow[])
    .filter((row) => !seenIds.has(row.id))
    .filter((row) => questionTypeMatches(row.question_type, args.questionFormat))
    .filter((row) => {
      const promptKey = normalizeText(row.prompt);
      if (!promptKey) return false;
      if (covered.has(promptKey)) return false;
      const fingerprint = normalizeText(row.question_fingerprint);
      return !fingerprint || !covered.has(fingerprint);
    })
    .sort((a, b) => poolScore({ row: b, focusTokens, difficulty: args.difficulty }) - poolScore({ row: a, focusTokens, difficulty: args.difficulty }));

  const selected: GeneratedPracticeQuestion[] = [];
  const selectedKeys = new Set<string>();
  for (const row of rows) {
    const question = rowToGeneratedQuestion(row);
    if (!question) continue;
    const key = normalizeText(question.questionFingerprint ?? question.question);
    if (!key || selectedKeys.has(key)) continue;
    selectedKeys.add(key);
    selected.push(question);
    if (selected.length >= args.count) break;
  }

  return selected;
}

async function findExistingPoolQuestion(materialId: string, fingerprint: string | null) {
  if (!fingerprint) return null;
  const { data } = await adminSupabase
    .from("study_material_question_pool")
    .select("id,quality_status")
    .eq("source_material_id", materialId)
    .eq("question_fingerprint", fingerprint)
    .maybeSingle();
  return data as ExistingPoolRow | null;
}

export async function upsertGeneratedQuestionsIntoPool(args: {
  userId: string;
  materialId: string;
  questions: GeneratedPracticeQuestion[];
}) {
  const poolIds: Array<string | null> = [];

  for (const question of args.questions) {
    if (question.poolQuestionId) {
      poolIds.push(question.poolQuestionId);
      continue;
    }

    const fingerprint = cleanString(question.questionFingerprint);
    const existing = await findExistingPoolQuestion(args.materialId, fingerprint);
    if (existing?.id) {
      poolIds.push(existing.id);
      continue;
    }

    const isMcq = question.question_type !== "short_answer" && question.question_type !== "theory";
    const answerKey = isMcq && (question.answer === "A" || question.answer === "B" || question.answer === "C" || question.answer === "D")
      ? question.answer
      : null;
    const { data: inserted, error: insertError } = await adminSupabase
      .from("study_material_question_pool")
      .insert({
        source_material_id: args.materialId,
        source_chunk_id: question.sourceChunkId ?? question.studyRef?.chunkId ?? null,
        prompt: question.question,
        explanation: question.explanation ?? null,
        question_type: isMcq ? "mcq" : question.question_type,
        answer_key: answerKey,
        model_answer: isMcq ? null : question.model_answer ?? null,
        marking_points: isMcq ? [] : question.marking_points ?? [],
        study_ref: question.studyRef ?? null,
        question_kind: question.questionKind ?? null,
        difficulty_level: question.difficultyLevel ?? null,
        cognitive_level: question.cognitiveLevel ?? null,
        source_topic: question.sourceTopic ?? question.studyRef?.topic ?? null,
        question_fingerprint: fingerprint,
        generation_meta: question.generationMeta ?? null,
        quality_status: "active",
        ai_generated: true,
        created_by: args.userId,
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      const fallback = await findExistingPoolQuestion(args.materialId, fingerprint);
      poolIds.push(fallback?.id ?? null);
      continue;
    }

    const poolId = String(inserted.id);
    poolIds.push(poolId);

    if (isMcq && question.options) {
      const optionRows = (["A", "B", "C", "D"] as const).map((key, position) => ({
        pool_question_id: poolId,
        text: question.options?.[key] ?? "",
        is_correct: answerKey === key,
        position,
      }));
      const { error: optionsError } = await adminSupabase
        .from("study_material_question_pool_options")
        .insert(optionRows);
      if (optionsError) {
        console.warn("[studyQuestionPool] option insert failed:", optionsError.message);
      }
    }
  }

  return poolIds;
}

export async function markPoolQuestionsSeen(args: {
  userId: string;
  materialId: string;
  poolQuestionIds: string[];
}) {
  const ids = [...new Set(args.poolQuestionIds.filter(Boolean))];
  if (!ids.length) return;
  const now = new Date().toISOString();
  await adminSupabase
    .from("study_user_question_pool_seen")
    .upsert(
      ids.map((id) => ({
        user_id: args.userId,
        pool_question_id: id,
        source_material_id: args.materialId,
        first_seen_at: now,
        last_seen_at: now,
        seen_count: 1,
      })),
      { onConflict: "user_id,pool_question_id" }
    );

  await adminSupabase.rpc("increment_study_material_question_pool_usage", { p_ids: ids });
}
