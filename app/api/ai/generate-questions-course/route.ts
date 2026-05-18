// app/api/ai/generate-questions-course/route.ts
export const maxDuration = 180; // requires Vercel Pro or above
export const runtime = "nodejs";
// POST /api/ai/generate-questions-course
//
// Generates a shared, course-wide AI practice set from the top materials in a
// course. The resulting set is public — all students in the course benefit.
//
// ── DB migration (run once in Supabase SQL editor) ───────────────────────────
// ALTER TABLE public.study_quiz_sets
//   ADD COLUMN IF NOT EXISTS source_material_ids jsonb DEFAULT NULL;
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateJson, userMessage, type AiContentBlock } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";
import { extractMaterialContent, truncateText } from "@/lib/extractMaterialContent";

const DEFAULT_QUESTION_COUNT = 10;
const MAX_QUESTION_COUNT = 15;
const MATERIAL_LIMIT = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const COURSE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h
const QUESTION_GEN_TEXT_CHARS = 24_000;
const AI_QUESTION_TIMEOUT_MS =
  parsePositiveInt(process.env.AI_QUESTION_TIMEOUT_MS) ??
  parsePositiveInt(process.env.GEMINI_QUESTION_TIMEOUT_MS) ??
  60_000;

function parsePositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type SourceMaterial = {
  id: string;
  title: string | null;
  material_type: string | null;
};

type QuizSetSourceRow = {
  id: string;
  source_material_ids?: unknown;
  created_at?: string | null;
};

type CandidateMaterial = {
  id: string;
  title: string | null;
  file_path: string | null;
  file_url?: string | null;
  material_type: string | null;
  downloads?: number | null;
};

function isAiSupported(filePath: string | null): boolean {
  if (!filePath) return false;
  return /\.(pdf|png|jpg|jpeg|webp|docx|pptx)$/i.test(filePath);
}

