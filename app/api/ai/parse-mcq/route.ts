// app/api/ai/parse-mcq/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateJson, userMessage } from "@/lib/ai";

type ParsedOption = { text: string; is_correct: boolean };
type ParsedQuestion = {
  prompt: string;
  explanation: string | null;
  options: ParsedOption[];
};

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || text.trim().length < 20) {
    return NextResponse.json({ error: "Text too short" }, { status: 400 });
  }

  const prompt = `You are a quiz parser. Extract MCQ questions from the raw document text below and return ONLY a JSON array. No markdown, no explanation, no backticks — just the raw JSON array.

Each element must follow this exact shape:
{
  "prompt": "full question text",
  "explanation": "explanation if present in the text, otherwise null",
  "options": [
    { "text": "option A text", "is_correct": false },
    { "text": "option B text", "is_correct": true },
    { "text": "option C text", "is_correct": false },
    { "text": "option D text", "is_correct": false }
  ]
}

Rules:
- Always exactly 4 options per question
- Exactly one is_correct: true per question
- If the correct answer is not marked in the text, set all is_correct to false
- Clean up any formatting artifacts from PDF/Word copy-paste
- Preserve the full question text verbatim
- Return ONLY the JSON array, nothing else

Document text:
${text}`;

  const result = await generateJson<ParsedQuestion[]>({
    messages: [userMessage(prompt)],
    maxTokens: 8000,
    temperature: 0.1,
    timeoutMs: 60_000,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ questions: result.data });
}
