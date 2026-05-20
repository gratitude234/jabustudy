// app/api/ai/save-generated-questions/route.ts
// POST /api/ai/save-generated-questions
// Saves AI-generated typed questions to study_quiz_sets and linked tables.
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
import {
  assertQuestionsNotDuplicateForCourse,
  duplicateGateErrorResponse,
} from "@/lib/studyDuplicateGate";
import {
  type GroundedQuestionMeta,
  SOURCE_GROUNDING_ERROR_MESSAGE,
  validateSourceBackedQuestions,
} from "@/lib/studyQuestionGrounding";

type QuestionType = "mcq" | "short_answer" | "theory";
type OptionKey = "A" | "B" | "C" | "D";

type GeneratedQuestion = {
  question_type?: QuestionType | null;
  question: string;
  options?: { A?: string; B?: string; C?: string; D?: string };
  answer?: OptionKey;
  explanation?: string;
  model_answer?: string;
  modelAnswer?: string;
  marking_points?: string[];
  markingPoints?: string[];
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

type NormalizedQuestion = Omit<GeneratedQuestion, "question_type" | "options" | "answer" | "modelAnswer" | "markingPoints"> & {
  question_type: QuestionType;
  question: string;
  explanation: string;
  options?: { A: string; B: string; C: string; D: string };
  answer?: OptionKey;
  model_answer?: string;
  marking_points: string[];
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

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
}

function questionTypeOf(value: unknown): QuestionType {
  return value === "short_answer" || value === "theory" ? value : "mcq";
}

function normalizeQuestions(questions: GeneratedQuestion[]): NormalizedQuestion[] {
  const optionKeys = ["A", "B", "C", "D"] as const;
  const normalized: NormalizedQuestion[] = [];

  for (const question of questions) {
    const prompt = cleanString(question.question);
    if (!prompt) continue;

    const questionType = questionTypeOf(question.question_type);
    const base = {
      ...question,
      question_type: questionType,
      question: prompt,
      explanation: cleanString(question.explanation) ?? "",
      marking_points: cleanStringArray(question.marking_points ?? question.markingPoints),
    };

    if (questionType === "mcq") {
      const options = question.options ?? {};
      const normalizedOptions = {
        A: cleanString(options.A) ?? "",
        B: cleanString(options.B) ?? "",
        C: cleanString(options.C) ?? "",
        D: cleanString(options.D) ?? "",
      };
      const validAnswer = optionKeys.includes(question.answer as OptionKey);
      if (!validAnswer || optionKeys.some((key) => !normalizedOptions[key])) continue;
      normalized.push({
        ...base,
        question_type: "mcq",
        options: normalizedOptions,
        answer: question.answer as OptionKey,
        model_answer: undefined,
        marking_points: [],
      });
      continue;
    }

    const modelAnswer = cleanString(question.model_answer) ?? cleanString(question.modelAnswer);
    if (!modelAnswer) continue;
    normalized.push({
      ...base,
      question_type: questionType,
      options: undefined,
      answer: undefined,
      model_answer: modelAnswer,
      marking_points: base.marking_points,
    });
  }

  return normalized;
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

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { materialId?: string; questions?: GeneratedQuestion[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { materialId, questions } = body;
  if (!materialId || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const normalizedQuestions = normalizeQuestions(questions);
  if (!normalizedQuestions || normalizedQuestions.length !== questions.length) {
    return NextResponse.json(
      { error: "AI returned malformed questions. Please try generating again." },
      { status: 422 }
    );
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
  let questionsToSave: Array<NormalizedQuestion & Partial<GroundedQuestionMeta>> = normalizedQuestions;
  const mcqQuestions = normalizedQuestions.filter((question) => question.question_type === "mcq");
  const allMcq = mcqQuestions.length === normalizedQuestions.length;
  if (allMcq) {
    try {
      questionsToSave = await validateSourceBackedQuestions(materialId, normalizedQuestions);
    } catch (error: unknown) {
      const groundingError = error as {
        message?: string;
        code?: string;
        invalidCount?: number;
        status?: number;
      };
      return NextResponse.json(
        {
          error: groundingError.message || SOURCE_GROUNDING_ERROR_MESSAGE,
          code: groundingError.code || "QUESTIONS_MISSING_SOURCE",
          invalidCount: groundingError.invalidCount,
        },
        { status: Number(groundingError.status) || 422 }
      );
    }
  }

  try {
    await assertQuestionsNotDuplicateForCourse({
      materialId,
      questions: allMcq ? questionsToSave : mcqQuestions,
    });
  } catch (error: unknown) {
    const duplicateError = error as { status?: number };
    return NextResponse.json(
      duplicateGateErrorResponse(error),
      { status: Number(duplicateError.status) || 422 }
    );
  }

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
      questions_count: questionsToSave.length,
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

  const questionPayload = questionsToSave.map((question, index) => ({
    set_id: quizSet.id,
    prompt: question.question,
    position: index,
    explanation: question.explanation || (question.question_type === "mcq" ? null : question.model_answer ?? null),
    question_type: question.question_type,
    model_answer: question.question_type === "mcq" ? null : question.model_answer ?? null,
    marking_points: question.question_type === "mcq" ? [] : question.marking_points,
    ai_generated: true,
    source_material_id: materialId,
    study_ref: question.studyRef,
    source_chunk_id: question.sourceChunkId,
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

    const question = questionsToSave[questionRow.position];
    if (!question || question.question_type !== "mcq" || !question.options || !question.answer) {
      return [];
    }
    const options = question.options;
    const answer = question.answer;

    return (["A", "B", "C", "D"] as const).map((key, index) => ({
      question_id: questionRow.id,
      text: options[key],
      is_correct: answer === key,
      position: index,
    }));
  });

  if (optionPayload.length !== mcqQuestions.length * 4) {
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

  const { error: optionsError } = optionPayload.length > 0
    ? await admin
      .from("study_quiz_options")
      .insert(optionPayload)
    : { error: null };

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
