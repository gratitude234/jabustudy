// app/api/ai/generate-questions/route.ts
// POST /api/ai/generate-questions
// Generates typed practice questions from a study material using the configured AI provider.
// Supports: PDF, JPG/PNG/WEBP images, DOCX, PPTX.

export const maxDuration = 180;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateJson, userMessage, type AiContentBlock } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  extractMaterialContent,
  truncateText,
} from "@/lib/extractMaterialContent";
import { saveGeneratedPracticeSet, type GeneratedPracticeQuestion } from "@/lib/aiGeneratedPractice";
import { generateCoverageAwareQuestions, type StudyGenerationIntent } from "@/lib/studyQuestionGeneration";
import {
  markPoolQuestionsSeen,
  selectReusablePoolQuestions,
} from "@/lib/studyQuestionPool";
import {
  recordAiUsageEvent,
  withAiUsageContext,
  type AiUsageContext,
  type AiUsageStatus,
} from "@/lib/aiUsage";
import {
  discardDraftSet,
  ensureStudyCreditBalance,
  generationReceipt,
  getActiveGenerationDrafts,
  normalizeQuestionGenerationRequest,
  spendStudyCredits,
} from "@/lib/aiQuestionGenerationTrust";
import { getAiGenerationAccess, recordFreeAiGeneration } from "@/lib/studyBilling";

const QUESTION_GEN_TEXT_CHARS = 24_000;
const AI_QUESTION_TIMEOUT_MS =
  parsePositiveInt(process.env.AI_QUESTION_TIMEOUT_MS) ??
  parsePositiveInt(process.env.GEMINI_QUESTION_TIMEOUT_MS) ??
  60_000;
const ENABLE_COVERAGE_AWARE_MCQ =
  process.env.AI_ENABLE_COVERAGE_AWARE_QUESTIONS?.trim().toLowerCase() === "true";

function parsePositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type StudyMaterialRow = {
  id: string;
  title: string | null;
  file_url: string | null;
  file_path: string | null;
  material_type: string | null;
  index_status?: string | null;
  gemini_file_uri?: string | null;
};

type StudyRef = {
  chunkId?: string;
  topic?: string;
  instruction?: string;
  quote?: string;
  page?: number;
};

type OptionKey = "A" | "B" | "C" | "D";

type MaterialChunk = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  text: string;
};

type GeneratedQuestion = {
  question_type: "mcq";
  question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: OptionKey;
  explanation: string;
  hint?: string;
  questionKind?: string;
  difficultyLevel?: string;
  cognitiveLevel?: string;
  sourceTopic?: string;
  poolQuestionId?: string | null;
  sourceChunkId?: string;
  questionFingerprint?: string;
  generationMeta?: Record<string, unknown> | null;
  studyRef?: StudyRef;
} | {
  question_type: "short_answer" | "theory";
  question: string;
  model_answer: string;
  marking_points: string[];
  explanation: string;
  hint?: string;
  questionKind?: string;
  difficultyLevel?: string;
  cognitiveLevel?: string;
  sourceTopic?: string;
  poolQuestionId?: string | null;
  sourceChunkId?: string;
  questionFingerprint?: string;
  generationMeta?: Record<string, unknown> | null;
  studyRef?: StudyRef;
};

type QuestionFormat = "mcq" | "mixed" | "written";

function generationIntentInstruction(intent: StudyGenerationIntent | null) {
  switch (intent) {
    case "weak_areas":
      return "Prioritize weak areas that are not well represented by the already generated questions.";
    case "untested_sections":
      return "Prioritize sections of the material that have little or no question coverage yet.";
    case "application":
      return "Prioritize application and understanding questions over direct recall.";
    case "hard":
      return "Prioritize hard exam-style questions that require deeper reasoning.";
    case "topic":
      return "Prioritize the requested topic or focus area.";
    case "past_question_style":
      return "Write the questions in a past-question exam style.";
    default:
      return "";
  }
}

function routeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `Failed to generate questions: ${error.message}`;
  }
  return "Failed to generate questions.";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => optionalString(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 8);
  }
  const text = optionalString(value);
  if (!text) return [];
  return text
    .split(/\r?\n|;/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function optionalPage(value: unknown): number | undefined {
  const page = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(page) || page < 1 || page > 2000) return undefined;
  return Math.floor(page);
}

function cleanForCompare(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function sourceSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 220) return normalized;
  return `${normalized.slice(0, 220).replace(/\s+\S*$/, "")}...`;
}

function normalizeStudyRef(
  value: unknown,
  fallbackHint?: string,
  chunksById?: Map<string, MaterialChunk>
): StudyRef | undefined {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawChunkId = optionalString(raw.chunkId) ?? optionalString(raw.chunk_id);
  const chunk = rawChunkId && chunksById?.has(rawChunkId) ? chunksById.get(rawChunkId) : undefined;
  const topic = optionalString(raw.topic);
  const instruction = optionalString(raw.instruction) ?? fallbackHint;
  const rawQuote = optionalString(raw.quote);
  const quoteLooksGrounded = rawQuote && chunk
    ? cleanForCompare(chunk.text).includes(cleanForCompare(rawQuote))
    : Boolean(rawQuote);
  const quote = chunk && !quoteLooksGrounded ? sourceSnippet(chunk.text) : rawQuote;
  const page = optionalPage(raw.page) ?? (typeof chunk?.page_number === "number" ? chunk.page_number : undefined);
  const chunkId = chunk?.id;

  if (!topic && !instruction && !quote && !page && !chunkId) return undefined;
  return { chunkId, topic, instruction, quote: quote ?? (chunk ? sourceSnippet(chunk.text) : undefined), page };
}

