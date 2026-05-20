// app/api/ai/explain/route.ts
// POST /api/ai/explain
// Returns a structured, source-backed explanation for a practice question.

import { NextRequest, NextResponse } from "next/server";
import { generateJson, userMessage } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OptionKey = "A" | "B" | "C" | "D";

type StudyRef = {
  chunkId?: string;
  topic?: string;
  instruction?: string;
  quote?: string;
  page?: number;
};

type BetterExplanation = {
  simpleAnswer: string;
  whyCorrect: string;
  whyChosenIsWrong?: string;
  optionBreakdown?: Array<{ option: OptionKey; reason: string }>;
  sourceAnchor?: string;
  memoryTip?: string;
  examTip?: string;
};

type ExplainCache = Record<string, BetterExplanation | string | undefined>;

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function cleanString(value: unknown, maxLength = 1800): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

function cleanOptionKey(value: unknown): OptionKey | undefined {
  return OPTION_KEYS.includes(value as OptionKey) ? value as OptionKey : undefined;
}

function cleanStudyRef(value: unknown): StudyRef | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const page = typeof raw.page === "number" && Number.isFinite(raw.page) ? Math.floor(raw.page) : undefined;
  const ref: StudyRef = {
    chunkId: cleanString(raw.chunkId, 120),
    topic: cleanString(raw.topic, 240),
    instruction: cleanString(raw.instruction, 300),
    quote: cleanString(raw.quote, 1200),
    page: page && page >= 1 && page <= 2000 ? page : undefined,
  };
  return Object.values(ref).some(Boolean) ? ref : undefined;
}

function cleanOptions(value: unknown): Record<OptionKey, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const options = {} as Record<OptionKey, string>;
  for (const key of OPTION_KEYS) {
    const text = cleanString(raw[key], 1000);
    if (!text) return undefined;
    options[key] = text;
  }
  return options;
}

function parseCache(raw: string | null | undefined): ExplainCache {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as ExplainCache;
  } catch {
    // Legacy plain-string cache. Its framing is unknown, so regenerate.
  }
  return {};
}

function normalizeExplanation(value: unknown): BetterExplanation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const simpleAnswer = cleanString(raw.simpleAnswer, 900);
  const whyCorrect = cleanString(raw.whyCorrect, 1400);
  if (!simpleAnswer || !whyCorrect) return null;

  const optionBreakdown = Array.isArray(raw.optionBreakdown)
    ? raw.optionBreakdown.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        const option = cleanOptionKey(row.option);
        const reason = cleanString(row.reason, 700);
        return option && reason ? [{ option, reason }] : [];
      })
    : undefined;

  return {
    simpleAnswer,
    whyCorrect,
    whyChosenIsWrong: cleanString(raw.whyChosenIsWrong, 1200),
    optionBreakdown: optionBreakdown?.length ? optionBreakdown : undefined,
    sourceAnchor: cleanString(raw.sourceAnchor, 1200),
    memoryTip: cleanString(raw.memoryTip, 700),
    examTip: cleanString(raw.examTip, 700),
  };
}

function legacyTextToExplanation(text: string): BetterExplanation {
  return {
    simpleAnswer: text,
    whyCorrect: text,
  };
}

function cachedExplanation(cache: ExplainCache, cacheKey: string, isCorrect: boolean): BetterExplanation | null {
  const exact = cache[cacheKey];
  const normalizedExact = typeof exact === "string" ? legacyTextToExplanation(exact) : normalizeExplanation(exact);
  if (normalizedExact) return normalizedExact;

  if (!isCorrect) return null;
  const legacyCorrect = cache.correct;
  return typeof legacyCorrect === "string"
    ? legacyTextToExplanation(legacyCorrect)
    : normalizeExplanation(legacyCorrect);
}

