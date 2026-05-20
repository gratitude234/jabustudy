import "server-only";

import { generateJson, userMessage } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  buildCoveragePlanForMaterial,
  coverageEngineVersion,
  type CoveragePlan,
  type CoveragePlanItem,
  type StudyGenerationIntent,
} from "@/lib/studyCoverageEngine";

const OUTLINE_CHUNK_LIMIT = 140;
const OUTLINE_TEXT_BUDGET = 58_000;
const QUESTION_TIMEOUT_MS =
  parsePositiveInt(process.env.AI_QUESTION_TIMEOUT_MS) ??
  parsePositiveInt(process.env.GEMINI_QUESTION_TIMEOUT_MS) ??
  45_000;
const OUTLINE_TIMEOUT_MS = parsePositiveInt(process.env.GEMINI_OUTLINE_TIMEOUT_MS) ?? 45_000;

type Difficulty = "easy" | "mixed" | "hard";
type QuestionKind = "recall" | "definition" | "application" | "comparison" | "exception" | "structure_function" | "clinical" | "analysis";
type CognitiveLevel = "recall" | "understanding" | "application" | "analysis";
export type { StudyGenerationIntent };

export type MaterialChunk = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  text: string;
};

type OutlineTopic = {
  title: string;
  chunkIds: string[];
  importance: number;
  suggestedQuestionCount: number;
  examAngles: string[];
};

type PlannedQuestion = {
  topic: string;
  chunkId: string;
  questionKind: QuestionKind;
  difficultyLevel: Difficulty;
  cognitiveLevel: CognitiveLevel;
  coverage?: CoveragePlanItem;
};

export type CoverageGeneratedQuestion = {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: "A" | "B" | "C" | "D";
  explanation: string;
  hint?: string;
  studyRef?: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  };
  questionKind?: string;
  difficultyLevel?: string;
  cognitiveLevel?: string;
  sourceTopic?: string;
  questionFingerprint?: string;
  generationMeta?: Record<string, unknown>;
};

export type CoverageGenerationResult = {
  questions: CoverageGeneratedQuestion[];
  topicsCovered: number;
  questionKindCounts: Record<string, number>;
  cognitiveLevelCounts: Record<string, number>;
  chunksLoaded: number;
  chunksCatalogued: number;
  coverage?: {
    courseMapId: string;
    courseCode: string | null;
    coveragePercent: number;
    topicsTotal: number;
    topicsStrongGap: number;
    topicsModerateGap: number;
    topicsWeakGap: number;
    duplicateRiskHigh: number;
    sourceConfidenceAverage: number;
    plannedItems: number;
    intent?: StudyGenerationIntent | null;
    intentLabel?: string;
    targetedTopic?: string | null;
    reason?: string;
  };
  ai?: {
    provider: "bedrock" | "gemini";
    model: string;
    fallbackProvider?: "bedrock" | "gemini";
    fallbackReason?: string;
    modelFallbackFrom?: string;
    modelFallbackReason?: string;
    repairedJson?: boolean;
    repairProvider?: "bedrock" | "gemini";
    repairModel?: string;
  };
};

type GeneratedShape = {
  question?: string;
  options?: Partial<Record<"A" | "B" | "C" | "D", string>>;
  answer?: "A" | "B" | "C" | "D";
  explanation?: string;
  hint?: string;
  studyRef?: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  };
};

function parsePositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function questionFingerprint(question: string, answerText?: string, sourceTopic?: string) {
  const source = `${sourceTopic ?? ""} ${question} ${answerText ?? ""}`;
  const words = source
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
  const unique = [...new Set(words)].sort().slice(0, 18);
  return unique.join("-");
}

