import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import {
  type BankTopic,
  fetchMaterialContent,
  generateTopicQuestions,
  getBankState,
  jsonError,
  outlineMaterial,
  requireScopedCourse,
} from "@/lib/repQuestionBank";

function topicsFrom(raw: unknown): BankTopic[] {
  return Array.isArray(raw)
    ? raw
        .map((t: any) => ({
          title: String(t?.title ?? "").trim(),
          description: t?.description ? String(t.description) : null,
          target: Math.max(1, Number(t?.target ?? 3)),
          generated: Math.max(0, Number(t?.generated ?? 0)),
        }))
        .filter((t) => t.title)
    : [];
}

async function markRunReadyIfCovered(runId: string, quizSetId: string) {
  const { data: rows } = await adminSupabase
    .from("study_question_bank_materials")
    .select("status")
    .eq("run_id", runId);
  const allCovered = (rows ?? []).length > 0 && (rows ?? []).every((row: any) => row.status === "covered");
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

    const { data: run, error: runErr } = await adminSupabase
      .from("study_question_bank_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (runErr) throw runErr;
    if (!run) return jsonError("Question bank run not found.", 404, "RUN_NOT_FOUND");
    if ((run as any).status === "completed") return jsonError("This question bank is already published.", 409, "RUN_COMPLETED");

    const course = await requireScopedCourse(String((run as any).course_id), scope);

    const { data: materialRows, error: rowsErr } = await adminSupabase
      .from("study_question_bank_materials")
      .select("*")
      .eq("run_id", runId)
      .order("position", { ascending: true });
    if (rowsErr) throw rowsErr;

    let current = ((materialRows ?? []) as any[]).find((row) => String(row.status) !== "covered");
    if (!current) {
      await markRunReadyIfCovered(runId, String((run as any).quiz_set_id));
      return NextResponse.json({ ok: true, bank: await getBankState(runId), message: "All selected materials are covered." });
    }
    materialRowIdForError = String(current.id);

    let topics = topicsFrom(current.topic_outline);
    const materialId = String(current.material_id);

    const { data: material, error: materialErr } = await adminSupabase
      .from("study_materials")
      .select("id,title,material_type,file_path,file_url")
      .eq("id", materialId)
      .maybeSingle();
    if (materialErr) throw materialErr;
    if (!material) return jsonError("Material not found.", 404, "MATERIAL_NOT_FOUND");

    const content = await fetchMaterialContent(material as any);

    if (String(current.status) === "pending" || topics.length === 0) {
      await adminSupabase
        .from("study_question_bank_materials")
        .update({ status: "generating", updated_at: new Date().toISOString(), error_message: null })
        .eq("id", current.id);

      topics = await outlineMaterial({
        courseCode: course.course_code,
        materialTitle: String((material as any).title ?? "Untitled material"),
        content,
        topicTarget: Number((run as any).topic_target ?? 3),
      });

      await adminSupabase
        .from("study_question_bank_materials")
        .update({ status: "outlined", topic_outline: topics, updated_at: new Date().toISOString() })
        .eq("id", current.id);
      current = { ...current, status: "outlined", topic_outline: topics };
    }

    let topicIndex = topics.findIndex((topic) => topic.generated < topic.target);
    if (topicIndex < 0) {
      await adminSupabase
        .from("study_question_bank_materials")
        .update({ status: "covered", updated_at: new Date().toISOString() })
        .eq("id", current.id);
      await markRunReadyIfCovered(runId, String((run as any).quiz_set_id));
      return NextResponse.json({ ok: true, bank: await getBankState(runId), message: "Material covered. Generate again for the next material." });
    }

    const topic = topics[topicIndex];
    const count = Math.min(Number((run as any).batch_size ?? 5), topic.target - topic.generated);

    const { data: existing } = await adminSupabase
      .from("study_quiz_questions")
      .select("prompt")
      .eq("set_id", (run as any).quiz_set_id)
      .order("position", { ascending: true })
      .limit(80);

    const questions = await generateTopicQuestions({
      courseCode: course.course_code,
      materialTitle: String((material as any).title ?? "Untitled material"),
      topic,
      count,
      existingPrompts: ((existing ?? []) as any[]).map((row) => String(row.prompt ?? "")).filter(Boolean),
      content,
    });

    if (!questions.length) throw new Error("AI did not return usable questions for this batch.");

    const { count: existingCount } = await adminSupabase
      .from("study_quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("set_id", (run as any).quiz_set_id);

    const { data: insertedQuestions, error: questionErr } = await adminSupabase
      .from("study_quiz_questions")
      .insert(
        questions.map((q, index) => ({
          set_id: (run as any).quiz_set_id,
          prompt: q.question,
          explanation: q.explanation,
          position: (existingCount ?? 0) + index,
          source_material_id: materialId,
          source_topic: topic.title,
          ai_generated: true,
        }))
      )
      .select("id,position");

    if (questionErr || !insertedQuestions?.length) throw questionErr ?? new Error("Failed to save generated questions.");

    const sortedInserted = [...(insertedQuestions as any[])].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
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
    topics[topicIndex] = { ...topic, generated: topic.generated + insertedCount };
    const materialCovered = topics.every((t) => t.generated >= t.target);
    const nextStatus = materialCovered ? "covered" : "outlined";
    const nextGeneratedCount = Number(current.generated_count ?? 0) + insertedCount;

    await Promise.all([
      adminSupabase
        .from("study_question_bank_materials")
        .update({
          status: nextStatus,
          topic_outline: topics,
          generated_count: nextGeneratedCount,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id),
      adminSupabase
        .from("study_quiz_sets")
        .update({ questions_count: (existingCount ?? 0) + insertedCount })
        .eq("id", (run as any).quiz_set_id),
      adminSupabase
        .from("study_question_bank_runs")
        .update({ status: "draft", updated_at: new Date().toISOString(), error_message: null })
        .eq("id", runId),
    ]);

    await markRunReadyIfCovered(runId, String((run as any).quiz_set_id));

    return NextResponse.json({
      ok: true,
      generated: insertedCount,
      topic: topic.title,
      bank: await getBankState(runId),
    });
  } catch (e: any) {
    const message = e?.message || "Failed to generate batch.";
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
    return jsonError(message, Number(e?.status) || 500, e?.code);
  }
}
