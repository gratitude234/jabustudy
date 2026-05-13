// app/api/ai/generate-questions/route.ts
// POST /api/ai/generate-questions
// Generates MCQ practice questions from a study material using Gemini.
// Supports: PDF, JPG/PNG/WEBP images, DOCX, PPTX.

export const maxDuration = 180;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateJson, userMessage } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  extractMaterialContent,
  truncateText,
} from "@/lib/extractMaterialContent";
import { generateCoverageAwareQuestions } from "@/lib/studyQuestionGeneration";

const MODEL = "gemini-2.5-flash-lite";
const QUESTION_GEN_TEXT_CHARS = 24_000;
const GEMINI_QUESTION_TIMEOUT_MS = parsePositiveInt(process.env.GEMINI_QUESTION_TIMEOUT_MS) ?? 60_000;

function parsePositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function geminiModelName() {
  return process.env.GEMINI_MODEL?.trim() || MODEL;
}

function geminiGenerateUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName()}:generateContent`;
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

type MaterialChunk = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  text: string;
};

type GeneratedQuestion = {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: "A" | "B" | "C" | "D";
  explanation: string;
  hint?: string;
  studyRef?: StudyRef;
};

function routeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `Failed to generate questions: ${error.message}`;
  }
  return "Failed to generate questions.";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
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

function normalizeGeneratedQuestions(questions: unknown[], chunksById?: Map<string, MaterialChunk>): GeneratedQuestion[] {
  const optionKeys = ["A", "B", "C", "D"] as const;

  return questions.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
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

    const questionText = optionalString(raw.question);
    if (!questionText) return [];
    if (answer !== "A" && answer !== "B" && answer !== "C" && answer !== "D") return [];
    if (optionKeys.some((key) => !normalizedOptions[key])) return [];

    const hint = optionalString(raw.hint);
    return [{
      question: questionText,
      options: normalizedOptions,
      answer: answer as GeneratedQuestion["answer"],
      explanation: optionalString(raw.explanation) ?? "",
      hint,
      studyRef: normalizeStudyRef(raw.studyRef, hint, chunksById),
    }];
  });
}

async function loadIndexedChunks(materialId: string): Promise<MaterialChunk[]> {
  try {
    const { data, error } = await adminSupabase
      .from("study_material_chunks")
      .select("id, page_number, chunk_index, text")
      .eq("material_id", materialId)
      .order("chunk_index", { ascending: true })
      .limit(80);

    if (error) {
      console.warn("[generate-questions] could not load material chunks:", error.message);
      return [];
    }

    return (data ?? []).filter((chunk: any) => typeof chunk?.text === "string" && chunk.text.trim().length > 0) as MaterialChunk[];
  } catch (error) {
    console.warn("[generate-questions] chunk load failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

function chunkPromptBlocks(chunks: MaterialChunk[]): MaterialChunk[] {
  const selected: MaterialChunk[] = [];
  let total = 0;

  for (const chunk of chunks) {
    const nextTotal = total + chunk.text.length;
    if (selected.length > 0 && nextTotal > QUESTION_GEN_TEXT_CHARS) break;
    selected.push(chunk);
    total = nextTotal;
  }

  return selected;
}

function buildChunkDocument(chunks: MaterialChunk[]): string {
  return chunks
    .map((chunk) => {
      const page = typeof chunk.page_number === "number" ? ` page:${chunk.page_number}` : "";
      return `[chunk:${chunk.id}${page}]\n${chunk.text}`;
    })
    .join("\n\n");
}

function buildQuestionPrompt(params: {
  count: number;
  difficultyInstruction: string;
  focusInstruction: string;
  coveredInstruction: string;
  chunkMode?: boolean;
}) {
  const chunkInstruction = params.chunkMode
    ? `For each question, studyRef MUST reference one of the provided chunk IDs:
- chunkId: copy the exact id from [chunk:...].
- page: use the page number from the chunk marker when present.
- topic: the concept or section to review.
- instruction: a short student-facing reading instruction.
- quote: a short relevant excerpt copied from the referenced chunk.`
    : `For each question, include studyRef to guide the student back to the source before answering:
- topic: the concept or section to review.
- instruction: a short student-facing reading instruction.
- quote: a short relevant excerpt from the document, if available.
- page: page number only if you can identify it confidently; otherwise omit it.`;

  const studyRefShape = params.chunkMode
    ? `"studyRef": {
        "chunkId": "uuid",
        "topic": "string",
        "instruction": "string",
        "quote": "string",
        "page": 1
      }`
    : `"studyRef": {
        "topic": "string",
        "instruction": "string",
        "quote": "string",
        "page": 1
      }`;

  return `You are an exam question generator for Nigerian university students.
Generate exactly ${params.count} multiple choice questions strictly from the provided document content.
Do not add any knowledge from outside the document.
${params.difficultyInstruction}${params.focusInstruction ? `\n${params.focusInstruction}` : ""}${params.coveredInstruction}
Each question must have 4 options (A, B, C, D) with exactly one correct answer.
Include a short explanation (1-2 sentences) for each correct answer, citing the part of the document it came from.
Include a hint (1 sentence) that nudges the student toward the right concept without naming the correct option or giving away the answer directly.
${chunkInstruction}

