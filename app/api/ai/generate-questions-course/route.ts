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
import { adminSupabase } from "@/lib/supabase/admin";
import {
  generateCoverageAwareQuestions,
  type CoverageGeneratedQuestion,
  type StudyGenerationIntent,
} from "@/lib/studyQuestionGeneration";
import {
  assertQuestionsNotDuplicateForCourse,
  duplicateGateErrorResponse,
} from "@/lib/studyDuplicateGate";
import { validateSourceBackedQuestions } from "@/lib/studyQuestionGrounding";

const DEFAULT_QUESTION_COUNT = 10;
const MAX_QUESTION_COUNT = 15;
const MATERIAL_LIMIT = 3;
const COURSE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h

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
  index_status?: string | null;
};

const COURSE_GENERATION_INTENTS = new Set<StudyGenerationIntent>([
  "weak_areas",
  "untested_sections",
  "application",
  "hard",
  "topic",
  "past_question_style",
]);

function normalizeGenerationIntent(value: unknown): StudyGenerationIntent | null {
  return typeof value === "string" && COURSE_GENERATION_INTENTS.has(value as StudyGenerationIntent)
    ? (value as StudyGenerationIntent)
    : null;
}

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
      .select("id,title,file_path,file_url,material_type,downloads,index_status")
      .eq("course_id", courseId)
      .eq("approved", true)
      .eq("upload_status", "live")
      .eq("material_type", "past_question")
      .not("file_path", "is", null)
      .order("downloads", { ascending: false, nullsFirst: false })
      .limit(3),

    admin
      .from("study_materials")
      .select("id,title,file_path,file_url,material_type,downloads,index_status")
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

  const indexedCandidates = (candidates as CandidateMaterial[]).filter(
    (material) => material.index_status === "ready"
  );

  if (indexedCandidates.length === 0) {
    return NextResponse.json(
      {
        error:
          "No indexed materials found for this course. Reindex approved materials before creating a source-backed course bank.",
        code: "MATERIAL_NOT_INDEXED",
      },
      { status: 422 }
    );
  }

  type GroundedCourseQuestion = CoverageGeneratedQuestion & {
    sourceMaterialId: string;
    sourceChunkId: string;
    studyRef: Record<string, string | number>;
  };

  const questions: GroundedCourseQuestion[] = [];
  const sources: SourceMaterial[] = [];
  let aiMeta: {
    provider: "bedrock" | "gemini";
    model: string;
    inputMode: "coverage-aware";
    fallbackProvider?: "bedrock" | "gemini";
    fallbackReason?: string;
    modelFallbackFrom?: string;
    modelFallbackReason?: string;
    reason?: string;
    coverage?: Record<string, unknown>;
  } | null = null;

  for (let i = 0; i < indexedCandidates.length && questions.length < questionCount; i++) {
    const material = indexedCandidates[i];
    const remainingMaterials = indexedCandidates.length - i;
    const remainingQuestions = questionCount - questions.length;
    const countForMaterial = Math.max(1, Math.ceil(remainingQuestions / remainingMaterials));

    try {
      const generation = await generateCoverageAwareQuestions({
        materialId: material.id,
        materialTitle: material.title ?? "Untitled material",
        count: countForMaterial,
        difficulty: "mixed",
        coveredQuestions: questions.map((question) => question.question),
      });

      if (!generation?.questions.length) continue;

      const grounded = await validateSourceBackedQuestions(material.id, generation.questions);
      questions.push(
        ...grounded.map((question) => ({
          ...question,
          sourceMaterialId: material.id,
        }))
      );

      if (!sources.some((source) => source.id === material.id)) {
        sources.push({
          id: material.id,
          title: material.title,
          material_type: material.material_type,
        });
      }

      if (generation.ai) {
        aiMeta = {
          provider: generation.ai.provider,
          model: generation.ai.model,
          fallbackProvider: generation.ai.fallbackProvider,
          fallbackReason: generation.ai.fallbackReason,
          modelFallbackFrom: generation.ai.modelFallbackFrom,
          modelFallbackReason: generation.ai.modelFallbackReason,
          inputMode: "coverage-aware",
          reason: `Generated source-backed questions from indexed chunks across ${indexedCandidates.length} material(s).`,
          coverage: generation.coverage,
        };
      }
    } catch (error) {
      console.warn(
        `[generate-questions-course] source-backed generation failed for material ${material.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  const finalQuestions = questions.slice(0, questionCount);
  if (finalQuestions.length === 0) {
    return NextResponse.json(
      {
        error: "Failed to generate source-backed questions from indexed course materials.",
        code: "QUESTIONS_MISSING_SOURCE",
      },
      { status: 422 }
    );
  }

  try {
    await assertQuestionsNotDuplicateForCourse({
      courseId,
      courseCode: code,
      questions: finalQuestions,
    });
  } catch (error: unknown) {
    const duplicateError = error as { status?: number };
    return NextResponse.json(
      duplicateGateErrorResponse(error),
      { status: Number(duplicateError.status) || 422 }
    );
  }

  const { data: quizSet, error: setErr } = await admin
    .from("study_quiz_sets")
    .insert({
      title: `${code} – AI Course Practice`,
      source: "ai_course",
      course_code: code,
      created_by: user.id,
      published: true,
      visibility: "public",
      questions_count: finalQuestions.length,
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
      finalQuestions.map((q, i) => ({
        set_id: quizSet.id,
        prompt: q.question,
        explanation: q.explanation,
        question_type: "mcq",
        position: i,
        ai_generated: true,
        source_material_id: q.sourceMaterialId,
        source_chunk_id: q.sourceChunkId,
        study_ref: q.studyRef,
        source_topic: q.sourceTopic ?? q.studyRef?.topic ?? null,
        question_kind: q.questionKind ?? null,
        difficulty_level: q.difficultyLevel ?? null,
        cognitive_level: q.cognitiveLevel ?? null,
        question_fingerprint: q.questionFingerprint ?? null,
        generation_meta: q.generationMeta ?? null,
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
    const q = finalQuestions[row.position ?? 0];
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