// GET — returns the cached course set if one was generated in the last 24 h
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ setId: null, sources: null });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ setId: null, sources: null });

  const { data: course } = await adminSupabase
    .from("study_courses")
    .select("course_code")
    .eq("id", courseId)
    .maybeSingle();

  if (!course?.course_code) return NextResponse.json({ setId: null, sources: null });

  const since = new Date(Date.now() - COURSE_COOLDOWN_MS).toISOString();

  const { data } = await adminSupabase
    .from("study_quiz_sets")
    .select("id,source_material_ids,created_at")
    .eq("course_code", course.course_code)
    .eq("source", "ai_course")
    .eq("published", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    setId: data?.id ?? null,
    sources: (data as QuizSetSourceRow | null)?.source_material_ids ?? null,
  });
}

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: { courseId?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { courseId } = body;
  if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  const requestedCount =
    typeof body.count === "number" && Number.isFinite(body.count)
      ? Math.floor(body.count)
      : DEFAULT_QUESTION_COUNT;
  const questionCount = Math.max(5, Math.min(MAX_QUESTION_COUNT, requestedCount));

  const admin = adminSupabase;

  const { data: courseForMaterials, error: courseForMaterialsErr } = await admin
    .from("study_courses")
    .select("id,course_code,course_title")
    .eq("id", courseId)
    .maybeSingle();

  if (courseForMaterialsErr || !courseForMaterials) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }
  const code = courseForMaterials.course_code as string;

  // ── Return cached set if still fresh ──────────────────────────────────────
  const since = new Date(Date.now() - COURSE_COOLDOWN_MS).toISOString();
  const { data: cached } = await admin
    .from("study_quiz_sets")
    .select("id,source_material_ids")
    .eq("course_code", code)
    .eq("source", "ai_course")
    .eq("published", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      setId: cached.id,
      sources: (cached as QuizSetSourceRow).source_material_ids ?? [],
      cached: true,
    });
  }

  // ── Fetch course ───────────────────────────────────────────────────────────
  // ── Fetch top materials: past questions first, then others ─────────────────
  const [pastQsRes, othersRes] = await Promise.all([
    admin
      .from("study_materials")
      .select("id,title,file_path,file_url,material_type,downloads")
      .eq("course_id", courseId)
      .eq("approved", true)
      .eq("upload_status", "live")
      .eq("material_type", "past_question")
      .not("file_path", "is", null)
      .order("downloads", { ascending: false, nullsFirst: false })
      .limit(3),

    admin
      .from("study_materials")
      .select("id,title,file_path,file_url,material_type,downloads")
      .eq("course_id", courseId)
      .eq("approved", true)
      .eq("upload_status", "live")
      .neq("material_type", "past_question")
      .not("file_path", "is", null)
      .order("downloads", { ascending: false, nullsFirst: false })
      .limit(3),
  ]);

  const pastQs = (pastQsRes.data ?? []).filter((m) => isAiSupported(m.file_path));
  const others = (othersRes.data ?? []).filter((m) => isAiSupported(m.file_path));
  const slotsForOthers = MATERIAL_LIMIT - Math.min(pastQs.length, 2);
  const candidates = [...pastQs.slice(0, 2), ...others.slice(0, slotsForOthers)].slice(
    0,
    MATERIAL_LIMIT
  );

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No AI-compatible materials found for this course." },
      { status: 422 }
    );
  }

  // ── Extract content from all materials in parallel ────────────────────────
  type Extracted = {
    source: SourceMaterial;
    content: Awaited<ReturnType<typeof extractMaterialContent>>;
  };

  async function extractOne(mat: CandidateMaterial): Promise<Extracted | null> {
    try {
      const { data: signed, error: signedErr } = await admin.storage
        .from("study-materials")
        .createSignedUrl(mat.file_path!, 300);

      if (signedErr) {
        console.warn(`[generate-questions-course] signed URL failed for ${mat.id}:`, signedErr.message);
      }
      const downloadUrl: string | null = signed?.signedUrl ?? mat.file_url ?? null;

      if (!downloadUrl) {
        console.warn(`[generate-questions-course] no download URL for material ${mat.id}`);
        return null;
      }

      // Retry once on transient network errors
      let fetchRes: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          fetchRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(45_000) });
          break;
        } catch (e: unknown) {
          console.warn(`[generate-questions-course] fetch attempt ${attempt + 1} failed for ${mat.id}:`, e instanceof Error ? e.message : e);
          if (attempt === 1) return null;
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (!fetchRes?.ok) {
        console.warn(`[generate-questions-course] fetch failed for ${mat.id}: HTTP ${fetchRes?.status}`);
        return null;
      }

      const buffer = await fetchRes.arrayBuffer();
      if (buffer.byteLength > MAX_FILE_BYTES) {
        console.warn(`[generate-questions-course] file too large for ${mat.id}: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
        return null;
      }

      const content = await extractMaterialContent(buffer, mat.file_path!);
      if (content.kind === "unsupported") {
        console.warn(`[generate-questions-course] unsupported content for ${mat.id}: ${content.message}`);
        return null;
      }

      console.log(`[generate-questions-course] extracted ${content.kind} from ${mat.id} (${mat.title})`);
      return { source: { id: mat.id, title: mat.title, material_type: mat.material_type }, content };
    } catch (e: unknown) {
      console.error(`[generate-questions-course] exception for material ${mat.id}:`, e instanceof Error ? e.message : e);
      return null;
    }
  }

  const results = await Promise.all(candidates.map(extractOne));
  const extracted: Extracted[] = results.filter((r): r is Extracted => r !== null);

  if (extracted.length === 0) {
    return NextResponse.json(
      { error: "Could not process any course materials. Please try again." },
      { status: 422 }
    );
  }

  const sources: SourceMaterial[] = extracted.map((e) => e.source);

  // ── Build AI content parts ────────────────────────────────────────────────
  const parts: AiContentBlock[] = [];

  for (let i = 0; i < extracted.length; i++) {
    const { source, content } = extracted[i];
    const label = `MATERIAL ${i + 1} — ${source.title ?? source.id} (${source.material_type ?? "file"})`;

    if (content.kind === "inline") {
      parts.push({ type: "text", text: label });
      parts.push({ type: "inline", mimeType: content.mimeType, data: content.base64, name: `material ${i + 1}` });
    } else if (content.kind === "text") {
      const truncated = truncateText(content.text, QUESTION_GEN_TEXT_CHARS);
      parts.push({ type: "text", text: `${label}\n\n${truncated}` });
    }
  }

  const systemPrompt = `You are an exam question generator for Nigerian university students.
You have been given ${extracted.length} document(s) uploaded for the course ${code}.
Your job is to generate exactly ${questionCount} multiple-choice questions strictly based on the content found in these documents.
Do not refuse — generate questions from whatever subject matter is present in the documents, regardless of the course code.
Cover a broad range of topics across all provided documents.
Mix recall, application, and analysis questions at exam difficulty level.
Each question must have exactly 4 options (A, B, C, D) with one correct answer.
Include a short explanation (1–2 sentences) for each correct answer.

Return ONLY a valid JSON object — no markdown, no backticks, no preamble, no explanatory text:
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

  parts.push({ type: "text", text: systemPrompt });

  let rawText: string | null = null;
  let aiMeta: {
    provider: "bedrock" | "gemini";
    model: string;
    inputMode: "extracted-text" | "inline-file";
    fallbackProvider?: "bedrock" | "gemini";
    fallbackReason?: string;
    reason?: string;
  } | null = null;
  const result = await generateJson<{ questions: unknown[] }>({
    messages: [userMessage(parts)],
    temperature: 0.25,
    maxTokens: Math.min(4096, questionCount * 320),
    timeoutMs: AI_QUESTION_TIMEOUT_MS,
    modelRole: "document",
  });
  if (!result.ok) {
    return NextResponse.json({
      error: "Failed to generate questions.",
      ai: { provider: result.provider, model: result.model, error: result.error },
    }, { status: 500 });
  }
  rawText = JSON.stringify(result.data);
  aiMeta = {
    provider: result.provider,
    model: result.model,
    fallbackProvider: result.fallbackProvider,
    fallbackReason: result.fallbackReason,
    inputMode: extracted.every((item) => item.content.kind === "text") ? "extracted-text" : "inline-file",
  };
  if (!rawText) {
    return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
  }
  type MCQ = {
    question: string;
    options: { A: string; B: string; C: string; D: string };
    answer: "A" | "B" | "C" | "D";
    explanation: string;
  };

  let questions: MCQ[];
  try {
    const clean = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(clean) as { questions: MCQ[] };
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) throw new Error("empty");
    questions = parsed.questions;
  } catch (e: unknown) {
    console.error(
      "[generate-questions-course] JSON parse error:",
      e instanceof Error ? e.message : e,
      rawText.slice(0, 300)
    );
    // Some providers return a refusal in plain text instead of JSON.
    const isRefusal = /i (am|'m) sorry|cannot fulfill|i cannot|not able to/i.test(rawText);
    return NextResponse.json(
      {
        error: isRefusal
          ? "The AI couldn't generate questions from these materials. Try uploading more relevant course documents."
          : "Failed to generate questions.",
      },
      { status: 500 }
    );
  }

  // ── Save quiz set ──────────────────────────────────────────────────────────
  const { data: quizSet, error: setErr } = await admin
    .from("study_quiz_sets")
    .insert({
      title: `${code} – AI Course Practice`,
      source: "ai_course",
      course_code: code,
      created_by: user.id,
      published: true,
      visibility: "public",
      questions_count: questions.length,
      source_material_ids: sources,
    } satisfies Record<string, unknown>)
    .select("id")
    .single();

  if (setErr || !quizSet) {
    console.error("[generate-questions-course] set insert error:", setErr);
    return NextResponse.json({ error: "Failed to save practice set." }, { status: 500 });
  }

  // ── Save questions ─────────────────────────────────────────────────────────
  const { data: insertedQs, error: qErr } = await admin
    .from("study_quiz_questions")
    .insert(
      questions.map((q, i) => ({
        set_id: quizSet.id,
        prompt: q.question,
        explanation: q.explanation,
        position: i,
      }))
    )
    .select("id,position");

  if (qErr || !insertedQs?.length) {
    console.error("[generate-questions-course] question insert error:", qErr);
    await admin.from("study_quiz_sets").delete().eq("id", quizSet.id);
    return NextResponse.json({ error: "Failed to save questions." }, { status: 500 });
  }

  // ── Save options ───────────────────────────────────────────────────────────
  const sortedQs = [...insertedQs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const optionRows = sortedQs.flatMap((row) => {
    const q = questions[row.position ?? 0];
    if (!q) return [];
    return (["A", "B", "C", "D"] as const).map((letter, idx) => ({
      question_id: row.id,
      text: q.options[letter],
      is_correct: q.answer === letter,
      position: idx,
    }));
  });

  const { error: optErr } = await admin.from("study_quiz_options").insert(optionRows);

  if (optErr) {
    console.error("[generate-questions-course] option insert error:", optErr);
    await admin.from("study_quiz_questions").delete().eq("set_id", quizSet.id);
    await admin.from("study_quiz_sets").delete().eq("id", quizSet.id);
    return NextResponse.json({ error: "Failed to save options." }, { status: 500 });
  }

  return NextResponse.json({ setId: quizSet.id, sources, cached: false, ai: aiMeta });
}
