import "server-only";

import { generateJson, userMessage, type AiContentBlock } from "@/lib/ai";
import {
  extractMaterialContent,
  truncateText,
} from "@/lib/extractMaterialContent";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  assertQuestionsNotDuplicateForCourse,
  type DuplicateGateError,
} from "@/lib/studyDuplicateGate";
import { generateCoverageAwareQuestions } from "@/lib/studyQuestionGeneration";
import {
  type GroundedQuestionMeta,
  SOURCE_GROUNDING_ERROR_MESSAGE,
  validateSourceBackedQuestions,
} from "@/lib/studyQuestionGrounding";

type QuestionType = "mcq" | "short_answer" | "theory";
type OptionKey = "A" | "B" | "C" | "D";

export type GeneratedPracticeQuestion = {
  question_type?: QuestionType | null;
  question: string;
  options?: { A?: string; B?: string; C?: string; D?: string };
  answer?: OptionKey;
  explanation?: string;
  model_answer?: string;
  modelAnswer?: string;
  marking_points?: string[];
  markingPoints?: string[];
  hint?: string;
  questionKind?: string;
  difficultyLevel?: string;
  cognitiveLevel?: string;
  sourceTopic?: string;
  questionFingerprint?: string;
  generationMeta?: Record<string, unknown> | null;
  studyRef?: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  };
};

type NormalizedQuestion = Omit<GeneratedPracticeQuestion, "question_type" | "options" | "answer" | "modelAnswer" | "markingPoints"> & {
  question_type: QuestionType;
  question: string;
  explanation: string;
  options?: { A: string; B: string; C: string; D: string };
  answer?: OptionKey;
  model_answer?: string;
  marking_points: string[];
};

type SavableQuestion = NormalizedQuestion & Partial<GroundedQuestionMeta>;

type MaterialRow = {
  id: string;
  title: string | null;
  course_code: string | null;
  file_path: string | null;
  gemini_file_uri?: string | null;
};

type InsertedQuestionRow = {
  id: string;
  position: number | null;
};

export type SaveGeneratedPracticeResult = {
  setId: string;
  savedCount: number;
  requestedCount: number;
  repaired: boolean;
  replacedCount: number;
  skippedCount: number;
};

export type SaveGeneratedPracticeArgs = {
  userId: string;
  materialId: string;
  questions: GeneratedPracticeQuestion[];
  asDraft?: boolean;
  generationConfig?: Record<string, unknown> | null;
};

const REPAIR_TEXT_CHARS = 24_000;
const REPAIR_TIMEOUT_MS =
  parsePositiveInt(process.env.AI_QUESTION_TIMEOUT_MS) ??
  parsePositiveInt(process.env.GEMINI_QUESTION_TIMEOUT_MS) ??
  60_000;
const REPAIR_ATTEMPTS = 2;
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function parsePositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
}

function questionTypeOf(value: unknown): QuestionType {
  return value === "short_answer" || value === "theory" ? value : "mcq";
}

function normalizeQuestions(questions: GeneratedPracticeQuestion[]): NormalizedQuestion[] {
  const optionKeys = ["A", "B", "C", "D"] as const;
  const normalized: NormalizedQuestion[] = [];

  for (const question of questions) {
    const prompt = cleanString(question.question);
    if (!prompt) continue;

    const questionType = questionTypeOf(question.question_type);
    const base = {
      ...question,
      question_type: questionType,
      question: prompt,
      explanation: cleanString(question.explanation) ?? "",
      marking_points: cleanStringArray(question.marking_points ?? question.markingPoints),
    };

    if (questionType === "mcq") {
      const options = question.options ?? {};
      const normalizedOptions = {
        A: cleanString(options.A) ?? "",
        B: cleanString(options.B) ?? "",
        C: cleanString(options.C) ?? "",
        D: cleanString(options.D) ?? "",
      };
      const validAnswer = optionKeys.includes(question.answer as OptionKey);
      if (!validAnswer || optionKeys.some((key) => !normalizedOptions[key])) continue;
      normalized.push({
        ...base,
        question_type: "mcq",
        options: normalizedOptions,
        answer: question.answer as OptionKey,
        model_answer: undefined,
        marking_points: [],
      });
      continue;
    }

    const modelAnswer = cleanString(question.model_answer) ?? cleanString(question.modelAnswer);
    if (!modelAnswer) continue;
    normalized.push({
      ...base,
      question_type: questionType,
      options: undefined,
      answer: undefined,
      model_answer: modelAnswer,
      marking_points: base.marking_points,
    });
  }

  return normalized;
}

