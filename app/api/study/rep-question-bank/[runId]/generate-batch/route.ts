import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import {
  getBankState,
  jsonError,
  requireScopedCourse,
} from "@/lib/repQuestionBank";
import { assertQuestionsNotDuplicateForCourse } from "@/lib/studyDuplicateGate";
import { generateCoverageAwareQuestions, type StudyGenerationIntent } from "@/lib/studyQuestionGeneration";
import { validateSourceBackedQuestions } from "@/lib/studyQuestionGrounding";

type BankRunRow = {
  status?: string | null;
  course_id: string;
  course_code?: string | null;
  quiz_set_id: string;
  batch_size?: number | null;
};

type BankMaterialRow = {
  id: string;
  material_id: string;
  status?: string | null;
  generated_count?: number | null;
};

type StudyMaterialRow = {
  id: string;
  title: string | null;
  index_status: string | null;
};

type ExistingQuestionRow = {
  prompt: string | null;
};

type InsertedQuestionRow = {
  id: string;
  position: number | null;
};

type RouteError = {
  message?: string;
  status?: number;
  code?: string;
  duplicateCount?: number;
  duplicates?: unknown;
};

const REP_GENERATION_INTENTS = new Set<StudyGenerationIntent>([
  "weak_areas",
  "untested_sections",
  "hard",
  "past_question_style",
]);

function normalizeGenerationIntent(value: unknown): StudyGenerationIntent {
  return typeof value === "string" && REP_GENERATION_INTENTS.has(value as StudyGenerationIntent)
    ? (value as StudyGenerationIntent)
    : "weak_areas";
}

