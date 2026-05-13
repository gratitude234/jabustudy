// app/api/ai/price-suggest/route.ts
// POST /api/ai/price-suggest
// Uses Gemini to suggest a realistic price range for a listing based on
// its category, title, and condition. Returns { min, max, label, reasoning }.
//
// No DB caching — results are cheap to regenerate and depend on market context.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateJson, userMessage } from "@/lib/ai";

type PriceSuggestion = {
  min: number;
  max: number;
  label: string;       // e.g. "₦25,000 – ₦40,000"
  reasoning: string;   // 1–2 sentence explanation shown to seller
};

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    title?: string;
    category?: string;
    condition?: string;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, category, condition, description } = body;

  if (!title || !category) {
    return NextResponse.json(
      { error: "title and category are required" },
      { status: 400 }
    );
  }

  // ── Build prompt ───────────────────────────────────────────────────────────
  const conditionLine = condition
    ? `- Condition: ${condition}`
    : "";
  const descLine = description?.trim()
    ? `- Description: ${description.trim().slice(0, 300)}`
    : "";

  const prompt = `You are a pricing assistant for Jabumarket, a student marketplace at Jaiz International University (JABU) in Abuja, Nigeria. 
Students buy and sell second-hand goods, food, services and more using Nigerian Naira (₦).

A student wants to price their listing. Suggest a realistic market price range based on what similar items go for on Nigerian campus marketplaces (e.g. Jiji, Facebook Marketplace Nigeria).

Listing details:
- Title: ${title}
- Category: ${category}
${conditionLine}
${descLine}

Important context:
- These are student buyers with limited budgets
- Campus prices are typically 10–30% below open market prices
- "New" items can be priced at near-retail; "for parts" should be 10–20% of working value
- Prices must be realistic for Nigerian students in 2024

Respond ONLY with valid JSON — no markdown, no backticks, no text outside the object:

{
  "min": <integer in Naira, no commas>,
  "max": <integer in Naira, no commas>,
  "label": "<formatted range e.g. ₦25,000 – ₦40,000>",
  "reasoning": "<1–2 sentences explaining the range, mention condition and category factors>"
}`;

  // ── Call Gemini ────────────────────────────────────────────────────────────
  const result = await generateJson<PriceSuggestion>({
    messages: [userMessage(prompt)],
    temperature: 0.3,
    maxTokens: 250,
    timeoutMs: 30_000,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const suggestion = result.data;

  // Basic sanity check — reject nonsensical values
  if (
    typeof suggestion.min !== "number" ||
    typeof suggestion.max !== "number" ||
    suggestion.min < 0 ||
    suggestion.max < suggestion.min
  ) {
    return NextResponse.json(
      { error: "Gemini returned an invalid price range" },
      { status: 502 }
    );
  }

  return NextResponse.json({ suggestion });
}