function cleanLabel(value: unknown, maxLength = 80): string | null {
  const clean = cleanString(value);
  return clean ? clean.slice(0, maxLength) : null;
}

function cleanJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeForFingerprint(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function keywordFingerprint(parts: string[]) {
  const words = normalizeForFingerprint(parts.join(" "))
    .split(" ")
    .filter((word) => word.length > 3 && !FINGERPRINT_STOP_WORDS.has(word));
  return [...new Set(words)].sort().slice(0, 18).join("-");
}

function questionFingerprint(question: NormalizedQuestion) {
  if (question.questionFingerprint) return question.questionFingerprint;
  const answerConcept = question.question_type === "mcq"
    ? question.options?.[question.answer ?? "A"] ?? ""
    : [question.model_answer ?? "", ...question.marking_points].join(" ");
  return keywordFingerprint([
    question.sourceTopic ?? question.studyRef?.topic ?? "",
    question.question,
    answerConcept,
  ]);
}

function withQuestionFingerprint<T extends NormalizedQuestion>(question: T): T {
  if (question.questionFingerprint) return question;
  return { ...question, questionFingerprint: questionFingerprint(question) } as T;
}

function mimeTypeFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return map[ext] ?? null;
}

type RepairSource =
  | { kind: "file"; mimeType: string; fileUri: string }
  | { kind: "inline"; mimeType: string; data: string }
  | { kind: "text"; text: string };

async function loadRepairSource(material: MaterialRow): Promise<RepairSource | null> {
  const filePath = material.file_path;
  if (!filePath) return null;

  const cachedFileUri = material.gemini_file_uri?.trim() ?? "";
  const cachedMimeType = cachedFileUri ? mimeTypeFromPath(filePath) : null;
  if (cachedFileUri && cachedMimeType) {
    return { kind: "file", mimeType: cachedMimeType, fileUri: cachedFileUri };
  }

  const { data: signed } = await adminSupabase.storage
    .from("study-materials")
    .createSignedUrl(filePath, 300);
  const downloadUrl = signed?.signedUrl ?? null;
  if (!downloadUrl) return null;

  const fetchRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
  if (!fetchRes.ok) return null;
  const fileBuffer = await fetchRes.arrayBuffer();
  if (fileBuffer.byteLength > 15 * 1024 * 1024) return null;

  const content = await extractMaterialContent(fileBuffer, filePath);
  if (content.kind === "text") {
    return { kind: "text", text: truncateText(content.text, REPAIR_TEXT_CHARS) };
  }
  if (content.kind === "inline") {
    return { kind: "inline", mimeType: content.mimeType, data: content.base64 };
  }
  return null;
}

function repairPrompt(args: {
  questionType: QuestionType;
  count: number;
  duplicatePrompts: string[];
  avoidPrompts: string[];
}) {
  const typeInstruction = args.questionType === "mcq"
    ? `Generate exactly ${args.count} multiple choice question${args.count === 1 ? "" : "s"}.
Each item must use question_type "mcq", 4 options (A, B, C, D), and exactly one correct answer.`
    : `Generate exactly ${args.count} ${args.questionType === "theory" ? "theory" : "short-answer"} question${args.count === 1 ? "" : "s"}.
Each item must use question_type "${args.questionType}", must not include options, and must include model_answer and marking_points.`;
  const itemSchema = args.questionType === "mcq"
    ? `{
      "question_type": "mcq",
      "question": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "answer": "A",
      "explanation": "string",
      "hint": "string",
      "studyRef": { "topic": "string", "instruction": "string", "quote": "string", "page": 1 }
    }`
    : `{
      "question_type": "${args.questionType}",
      "question": "string",
      "model_answer": "string",
      "marking_points": ["string"],
      "explanation": "string",
      "hint": "string",
      "studyRef": { "topic": "string", "instruction": "string", "quote": "string", "page": 1 }
    }`;

  return `You are replacing duplicate study questions for a Nigerian university student.
Use only the provided document content.
${typeInstruction}
Use different concepts, sections, wording, and exam angles from the duplicate questions.

Duplicate questions to replace:
${args.duplicatePrompts.map((prompt, index) => `${index + 1}. ${prompt}`).join("\n")}

Avoid repeating or closely paraphrasing these questions:
${args.avoidPrompts.slice(-30).map((prompt, index) => `${index + 1}. ${prompt}`).join("\n")}

Return ONLY valid JSON:
{
  "questions": [
    ${itemSchema}
  ]
}`;
}

