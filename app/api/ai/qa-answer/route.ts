// app/api/ai/qa-answer/route.ts
// POST /api/ai/qa-answer
// Generates an AI answer for a study question when no human answers exist yet.
// Stores the result as a real study_answers row with is_ai = true
// so the existing UI renders it without changes.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateText, userMessage } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";

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
    title?: string;
    questionBody?: string;
    courseCode?: string;
    level?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { questionId, title, questionBody, courseCode, level } = body;

  if (!questionId || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = adminSupabase;

  // ── Check if AI answer already exists ─────────────────────────────────────
  const { data: existing } = await admin
    .from("study_answers")
    .select("id,body,created_at")
    .eq("question_id", questionId)
    .eq("is_ai", true)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ answer: existing, cached: true });
  }

  // ── Build prompt ───────────────────────────────────────────────────────────
  const contextLine = [
    courseCode ? `Course: ${courseCode}` : null,
    level ? `Level: ${level}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const prompt = `You are a knowledgeable, helpful teaching assistant for Nigerian university students.
${contextLine ? `Context: ${contextLine}` : ""}

A student asked this question:
TITLE: ${title}
${questionBody ? `DETAILS:\n${questionBody}` : ""}

Write a thorough but concise answer (150–300 words) that:
1. Directly addresses what was asked.
2. Explains the concept clearly with an example if helpful.
3. Mentions any important caveats or related concepts worth knowing.

Write in plain English. No markdown formatting. No greetings or sign-offs.
Note at the end in one line: "— AI-generated answer. Verify with your lecturer or textbook."`;

  // ── Call Gemini ────────────────────────────────────────────────────────────
  const result = await generateText({
    messages: [userMessage(prompt)],
    temperature: 0.5,
    maxTokens: 500,
    timeoutMs: 45_000,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // ── Store as a real answer row ─────────────────────────────────────────────
  const { data: inserted, error: insertError } = await admin
    .from("study_answers")
    .insert({
      question_id: questionId,
      body: result.text,
      is_ai: true,
      author_email: "ai@jabustudy.app",
      author_id: null,
      is_accepted: false,
    })
    .select("id,body,created_at")
    .single();

  if (insertError) {
    // Still return the text even if we couldn't persist it
    console.warn("[ai/qa-answer] insert failed:", insertError.message);
    return NextResponse.json({
      answer: { id: null, body: result.text, created_at: new Date().toISOString() },
      cached: false,
    });
  }

  // Bump answers_count on the question
  try {
    await admin.rpc("increment_answers_count", { q_id: questionId });
  } catch {
    // RPC may not exist — fall back to manual update
    const { data } = await admin
      .from("study_questions")
      .select("answers_count")
      .eq("id", questionId)
      .maybeSingle();
    if (data) {
      await admin
        .from("study_questions")
        .update({ answers_count: (data.answers_count ?? 0) + 1 })
        .eq("id", questionId);
    }
  }

  return NextResponse.json({ answer: inserted, cached: false });
}