Return ONLY a valid JSON object with no markdown, no backticks, no preamble:
{
  "questions": [
    {
      "question": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "answer": "A" | "B" | "C" | "D",
      "explanation": "string",
      "hint": "string",
      ${studyRefShape}
    }
  ]
}`;
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
  let body: { materialId?: string; count?: number; difficulty?: "easy" | "mixed" | "hard"; focus?: string; coveredQuestions?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { materialId, count = 10, difficulty = "mixed", focus, coveredQuestions = [] } = body;
  if (!materialId) return NextResponse.json({ error: "Missing materialId" }, { status: 400 });

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
  }[difficulty] ?? "Mix of recall, application, and analysis questions.";

  const focusInstruction = focus ? `Focus specifically on: ${focus}` : "";

  const coveredInstruction = coveredQuestions.length > 0
    ? `\n\nThe following questions have ALREADY been generated from this document. Do NOT repeat these topics or ask similar questions. Identify sections or concepts in the document that are NOT covered by these questions and generate new questions from those parts:\n${coveredQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";

  try {
    const coverageResult = await generateCoverageAwareQuestions({
      materialId,
      materialTitle: material.title ?? "Untitled material",
      count,
      difficulty,
      focus,
      coveredQuestions,
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
          provider: "gemini",
          model: geminiModelName(),
          inputMode: "coverage-aware",
          reason: `Coverage-aware generation covered ${coverageResult.topicsCovered} topic(s)${kindSummary ? `: ${kindSummary}` : ""}.`,
          coverage: {
            topicsCovered: coverageResult.topicsCovered,
            questionKindCounts: coverageResult.questionKindCounts,
            cognitiveLevelCounts: coverageResult.cognitiveLevelCounts,
            chunksLoaded: coverageResult.chunksLoaded,
            chunksCatalogued: coverageResult.chunksCatalogued,
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

  // ── Build Gemini request ───────────────────────────────────────────────────
  const systemPrompt = `You are an exam question generator for Nigerian university students.
Generate exactly ${count} multiple choice questions strictly from the provided document content.
Do not add any knowledge from outside the document.
${difficultyInstruction}${focusInstruction ? `\n${focusInstruction}` : ""}${coveredInstruction}
Each question must have 4 options (A, B, C, D) with exactly one correct answer.
Include a short explanation (1-2 sentences) for each correct answer, citing the part of the document it came from.
Include a hint (1 sentence) that nudges the student toward the right concept without naming the correct option or giving away the answer directly.
For each question, include studyRef to guide the student back to the source before answering:
- topic: the concept or section to review.
- instruction: a short student-facing reading instruction.
- quote: a short relevant excerpt from the document, if available.
- page: page number only if you can identify it confidently; otherwise omit it.

Return ONLY a valid JSON object with no markdown, no backticks, no preamble:
{
  "questions": [
    {
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
    }
  ]
}`;

  if (content.kind === "text") {
    const truncated = truncateText(content.text, QUESTION_GEN_TEXT_CHARS);
    const result = await generateJson<{ questions: unknown[] }>({
      messages: [userMessage(`DOCUMENT CONTENT:\n\n${truncated}\n\n${systemPrompt}`)],
      temperature: 0.3,
      maxTokens: Math.min(6000, count * 380),
      timeoutMs: GEMINI_QUESTION_TIMEOUT_MS,
    });

    if (!result.ok) {
      return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
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
        model: geminiModelName(),
        inputMode: "extracted-text",
      },
    });
  }

  // Build parts array depending on content kind
  type GeminiPart =
    | { inline_data: { mime_type: string; data: string } }
    | { text: string };

  let parts: GeminiPart[];
  if (content.kind === "inline") {
    parts = [
      { inline_data: { mime_type: content.mimeType, data: content.base64 } },
      { text: systemPrompt },
    ];
  } else {
    return NextResponse.json({ error: "Unexpected content kind." }, { status: 500 });
  }

  const geminiBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: Math.min(6000, count * 380),
    },
  };

  // ── Call Gemini ────────────────────────────────────────────────────────────
  let rawText: string;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI service not configured." }, { status: 500 });

    const geminiRes = await fetch(`${geminiGenerateUrl()}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
      signal: AbortSignal.timeout(60_000),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => geminiRes.statusText);
      console.error("[generate-questions] Gemini error:", errText);
      return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!rawText.trim()) return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
  } catch (e: unknown) {
    console.error("[generate-questions] Gemini fetch error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
  }

  // ── Parse response ─────────────────────────────────────────────────────────
  try {
    const clean = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(clean) as { questions: unknown[] };
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
    }
    const questions = normalizeGeneratedQuestions(parsed.questions);
    if (questions.length === 0) {
      return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
    }
    return NextResponse.json({
      questions,
      ai: {
        provider: "gemini",
        model: geminiModelName(),
        inputMode: "inline-file",
        reason: content.reason ?? "Inline files are handled by Gemini.",
      },
    });
  } catch (e: unknown) {
    console.error("[generate-questions] JSON parse error:", e instanceof Error ? e.message : e, rawText.slice(0, 200));
    return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
  }
}