async function callRepairAi(source: RepairSource, prompt: string, maxTokens: number) {
  const message = source.kind === "text"
    ? userMessage(`DOCUMENT CONTENT:\n\n${source.text}\n\n${prompt}`)
    : userMessage([
      source.kind === "file"
        ? { type: "file", mimeType: source.mimeType, fileUri: source.fileUri } satisfies AiContentBlock
        : { type: "inline", mimeType: source.mimeType, data: source.data, name: "study material" } satisfies AiContentBlock,
      { type: "text", text: prompt },
    ]);

  const result = await generateJson<{ questions?: unknown[] }>({
    messages: [message],
    temperature: 0.35,
    maxTokens,
    timeoutMs: REPAIR_TIMEOUT_MS,
    modelRole: source.kind === "text" ? "generation" : "document",
  });

  if (!result.ok || !Array.isArray(result.data.questions)) return [];
  return normalizeQuestions(result.data.questions as GeneratedPracticeQuestion[]);
}

async function generateSourceBackedMcqReplacements(args: {
  material: MaterialRow;
  materialId: string;
  count: number;
  avoidPrompts: string[];
  ownerUserId: string;
}) {
  const generation = await generateCoverageAwareQuestions({
    materialId: args.materialId,
    materialTitle: args.material.title ?? "Untitled material",
    count: args.count,
    difficulty: "mixed",
    coveredQuestions: args.avoidPrompts,
    ownerUserId: args.ownerUserId,
    generationIntent: "untested_sections",
  }).catch((error) => {
    console.warn("[aiGeneratedPractice] source-backed repair failed:", error instanceof Error ? error.message : error);
    return null;
  });

  if (!generation?.questions.length) return [];
  return normalizeQuestions(
    generation.questions.map((question) => ({
      ...question,
      question_type: "mcq" as const,
    })) as GeneratedPracticeQuestion[]
  );
}

async function generateReplacementQuestions(args: {
  material: MaterialRow;
  materialId: string;
  targets: SavableQuestion[];
  avoidPrompts: string[];
  ownerUserId: string;
  allMcqSourceBacked: boolean;
}) {
  if (!args.targets.length) return [];

  if (args.allMcqSourceBacked && args.targets.every((question) => question.question_type === "mcq")) {
    return generateSourceBackedMcqReplacements({
      material: args.material,
      materialId: args.materialId,
      count: args.targets.length,
      avoidPrompts: args.avoidPrompts,
      ownerUserId: args.ownerUserId,
    });
  }

  const source = await loadRepairSource(args.material).catch((error) => {
    console.warn("[aiGeneratedPractice] repair source failed:", error instanceof Error ? error.message : error);
    return null;
  });
  if (!source) return [];

  const replacements: NormalizedQuestion[] = [];
  const types: QuestionType[] = ["mcq", "short_answer", "theory"];
  for (const questionType of types) {
    const targets = args.targets.filter((question) => question.question_type === questionType);
    if (!targets.length) continue;

    const generated = await callRepairAi(
      source,
      repairPrompt({
        questionType,
        count: targets.length,
        duplicatePrompts: targets.map((question) => question.question),
        avoidPrompts: args.avoidPrompts,
      }),
      Math.min(8000, targets.length * (questionType === "mcq" ? 420 : 620))
    );

    replacements.push(
      ...generated
        .filter((question) => question.question_type === questionType)
        .slice(0, targets.length)
    );
  }

  return replacements;
}

function duplicateIndicesFromError(error: unknown) {
  const duplicateError = error as Partial<DuplicateGateError>;
  if (duplicateError.code !== "DUPLICATE_QUESTION" || !Array.isArray(duplicateError.duplicates)) return null;
  return new Set(
    duplicateError.duplicates
      .map((duplicate) => Number(duplicate.incomingIndex))
      .filter((index) => Number.isInteger(index) && index >= 0)
  );
}

async function findDuplicateIndices(args: {
  materialId: string;
  ownerUserId: string;
  questions: SavableQuestion[];
}) {
  try {
    await assertQuestionsNotDuplicateForCourse({
      materialId: args.materialId,
      ownerUserId: args.ownerUserId,
      questions: args.questions,
    });
    return null;
  } catch (error: unknown) {
    const duplicateIndices = duplicateIndicesFromError(error);
    if (!duplicateIndices) throw error;
    return duplicateIndices;
  }
}