function normalizeQuestionType(value: unknown): GeneratedQuestion["question_type"] {
  return value === "short_answer" || value === "theory" ? value : "mcq";
}

function normalizeGeneratedQuestions(questions: unknown[], chunksById?: Map<string, MaterialChunk>): GeneratedQuestion[] {
  const optionKeys = ["A", "B", "C", "D"] as const;

  return questions.flatMap<GeneratedQuestion>((item): GeneratedQuestion[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const questionType = normalizeQuestionType(raw.question_type ?? raw.questionType);
    const questionText = optionalString(raw.question);
    if (!questionText) return [];

    const hint = optionalString(raw.hint);
    const common = {
      question: questionText,
      explanation: optionalString(raw.explanation) ?? "",
      hint,
      questionKind: optionalString(raw.questionKind) ?? optionalString(raw.question_kind),
      difficultyLevel: optionalString(raw.difficultyLevel) ?? optionalString(raw.difficulty_level),
      cognitiveLevel: optionalString(raw.cognitiveLevel) ?? optionalString(raw.cognitive_level),
      sourceTopic: optionalString(raw.sourceTopic) ?? optionalString(raw.source_topic),
      studyRef: normalizeStudyRef(raw.studyRef, hint, chunksById),
    };

    if (questionType === "short_answer" || questionType === "theory") {
      const modelAnswer = optionalString(raw.model_answer) ?? optionalString(raw.modelAnswer);
      if (!modelAnswer) return [];
      return [{
        ...common,
        question_type: questionType,
        model_answer: modelAnswer,
        marking_points: optionalStringArray(raw.marking_points ?? raw.markingPoints),
      }];
    }

    const options = raw.options && typeof raw.options === "object"
      ? raw.options as Record<string, unknown>
      : {};
    const answer = raw.answer;

    const normalizedOptions = {
      A: optionalString(options.A) ?? "",
      B: optionalString(options.B) ?? "",
      C: optionalString(options.C) ?? "",
      D: optionalString(options.D) ?? "",
    };

    if (answer !== "A" && answer !== "B" && answer !== "C" && answer !== "D") return [];
    if (optionKeys.some((key) => !normalizedOptions[key])) return [];

    return [{
      ...common,
      question_type: "mcq",
      options: normalizedOptions,
      answer: answer as OptionKey,
    }];
  });
}

