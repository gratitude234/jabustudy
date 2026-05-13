import "server-only";

import { NextResponse } from "next/server";
import { generateJson, userMessage } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";
import { extractMaterialContent, truncateText } from "@/lib/extractMaterialContent";
import { isWithinScope } from "@/lib/studyAdmin/scope";
import type { StudyModeratorScope } from "@/lib/studyAdmin/requireStudyModerator";

const MODEL = "gemini-2.5-flash-lite";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const QUESTION_BANK_TEXT_CHARS = 24_000;
const OUTLINE_TIMEOUT_MS = parsePositiveInt(process.env.GEMINI_OUTLINE_TIMEOUT_MS) ?? 60_000;
const QUESTION_TIMEOUT_MS = parsePositiveInt(process.env.GEMINI_QUESTION_TIMEOUT_MS) ?? 60_000;

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

export type BankTopic = {
  title: string;
  description?: string | null;
  target: number;
  generated: number;
};

type CourseRow = {
  id: string;
  course_code: string;
  course_title: string | null;
  level: number | null;
  faculty_id: string | null;
  department_id: string | null;
};

export function jsonError(message: string, status = 500, code?: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

export function isAiSupported(filePath: string | null): boolean {
  if (!filePath) return false;
  return /\.(pdf|png|jpg|jpeg|webp|docx|pptx)$/i.test(filePath);
}

export async function requireScopedCourse(courseId: string, scope: StudyModeratorScope) {
  const { data: course, error } = await adminSupabase
    .from("study_courses")
    .select("id,course_code,course_title,level,faculty_id,department_id")
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!course) throw Object.assign(new Error("Course not found."), { status: 404 });

  const row = course as CourseRow;
  if (!isWithinScope(scope, row)) {
    throw Object.assign(new Error("You cannot manage this course."), { status: 403, code: "OUT_OF_SCOPE" });
  }

  return row;
}

export async function getBearerUserToken(req: Request) {
  const raw = req.headers.get("authorization") || req.headers.get("Authorization");
  return raw?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
}

export async function getBankState(runId: string) {
  const [{ data: run, error: runErr }, { data: materials, error: matsErr }] = await Promise.all([
    adminSupabase
      .from("study_question_bank_runs")
      .select("id,course_id,course_code,quiz_set_id,created_by,status,selected_materials,batch_size,topic_target,error_message,created_at,updated_at")
      .eq("id", runId)
      .maybeSingle(),
    adminSupabase
      .from("study_question_bank_materials")
      .select("id,run_id,material_id,position,status,topic_outline,generated_count,error_message,study_materials(id,title,material_type,file_path)")
      .eq("run_id", runId)
      .order("position", { ascending: true }),
  ]);

  if (runErr) throw runErr;
  if (matsErr) throw matsErr;
  if (!run) return null;

  const { count } = await adminSupabase
    .from("study_quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("set_id", (run as any).quiz_set_id);

  return { run, materials: materials ?? [], questionsCount: count ?? 0 };
}

export async function fetchMaterialContent(material: { id: string; file_path: string | null; file_url?: string | null }) {
  if (!material.file_path) throw new Error("No file attached to this material.");

  const { data: signed } = await adminSupabase.storage
    .from("study-materials")
    .createSignedUrl(material.file_path, 300);
  const downloadUrl = signed?.signedUrl ?? material.file_url ?? null;
  if (!downloadUrl) throw new Error("File URL not available.");

  const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`Failed to fetch material file (HTTP ${res.status}).`);

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("File is too large for AI bank generation.");
  }

  const content = await extractMaterialContent(buffer, material.file_path);
  if (content.kind === "unsupported") throw new Error(content.message);
  return content;
}

async function callGeminiJson<T>(parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>, maxOutputTokens: number): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI service not configured.");

  const res = await fetch(`${geminiGenerateUrl()}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`AI request failed: ${errText.slice(0, 180)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!raw.trim()) throw new Error("AI returned an empty response.");

  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(clean) as T;
}

