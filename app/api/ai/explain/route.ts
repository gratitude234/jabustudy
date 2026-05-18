// app/api/ai/explain/route.ts
// POST /api/ai/explain
// Returns an AI-generated explanation for a practice question.
//
// Cache strategy (no schema change needed):
//   study_quiz_questions.ai_explanation stores a JSON blob:
//     { "correct": "...", "wrong": "..." }
//   — "correct" is the explanation shown to students who answered right.
//   — "wrong"   is the explanation shown to students who answered wrong.
//   Each variant is generated and cached independently on first request.
//   A student who got it right will never receive a wrong-framed explanation.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateText, userMessage } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";

type ExplainCache = {
  correct?: string;
  wrong?: string;
};

function parseCache(raw: string | null | undefined): ExplainCache {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed as ExplainCache;
    // Legacy: plain string was stored (old single-variant cache).
    // Framing is unknown so discard it — both variants regenerate on next request.
    return {};
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    questionId?: string;
    questionPrompt?: string;
    chosenOptionText?: string;
    correctOptionText?: string;
    isCorrect?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { questionId, questionPrompt, chosenOptionText, correctOptionText, isCorrect } = body;

  if (!questionId || !questionPrompt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // ── Check cache ────────────────────────────────────────────────────────────
  const admin = adminSupabase;
  const { data: row } = await admin
    .from("study_quiz_questions")
    .select("ai_explanation")
    .eq("id", questionId)
    .maybeSingle();

  const cache = parseCache(row?.ai_explanation);
  const cacheKey: keyof ExplainCache = isCorrect ? "correct" : "wrong";

  if (cache[cacheKey]) {
    return NextResponse.json({ explanation: cache[cacheKey], cached: true });
  }

  // ── Build prompt — framed per outcome ─────────────────────────────────────
  const prompt = isCorrect
    ? `You are a concise, friendly academic tutor helping a Nigerian university student understand a practice question they just answered correctly.

QUESTION:
${questionPrompt}

CORRECT ANSWER: ${correctOptionText ?? "Not provided"}

Write a clear explanation (3–5 sentences) that:
1. Reinforces WHY the correct answer is right using first principles.
2. Points out the most common misconception that causes students to get this wrong.
3. Gives a memorable tip or mnemonic if applicable.

Be direct and academic. No greetings. No filler phrases like "Great job!". Write in plain English — no markdown formatting.`
    : `You are a concise, friendly academic tutor helping a Nigerian university student understand a practice question they just got wrong.

QUESTION:
${questionPrompt}

CORRECT ANSWER: ${correctOptionText ?? "Not provided"}
STUDENT'S WRONG ANSWER: ${chosenOptionText ?? "Not provided"}

Write a clear explanation (3–5 sentences) that:
1. States WHY the correct answer is right using first principles.
2. Explains specifically why the student's chosen answer is incorrect.
3. Gives a memorable tip or mnemonic to avoid this mistake in future.

Be direct and academic. No greetings. No filler phrases like "Great question!". Write in plain English — no markdown formatting.`;

  // ── Call Gemini ────────────────────────────────────────────────────────────
  const result = await generateText({
    messages: [userMessage(prompt)],
    temperature: 0.3,
    maxTokens: 400,
    timeoutMs: 45_000,
    modelRole: "fast",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const explanation = result.text;

  // ── Cache in DB — merge new variant into the existing JSON blob ────────────
  const updatedCache: ExplainCache = { ...cache, [cacheKey]: explanation };
  await admin
    .from("study_quiz_questions")
    .update({ ai_explanation: JSON.stringify(updatedCache) })
    .eq("id", questionId)
    .then(({ error }) => {
      if (error) console.warn("[ai/explain] cache write failed:", error.message);
    });

  return NextResponse.json({ explanation, cached: false });
}
