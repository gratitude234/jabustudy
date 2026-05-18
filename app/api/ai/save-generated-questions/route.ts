// app/api/ai/save-generated-questions/route.ts
// POST /api/ai/save-generated-questions
// Saves AI-generated MCQ questions to study_quiz_sets and linked tables.
//
// ── Run this in the Supabase SQL editor before deploying ─────────────────────
// ALTER TABLE public.study_quiz_sets
//   ADD COLUMN IF NOT EXISTS source_material_id uuid
//     REFERENCES public.study_materials(id) ON DELETE SET NULL;
// ALTER TABLE public.study_quiz_sets
//   ADD COLUMN IF NOT EXISTS due_at timestamptz
//     DEFAULT (now() + interval '1 day');
// ALTER TABLE public.study_quiz_sets
//   ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
//   CHECK (visibility IN ('public', 'private', 'pending_review'));
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";

type MCQ = {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: "A" | "B" | "C" | "D";
  explanation: string;
  hint?: string;
  questionKind?: string;
  difficultyLevel?: string;
  cognitiveLevel?: string;
  sourceTopic?: string;
  questionFingerprint?: string;
  generationMeta?: Record<string, unknown> | null;
  studyRef?: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  };
};

type MaterialTitleRow = {
  id: string;
  title: string | null;
  course_code: string | null;
};

type QuizSetRow = {
  id: string;
};

type InsertedQuestionRow = {
  id: string;
  position: number | null;
};

type SourceChunkIdRow = {
  id: string;
};

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function cleanLabel(value: unknown, maxLength = 80): string | null {
  const clean = cleanString(value);
  return clean ? clean.slice(0, maxLength) : null;
}

function cleanJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanPage(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const page = Math.floor(value);
  return page >= 1 && page <= 2000 ? page : undefined;
}

function cleanStudyRef(question: MCQ, validChunkIds?: Set<string>) {
  const raw = question.studyRef ?? {};
  const rawChunkId = cleanString(raw.chunkId);
  const chunkId = rawChunkId && validChunkIds?.has(rawChunkId) ? rawChunkId : undefined;
  const topic = cleanString(raw.topic);
  const instruction = cleanString(raw.instruction) ?? cleanString(question.hint);
  const quote = cleanString(raw.quote);
  const page = cleanPage(raw.page);
  const ref: Record<string, string | number> = {};

  if (chunkId) ref.chunkId = chunkId;
  if (topic) ref.topic = topic;
  if (instruction) ref.instruction = instruction;
  if (quote) ref.quote = quote;
  if (page) ref.page = page;

  return Object.keys(ref).length > 0 ? ref : null;
}