function normalizeForCompare(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function keywordSet(value: string) {
  return new Set(
    normalizeForCompare(value)
      .split(" ")
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function sourceSnippet(text: string, max = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

function normalizePage(value: unknown) {
  const page = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(page) || page < 1 || page > 2000) return undefined;
  return Math.floor(page);
}

function compactChunkText(text: string, maxChars: number) {
  return text.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function selectCatalogChunks(chunks: MaterialChunk[]) {
  if (chunks.length <= OUTLINE_CHUNK_LIMIT) return chunks;
  const selected: MaterialChunk[] = [];
  const stride = chunks.length / OUTLINE_CHUNK_LIMIT;
  const used = new Set<string>();
  for (let i = 0; i < OUTLINE_CHUNK_LIMIT; i++) {
    const chunk = chunks[Math.floor(i * stride)];
    if (chunk && !used.has(chunk.id)) {
      selected.push(chunk);
      used.add(chunk.id);
    }
  }
  return selected;
}

function buildChunkCatalog(chunks: MaterialChunk[]) {
  const perChunkBudget = Math.max(180, Math.floor(OUTLINE_TEXT_BUDGET / Math.max(1, chunks.length)) - 80);
  let total = 0;
  const lines: string[] = [];
  for (const chunk of chunks) {
    const page = typeof chunk.page_number === "number" ? ` page:${chunk.page_number}` : "";
    const text = compactChunkText(chunk.text, perChunkBudget);
    const block = `[chunk:${chunk.id}${page} index:${chunk.chunk_index}]\n${text}`;
    total += block.length;
    if (total > OUTLINE_TEXT_BUDGET && lines.length > 0) break;
    lines.push(block);
  }
  return lines.join("\n\n");
}

async function loadIndexedChunks(materialId: string): Promise<MaterialChunk[]> {
  const { data, error } = await adminSupabase
    .from("study_material_chunks")
    .select("id,page_number,chunk_index,text")
    .eq("material_id", materialId)
    .order("chunk_index", { ascending: true })
    .limit(500);

  if (error) {
    console.warn("[question-v2] chunk load failed:", error.message);
    return [];
  }

  return ((data ?? []) as MaterialChunk[]).filter((chunk) => chunk.text?.trim().length > 0);
}

async function loadExistingQuestionMemory(materialId: string) {
  const { data, error } = await adminSupabase
    .from("study_quiz_questions")
    .select("prompt,question_fingerprint,source_topic")
    .eq("source_material_id", materialId)
    .limit(300);

  if (error) {
    console.warn("[question-v2] existing question memory failed:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row: { prompt?: unknown; question_fingerprint?: unknown; source_topic?: unknown }) => ({
      prompt: String(row.prompt ?? "").trim(),
      fingerprint: typeof row.question_fingerprint === "string" ? row.question_fingerprint : "",
      sourceTopic: typeof row.source_topic === "string" ? row.source_topic : "",
    }))
    .filter((row) => row.prompt);
}

async function buildSourceOutline(args: {
  materialTitle: string;
  count: number;
  focus?: string;
  chunks: MaterialChunk[];
}): Promise<{ topics: OutlineTopic[]; cataloguedChunks: MaterialChunk[]; ai?: CoverageGenerationResult["ai"] }> {
  const cataloguedChunks = selectCatalogChunks(args.chunks);
  const chunksById = new Map(args.chunks.map((chunk) => [chunk.id, chunk]));
  const prompt = `You are creating an exam coverage outline from a study material.
Material: ${args.materialTitle}
${args.focus ? `Student focus request: ${args.focus}` : ""}

Read the chunk catalog and identify the most examinable topics. Spread coverage across the full material, not only the beginning.
Use only chunk IDs that appear in the catalog.
Return 5 to 12 topics when possible.

Return ONLY JSON:
{
  "topics": [
    {
      "title": "short topic name",
      "chunkIds": ["uuid"],
      "importance": 1,
      "suggestedQuestionCount": 2,
      "examAngles": ["short angle"]
    }
  ]
}`;

  const result = await generateJson<{ topics?: Array<Record<string, unknown>> }>({
    messages: [userMessage(`SOURCE CHUNK CATALOG:\n\n${buildChunkCatalog(cataloguedChunks)}\n\n${prompt}`)],
    temperature: 0.2,
    maxTokens: 2400,
    timeoutMs: OUTLINE_TIMEOUT_MS,
    modelRole: "generation",
  });

  if (!result.ok) {
    return { topics: fallbackOutline(cataloguedChunks, args.count), cataloguedChunks };
  }

  const topics = (Array.isArray(result.data.topics) ? result.data.topics : [])
    .map((raw) => {
      const chunkIds = Array.isArray(raw.chunkIds)
        ? raw.chunkIds.map((id) => String(id)).filter((id) => chunksById.has(id)).slice(0, 6)
        : [];
      const title = typeof raw.title === "string" ? raw.title.trim() : "";
      const importance = Math.max(1, Math.min(5, Number(raw.importance ?? 3)));
      const suggestedQuestionCount = Math.max(1, Math.min(5, Number(raw.suggestedQuestionCount ?? 1)));
      const examAngles = Array.isArray(raw.examAngles)
        ? raw.examAngles.map((angle) => String(angle).trim()).filter(Boolean).slice(0, 4)
        : [];
      return { title, chunkIds, importance, suggestedQuestionCount, examAngles };
    })
    .filter((topic) => topic.title && topic.chunkIds.length > 0)
    .slice(0, 12);

  return {
    topics: topics.length ? topics : fallbackOutline(cataloguedChunks, args.count),
    cataloguedChunks,
    ai: {
      provider: result.provider,
      model: result.model,
      fallbackProvider: result.fallbackProvider,
      fallbackReason: result.fallbackReason,
      modelFallbackFrom: result.modelFallbackFrom,
      modelFallbackReason: result.modelFallbackReason,
      repairedJson: result.repairedJson,
      repairProvider: result.repairProvider,
      repairModel: result.repairModel,
    },
  };
}

function fallbackOutline(chunks: MaterialChunk[], count: number): OutlineTopic[] {
  const target = Math.max(4, Math.min(10, count));
  return chunks.slice(0, target).map((chunk, index) => ({
    title: chunk.text.replace(/\s+/g, " ").trim().split(/[.;:]/)[0]?.slice(0, 70) || `Topic ${index + 1}`,
    chunkIds: [chunk.id],
    importance: 3,
    suggestedQuestionCount: 1,
    examAngles: ["Core examinable detail"],
  }));
}

export function generationIntentLabel(intent?: StudyGenerationIntent | null) {
  switch (intent) {
    case "weak_areas":
      return "Cover weak areas";
    case "untested_sections":
      return "Untested sections";
    case "application":
      return "More application questions";
    case "hard":
      return "Harder questions";
    case "topic":
      return "Focus on a topic";
    case "past_question_style":
      return "Past-question style";
    default:
      return "Balanced coverage";
  }
}

function generationIntentReason(intent?: StudyGenerationIntent | null) {
  switch (intent) {
    case "weak_areas":
      return "Prioritized low-coverage topics before better-tested areas.";
    case "untested_sections":
      return "Prioritized sections with little or no saved question coverage.";
    case "application":
      return "Prioritized application and understanding questions.";
    case "hard":
      return "Prioritized harder exam-style questions.";
    case "topic":
      return "Prioritized the requested topic.";
    case "past_question_style":
      return "Prioritized exam-style questions from selected source material.";
    default:
      return "Balanced coverage-aware generation.";
  }
}

function questionKindCycle(difficulty: Difficulty, intent?: StudyGenerationIntent | null): QuestionKind[] {
  if (intent === "application") {
    return ["application", "structure_function", "clinical", "application", "comparison", "analysis"];
  }
  if (intent === "hard") {
    return ["analysis", "clinical", "exception", "comparison", "application"];
  }
  if (intent === "past_question_style") {
    return ["application", "comparison", "exception", "analysis", "clinical"];
  }
  if (difficulty === "easy") {
    return ["recall", "definition", "recall", "structure_function", "definition"];
  }
  if (difficulty === "hard") {
    return ["application", "comparison", "exception", "clinical", "analysis"];
  }
  return ["recall", "definition", "application", "structure_function", "comparison", "recall", "application", "exception", "comparison", "clinical"];
}

function cognitiveLevelFor(kind: QuestionKind): CognitiveLevel {
  if (kind === "recall" || kind === "definition") return "recall";
  if (kind === "structure_function") return "understanding";
  if (kind === "application" || kind === "clinical") return "application";
  return "analysis";
}

function difficultyLevelFor(kind: QuestionKind, requested: Difficulty): Difficulty {
  if (requested !== "mixed") return requested;
  if (kind === "recall" || kind === "definition") return "easy";
  if (kind === "analysis" || kind === "exception" || kind === "clinical") return "hard";
  return "mixed";
}

function buildCoveragePlan(args: {
  topics: OutlineTopic[];
  chunksById: Map<string, MaterialChunk>;
  count: number;
  difficulty: Difficulty;
  focus?: string;
  coverageItems?: CoveragePlanItem[];
  generationIntent?: StudyGenerationIntent | null;
}) {
  const effectiveDifficulty = args.generationIntent === "hard" || args.generationIntent === "past_question_style"
    ? "hard"
    : args.difficulty;
  const kinds = questionKindCycle(effectiveDifficulty, args.generationIntent);
  if (args.coverageItems?.length) {
    const plan: PlannedQuestion[] = [];
    let cursor = 0;
    while (plan.length < args.count + 4 && cursor < args.coverageItems.length * 3) {
      const item = args.coverageItems[cursor % args.coverageItems.length];
      if (args.chunksById.has(item.chunkId)) {
        const questionKind = kinds[plan.length % kinds.length];
        plan.push({
          topic: item.subtopicTitle || item.topicTitle,
          chunkId: item.chunkId,
          questionKind,
          difficultyLevel: difficultyLevelFor(questionKind, effectiveDifficulty),
          cognitiveLevel: cognitiveLevelFor(questionKind),
          coverage: item,
        });
      }
      cursor++;
    }
    if (plan.length) return plan;
  }

  const focus = normalizeForCompare(args.focus ?? "");
  const topics = [...args.topics].sort((a, b) => {
    const aBoost = focus && normalizeForCompare(`${a.title} ${a.examAngles.join(" ")}`).includes(focus) ? 4 : 0;
    const bBoost = focus && normalizeForCompare(`${b.title} ${b.examAngles.join(" ")}`).includes(focus) ? 4 : 0;
    return b.importance + bBoost - (a.importance + aBoost);
  });
  const plan: PlannedQuestion[] = [];
  let topicCursor = 0;

  while (plan.length < args.count + 4 && topics.length > 0) {
    const topic = topics[topicCursor % topics.length];
    const usableChunkIds = topic.chunkIds.filter((id) => args.chunksById.has(id));
    if (usableChunkIds.length) {
      const chunkId = usableChunkIds[Math.floor(plan.length / Math.max(1, topics.length)) % usableChunkIds.length];
      const questionKind = kinds[plan.length % kinds.length];
      plan.push({
        topic: topic.title,
        chunkId,
        questionKind,
        difficultyLevel: difficultyLevelFor(questionKind, effectiveDifficulty),
        cognitiveLevel: cognitiveLevelFor(questionKind),
      });
    }
    topicCursor++;
    if (topicCursor > topics.length * (args.count + 5)) break;
  }

  return plan;
}

async function generatePlannedQuestion(args: {
  materialTitle: string;
  plan: PlannedQuestion;
  chunk: MaterialChunk;
  avoidPrompts: string[];
  generationIntent?: StudyGenerationIntent | null;
}) {
  const page = typeof args.chunk.page_number === "number" ? `Page ${args.chunk.page_number}` : "Unknown page";
  const intentInstruction = args.generationIntent
    ? `Generation mode: ${generationIntentLabel(args.generationIntent)}. ${generationIntentReason(args.generationIntent)}`
    : "";
  const prompt = `You are writing one high-quality Nigerian university exam MCQ from the source chunk.
Material: ${args.materialTitle}
Topic: ${args.plan.topic}
Question kind: ${args.plan.questionKind}
Difficulty: ${args.plan.difficultyLevel}
Cognitive level: ${args.plan.cognitiveLevel}
Source: ${page}
${intentInstruction}

Avoid repeating or closely paraphrasing these questions:
${args.avoidPrompts.slice(-35).map((q, i) => `${i + 1}. ${q}`).join("\n") || "None"}

Quality rules:
- Use only the source chunk.
- Write a natural exam-style question, not a trivia fragment.
- Make all distractors plausible and from the same category as the answer.
- Do not use "all of the above" or "none of the above".
- Exactly one option must be correct.
- Explanation must explain why the answer is correct.
- Hint should point to the concept but must not reveal the correct option or answer text.
- Quote must be a short exact excerpt copied from the source chunk.

SOURCE CHUNK [chunk:${args.chunk.id}${typeof args.chunk.page_number === "number" ? ` page:${args.chunk.page_number}` : ""}]:
${args.chunk.text}

Return ONLY JSON:
{
  "question": {
    "question": "string",
    "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
    "answer": "A",
    "explanation": "string",
    "hint": "string",
    "studyRef": {
      "chunkId": "${args.chunk.id}",
      "topic": "${args.plan.topic}",
      "instruction": "what to read before answering",
      "quote": "exact short source quote",
      "page": ${typeof args.chunk.page_number === "number" ? args.chunk.page_number : 1}
    }
  }
}`;

  const result = await generateJson<{ question?: GeneratedShape }>({
    messages: [userMessage(prompt)],
    temperature: 0.25,
    maxTokens: 1150,
    timeoutMs: QUESTION_TIMEOUT_MS,
    modelRole: "generation",
  });

  if (!result.ok) return null;
  return {
    question: result.data.question ?? null,
    ai: {
      provider: result.provider,
      model: result.model,
      fallbackProvider: result.fallbackProvider,
      fallbackReason: result.fallbackReason,
      modelFallbackFrom: result.modelFallbackFrom,
      modelFallbackReason: result.modelFallbackReason,
      repairedJson: result.repairedJson,
      repairProvider: result.repairProvider,
      repairModel: result.repairModel,
    },
  };
}

function normalizeGeneratedQuestion(
  raw: GeneratedShape,
  plan: PlannedQuestion,
  chunk: MaterialChunk,
  generationIntent?: StudyGenerationIntent | null
): CoverageGeneratedQuestion | null {
  const optionKeys = ["A", "B", "C", "D"] as const;
  const question = typeof raw.question === "string" ? raw.question.trim() : "";
  const answer = raw.answer;
  const options = {
    A: raw.options?.A?.trim() ?? "",
    B: raw.options?.B?.trim() ?? "",
    C: raw.options?.C?.trim() ?? "",
    D: raw.options?.D?.trim() ?? "",
  };
  if (answer !== "A" && answer !== "B" && answer !== "C" && answer !== "D") return null;
  if (optionKeys.some((key) => !options[key])) return null;

  const quote = raw.studyRef?.quote?.trim();
  const groundedQuote = quote && normalizeForCompare(chunk.text).includes(normalizeForCompare(quote))
    ? quote
    : sourceSnippet(chunk.text);
  const page = normalizePage(raw.studyRef?.page) ?? normalizePage(chunk.page_number);
  const answerText = options[answer as "A" | "B" | "C" | "D"];
  const fingerprint = questionFingerprint(question, answerText, plan.topic);

  return {
    question,
    options,
    answer: answer as CoverageGeneratedQuestion["answer"],
    explanation: typeof raw.explanation === "string" ? raw.explanation.trim() : "",
    hint: typeof raw.hint === "string" ? raw.hint.trim() : undefined,
    studyRef: {
      chunkId: chunk.id,
      topic: raw.studyRef?.topic?.trim() || plan.topic,
      instruction: raw.studyRef?.instruction?.trim() || `Review ${plan.topic} before answering.`,
      quote: groundedQuote,
      page,
    },
    questionKind: plan.questionKind,
    difficultyLevel: plan.difficultyLevel,
    cognitiveLevel: plan.cognitiveLevel,
    sourceTopic: plan.topic,
    questionFingerprint: fingerprint,
    generationMeta: {
      version: "question-generation-v2",
      plannedChunkId: plan.chunkId,
      questionKind: plan.questionKind,
      cognitiveLevel: plan.cognitiveLevel,
      difficultyLevel: plan.difficultyLevel,
      intent: generationIntent ?? null,
      intentLabel: generationIntentLabel(generationIntent),
      coverageEngineVersion: plan.coverage ? coverageEngineVersion() : undefined,
      courseMapId: plan.coverage?.courseMapId,
      topicId: plan.coverage?.topicId,
      subtopicId: plan.coverage?.subtopicId,
      coverageBefore: plan.coverage
        ? {
            coveragePercent: plan.coverage.coveragePercent,
            questionCount: plan.coverage.questionCount,
            targetQuestionCount: plan.coverage.targetQuestionCount,
          }
        : undefined,
      coverageGapStrength: plan.coverage?.gapStrength,
      sourceConfidence: plan.coverage?.sourceConfidence,
      duplicateRisk: plan.coverage?.duplicateRisk,
    },
  };
}

function validationFailure(question: CoverageGeneratedQuestion, usedPrompts: string[], usedFingerprints: Set<string>) {
  const optionValues = Object.values(question.options).map(normalizeForCompare);
  if (new Set(optionValues).size !== 4) return "duplicate_options";
  if (optionValues.some((value) => /^all of the above$|^none of the above$/i.test(value))) return "weak_option";
  if (!question.explanation || question.explanation.length < 24) return "thin_explanation";

  const answerText = question.options[question.answer];
  if (question.hint && normalizeForCompare(answerText).length > 4 && normalizeForCompare(question.hint).includes(normalizeForCompare(answerText))) {
    return "hint_leaks_answer";
  }

  const normalizedPrompt = normalizeForCompare(question.question);
  if (usedPrompts.some((prompt) => normalizeForCompare(prompt) === normalizedPrompt)) return "exact_duplicate";
  if (question.questionFingerprint && usedFingerprints.has(question.questionFingerprint)) return "fingerprint_duplicate";

  const nextKeywords = keywordSet(question.question);
  for (const prompt of usedPrompts) {
    const similarity = jaccard(nextKeywords, keywordSet(prompt));
    if (similarity >= 0.72) return "near_duplicate";
  }

  return null;
}

export async function generateCoverageAwareQuestions(args: {
  materialId: string;
  materialTitle: string;
  count: number;
  difficulty: Difficulty;
  focus?: string;
  coveredQuestions?: string[];
  generationIntent?: StudyGenerationIntent | null;
  topicId?: string | null;
  subtopicId?: string | null;
}): Promise<CoverageGenerationResult | null> {
  const chunks = await loadIndexedChunks(args.materialId);
  if (chunks.length === 0) return null;

  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const [coveragePlan, existingMemory] = await Promise.all([
    buildCoveragePlanForMaterial({
      materialId: args.materialId,
      count: args.count,
      focus: args.focus,
      coveredQuestions: args.coveredQuestions,
      generationIntent: args.generationIntent,
      topicId: args.topicId,
      subtopicId: args.subtopicId,
    }).catch((error) => {
      console.warn("[question-v2] coverage plan unavailable:", error instanceof Error ? error.message : error);
      return null;
    }),
    loadExistingQuestionMemory(args.materialId),
  ]);

  let topics: OutlineTopic[] = [];
  let cataloguedChunks = selectCatalogChunks(chunks);
  let outlineAi: CoverageGenerationResult["ai"] | undefined;
  if (!coveragePlan?.items.length) {
    const outline = await buildSourceOutline({
      materialTitle: args.materialTitle,
      count: args.count,
      focus: args.focus,
      chunks,
    });
    topics = outline.topics;
    cataloguedChunks = outline.cataloguedChunks;
    outlineAi = outline.ai;
  }

  const plan = buildCoveragePlan({
    topics,
    chunksById,
    count: args.count,
    difficulty: args.difficulty,
    focus: args.focus,
    coverageItems: coveragePlan?.items,
    generationIntent: args.generationIntent,
  });

  const accepted: CoverageGeneratedQuestion[] = [];
  const usedPrompts = [
    ...(args.coveredQuestions ?? []),
    ...existingMemory.map((row) => row.prompt),
  ].filter(Boolean);
  const usedFingerprints = new Set(existingMemory.map((row) => row.fingerprint).filter(Boolean));
  const failures: Record<string, number> = {};
  let ai = outlineAi;

  for (const planned of plan) {
    if (accepted.length >= args.count) break;
    const chunk = chunksById.get(planned.chunkId);
    if (!chunk) continue;

    let acceptedThisPlan = false;
    for (let attempt = 0; attempt < 2 && !acceptedThisPlan; attempt++) {
      const generated = await generatePlannedQuestion({
        materialTitle: args.materialTitle,
        plan: planned,
        chunk,
        avoidPrompts: [...usedPrompts, ...accepted.map((question) => question.question)],
        generationIntent: args.generationIntent,
      });
      const raw = generated?.question ?? null;
      if (generated?.ai) ai = generated.ai;
      if (!raw) {
        failures.ai_empty = (failures.ai_empty ?? 0) + 1;
        continue;
      }

      const question = normalizeGeneratedQuestion(raw, planned, chunk, args.generationIntent);
      if (!question) {
        failures.malformed = (failures.malformed ?? 0) + 1;
        continue;
      }

      const failure = validationFailure(question, [...usedPrompts, ...accepted.map((q) => q.question)], usedFingerprints);
      if (failure) {
        failures[failure] = (failures[failure] ?? 0) + 1;
        continue;
      }

      accepted.push(question);
      usedFingerprints.add(question.questionFingerprint ?? "");
      acceptedThisPlan = true;
    }
  }

  if (accepted.length === 0) {
    throw new Error("Coverage-aware generation could not produce usable questions.");
  }

  const topicSet = new Set(accepted.map((question) => question.sourceTopic).filter(Boolean));
  return {
    questions: accepted,
    topicsCovered: topicSet.size,
    questionKindCounts: countBy(accepted.map((question) => question.questionKind ?? "unknown")),
    cognitiveLevelCounts: countBy(accepted.map((question) => question.cognitiveLevel ?? "unknown")),
    chunksLoaded: chunks.length,
    chunksCatalogued: cataloguedChunks.length,
    coverage: coveragePlan ? coverageSummary(coveragePlan, args.generationIntent) : undefined,
    ai,
  };
}

function coverageSummary(
  plan: CoveragePlan,
  generationIntent?: StudyGenerationIntent | null
): NonNullable<CoverageGenerationResult["coverage"]> {
  const firstItem = plan.items[0];
  return {
    courseMapId: plan.courseMapId,
    courseCode: plan.courseCode,
    coveragePercent: plan.summary.coveragePercent,
    topicsTotal: plan.summary.topicsTotal,
    topicsStrongGap: plan.summary.topicsStrongGap,
    topicsModerateGap: plan.summary.topicsModerateGap,
    topicsWeakGap: plan.summary.topicsWeakGap,
    duplicateRiskHigh: plan.summary.duplicateRiskHigh,
    sourceConfidenceAverage: plan.summary.sourceConfidenceAverage,
    plannedItems: plan.items.length,
    intent: generationIntent ?? null,
    intentLabel: generationIntentLabel(generationIntent),
    targetedTopic: firstItem ? `${firstItem.topicTitle} / ${firstItem.subtopicTitle}` : null,
    reason: generationIntentReason(generationIntent),
  };
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

const STOP_WORDS = new Set([
  "about",
  "above",
  "after",
  "also",
  "answer",
  "because",
  "before",
  "below",
  "between",
  "correct",
  "describe",
  "during",
  "following",
  "from",
  "into",
  "most",
  "question",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "what",
  "when",
  "where",
  "which",
  "with",
]);
