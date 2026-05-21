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
import { generateCoverageAwareQuestions, type StudyGenerationIntent } from "@/lib/studyQuestionGeneration";

const QUESTION_GEN_TEXT_CHARS = 24_000;
const AI_QUESTION_TIMEOUT_MS =
  parsePositiveInt(process.env.AI_QUESTION_TIMEOUT_MS) ??
  parsePositiveInt(process.env.GEMINI_QUESTION_TIMEOUT_MS) ??
  60_000;
const MAX_QUESTION_COUNT = 20;

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
  studyRef?: StudyRef;
};

type QuestionFormat = "mcq" | "mixed" | "written";

const GENERATION_INTENTS = new Set<StudyGenerationIntent>([
  "weak_areas",
  "untested_sections",
  "application",
  "hard",
  "topic",
  "past_question_style",
]);

function normalizeGenerationIntent(value: unknown): StudyGenerationIntent | null {
  return typeof value === "string" && GENERATION_INTENTS.has(value as StudyGenerationIntent)
    ? (value as StudyGenerationIntent)
    : null;
}

function normalizeQuestionFormat(value: unknown): QuestionFormat {
  return value === "mcq" || value === "written" || value === "mixed" ? value : "mixed";
}

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
    generationIntent?: string;
    topicId?: string | null;
    subtopicId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { materialId, count = 10, difficulty = "mixed", focus, coveredQuestions = [] } = body;
  const questionFormat = normalizeQuestionFormat(body.questionFormat);
  const generationIntent = normalizeGenerationIntent(body.generationIntent);
  const topicId = typeof body.topicId === "string" && body.topicId.trim() ? body.topicId.trim() : null;
  const subtopicId = typeof body.subtopicId === "string" && body.subtopicId.trim() ? body.subtopicId.trim() : null;
  if (!materialId) return NextResponse.json({ error: "Missing materialId" }, { status: 400 });
  const questionCount = Math.max(1, Math.min(MAX_QUESTION_COUNT, Math.floor(Number(count) || 10)));
  const effectiveDifficulty = generationIntent === "hard" || generationIntent === "past_question_style" ? "hard" : difficulty;

  // ── Fetch material ─────────────────────────────────────────────────────────
  const admin = adminSupabase;
  const { data: mat, error: matErr } = await admin
    .from("study_materials")
    .select("id, title, file_url, file_path, material_type, index_status, study_courses(id, course_code)")
    .eq("id", materialId)
    .maybeSingle();

  if (matErr || !mat) return NextResponse.json({ error: "Material not found." }, { status: 404 });

  const material = mat as StudyMaterialRow;
  const filePath = material.file_path;
  if (!filePath) return NextResponse.json({ error: "No file attached to this material." }, { status: 400 });

  const difficultyInstruction = {
    easy: "Generate straightforward recall and definition questions.",
    mixed: "Mix of recall, application, and analysis questions.",
    hard: "Generate exam-style questions requiring deep understanding and application.",
  }[effectiveDifficulty] ?? "Mix of recall, application, and analysis questions.";

  const focusInstruction = [focus ? `Focus specifically on: ${focus}` : "", generationIntentInstruction(generationIntent)]
    .filter(Boolean)
    .join("\n");

  const cappedCoveredQuestions = coveredQuestions.slice(-20);
  const coveredInstruction = cappedCoveredQuestions.length > 0
    ? `\n\nThe following questions have ALREADY been generated from this document. Do NOT repeat these topics or ask similar questions. Identify sections or concepts in the document that are NOT covered by these questions and generate new questions from those parts:\n${cappedCoveredQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";
  const formatInstruction = questionFormatInstruction(questionFormat, questionCount);

  if (questionFormat === "mcq") {
    try {
      const coverageResult = await generateCoverageAwareQuestions({
        materialId,
        materialTitle: material.title ?? "Untitled material",
        count: questionCount,
        difficulty: effectiveDifficulty,
        focus,
        coveredQuestions,
        generationIntent,
        topicId,
        subtopicId,
      });

      if (coverageResult?.questions.length) {
        const missingChunkRefs = coverageResult.questions.filter((question) => !question.studyRef?.chunkId).length;
        if (missingChunkRefs > 0) {
          console.warn("[generate-questions] coverage-aware result included best-effort refs for indexed material:", {
            materialId,
            missingChunkRefs,
          });
        }
        const kindSummary = Object.entries(coverageResult.questionKindCounts)
          .map(([kind, value]) => `${value} ${kind.replace(/_/g, " ")}`)
          .join(", ");
        return NextResponse.json({
          questions: coverageResult.questions,
          ai: {
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
          },
        });
      }
    } catch (error) {
      console.warn("[generate-questions] coverage-aware generation fell back:", error instanceof Error ? error.message : error);
      if (material.index_status === "ready") {
        console.warn("[generate-questions] indexed material is using best-effort generation fallback:", {
          materialId,
          indexStatus: material.index_status,
        });
      }
    }
  }

  // ── Resolve signed download URL ────────────────────────────────────────────
  const { data: signed } = await admin.storage
    .from("study-materials")
    .createSignedUrl(filePath, 300);
  const downloadUrl = signed?.signedUrl ?? null;
  if (!downloadUrl) return NextResponse.json({ error: "File URL not available." }, { status: 404 });

  // ── Fetch file bytes ───────────────────────────────────────────────────────
  let fileBuffer: ArrayBuffer;
  try {
    const fetchRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    fileBuffer = await fetchRes.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "Failed to fetch file." }, { status: 502 });
  }

  if (fileBuffer.byteLength > 15 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File is too large for AI question generation (max 15 MB). Try a shorter document." },
      { status: 422 }
    );
  }

  // ── Extract content (PDF/image → inline, DOCX/PPTX → text) ────────────────
  const content = await extractMaterialContent(fileBuffer, filePath);
  if (content.kind === "unsupported") {
    return NextResponse.json({ error: content.message }, { status: 422 });
  }

  // ── Build AI request ───────────────────────────────────────────────────────
  const systemPrompt = `You are an exam question generator for Nigerian university students.
