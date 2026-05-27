import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

async function getOrCreateMasterSet(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  materialId: string,
  materialTitle: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("study_quiz_sets")
    .select("id")
    .eq("created_by", userId)
    .eq("source_material_id", materialId)
    .eq("draft_status", "master")
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data: created, error } = await admin
    .from("study_quiz_sets")
    .insert({
      title: materialTitle,
      description: "AI-generated questions from this material",
      created_by: userId,
      source: "ai_generated",
      source_material_id: materialId,
      draft_status: "master",
      visibility: "private",
      published: true,
      questions_count: 0,
    })
    .select("id")
    .single();

  if (error || !created?.id) throw new Error("Could not create master practice set");
  return String(created.id);
}

type Params = { params: Promise<{ materialId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { materialId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorised", 401, "UNAUTHORISED");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("study_material_sessions")
    .select("id, total_questions, total_correct, batches, started_at, last_active_at, status")
    .eq("user_id", user.id)
    .eq("material_id", materialId)
    .eq("status", "active")
    .gt("last_active_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("last_active_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return jsonError("Failed to fetch session", 500, "DB_ERROR");

  return NextResponse.json({ ok: true, session: data ?? null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { materialId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorised", 401, "UNAUTHORISED");

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("study_material_sessions")
    .insert({
      user_id: user.id,
      material_id: materialId,
      status: "active",
      total_questions: 0,
      total_correct: 0,
      batches: [],
      started_at: now,
      last_active_at: now,
      created_at: now,
    })
    .select("id, total_questions, total_correct, batches, started_at, last_active_at, status")
    .maybeSingle();

  if (error || !data) return jsonError("Failed to create session", 500, "DB_ERROR");

  return NextResponse.json({ ok: true, session: data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { materialId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorised", 401, "UNAUTHORISED");

  let body: { action: string; batch?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, "BAD_REQUEST");
  }

  const admin = createSupabaseAdminClient();

  if (body.action === "complete") {
    const { error } = await admin
      .from("study_material_sessions")
      .update({ status: "completed" })
      .eq("user_id", user.id)
      .eq("material_id", materialId)
      .eq("status", "active");

    if (error) return jsonError("Failed to complete session", 500, "DB_ERROR");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "append_batch") {
    if (!body.batch || typeof body.batch !== "object") {
      return jsonError("Missing batch data", 400, "BAD_REQUEST");
    }

    // Fetch current session to append to batches array
    const { data: session, error: fetchError } = await admin
      .from("study_material_sessions")
      .select("id, batches, total_questions, total_correct")
      .eq("user_id", user.id)
      .eq("material_id", materialId)
      .eq("status", "active")
      .order("last_active_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !session) return jsonError("Session not found", 404, "NOT_FOUND");

    const batchCount = typeof body.batch.count === "number" ? body.batch.count : 0;
    const batchCorrect = typeof body.batch.correct === "number" ? body.batch.correct : 0;
    const existingBatches = Array.isArray(session.batches) ? session.batches : [];
    const nextAttemptId = typeof body.batch.attemptId === "string" ? body.batch.attemptId : null;
    const batchSetId = typeof body.batch.setId === "string" ? body.batch.setId : null;
    const alreadyAppended = nextAttemptId
      ? existingBatches.some((batch) => {
          if (!batch || typeof batch !== "object") return false;
          return (batch as { attemptId?: unknown }).attemptId === nextAttemptId;
        })
      : false;

    if (alreadyAppended) {
      const { data: existingMaster } = await admin
        .from("study_quiz_sets")
        .select("id, questions_count")
        .eq("created_by", user.id)
        .eq("source_material_id", materialId)
        .eq("draft_status", "master")
        .maybeSingle();
      return NextResponse.json({
        ok: true,
        duplicate: true,
        masterSetId: existingMaster?.id ?? null,
        masterSetCount: existingMaster?.questions_count ?? 0,
      });
    }

    const updatedBatches = [...existingBatches, body.batch];

    const { error: updateError } = await admin
      .from("study_material_sessions")
      .update({
        batches: updatedBatches,
        total_questions: (session.total_questions ?? 0) + batchCount,
        total_correct: (session.total_correct ?? 0) + batchCorrect,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (updateError) return jsonError("Failed to update session", 500, "DB_ERROR");

    // Merge batch questions into the user's master set for this material
    let masterSetId: string | null = null;
    let masterSetCount = 0;
    if (batchSetId) {
      try {
        const { data: materialData } = await admin
          .from("study_materials")
          .select("title")
          .eq("id", materialId)
          .maybeSingle();
        const materialTitle =
          (typeof materialData?.title === "string" ? materialData.title : null) ?? "AI Practice Set";

        masterSetId = await getOrCreateMasterSet(admin, user.id, materialId, materialTitle);

        await admin.from("study_quiz_questions").update({ set_id: masterSetId }).eq("set_id", batchSetId);

        if (nextAttemptId) {
          await admin
            .from("study_practice_attempts")
            .update({ set_id: masterSetId })
            .eq("id", nextAttemptId);
        }

        const { count } = await admin
          .from("study_quiz_questions")
          .select("id", { count: "exact", head: true })
          .eq("set_id", masterSetId);
        masterSetCount = count ?? 0;

        await admin
          .from("study_quiz_sets")
          .update({ questions_count: masterSetCount })
          .eq("id", masterSetId);

        await admin
          .from("study_quiz_sets")
          .update({ draft_status: "discarded" })
          .eq("id", batchSetId);
      } catch {
        // Master set merge is non-critical — session append already succeeded
      }
    }

    return NextResponse.json({ ok: true, masterSetId, masterSetCount });
  }

  return jsonError("Unknown action", 400, "BAD_REQUEST");
}