async function repairPersonalQuestions(args: {
  material: MaterialRow;
  materialId: string;
  ownerUserId: string;
  questions: SavableQuestion[];
  allMcqSourceBacked: boolean;
}) {
  let candidate = args.questions.map(withQuestionFingerprint);
  let initialDuplicateCount = 0;

  for (let attempt = 0; attempt < REPAIR_ATTEMPTS; attempt++) {
    const duplicateIndices = await findDuplicateIndices({
      materialId: args.materialId,
      ownerUserId: args.ownerUserId,
      questions: candidate,
    });
    if (!duplicateIndices) {
      const skippedCount = Math.max(0, args.questions.length - candidate.length);
      return {
        questions: candidate,
        replacedCount: Math.max(0, initialDuplicateCount - skippedCount),
        skippedCount,
        repaired: initialDuplicateCount > 0,
      };
    }

    if (initialDuplicateCount === 0) initialDuplicateCount = duplicateIndices.size;
    const cleanQuestions = candidate.filter((_, index) => !duplicateIndices.has(index));
    const duplicateQuestions = candidate.filter((_, index) => duplicateIndices.has(index));
    const avoidPrompts = [
      ...candidate.map((question) => question.question),
      ...duplicateQuestions.map((question) => question.question),
    ];
    const replacements = (await generateReplacementQuestions({
      material: args.material,
      materialId: args.materialId,
      targets: duplicateQuestions,
      avoidPrompts,
      ownerUserId: args.ownerUserId,
      allMcqSourceBacked: args.allMcqSourceBacked,
    })).map(withQuestionFingerprint);

    candidate = [...cleanQuestions, ...replacements];
    if (!candidate.length) break;
  }

  for (let pass = 0; pass < 3 && candidate.length > 0; pass++) {
    const duplicateIndices = await findDuplicateIndices({
      materialId: args.materialId,
      ownerUserId: args.ownerUserId,
      questions: candidate,
    });
    if (!duplicateIndices) break;
    if (initialDuplicateCount === 0) initialDuplicateCount = duplicateIndices.size;
    candidate = candidate.filter((_, index) => !duplicateIndices.has(index));
  }

  if (!candidate.length) {
    const error = Object.assign(new Error("All generated questions were duplicates. Generate again from uncovered areas."), {
      status: 422 as const,
      code: "DUPLICATE_QUESTION" as const,
      duplicateCount: initialDuplicateCount,
      duplicates: [],
    });
    throw error;
  }

  const skippedCount = Math.max(0, args.questions.length - candidate.length);
  return {
    questions: candidate,
    replacedCount: Math.max(0, initialDuplicateCount - skippedCount),
    skippedCount,
    repaired: initialDuplicateCount > 0,
  };
}

