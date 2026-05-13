// app/api/study-admin/rep-applications/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModerator } from "@/lib/studyAdmin/requireStudyModerator";

function jsonError(message: string, status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, message, ...(extra ?? {}) }, { status });
}

function normalizeRole(raw: unknown): "course_rep" | "dept_librarian" | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "course_rep") return "course_rep";
  if (v === "dept_librarian") return "dept_librarian";
  if (v === "rep") return "course_rep";
  if (v === "librarian") return "dept_librarian";
  return null;
}

function normalizeLevels(appRow: any, role: "course_rep" | "dept_librarian") {
  if (role === "dept_librarian") return null;

  // course_rep: levels required; fallback to legacy level
  const lv =
    Array.isArray(appRow?.levels) && appRow.levels.length
      ? appRow.levels
      : typeof appRow?.level === "number"
        ? [appRow.level]
        : null;

  if (!lv || !Array.isArray(lv) || lv.length === 0) return null;

  // sanitize unique integers
  const cleaned = Array.from(
    new Set(
      lv
        .map((x: any) => (typeof x === "number" ? x : Number(x)))
        .filter((n: any) => Number.isFinite(n))
        .map((n: number) => Math.trunc(n))
    )
  );

  return cleaned.length ? cleaned : null;
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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const admin_note = typeof body?.admin_note === "string" ? body.admin_note.trim() : null;
  const decision_reason = typeof body?.decision_reason === "string" ? body.decision_reason.trim() : null;

  const adminDb = createSupabaseAdminClient();

  // Fetch application
  const { data: appRow, error: appErr } = await adminDb
    .from("study_rep_applications")
    .select("id, user_id, status, role, faculty_id, department_id, level, levels")
    .eq("id", id)
    .maybeSingle();

  if (appErr) return jsonError(appErr.message || "DB error", 500, "DB_ERROR");
  if (!appRow?.id) return jsonError("Application not found", 404, "NOT_FOUND");

  if (appRow.status !== "pending") {
    // Idempotent behavior for double-clicks
    return NextResponse.json({ ok: true, already_processed: true, status: appRow.status });
  }

  const role = normalizeRole(appRow.role);
  if (!role) return jsonError("Invalid application role", 400, "INVALID_ROLE");

  const department_id = appRow.department_id ?? null;
  const faculty_id = appRow.faculty_id ?? null;

  if (!department_id) {
    return jsonError("Cannot approve: missing department", 400, "MISSING_DEPARTMENT");
  }

  const levels = normalizeLevels(appRow, role);
  if (role === "course_rep" && (!levels || levels.length === 0)) {
    return jsonError("Cannot approve: course rep must have level(s)", 400, "LEVELS_REQUIRED");
  }

  // M-10: Guard against overwriting existing rep for a different department
  const { data: existingRep } = await adminDb
    .from('study_reps')
    .select('user_id, department_id, role')
    .eq('user_id', appRow.user_id)
    .maybeSingle();

  if (existingRep && existingRep.department_id !== department_id) {
    return jsonError(
      `This user is already a ${existingRep.role} for a different department. ` +
      `Revoke their current role first before approving this application.`,
      409,
      'REP_ALREADY_EXISTS'
    );
  }

  // 1) Upsert into study_reps
  const repPayload: Record<string, any> = {
    user_id: appRow.user_id,
    faculty_id,
    department_id,
    active: true,
    role, // store new roles
    levels: role === "dept_librarian" ? null : levels,
  };

  const { error: upsertErr } = await adminDb.from("study_reps").upsert(repPayload, { onConflict: "user_id" });
  if (upsertErr) return jsonError(upsertErr.message || "Failed to upsert rep", 500, "UPSERT_FAILED");

  // 2) Mark application approved
  const updatePayload: Record<string, any> = {
    status: "approved",
  };
  if (admin_note) updatePayload.admin_note = admin_note;
  if (decision_reason) updatePayload.decision_reason = decision_reason;
  // C-5: Audit trail
  updatePayload.reviewed_at = new Date().toISOString();
  updatePayload.reviewed_by = auth.userId;
  updatePayload.decided_at  = new Date().toISOString();

  const { error: updErr } = await adminDb.from("study_rep_applications").update(updatePayload).eq("id", id);
  if (updErr) return jsonError(updErr.message || "Failed to update application", 500, "UPDATE_FAILED");

  // C-6: Notify applicant
  try {
    const roleLabel = role === 'dept_librarian' ? 'Dept Librarian' : 'Course Rep';
    await adminDb.from('notifications').insert({
      user_id: appRow.user_id,
      type:    'rep_approved',
      title:   `You're now a ${roleLabel}!`,
      body:    'Your application was approved. You can now upload and manage materials for your department.',
      href:    '/study/materials/upload',
    });
  } catch { /* non-critical */ }

  return NextResponse.json({
    ok: true,
    approved: true,
    role,
    scope: {
      faculty_id,
      department_id,
      levels: role === "course_rep" ? levels : null,
      all_levels: role === "dept_librarian",
    },
  });
}