async function validSourceChunkIds(materialId: string, questions: MCQ[]) {
  const requested = [
    ...new Set(questions.map((question) => cleanString(question.studyRef?.chunkId)).filter(Boolean)),
  ] as string[];

  if (requested.length === 0) return new Set<string>();

  const { data, error } = await adminSupabase
    .from("study_material_chunks")
    .select("id")
    .eq("material_id", materialId)
    .in("id", requested);

  if (error) {
    console.warn("[save-generated-questions] source chunk validation failed:", error.message);
    return new Set<string>();
  }

  return new Set(((data ?? []) as SourceChunkIdRow[]).map((row) => String(row.id)));
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { materialId?: string; questions?: MCQ[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { materialId, questions } = body;
  if (!materialId || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  for (const question of questions) {
    const optionKeys = ["A", "B", "C", "D"] as const;
    const hasAllOptions = optionKeys.every((key) => {
      const value = question.options?.[key];
      return typeof value === "string" && value.trim().length > 0;
    });
    const validAnswer = optionKeys.includes(question.answer);
    if (!hasAllOptions || !validAnswer) {
      return NextResponse.json(
        { error: "AI returned malformed questions. Please try generating again." },
        { status: 422 }
      );
    }
  }

  const admin = adminSupabase;
  const { data: mat, error: matErr } = await admin
    .from("study_materials")
    .select("id, title, course_code")
    .eq("id", materialId)
    .maybeSingle();

  if (matErr || !mat) {
    return NextResponse.json({ error: "Material not found." }, { status: 404 });
  }

  const material = mat as MaterialTitleRow;
  const title = `AI Generated - ${material.title ?? "Practice Set"}`;

  const { data: set, error: setErr } = await admin
    .from("study_quiz_sets")
    .insert({
      title,
      source: "ai_generated",
      course_code: material.course_code,
      created_by: user.id,
      published: true,
      visibility: "private",
      questions_count: questions.length,
      source_material_id: materialId,
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (setErr) {
    console.error("[save-generated-questions] supabase error:", setErr);
  }

  if (setErr || !set) {
    return NextResponse.json({ error: "Failed to save questions." }, { status: 500 });
  }

  const quizSet = set as QuizSetRow;
  const chunkIds = await validSourceChunkIds(materialId, questions);

  const questionPayload = questions.map((question, index) => ({
    set_id: quizSet.id,
    prompt: question.question,
    position: index,
    explanation: question.explanation,
    ai_generated: true,
    source_material_id: materialId,
    study_ref: cleanStudyRef(question, chunkIds),
    source_chunk_id: chunkIds.has(question.studyRef?.chunkId ?? "") ? question.studyRef?.chunkId : null,
    question_kind: cleanLabel(question.questionKind),
    difficulty_level: cleanLabel(question.difficultyLevel, 40),
    cognitive_level: cleanLabel(question.cognitiveLevel, 40),
    source_topic: cleanLabel(question.sourceTopic ?? question.studyRef?.topic, 120),
    question_fingerprint: cleanLabel(question.questionFingerprint, 240),
    generation_meta: cleanJsonObject(question.generationMeta),
  }));

  const { data: insertedQuestions, error: questionsError } = await admin
    .from("study_quiz_questions")
    .insert(questionPayload)
    .select("id, position");

  if (questionsError || !insertedQuestions) {
    console.error("[save-generated-questions] question insert error:", questionsError);
    const { error: rollbackError } = await admin
      .from("study_quiz_sets")
      .delete()
      .eq("id", quizSet.id);
    if (rollbackError) {
      console.error("[save-generated-questions] question rollback error:", rollbackError);
    }
    return NextResponse.json({ error: "Failed to save questions." }, { status: 500 });
  }

  const orderedQuestions = [...(insertedQuestions as InsertedQuestionRow[])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );

  const optionPayload = orderedQuestions.flatMap((questionRow) => {
    if (typeof questionRow.position !== "number") {
      return [];
    }

    const question = questions[questionRow.position];
    if (!question) {
      return [];
    }

    return (["A", "B", "C", "D"] as const).map((key, index) => ({
      question_id: questionRow.id,
      text: question.options[key],
      is_correct: question.answer === key,
      position: index,
    }));
  });

  if (optionPayload.length !== questions.length * 4) {
    console.error("[save-generated-questions] option payload build error");
    const { error: questionRollbackError } = await admin
      .from("study_quiz_questions")
      .delete()
      .eq("set_id", quizSet.id);
    if (questionRollbackError) {
      console.error("[save-generated-questions] option build question rollback error:", questionRollbackError);
    }
    const { error: setRollbackError } = await admin
      .from("study_quiz_sets")
      .delete()
      .eq("id", quizSet.id);
    if (setRollbackError) {
      console.error("[save-generated-questions] option build set rollback error:", setRollbackError);
    }
    return NextResponse.json({ error: "Failed to save questions." }, { status: 500 });
  }

  const { error: optionsError } = await admin
    .from("study_quiz_options")
    .insert(optionPayload);

  if (optionsError) {
    console.error("[save-generated-questions] options insert error:", optionsError);
    const { error: questionRollbackError } = await admin
      .from("study_quiz_questions")
      .delete()
      .eq("set_id", quizSet.id);
    if (questionRollbackError) {
      console.error("[save-generated-questions] options question rollback error:", questionRollbackError);
    }
    const { error: setRollbackError } = await admin
      .from("study_quiz_sets")
      .delete()
      .eq("id", quizSet.id);
    if (setRollbackError) {
      console.error("[save-generated-questions] options set rollback error:", setRollbackError);
    }
    return NextResponse.json({ error: "Failed to save questions. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ setId: quizSet.id });
}