function sourceContext(studyRef?: StudyRef, sourceTopic?: string) {
  const parts = [
    sourceTopic ? `Source topic: ${sourceTopic}` : "",
    studyRef?.topic ? `Study reference topic: ${studyRef.topic}` : "",
    studyRef?.instruction ? `Reading instruction: ${studyRef.instruction}` : "",
    studyRef?.quote ? `Source excerpt: "${studyRef.quote}"` : "",
    studyRef?.page ? `Page: ${studyRef.page}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : "No source excerpt was provided.";
}

function buildPrompt(args: {
  questionPrompt: string;
  options: Record<OptionKey, string>;
  chosenOptionKey: OptionKey;
  chosenOptionText: string;
  correctOptionKey: OptionKey;
  correctOptionText: string;
  isCorrect: boolean;
  basicExplanation?: string;
  studyRef?: StudyRef;
  sourceTopic?: string;
}) {
  const optionLines = OPTION_KEYS.map((key) => `${key}. ${args.options[key]}`).join("\n");
  const outcome = args.isCorrect
    ? "The student selected the correct answer."
    : `The student selected ${args.chosenOptionKey}, which is incorrect.`;

  return `You are an academic tutor helping a Nigerian university student understand a multiple-choice question.

Use the source context and basic explanation as primary evidence. If the source context is thin, explain from standard academic knowledge, but do not invent claims about the document.

QUESTION:
${args.questionPrompt}

OPTIONS:
${optionLines}

CORRECT ANSWER:
${args.correctOptionKey}. ${args.correctOptionText}

STUDENT ANSWER:
${args.chosenOptionKey}. ${args.chosenOptionText}

OUTCOME:
${outcome}

BASIC EXPLANATION:
${args.basicExplanation ?? "Not provided."}

SOURCE CONTEXT:
${sourceContext(args.studyRef, args.sourceTopic)}

Return ONLY valid JSON with this exact shape:
{
  "simpleAnswer": "2-3 plain-English sentences that answer the question directly.",
  "whyCorrect": "Explain why the correct option is right using the source context and first principles.",
  "whyChosenIsWrong": "If the student was wrong, explain specifically why their selected option is wrong. If they were correct, omit this field.",
  "optionBreakdown": [
    { "option": "A", "reason": "Briefly explain whether this option fits or fails." }
  ],
  "sourceAnchor": "Quote or summarize the most relevant source point. Include page if provided. Omit if no source context exists.",
  "memoryTip": "One memorable study tip or mnemonic.",
  "examTip": "One exam-taking tip for recognizing this concept."
}

Rules:
- Keep the tone direct, academic, and student-friendly.
- Do not use markdown.
- Do not include greetings, praise, or filler.
- Keep each field concise.
- Include all four options in optionBreakdown.`;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const questionId = cleanString(body.questionId, 80);
  const questionPrompt = cleanString(body.questionPrompt, 4000);
  const options = cleanOptions(body.options);
  const chosenOptionKey = cleanOptionKey(body.chosenOptionKey);
  const correctOptionKey = cleanOptionKey(body.correctOptionKey);
  const isCorrect = typeof body.isCorrect === "boolean" ? body.isCorrect : undefined;

  if (!questionPrompt || !options || !chosenOptionKey || !correctOptionKey || typeof isCorrect !== "boolean") {
    return NextResponse.json({ error: "Missing required explanation fields." }, { status: 400 });
  }

  const chosenOptionText = cleanString(body.chosenOptionText, 1000) ?? options[chosenOptionKey];
  const correctOptionText = cleanString(body.correctOptionText, 1000) ?? options[correctOptionKey];
  if (!chosenOptionText || !correctOptionText) {
    return NextResponse.json({ error: "Missing selected or correct answer text." }, { status: 400 });
  }

  const admin = adminSupabase;
  let cache: ExplainCache = {};
  let dbBasicExplanation: string | undefined;
  let dbStudyRef: StudyRef | undefined;
  let dbSourceTopic: string | undefined;

  if (questionId) {
    const { data: row } = await admin
      .from("study_quiz_questions")
      .select("ai_explanation,explanation,study_ref,source_topic,question_type")
      .eq("id", questionId)
      .maybeSingle();

    const questionType = row?.question_type === "short_answer" || row?.question_type === "theory" ? row.question_type : "mcq";
    if (questionType !== "mcq") {
      return NextResponse.json({ error: "AI option explanations are only available for MCQs." }, { status: 400 });
    }

    cache = parseCache(typeof row?.ai_explanation === "string" ? row.ai_explanation : null);
    dbBasicExplanation = cleanString(row?.explanation, 1600);
    dbStudyRef = cleanStudyRef(row?.study_ref);
    dbSourceTopic = cleanString(row?.source_topic, 240);
  }

  const cacheKey = isCorrect ? "correct" : `wrong:${chosenOptionKey}`;
  const cached = questionId ? cachedExplanation(cache, cacheKey, isCorrect) : null;
  if (cached) {
    return NextResponse.json({ explanation: cached, cached: true });
  }

  const studyRef = cleanStudyRef(body.studyRef) ?? dbStudyRef;
  const sourceTopic = cleanString(body.sourceTopic, 240) ?? dbSourceTopic;
  const basicExplanation = cleanString(body.basicExplanation, 1600) ?? dbBasicExplanation;

  const result = await generateJson<BetterExplanation>({
    messages: [userMessage(buildPrompt({
      questionPrompt,
      options,
      chosenOptionKey,
      chosenOptionText,
      correctOptionKey,
      correctOptionText,
      isCorrect,
      basicExplanation,
      studyRef,
      sourceTopic,
    }))],
    temperature: 0.2,
    maxTokens: 900,
    timeoutMs: 45_000,
    modelRole: "fast",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const explanation = normalizeExplanation(result.data);
  if (!explanation) {
    return NextResponse.json({ error: "AI returned a malformed explanation." }, { status: 502 });
  }

  if (questionId) {
    const updatedCache: ExplainCache = { ...cache, [cacheKey]: explanation };
    await admin
      .from("study_quiz_questions")
      .update({ ai_explanation: JSON.stringify(updatedCache) })
      .eq("id", questionId)
      .then(({ error }) => {
        if (error) console.warn("[ai/explain] cache write failed:", error.message);
      });
  }

  return NextResponse.json({ explanation, cached: false });
}