export async function saveGeneratedPracticeSet(args: SaveGeneratedPracticeArgs): Promise<SaveGeneratedPracticeResult> {
  if (!args.materialId || !Array.isArray(args.questions) || args.questions.length === 0) {
    throw Object.assign(new Error("Missing required fields."), { status: 400, code: "MISSING_REQUIRED_FIELDS" });
  }

  const normalizedQuestions = normalizeQuestions(args.questions);
  if (!normalizedQuestions || normalizedQuestions.length !== args.questions.length) {
    throw Object.assign(new Error("AI returned malformed questions. Please try generating again."), {
      status: 422,
      code: "MALFORMED_QUESTIONS",
    });
  }

  const { data: mat, error: matErr } = await adminSupabase
    .from("study_materials")
    .select("id, title, course_code, file_path, gemini_file_uri")
    .eq("id", args.materialId)
    .maybeSingle();

  if (matErr || !mat) {
    throw Object.assign(new Error("Material not found."), { status: 404, code: "MATERIAL_NOT_FOUND" });
  }

  const material = mat as MaterialRow;
  const requestedCount = normalizedQuestions.length;
  let questionsToSave: SavableQuestion[] = normalizedQuestions.map(withQuestionFingerprint);
  const allMcq = questionsToSave.every((question) => question.question_type === "mcq");
  if (allMcq) {
    try {
      questionsToSave = await validateSourceBackedQuestions(args.materialId, questionsToSave);
    } catch (error: unknown) {
      const groundingError = error as { message?: string; code?: string; invalidCount?: number; status?: number };
      throw Object.assign(new Error(groundingError.message || SOURCE_GROUNDING_ERROR_MESSAGE), {
        status: Number(groundingError.status) || 422,
        code: groundingError.code || "QUESTIONS_MISSING_SOURCE",
        invalidCount: groundingError.invalidCount,
      });
    }
  }

  const repaired = await repairPersonalQuestions({
    material,
    materialId: args.materialId,
    ownerUserId: args.userId,
    questions: questionsToSave,
    allMcqSourceBacked: allMcq,
  });
  questionsToSave = repaired.questions;

  if (allMcq) {
    questionsToSave = await validateSourceBackedQuestions(args.materialId, questionsToSave);
  }

  await assertQuestionsNotDuplicateForCourse({
    materialId: args.materialId,
    ownerUserId: args.userId,
    questions: questionsToSave,
  });

  const isDraft = Boolean(args.asDraft);
  const title = `AI Generated - ${material.title ?? "Practice Set"}`;
  const { data: set, error: setErr } = await adminSupabase
    .from("study_quiz_sets")
    .insert({
      title,
      source: "ai_generated",
      course_code: material.course_code,
      created_by: args.userId,
      published: !isDraft,
      visibility: "private",
      questions_count: questionsToSave.length,
      source_material_id: args.materialId,
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      draft_status: isDraft ? "draft" : "kept",
      draft_expires_at: isDraft ? new Date(Date.now() + DRAFT_TTL_MS).toISOString() : null,
      generation_config: cleanJsonObject(args.generationConfig),
    })
    .select("id")
    .single();

  if (setErr || !set?.id) {
    console.error("[aiGeneratedPractice] set insert error:", setErr);
    throw Object.assign(new Error("Failed to save questions."), { status: 500, code: "SET_INSERT_FAILED" });
  }

  const quizSetId = String(set.id);
  const questionPayload = questionsToSave.map((question, index) => ({
    set_id: quizSetId,
    prompt: question.question,
    position: index,
    explanation: question.explanation || (question.question_type === "mcq" ? null : question.model_answer ?? null),
    question_type: question.question_type,
    model_answer: question.question_type === "mcq" ? null : question.model_answer ?? null,
    marking_points: question.question_type === "mcq" ? [] : question.marking_points,
    ai_generated: true,
    source_material_id: args.materialId,
    study_ref: question.studyRef,
    source_chunk_id: question.sourceChunkId,
    question_kind: cleanLabel(question.questionKind),
    difficulty_level: cleanLabel(question.difficultyLevel, 40),
    cognitive_level: cleanLabel(question.cognitiveLevel, 40),
    source_topic: cleanLabel(question.sourceTopic ?? question.studyRef?.topic, 120),
    question_fingerprint: cleanLabel(question.questionFingerprint, 240),
    generation_meta: cleanJsonObject(question.generationMeta),
  }));

  const { data: insertedQuestions, error: questionsError } = await adminSupabase
    .from("study_quiz_questions")
    .insert(questionPayload)
    .select("id, position");

  if (questionsError || !insertedQuestions) {
    console.error("[aiGeneratedPractice] question insert error:", questionsError);
    await adminSupabase.from("study_quiz_sets").delete().eq("id", quizSetId);
    throw Object.assign(new Error("Failed to save questions."), { status: 500, code: "QUESTION_INSERT_FAILED" });
  }

  const orderedQuestions = [...(insertedQuestions as InsertedQuestionRow[])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );

  const mcqQuestions = questionsToSave.filter((question) => question.question_type === "mcq");
  const optionPayload = orderedQuestions.flatMap((questionRow) => {
    if (typeof questionRow.position !== "number") return [];
    const question = questionsToSave[questionRow.position];
    if (!question || question.question_type !== "mcq" || !question.options || !question.answer) return [];
    return (["A", "B", "C", "D"] as const).map((key, index) => ({
      question_id: questionRow.id,
      text: question.options![key],
      is_correct: question.answer === key,
      position: index,
    }));
  });

  if (optionPayload.length !== mcqQuestions.length * 4) {
    await adminSupabase.from("study_quiz_questions").delete().eq("set_id", quizSetId);
    await adminSupabase.from("study_quiz_sets").delete().eq("id", quizSetId);
    throw Object.assign(new Error("Failed to save questions."), { status: 500, code: "OPTION_BUILD_FAILED" });
  }

  const { error: optionsError } = optionPayload.length > 0
    ? await adminSupabase.from("study_quiz_options").insert(optionPayload)
    : { error: null };

  if (optionsError) {
    console.error("[aiGeneratedPractice] option insert error:", optionsError);
    await adminSupabase.from("study_quiz_questions").delete().eq("set_id", quizSetId);
    await adminSupabase.from("study_quiz_sets").delete().eq("id", quizSetId);
    throw Object.assign(new Error("Failed to save questions. Please try again."), { status: 500, code: "OPTION_INSERT_FAILED" });
  }

  return {
    setId: quizSetId,
    savedCount: questionsToSave.length,
    requestedCount,
    repaired: repaired.repaired,
    replacedCount: repaired.replacedCount,
    skippedCount: repaired.skippedCount,
  };
}

const FINGERPRINT_STOP_WORDS = new Set([
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
  "discuss",
  "during",
  "explain",
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