async function markRunReadyIfCovered(runId: string, quizSetId: string) {
  const { data: rows } = await adminSupabase
    .from("study_question_bank_materials")
    .select("status")
    .eq("run_id", runId);
  const statusRows = (rows ?? []) as Array<{ status?: string | null }>;
  const allCovered = statusRows.length > 0 && statusRows.every((row) => row.status === "covered");
  if (!allCovered) return;

  const { count } = await adminSupabase
    .from("study_quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("set_id", quizSetId);

  if ((count ?? 0) > 0) {
    await adminSupabase
      .from("study_question_bank_runs")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", runId);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { runId: string } | Promise<{ runId: string }> }
) {
  let runIdForError: string | null = null;
  let materialRowIdForError: string | null = null;
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const { runId } = await params;
    runIdForError = runId ?? null;
    if (!runId) return jsonError("Missing runId.", 400, "MISSING_RUN_ID");
    const requestBody = await req.json().catch(() => ({}));
    const generationIntent = normalizeGenerationIntent((requestBody as { generationIntent?: unknown }).generationIntent);

    const { data: run, error: runErr } = await adminSupabase
      .from("study_question_bank_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (runErr) throw runErr;
    if (!run) return jsonError("Question bank run not found.", 404, "RUN_NOT_FOUND");
    const bankRun = run as BankRunRow;
    if (bankRun.status === "completed") return jsonError("This question bank is already published.", 409, "RUN_COMPLETED");

    await requireScopedCourse(String(bankRun.course_id), scope);

    const { data: materialRows, error: rowsErr } = await adminSupabase
      .from("study_question_bank_materials")
      .select("*")
      .eq("run_id", runId)
      .order("position", { ascending: true });
    if (rowsErr) throw rowsErr;

    const current = ((materialRows ?? []) as BankMaterialRow[]).find((row) => String(row.status) !== "covered");
    if (!current) {
      await markRunReadyIfCovered(runId, String(bankRun.quiz_set_id));
      return NextResponse.json({ ok: true, bank: await getBankState(runId), message: "All selected materials are covered." });
    }
    materialRowIdForError = String(current.id);

    const materialId = String(current.material_id);

    const { data: material, error: materialErr } = await adminSupabase
      .from("study_materials")
      .select("id,title,material_type,file_path,file_url,index_status")
      .eq("id", materialId)
      .maybeSingle();
    if (materialErr) throw materialErr;
    if (!material) return jsonError("Material not found.", 404, "MATERIAL_NOT_FOUND");

    const materialRow = material as StudyMaterialRow;
    if (materialRow.index_status !== "ready") {
      await adminSupabase
        .from("study_question_bank_materials")
        .update({
          status: "failed",
          error_message: "Material is not indexed yet. Reindex it before generating source-backed questions.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);
      return jsonError(
        "Material is not indexed yet. Reindex it before generating source-backed questions.",
        422,
        "MATERIAL_NOT_INDEXED"
      );
    }

    await adminSupabase
      .from("study_question_bank_materials")
      .update({ status: "generating", updated_at: new Date().toISOString(), error_message: null })
      .eq("id", current.id);

    const { data: existing } = await adminSupabase
      .from("study_quiz_questions")
      .select("prompt")
      .eq("set_id", bankRun.quiz_set_id)
      .order("position", { ascending: true })
      .limit(80);

    const requestedCount = Math.max(1, Math.min(10, Number(bankRun.batch_size ?? 5)));
    const generation = await generateCoverageAwareQuestions({
      materialId,
      materialTitle: String(materialRow.title ?? "Untitled material"),
      count: requestedCount,
      difficulty: generationIntent === "hard" || generationIntent === "past_question_style" ? "hard" : "mixed",
      generationIntent,
      coveredQuestions: ((existing ?? []) as ExistingQuestionRow[])
        .map((row) => String(row.prompt ?? ""))
        .filter(Boolean),
    });

    if (!generation?.questions.length) throw new Error("AI did not return usable source-backed questions for this batch.");
    const questions = await validateSourceBackedQuestions(materialId, generation.questions);

    await assertQuestionsNotDuplicateForCourse({
      courseId: bankRun.course_id,
      courseCode: bankRun.course_code,
      questions,
    });

    const { count: existingCount } = await adminSupabase
      .from("study_quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("set_id", bankRun.quiz_set_id);

    const { data: insertedQuestions, error: questionErr } = await adminSupabase
      .from("study_quiz_questions")
      .insert(
        questions.map((q, index) => ({
          set_id: bankRun.quiz_set_id,
          prompt: q.question,
          explanation: q.explanation,
          position: (existingCount ?? 0) + index,
          source_material_id: materialId,
          source_chunk_id: q.sourceChunkId,
          study_ref: q.studyRef,
          source_topic: q.sourceTopic ?? q.studyRef?.topic ?? null,
          question_kind: q.questionKind ?? null,
          difficulty_level: q.difficultyLevel ?? null,
          cognitive_level: q.cognitiveLevel ?? null,
          question_fingerprint: q.questionFingerprint ?? null,
          generation_meta: q.generationMeta ?? null,
          ai_generated: true,
        }))
      )
      .select("id,position");

    if (questionErr || !insertedQuestions?.length) throw questionErr ?? new Error("Failed to save generated questions.");

    const sortedInserted = [...(insertedQuestions as InsertedQuestionRow[])].sort(
      (a, b) => Number(a.position ?? 0) - Number(b.position ?? 0)
    );
    const optionRows = sortedInserted.flatMap((row, index) => {
      const q = questions[index];
      return (["A", "B", "C", "D"] as const).map((letter, optIndex) => ({
        question_id: row.id,
        text: q.options[letter],
        is_correct: q.answer === letter,
        position: optIndex,
      }));
    });

    const { error: optionErr } = await adminSupabase.from("study_quiz_options").insert(optionRows);
    if (optionErr) {
      await adminSupabase.from("study_quiz_questions").delete().in("id", sortedInserted.map((row) => row.id));
      throw optionErr;
    }

    const insertedCount = sortedInserted.length;
    const nextGeneratedCount = Number(current.generated_count ?? 0) + insertedCount;
    const nextTopicOutline = Object.entries(generation.questionKindCounts).map(([title, generated]) => ({
      title: title.replace(/_/g, " "),
      description: null,
      target: generated,
      generated,
    }));

    await Promise.all([
      adminSupabase
        .from("study_question_bank_materials")
        .update({
          status: "covered",
          topic_outline: nextTopicOutline,
          generated_count: nextGeneratedCount,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id),
      adminSupabase
        .from("study_quiz_sets")
        .update({ questions_count: (existingCount ?? 0) + insertedCount })
        .eq("id", bankRun.quiz_set_id),
      adminSupabase
        .from("study_question_bank_runs")
        .update({ status: "draft", updated_at: new Date().toISOString(), error_message: null })
        .eq("id", runId),
    ]);

    await markRunReadyIfCovered(runId, String(bankRun.quiz_set_id));

    return NextResponse.json({
      ok: true,
      generated: insertedCount,
      topic: generation.questions[0]?.sourceTopic ?? "Source-backed batch",
      bank: await getBankState(runId),
    });
  } catch (e: unknown) {
    const error = e as RouteError;
    const message = error.message || "Failed to generate batch.";
    const updatedAt = new Date().toISOString();
    if (materialRowIdForError) {
      await adminSupabase
        .from("study_question_bank_materials")
        .update({ status: "failed", error_message: message, updated_at: updatedAt })
        .eq("id", materialRowIdForError);
    }
    if (runIdForError) {
      await adminSupabase
        .from("study_question_bank_runs")
        .update({ status: "failed", error_message: message, updated_at: updatedAt })
        .eq("id", runIdForError);
    }
    if (error.code === "DUPLICATE_QUESTION") {
      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          error: message,
          duplicateCount: error.duplicateCount,
          duplicates: error.duplicates,
        },
        { status: Number(error.status) || 422 }
      );
    }
    return jsonError(message, Number(error.status) || 500, error.code);
  }
}
