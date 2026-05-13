import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { getBankState, isAiSupported, jsonError, requireScopedCourse } from "@/lib/repQuestionBank";

type StartBody = {
  courseId?: string;
  materialIds?: string[];
  batchSize?: number;
  topicTarget?: number;
};

export async function POST(req: NextRequest) {
  try {
    const { userId, scope } = await requireStudyModeratorFromRequest(req);
    const body = (await req.json().catch(() => null)) as StartBody | null;
    const courseId = body?.courseId?.trim();
    if (!courseId) return jsonError("Missing courseId.", 400, "MISSING_COURSE_ID");

    const course = await requireScopedCourse(courseId, scope);
    const batchSize = Math.max(3, Math.min(10, Math.trunc(Number(body?.batchSize ?? 5))));
    const topicTarget = Math.max(1, Math.min(10, Math.trunc(Number(body?.topicTarget ?? 3))));

    const { data: existingRun, error: existingErr } = await adminSupabase
      .from("study_question_bank_runs")
      .select("id")
      .eq("course_id", courseId)
      .in("status", ["draft", "ready", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existingRun?.id) {
      return NextResponse.json({ ok: true, bank: await getBankState(String(existingRun.id)) });
    }

    const requestedIds = Array.isArray(body?.materialIds)
      ? body!.materialIds!.map((id) => String(id).trim()).filter(Boolean).slice(0, 20)
      : [];

    let materialsQuery = adminSupabase
      .from("study_materials")
      .select("id,title,material_type,file_path,downloads")
      .eq("course_id", courseId)
      .eq("approved", true)
      .eq("upload_status", "live")
      .not("file_path", "is", null)
      .order("downloads", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (requestedIds.length) materialsQuery = materialsQuery.in("id", requestedIds);
    else materialsQuery = materialsQuery.limit(8);

    const { data: materialsData, error: materialsErr } = await materialsQuery;
    if (materialsErr) throw materialsErr;

    const materials = ((materialsData ?? []) as any[]).filter((m) => isAiSupported(m.file_path));
    if (!materials.length) {
      return jsonError("No AI-compatible approved materials found for this course.", 422, "NO_COMPATIBLE_MATERIALS");
    }

    const selectedMaterials = materials.map((m) => ({
      id: m.id,
      title: m.title ?? "Untitled material",
      material_type: m.material_type ?? "other",
    }));

    const { data: set, error: setErr } = await adminSupabase
      .from("study_quiz_sets")
      .insert({
        title: `${course.course_code} Official Practice Bank`,
        description: "AI-assisted draft created by a course rep. Review before publishing.",
        course_code: course.course_code,
        level: course.level,
        source: "rep_ai_bank",
        source_material_ids: selectedMaterials,
        created_by: userId,
        published: false,
        visibility: "public",
        questions_count: 0,
      } as any)
      .select("id")
      .single();

    if (setErr || !set?.id) throw setErr ?? new Error("Failed to create practice set.");

    const { data: run, error: runErr } = await adminSupabase
      .from("study_question_bank_runs")
      .insert({
        course_id: course.id,
        course_code: course.course_code,
        quiz_set_id: set.id,
        created_by: userId,
        status: "draft",
        selected_materials: selectedMaterials,
        batch_size: batchSize,
        topic_target: topicTarget,
      })
      .select("id")
      .single();

    if (runErr || !run?.id) {
      await adminSupabase.from("study_quiz_sets").delete().eq("id", set.id);
      throw runErr ?? new Error("Failed to create question bank run.");
    }

    const materialRows = materials.map((m, index) => ({
      run_id: run.id,
      material_id: m.id,
      position: index,
      status: "pending",
      topic_outline: [],
      generated_count: 0,
    }));

    const { error: rowsErr } = await adminSupabase.from("study_question_bank_materials").insert(materialRows);
    if (rowsErr) {
      await adminSupabase.from("study_question_bank_runs").delete().eq("id", run.id);
      await adminSupabase.from("study_quiz_sets").delete().eq("id", set.id);
      throw rowsErr;
    }

    const bank = await getBankState(String(run.id));
    return NextResponse.json({ ok: true, bank });
  } catch (e: any) {
    return jsonError(e?.message || "Failed to start question bank.", Number(e?.status) || 500, e?.code);
  }
}