${formatInstruction.text}
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

  if (content.kind === "text") {
    const truncated = truncateText(content.text, QUESTION_GEN_TEXT_CHARS);
    const result = await generateJson<{ questions: unknown[] }>({
      messages: [userMessage(`DOCUMENT CONTENT:\n\n${truncated}\n\n${systemPrompt}`)],
      temperature: 0.3,
      maxTokens: formatInstruction.maxTokens,
      timeoutMs: AI_QUESTION_TIMEOUT_MS,
      modelRole: "generation",
    });

    if (!result.ok) {
      return NextResponse.json({
        error: "Failed to generate questions.",
        ai: { provider: result.provider, model: result.model, error: result.error },
      }, { status: 500 });
    }
    if (!Array.isArray(result.data.questions) || result.data.questions.length === 0) {
      return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
    }
    const questions = normalizeGeneratedQuestions(result.data.questions);
    if (questions.length === 0) {
      return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
    }
    return NextResponse.json({
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
        inputMode: "extracted-text",
        reason: `Generated ${formatInstruction.label} questions from extracted document text.`,
      },
    });
  }

  // Build parts array depending on content kind
  type InlinePart = AiContentBlock;

  let parts: InlinePart[];
  if (content.kind === "inline") {
    parts = [
      { type: "inline", mimeType: content.mimeType, data: content.base64, name: "study material" },
      { type: "text", text: systemPrompt },
    ];
  } else {
    return NextResponse.json({ error: "Unexpected content kind." }, { status: 500 });
  }

  const result = await generateJson<{ questions: unknown[] }>({
    messages: [userMessage(parts)],
    temperature: 0.3,
    maxTokens: formatInstruction.maxTokens,
    timeoutMs: AI_QUESTION_TIMEOUT_MS,
    modelRole: "document",
  });

  if (!result.ok) {
    return NextResponse.json({
      error: "Failed to generate questions.",
      ai: { provider: result.provider, model: result.model, error: result.error },
    }, { status: 500 });
  }

  // ── Call configured AI provider ────────────────────────────────────────────
  // ── Parse response ─────────────────────────────────────────────────────────
  try {
    if (!Array.isArray(result.data.questions) || result.data.questions.length === 0) {
      return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
    }
    const questions = normalizeGeneratedQuestions(result.data.questions);
    if (questions.length === 0) {
      return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
    }
    return NextResponse.json({
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
        reason: content.reason ?? `Generated ${formatInstruction.label} questions from the inline file.`,
      },
    });
  } catch (e: unknown) {
    console.error("[generate-questions] JSON normalize error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
  }
}
