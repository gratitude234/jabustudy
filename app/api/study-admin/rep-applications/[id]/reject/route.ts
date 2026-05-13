// app/api/study-admin/rep-applications/[id]/reject/route.ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModerator } from "@/lib/studyAdmin/requireStudyModerator";

function jsonError(message: string, status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, message, ...(extra ?? {}) }, { status });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Super admin only
  let auth;
  let resolvedParams: { id: string } | null = null;
  try {
    resolvedParams = await params;
    auth = await requireStudyModerator();
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.status || 401, e?.code || "UNAUTHORIZED");
  }
  if (!auth.isSuper) return jsonError("Forbidden", 403, "FORBIDDEN");

  const id = resolvedParams?.id;
  if (!id) return jsonError("Missing application id", 400, "MISSING_ID");

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const decision_reason = typeof body?.decision_reason === "string" ? body.decision_reason.trim() : "";
  const admin_note = typeof body?.admin_note === "string" ? body.admin_note.trim() : null;

  if (!decision_reason) {
    return jsonError("Rejection reason is required", 400, "REASON_REQUIRED");
  }

  const adminDb = createSupabaseAdminClient();

  const { data: appRow, error: appErr } = await adminDb
    .from("study_rep_applications")
    .select("id, status, user_id")
    .eq("id", id)
    .maybeSingle();

  if (appErr) return jsonError(appErr.message || "DB error", 500, "DB_ERROR");
  if (!appRow?.id) return jsonError("Application not found", 404, "NOT_FOUND");

  if (appRow.status !== "pending") {
    // Idempotent behavior
    return NextResponse.json({ ok: true, already_processed: true, status: appRow.status });
  }

  const updatePayload: Record<string, any> = {
    status: "rejected",
    decision_reason,
  };
  if (admin_note) updatePayload.admin_note = admin_note;
  // C-5: Audit trail
  updatePayload.reviewed_at = new Date().toISOString();
  updatePayload.reviewed_by = auth.userId;
  updatePayload.decided_at  = new Date().toISOString();

  const { error: updErr } = await adminDb.from("study_rep_applications").update(updatePayload).eq("id", id);
  if (updErr) return jsonError(updErr.message || "Failed to reject application", 500, "UPDATE_FAILED");

  // C-6: Notify applicant
  try {
    await adminDb.from('notifications').insert({
      user_id: appRow.user_id,
      type:    'rep_rejected',
      title:   'Application not approved',
      body:    decision_reason
        ? `Reason: ${decision_reason}`
        : 'Your rep application was not approved. Contact the study admin for details.',
      href:    '/study/apply-rep',
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true, rejected: true });
}