export async function outlineMaterial(args: {
  courseCode: string;
  materialTitle: string;
  content: Awaited<ReturnType<typeof fetchMaterialContent>>;
  topicTarget: number;
}) {
  const prompt = `You are helping a Nigerian university course rep build a practice question bank for ${args.courseCode}.
Read the provided material and identify the main examinable topics that should be covered by MCQ practice.
Return 3 to 8 topics. Keep topic titles short and specific.
Each topic should have target ${args.topicTarget}.

Return ONLY JSON:
{
  "topics": [
    { "title": "string", "description": "string" }
  ]
}`;

  if (args.content.kind === "text") {
    const result = await generateJson<{ topics?: Array<{ title?: string; description?: string }> }>({
      messages: [userMessage(`MATERIAL: ${args.materialTitle}\n\n${truncateText(args.content.text, QUESTION_BANK_TEXT_CHARS)}\n\n${prompt}`)],
      temperature: 0.25,
      maxTokens: 1200,
      timeoutMs: OUTLINE_TIMEOUT_MS,
    });
    if (!result.ok) throw new Error(result.error);

    const topics = Array.isArray(result.data.topics) ? result.data.topics : [];
    const normalized: BankTopic[] = topics
      .map((topic) => ({
        title: String(topic.title ?? "").trim(),
        description: String(topic.description ?? "").trim() || null,
        target: args.topicTarget,
        generated: 0,
      }))
      .filter((topic) => topic.title.length > 0)
      .slice(0, 8);

    if (!normalized.length) throw new Error("AI could not outline this material.");
    return normalized;
  }

  const parts = [
    { text: `MATERIAL: ${args.materialTitle}` },
    { inline_data: { mime_type: args.content.mimeType, data: args.content.base64 } },
    { text: prompt },
  ];

  const parsed = await callGeminiJson<{ topics?: Array<{ title?: string; description?: string }> }>(parts, 1200);
  const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
  const normalized: BankTopic[] = topics
    .map((topic) => ({
      title: String(topic.title ?? "").trim(),
      description: String(topic.description ?? "").trim() || null,
      target: args.topicTarget,
      generated: 0,
    }))
    .filter((topic) => topic.title.length > 0)
    .slice(0, 8);

  if (!normalized.length) throw new Error("AI could not outline this material.");
  return normalized;
}

export type GeneratedMCQ = {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: "A" | "B" | "C" | "D";
  explanation: string;
};

export async function generateTopicQuestions(args: {
  courseCode: string;
  materialTitle: string;
  topic: BankTopic;
  count: number;
  existingPrompts: string[];
  content: Awaited<ReturnType<typeof fetchMaterialContent>>;
}) {
  const avoid = args.existingPrompts.length
    ? `Avoid duplicating these existing prompts:\n${args.existingPrompts.slice(-25).map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const prompt = `You are building an official course practice bank for ${args.courseCode}.
Generate exactly ${args.count} exam-style multiple-choice questions from the provided material.
Focus only on this topic: ${args.topic.title}.
${args.topic.description ? `Topic context: ${args.topic.description}` : ""}
${avoid}

Rules:
- Use only the provided material.
- Each question must have options A, B, C, D.
- Exactly one answer must be correct.
- Include a concise explanation.

Return ONLY JSON:
{
  "questions": [
    {
      "question": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "answer": "A" | "B" | "C" | "D",
      "explanation": "string"
    }
  ]
}`;

  if (args.content.kind === "text") {
    const result = await generateJson<{ questions?: GeneratedMCQ[] }>({
      messages: [userMessage(`MATERIAL: ${args.materialTitle}\n\n${truncateText(args.content.text, QUESTION_BANK_TEXT_CHARS)}\n\n${prompt}`)],
      temperature: 0.25,
      maxTokens: Math.min(4096, args.count * 360),
      timeoutMs: QUESTION_TIMEOUT_MS,
    });
    if (!result.ok) throw new Error(result.error);

    const questions = Array.isArray(result.data.questions) ? result.data.questions : [];
    const optionKeys = ["A", "B", "C", "D"] as const;

    return questions
      .filter((q) => {
        if (!q?.question || !q?.options || !optionKeys.includes(q.answer)) return false;
        return optionKeys.every((key) => typeof q.options[key] === "string" && q.options[key].trim().length > 0);
      })
      .slice(0, args.count);
  }

  const parts = [
    { text: `MATERIAL: ${args.materialTitle}` },
    { inline_data: { mime_type: args.content.mimeType, data: args.content.base64 } },
    { text: prompt },
  ];

  const parsed = await callGeminiJson<{ questions?: GeneratedMCQ[] }>(parts, Math.min(4096, args.count * 360));
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const optionKeys = ["A", "B", "C", "D"] as const;

  return questions
    .filter((q) => {
      if (!q?.question || !q?.options || !optionKeys.includes(q.answer)) return false;
      return optionKeys.every((key) => typeof q.options[key] === "string" && q.options[key].trim().length > 0);
    })
    .slice(0, args.count);
}