function questionFormatInstruction(questionFormat: QuestionFormat, questionCount: number) {
  if (questionFormat === "mcq") {
    return {
      label: "objective multiple choice",
      maxTokens: Math.min(6000, questionCount * 380),
      text: `Generate exactly ${questionCount} multiple choice questions strictly from the provided document content.
Each item must use question_type "mcq".
Each question must have 4 options (A, B, C, D) with exactly one correct answer.`,
    };
  }

  if (questionFormat === "written") {
    return {
      label: "written/theory",
      maxTokens: Math.min(8000, questionCount * 560),
      text: `Generate exactly ${questionCount} written-answer questions strictly from the provided document content.
Use only question_type "short_answer" or "theory".
Use short_answer for focused answers that fit in a few sentences.
Use theory for longer explain/describe/discuss answers.
Do not include options or answer letters for written questions.
Each written question must include a model_answer and marking_points array.`,
    };
  }

  const theoryCount = questionCount >= 10 ? Math.max(1, Math.round(questionCount * 0.1)) : Math.max(1, Math.floor(questionCount / 5));
  const shortAnswerCount = questionCount >= 5 ? Math.max(1, Math.round(questionCount * 0.2)) : 1;
  const writtenCount = Math.min(questionCount, shortAnswerCount + theoryCount);
  const mcqCount = Math.max(0, questionCount - writtenCount);
  return {
    label: "mixed objective and written",
    maxTokens: Math.min(8500, questionCount * 560),
    text: `Generate exactly ${questionCount} practice questions strictly from the provided document content.
Target this mix: ${mcqCount} mcq, ${shortAnswerCount} short_answer, ${theoryCount} theory. If the total needs adjustment, keep the final array length exactly ${questionCount}.
For mcq items, include question_type "mcq", 4 options (A, B, C, D), and exactly one correct answer.
For short_answer and theory items, do not include options or answer letters; include a model_answer and marking_points array.`,
  };
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

function computeBatches(total: number): number[] {
  if (total <= 10) return [total];
  const numBatches = 2;
  const base = Math.floor(total / numBatches);
  const rem = total % numBatches;
  return Array.from({ length: numBatches }, (_, i) => base + (i < rem ? 1 : 0));
}

type DirectGenResult = {
  questions: GeneratedQuestion[];
  ai: Record<string, unknown>;
};

function aiProviderFromMeta(ai: Record<string, unknown> | null | undefined): "bedrock" | "gemini" | null {
  const provider = ai?.provider;
  return provider === "bedrock" || provider === "gemini" ? provider : null;
}

function aiModelFromMeta(ai: Record<string, unknown> | null | undefined): string | null {
  return typeof ai?.model === "string" && ai.model.trim() ? ai.model.trim() : null;
}

async function recordQuestionGenerationUsage(
  context: AiUsageContext,
  status: AiUsageStatus,
  ai?: Record<string, unknown> | null,
  error?: unknown
) {
  await recordAiUsageEvent({
    ...context,
    provider: aiProviderFromMeta(ai),
    model: aiModelFromMeta(ai),
    status,
    errorCode: status === "failure" ? "GENERATE_QUESTIONS_FAILED" : null,
    errorMessage: status === "failure"
      ? error instanceof Error
        ? error.message
        : "Question generation failed."
      : null,
  });
}

async function runDirectGeneration(args: {
  material: StudyMaterialRow;
  filePath: string;
  totalCount: number;
  buildPrompt: (count: number, priorQuestions: string[]) => { prompt: string; maxTokens: number };
  onStatus?: (message: string, phase?: string) => void;
  onQuestion?: (question: GeneratedQuestion) => void;
}): Promise<DirectGenResult> {
  const { material, filePath, totalCount, buildPrompt, onStatus, onQuestion } = args;

  // Reuse cached Gemini file URI — skip download and base64 encoding
  const cachedFileUri = material.gemini_file_uri?.trim() ?? "";
  const cachedMimeType = cachedFileUri ? mimeTypeFromPath(filePath) : null;

  if (cachedFileUri && cachedMimeType) {
    onStatus?.("Preparing questions from your document.", "file-uri");
    const batches = computeBatches(totalCount);
    const allQuestions: GeneratedQuestion[] = [];
    let lastAi: Record<string, unknown> = {};

    for (let i = 0; i < batches.length; i++) {
      const batchCount = batches[i];
      const priorQuestions = allQuestions.map((q) => q.question);
      const { prompt, maxTokens } = buildPrompt(batchCount, priorQuestions);

      if (batches.length > 1) {
        onStatus?.(
          `Generating questions ${allQuestions.length + 1}–${allQuestions.length + batchCount}…`,
          "file-uri-batch"
        );
      }

      const parts: AiContentBlock[] = [
        { type: "file", mimeType: cachedMimeType, fileUri: cachedFileUri },
        { type: "text", text: prompt },
      ];
      const result = await generateJson<{ questions: unknown[] }>({
        messages: [userMessage(parts)],
        temperature: 0.3,
        maxTokens,
        timeoutMs: AI_QUESTION_TIMEOUT_MS,
        modelRole: "document",
      });
      if (!result.ok) {
        if (allQuestions.length > 0) break;
        throw new Error(result.error ?? "AI request failed.");
      }
      if (!Array.isArray(result.data.questions) || result.data.questions.length === 0) {
        if (allQuestions.length > 0) break;
        throw new Error("AI returned no questions.");
      }
      const batch = normalizeGeneratedQuestions(result.data.questions);
      for (const q of batch) {
        allQuestions.push(q);
        onQuestion?.(q);
      }
      lastAi = {
        provider: result.provider,
        model: result.model,
        fallbackProvider: result.fallbackProvider,
        fallbackReason: result.fallbackReason,
        modelFallbackFrom: result.modelFallbackFrom,
        modelFallbackReason: result.modelFallbackReason,
        repairedJson: result.repairedJson,
        repairProvider: result.repairProvider,
        repairModel: result.repairModel,
        inputMode: "file-uri",
        reason: `Generated ${totalCount} questions${batches.length > 1 ? ` in ${batches.length} batches` : ""} from cached Gemini file URI.`,
      };
    }

    if (allQuestions.length === 0) throw new Error("AI returned no valid questions.");
    return { questions: allQuestions, ai: lastAi };
  }

  // Resolve signed download URL
  onStatus?.("Preparing your document.", "prepare-file");
  const admin = adminSupabase;
  const { data: signed } = await admin.storage
    .from("study-materials")
    .createSignedUrl(filePath, 300);
  const downloadUrl = signed?.signedUrl ?? null;
  if (!downloadUrl) throw new Error("File URL not available.");

  let fileBuffer: ArrayBuffer;
  try {
    onStatus?.("Fetching the material file.", "download-file");
    const fetchRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    fileBuffer = await fetchRes.arrayBuffer();
  } catch (e) {
    throw new Error(e instanceof Error && e.message ? e.message : "Failed to fetch file.");
  }

  if (fileBuffer.byteLength > 15 * 1024 * 1024) {
    throw new Error("File is too large for AI question generation (max 15 MB). Try a shorter document.");
  }

  onStatus?.("Reading the document content.", "extract-content");
  const content = await extractMaterialContent(fileBuffer, filePath);
  if (content.kind === "unsupported") throw new Error(content.message);

  if (content.kind === "text") {
    const truncated = truncateText(content.text, QUESTION_GEN_TEXT_CHARS);
    const batches = computeBatches(totalCount);
    const allQuestions: GeneratedQuestion[] = [];
    let lastAi: Record<string, unknown> = {};

    for (let i = 0; i < batches.length; i++) {
      const batchCount = batches[i];
      const priorQuestions = allQuestions.map((q) => q.question);
      const { prompt, maxTokens } = buildPrompt(batchCount, priorQuestions);

      onStatus?.(
        batches.length > 1
          ? `Generating questions ${allQuestions.length + 1}–${allQuestions.length + batchCount}…`
          : "Generating your questions…",
        "ai-generate-text"
      );

      const result = await generateJson<{ questions: unknown[] }>({
        messages: [userMessage(`DOCUMENT CONTENT:\n\n${truncated}\n\n${prompt}`)],
        temperature: 0.3,
        maxTokens,
        timeoutMs: AI_QUESTION_TIMEOUT_MS,
        modelRole: "generation",
      });
      if (!result.ok) {
        if (allQuestions.length > 0) break;
        throw new Error(result.error ?? "AI request failed.");
      }
      if (!Array.isArray(result.data.questions) || result.data.questions.length === 0) {
        if (allQuestions.length > 0) break;
        throw new Error("AI returned no questions.");
      }
      const batch = normalizeGeneratedQuestions(result.data.questions);
      for (const q of batch) {
        allQuestions.push(q);
        onQuestion?.(q);
      }
      lastAi = {
        provider: result.provider,
        model: result.model,
        fallbackProvider: result.fallbackProvider,
        fallbackReason: result.fallbackReason,
        modelFallbackFrom: result.modelFallbackFrom,
        modelFallbackReason: result.modelFallbackReason,
        repairedJson: result.repairedJson,
        repairProvider: result.repairProvider,
        repairModel: result.repairModel,
        inputMode: "extracted-text",
        reason: `Generated questions from extracted document text.`,
      };
    }

    if (allQuestions.length === 0) throw new Error("AI returned no valid questions.");
    return { questions: allQuestions, ai: lastAi };
  }

  if (content.kind !== "inline") throw new Error("Unexpected content kind.");

  // Inline path: single call — no batching to avoid re-encoding the file multiple times
  onStatus?.("Reading your document…", "ai-generate-file");
  const { prompt: inlinePrompt, maxTokens: inlineMaxTokens } = buildPrompt(totalCount, []);
  const parts: AiContentBlock[] = [
    { type: "inline", mimeType: content.mimeType, data: content.base64, name: "study material" },
    { type: "text", text: inlinePrompt },
  ];
  const result = await generateJson<{ questions: unknown[] }>({
    messages: [userMessage(parts)],
    temperature: 0.3,
    maxTokens: inlineMaxTokens,
    timeoutMs: AI_QUESTION_TIMEOUT_MS,
    modelRole: "document",
  });
  if (!result.ok) throw new Error(result.error ?? "AI request failed.");
  if (!Array.isArray(result.data.questions) || result.data.questions.length === 0) {
    throw new Error("AI returned no questions.");
  }
  const questions = normalizeGeneratedQuestions(result.data.questions);
  if (questions.length === 0) throw new Error("AI returned no valid questions.");
  for (const q of questions) {
    onQuestion?.(q);
  }
  return {
    questions,
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
      inputMode: "inline-file",
      reason: content.reason ?? `Generated questions from the inline file.`,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    return await handleGenerateQuestionsRequest(req);
  } catch (error) {
    console.error("[generate-questions] unhandled route error:", error);
    return NextResponse.json({ error: routeErrorMessage(error) }, { status: 500 });
  }
}

async function handleGenerateQuestionsRequest(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    materialId?: string;
    count?: number;
    difficulty?: "easy" | "mixed" | "hard";
    focus?: string;
    questionFormat?: string;
    coveredQuestions?: string[];
    persistDraft?: boolean;
    ignoreMatchingDraft?: boolean;
    generationIntent?: string;
    topicId?: string | null;
    subtopicId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { coveredQuestions = [] } = body;
  const persistDraft = body.persistDraft === true;
  const ignoreMatchingDraft = body.ignoreMatchingDraft === true;
  const requestConfig = normalizeQuestionGenerationRequest({
    materialId: body.materialId,
    count: body.count,
    difficulty: body.difficulty,
    focus: body.focus,
    questionFormat: body.questionFormat,
    generationIntent: body.generationIntent,
    topicId: body.topicId,
    subtopicId: body.subtopicId,
  });
  if (!requestConfig) return NextResponse.json({ error: "Missing materialId" }, { status: 400 });

  const materialId = requestConfig.materialId;
  const questionCount = requestConfig.questionCount;
  const questionFormat = requestConfig.questionFormat;
  const effectiveDifficulty = requestConfig.effectiveDifficulty;
  const focus = requestConfig.focus ?? undefined;
  const generationIntent = requestConfig.generationIntent;
  const topicId = requestConfig.topicId;
  const subtopicId = requestConfig.subtopicId;
  const estimatedCreditCost = requestConfig.creditCost;
  const canReuseDraft = persistDraft && !ignoreMatchingDraft && coveredQuestions.length === 0;

  // ── Fetch material ─────────────────────────────────────────────────────────
  const admin = adminSupabase;
  const { data: mat, error: matErr } = await admin
    .from("study_materials")
    .select("id, title, file_url, file_path, material_type, index_status, gemini_file_uri, study_courses(id, course_code)")
    .eq("id", materialId)
    .maybeSingle();

  if (matErr || !mat) return NextResponse.json({ error: "Material not found." }, { status: 404 });

  const material = mat as StudyMaterialRow;
  const filePath = material.file_path;
  if (!filePath) return NextResponse.json({ error: "No file attached to this material." }, { status: 400 });

  if (canReuseDraft) {
    const { matchingDraft } = await getActiveGenerationDrafts({
      userId: user.id,
      materialId,
      signature: requestConfig.signature,
    });

    if (matchingDraft) {
      const balance = await ensureStudyCreditBalance(user.id);
      const receiptMessage = generationReceipt({
        savedCount: matchingDraft.questionsCount,
        creditCost: 0,
        creditsRemaining: balance,
        reusedDraft: true,
      });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({
            type: "status",
            message: "Found a matching saved draft. No credits charged.",
            phase: "reuse-draft",
          }) + "\n"));
          controller.enqueue(encoder.encode(JSON.stringify({
            type: "done",
            draftSetId: matchingDraft.setId,
            savedCount: matchingDraft.questionsCount,
            requestedCount: matchingDraft.questionsCount,
            reusedDraft: true,
            charged: false,
            creditCost: 0,
            creditsRemaining: balance,
            receiptMessage,
          }) + "\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  }

  const pooledQuestions = persistDraft
    ? await selectReusablePoolQuestions({
      userId: user.id,
      materialId,
      count: questionCount,
      questionFormat,
      difficulty: effectiveDifficulty,
      focus: requestConfig.focus,
      coveredQuestions,
    })
    : [];
  const pooledCount = pooledQuestions.length;
  const aiQuestionCount = Math.max(0, questionCount - pooledCount);
  const estimatedAiCreditCost = Math.max(1, Math.ceil(questionCount / 5));
  const aiCoveredQuestions = [
    ...coveredQuestions,
    ...pooledQuestions.map((question) => question.question),
  ];

  const usageContext: AiUsageContext = {
    userId: user.id,
    endpoint: "generate-questions",
    route: "/api/ai/generate-questions",
    materialId,
    requestedCount: aiQuestionCount,
    metadata: {
      requestedQuestionCount: requestConfig.requestedQuestionCount,
      requestedSavedQuestionCount: questionCount,
      questionFormat,
      difficulty: effectiveDifficulty,
      focus: requestConfig.focus,
      generationIntent,
      topicId,
      subtopicId,
      requestSignature: requestConfig.signature,
      estimatedCreditCost: estimatedAiCreditCost,
      originalEstimatedCreditCost: estimatedCreditCost,
      pooledCount,
      generatedCount: aiQuestionCount,
      reusedPool: pooledCount > 0,
    },
  };
  const generationAccess = await getAiGenerationAccess(user.id, estimatedAiCreditCost);

  // ── Credits check ─────────────────────────────────────────────────────────
  const currentBalance = generationAccess.credits.balance;
  if (!generationAccess.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: generationAccess.freeAi.remaining <= 0 ? "AI_LIMIT_REACHED" : "INSUFFICIENT_CREDITS",
        message: generationAccess.freeAi.remaining <= 0
          ? "You have used your free AI generations for this month. Upgrade or buy credits to continue."
          : "Not enough credits to generate questions",
        chargeStatus: "not_charged",
      },
      { status: 402 }
    );
  }

  // The actual spend happens after generation and draft persistence succeed.
  let creditsRemaining = currentBalance;

  // ── Build prompt components ────────────────────────────────────────────────
  const difficultyInstruction = {
    easy: "Generate straightforward recall and definition questions.",
    mixed: "Mix of recall, application, and analysis questions.",
    hard: "Generate exam-style questions requiring deep understanding and application.",
  }[effectiveDifficulty] ?? "Mix of recall, application, and analysis questions.";

  const focusInstruction = [focus ? `Focus specifically on: ${focus}` : "", generationIntentInstruction(generationIntent)]
    .filter(Boolean)
    .join("\n");

  const buildPrompt = (batchCount: number, priorBatchQuestions: string[]) => {
    const fmt = questionFormatInstruction(questionFormat, batchCount);
    const allCovered = [...aiCoveredQuestions.slice(-20), ...priorBatchQuestions].slice(-20);
    const coveredInstruction = allCovered.length > 0
      ? `\n\nThe following questions have ALREADY been generated from this document. Do NOT repeat these topics or ask similar questions. Identify sections or concepts in the document that are NOT covered by these questions and generate new questions from those parts:\n${allCovered.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";
    const prompt = `You are an exam question generator for Nigerian university students.
${fmt.text}
Do not add any knowledge from outside the document.
${difficultyInstruction}${focusInstruction ? `\n${focusInstruction}` : ""}${coveredInstruction}
Include a short explanation (1-2 sentences) for each question, citing the part of the document it came from.
Include a hint (1 sentence) that nudges the student toward the right concept without naming the answer directly.
For each question, include studyRef to guide the student back to the source before answering:
- topic: the concept or section to review.
- instruction: a short student-facing reading instruction.
- quote: a short relevant excerpt from the document, if available.
- page: page number only if you can identify it confidently; otherwise omit it.

Return ONLY a valid JSON object with no markdown, no backticks, no preamble:
{
  "questions": [
    {
      "question_type": "mcq",
      "question": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "answer": "A" | "B" | "C" | "D",
      "explanation": "string",
      "hint": "string",
      "studyRef": {
        "topic": "string",
        "instruction": "string",
        "quote": "string",
        "page": 1
      }
    },
    {
      "question_type": "short_answer" | "theory",
      "question": "string",
      "model_answer": "string",
      "marking_points": ["string"],
      "explanation": "string",
      "hint": "string",
      "studyRef": {
        "topic": "string",
        "instruction": "string",
        "quote": "string",
        "page": 1
      }
    }
  ]
}`;
    return { prompt, maxTokens: fmt.maxTokens };
  };

  // ── Stream NDJSON response ─────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      await withAiUsageContext({ ...usageContext, suppressProviderUsageEvents: true }, async () => {
      let usageRecorded = false;
      const recordUsage = async (
        status: AiUsageStatus,
        ai?: Record<string, unknown> | null,
        error?: unknown
      ) => {
        if (usageRecorded) return;
        usageRecorded = true;
        await recordQuestionGenerationUsage(usageContext, status, ai, error);
      };
      const emit = (obj: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      const emitStatus = (message: string, phase?: string) => {
        emit({ type: "status", message, phase });
      };
      const buildGenerationConfig = (
        ai: Record<string, unknown>,
        credit?: Record<string, unknown>
      ) => ({
        count: questionCount,
        difficulty: effectiveDifficulty,
        focus: focus || null,
        questionFormat,
        generationIntent,
        topicId,
        subtopicId,
        ai,
        request: {
          ...requestConfig.signaturePayload,
          signature: requestConfig.signature,
        },
        credit: credit ?? {
          estimatedCost: estimatedAiCreditCost,
          charged: false,
        },
        pool: {
          requestedCount: questionCount,
          pooledCount,
          generatedCount: aiQuestionCount,
          reusedPool: pooledCount > 0,
        },
      });
      const persistDraftIfNeeded = async (questions: GeneratedPracticeQuestion[], ai: Record<string, unknown>) => {
        if (!persistDraft) return null;
        emitStatus("Saving your AI practice draft.", "persist-draft");
        return saveGeneratedPracticeSet({
          userId: user.id,
          materialId,
          questions,
          asDraft: true,
          generationConfig: buildGenerationConfig(ai),
        });
      };
      const finalizeSuccessfulGeneration = async (
        questions: GeneratedPracticeQuestion[],
        ai: Record<string, unknown>,
        draft: Awaited<ReturnType<typeof persistDraftIfNeeded>>,
        chargeableCount: number
      ) => {
        const savedCount = draft?.savedCount ?? questions.length;
        if (persistDraft && (!draft?.setId || savedCount <= 0)) {
          throw new Error("Questions generated, but the draft could not be saved. No credits charged.");
        }

        const savedGeneratedCount = Math.max(0, draft?.generatedCount ?? chargeableCount);
        const finalCreditCost = savedCount > 0 ? Math.max(1, Math.ceil(savedCount / 5)) : 0;
        if (finalCreditCost > 0 && generationAccess.chargeMode === "free_monthly") {
          emitStatus("Confirming free monthly generation.", "free-ai-allowance");
          try {
            await recordFreeAiGeneration(user.id, {
              materialId,
              savedCount,
              generatedCount: savedGeneratedCount,
              creditEquivalent: finalCreditCost,
            });
          } catch (freeError) {
            if (draft?.setId) await discardDraftSet(draft.setId);
            throw Object.assign(
              new Error("Your free AI generations are used up. No credits charged."),
              { code: "AI_LIMIT_REACHED", cause: freeError }
            );
          }
        } else if (finalCreditCost > 0) {
          emitStatus("Confirming credits.", "charge-credits");
          const spend = await spendStudyCredits({ userId: user.id, cost: finalCreditCost });
          if (!spend.ok) {
            if (draft?.setId) await discardDraftSet(draft.setId);
            const message = spend.code === "INSUFFICIENT_CREDITS"
              ? "Not enough credits to generate questions. No credits charged."
              : "Credit charge could not be completed. No credits charged.";
            throw Object.assign(new Error(message), { code: spend.code });
          }

          creditsRemaining = spend.balance;
        }
        const receiptMessage = generationAccess.chargeMode === "free_monthly" && finalCreditCost > 0
          ? `${savedCount} question${savedCount === 1 ? "" : "s"} saved - free monthly AI generation used - ${creditsRemaining} credits left.`
          : generationReceipt({
            savedCount,
            creditCost: finalCreditCost,
            creditsRemaining,
          });

        if (draft?.poolQuestionIds?.length) {
          await markPoolQuestionsSeen({
            userId: user.id,
            materialId,
            poolQuestionIds: draft.poolQuestionIds,
          });
        }

        if (draft?.setId) {
          try {
            await admin
              .from("study_quiz_sets")
              .update({
                generation_config: buildGenerationConfig(ai, {
                  estimatedCost: estimatedAiCreditCost,
                  cost: finalCreditCost,
                  charged: finalCreditCost > 0 && generationAccess.chargeMode !== "free_monthly",
                  chargeMode: finalCreditCost > 0 ? generationAccess.chargeMode : "none",
                  chargedAt: new Date().toISOString(),
                  balanceAfter: creditsRemaining,
                  receiptMessage,
                }),
              })
              .eq("id", draft.setId);
          } catch (configError) {
            console.warn(
              "[generate-questions] credit receipt metadata update failed:",
              configError instanceof Error ? configError.message : configError
            );
          }
        }

        return {
          creditCost: finalCreditCost,
          creditsRemaining,
          receiptMessage,
          savedCount,
        };
      };

      try {
        emitStatus("Starting question generation.", "start");
        console.info("[generate-questions] START", {
          userId: user.id,
          materialId,
          questionCount,
          questionFormat,
          effectiveDifficulty,
          generationIntent,
          model: process.env.GEMINI_MODEL_GENERATION?.trim() ?? process.env.GEMINI_MODEL?.trim() ?? "gemini-2.5-flash",
          coverageAwarePath: questionFormat === "mcq" && ENABLE_COVERAGE_AWARE_MCQ,
          hasCachedFileUri: Boolean(material.gemini_file_uri?.trim()),
          inputMode: material.gemini_file_uri?.trim() ? "file-uri" : "text-or-inline",
          pooledCount,
          aiQuestionCount,
        });
        if (pooledCount > 0) {
          emitStatus("Preparing your questions.", "prepare-pool");
          for (const question of pooledQuestions) {
            emit({ type: "question", question });
          }
        }
        if (aiQuestionCount === 0) {
          const ai = {
            provider: "question_pool",
            model: "stored-material-questions",
            inputMode: "question-pool",
            reason: "Prepared questions from stored material question pool.",
          };
          const draft = await persistDraftIfNeeded(pooledQuestions, ai);
          const receipt = await finalizeSuccessfulGeneration(pooledQuestions, ai, draft, 0);
          emit({
            type: "done",
            ai,
            draftSetId: draft?.setId,
            savedQuestions: draft?.savedQuestions,
            savedCount: receipt.savedCount,
            requestedCount: draft?.requestedCount,
            repaired: draft?.repaired,
            replacedCount: draft?.replacedCount,
            skippedCount: draft?.skippedCount,
            reusedDraft: false,
            reusedPool: true,
            pooledCount: draft?.poolBackedCount ?? pooledCount,
            generatedCount: draft?.generatedCount ?? 0,
            charged: false,
            creditCost: receipt.creditCost,
            creditsRemaining: receipt.creditsRemaining,
            receiptMessage: receipt.receiptMessage,
          });
          return;
        }
        // Coverage-aware MCQ path
        if (questionFormat === "mcq" && ENABLE_COVERAGE_AWARE_MCQ) {
          let emittedAny = false;

          try {
            emitStatus("Planning source-backed questions from indexed chunks.", "coverage-plan");
            const coverageResult = await generateCoverageAwareQuestions({
              materialId,
              materialTitle: material.title ?? "Untitled material",
              count: aiQuestionCount,
              difficulty: effectiveDifficulty,
              focus,
              coveredQuestions: aiCoveredQuestions,
              ownerUserId: user.id,
              generationIntent,
              topicId,
              subtopicId,
              onQuestion: (q) => {
                emit({ type: "question", question: q });
                emitStatus("Checking quality and source references.", "coverage-question");
                emittedAny = true;
              },
            });

            if (coverageResult?.questions.length) {
              const missingChunkRefs = coverageResult.questions.filter((q) => !q.studyRef?.chunkId).length;
              if (missingChunkRefs > 0) {
                console.warn("[generate-questions] coverage-aware result included best-effort refs:", {
                  materialId,
                  missingChunkRefs,
                });
              }
              const kindSummary = Object.entries(coverageResult.questionKindCounts)
                .map(([kind, value]) => `${value} ${kind.replace(/_/g, " ")}`)
                .join(", ");
              const ai = {
                provider: coverageResult.ai?.provider ?? "gemini",
                model: coverageResult.ai?.model ?? process.env.GEMINI_MODEL_GENERATION?.trim() ?? process.env.GEMINI_MODEL?.trim() ?? "gemini-2.5-flash",
                fallbackProvider: coverageResult.ai?.fallbackProvider,
                fallbackReason: coverageResult.ai?.fallbackReason,
                modelFallbackFrom: coverageResult.ai?.modelFallbackFrom,
                modelFallbackReason: coverageResult.ai?.modelFallbackReason,
                inputMode: "coverage-aware",
                reason: `Coverage-aware generation covered ${coverageResult.topicsCovered} topic(s)${kindSummary ? `: ${kindSummary}` : ""}.`,
                coverage: {
                  topicsCovered: coverageResult.topicsCovered,
                  questionKindCounts: coverageResult.questionKindCounts,
                  cognitiveLevelCounts: coverageResult.cognitiveLevelCounts,
                  chunksLoaded: coverageResult.chunksLoaded,
                  chunksCatalogued: coverageResult.chunksCatalogued,
                  courseMap: coverageResult.coverage,
                  intent: coverageResult.coverage?.intent ?? generationIntent,
                  intentLabel: coverageResult.coverage?.intentLabel,
                  targetedTopic: coverageResult.coverage?.targetedTopic,
                  reason: coverageResult.coverage?.reason,
                },
              };
              const combinedQuestions = [
                ...pooledQuestions,
                ...(coverageResult.questions as GeneratedPracticeQuestion[]),
              ];
              const draft = await persistDraftIfNeeded(combinedQuestions, ai);
              const receipt = await finalizeSuccessfulGeneration(
                combinedQuestions,
                ai,
                draft,
                coverageResult.questions.length
              );
              await recordUsage("success", ai);
              emit({
                type: "done",
                ai,
                draftSetId: draft?.setId,
                savedQuestions: draft?.savedQuestions,
                savedCount: receipt.savedCount,
                requestedCount: draft?.requestedCount,
                repaired: draft?.repaired,
                replacedCount: draft?.replacedCount,
                skippedCount: draft?.skippedCount,
                reusedDraft: false,
                reusedPool: pooledCount > 0,
                pooledCount: draft?.poolBackedCount ?? pooledCount,
                generatedCount: draft?.generatedCount ?? coverageResult.questions.length,
                charged: receipt.creditCost > 0,
                creditCost: receipt.creditCost,
                creditsRemaining: receipt.creditsRemaining,
                receiptMessage: receipt.receiptMessage,
              });
              return;
            }
          } catch (coverageError) {
            if (emittedAny) {
              throw new Error("Generation stopped before the questions could be saved. No credits charged.");
            }
            console.warn("[generate-questions] coverage-aware generation fell back:", coverageError instanceof Error ? coverageError.message : coverageError);
            if (material.index_status === "ready") {
              console.warn("[generate-questions] indexed material using best-effort fallback:", { materialId });
            }
            emitStatus("Using the best available document-reading path instead.", "direct-fallback");
          }

          // If emittedAny but coverageResult had 0 questions (shouldn't happen), exit cleanly
          if (emittedAny) return;
        }

        // Direct generation — text extraction, file URI, or inline base64
        const directResult = await runDirectGeneration({
          material,
          filePath,
          totalCount: aiQuestionCount,
          buildPrompt,
          onStatus: emitStatus,
          onQuestion: (q) => emit({ type: "question", question: q }),
        });
        const combinedQuestions = [
          ...pooledQuestions,
          ...(directResult.questions as GeneratedPracticeQuestion[]),
        ];
        const draft = await persistDraftIfNeeded(combinedQuestions, directResult.ai);
        const receipt = await finalizeSuccessfulGeneration(
          combinedQuestions,
          directResult.ai,
          draft,
          directResult.questions.length
        );
        await recordUsage("success", directResult.ai);
        emit({
          type: "done",
          ai: directResult.ai,
          draftSetId: draft?.setId,
          savedQuestions: draft?.savedQuestions,
          savedCount: receipt.savedCount,
          requestedCount: draft?.requestedCount,
          repaired: draft?.repaired,
          replacedCount: draft?.replacedCount,
          skippedCount: draft?.skippedCount,
          reusedDraft: false,
          reusedPool: pooledCount > 0,
          pooledCount: draft?.poolBackedCount ?? pooledCount,
          generatedCount: draft?.generatedCount ?? directResult.questions.length,
          charged: receipt.creditCost > 0,
          creditCost: receipt.creditCost,
          creditsRemaining: receipt.creditsRemaining,
          receiptMessage: receipt.receiptMessage,
        });
      } catch (error) {
        const errCause = error instanceof Error ? error.cause : undefined;
        console.error("[generate-questions] FAILED", {
          userId: user.id,
          materialId,
          questionCount,
          questionFormat,
          error: error instanceof Error ? error.message : String(error),
          code: (error as { code?: unknown })?.code,
          status: (error as { status?: unknown })?.status,
          cause: errCause instanceof Error
            ? errCause.message
            : errCause && typeof errCause === "object"
              ? { message: (errCause as { message?: unknown }).message, code: (errCause as { code?: unknown }).code, details: (errCause as { details?: unknown }).details }
              : errCause,
        });
        if (aiQuestionCount > 0) {
          await recordUsage("failure", null, error);
        }
        try {
          emit({ type: "error", message: routeErrorMessage(error), chargeStatus: "not_charged" });
        } catch { /* controller already closed */ }
      } finally {
        controller.close();
      }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
