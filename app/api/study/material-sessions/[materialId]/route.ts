import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
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
    const alreadyAppended = nextAttemptId
      ? existingBatches.some((batch) => {
          if (!batch || typeof batch !== "object") return false;
          return (batch as { attemptId?: unknown }).attemptId === nextAttemptId;
        })
      : false;

    if (alreadyAppended) {
      return NextResponse.json({ ok: true, duplicate: true });
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
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action", 400, "BAD_REQUEST");
}
