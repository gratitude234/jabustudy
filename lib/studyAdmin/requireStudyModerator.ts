import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StudyModeratorRole = "super" | "course_rep" | "dept_librarian";

export type StudyModeratorScope = {
  facultyId: string | null;
  departmentId: string | null;
  role: StudyModeratorRole;
  /**
   * Only relevant for course reps:
   * - course_rep: MUST be a non-empty array (e.g. [100, 200])
   * - dept_librarian: MUST be null
   * - super: unused
   */
  levels: number[] | null;
};

export type StudyModeratorAuthResult = {
  userId: string;
  scope: StudyModeratorScope;
  /** True if the user has a row in study_admins, regardless of rep scope. */
  isSuper: boolean;
};

// -----------------------------
// Helpers
// -----------------------------

function httpError(message: string, status: number, code?: string) {
  return Object.assign(new Error(message), { status, code });
}

function normalizeRole(raw: unknown): StudyModeratorRole {
  const v = typeof raw === "string" ? raw.trim() : "";

  // New intended values
  if (v === "course_rep") return "course_rep";
  if (v === "dept_librarian") return "dept_librarian";

  // Backward compatibility with older schema values
  if (v === "rep") return "course_rep";
  if (v === "librarian") return "dept_librarian";

  // If the DB column doesn't exist or value is empty,
  // defaulting is risky — we choose the safer option:
  // treat it as course_rep (more restrictive) and require levels.
  return "course_rep";
}

function parseLevels(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;

  const nums = raw
    .map((x) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.trunc(n));

  // Remove duplicates
  const unique = Array.from(new Set(nums));

  return unique.length ? unique : null;
}

/**
 * Centralized scope lookup by userId.
 * Uses service-role client (does not rely on RLS).
 *
 * IMPORTANT PRIORITY RULE:
 * - If a user is BOTH a super admin AND has an active rep/librarian row,
 *   we prefer the REP/LIBRARIAN scope for scoped actions (like creating courses).
 * - `isSuper` is always true if the user is in study_admins, regardless of rep row.
 *
 * Throws:
 * - 403 NOT_STUDY_MODERATOR
 * - 403 REP_SCOPE_MISCONFIGURED
 * - 500 DB_LOOKUP_FAILED
 */
export async function getStudyModeratorScopeByUserId(userId: string): Promise<{ scope: StudyModeratorScope; isSuper: boolean }> {
  const admin = createSupabaseAdminClient();

  // 1) Check super admin (but don't return early; super+rep should still work)
  const { data: studyAdminRow, error: studyAdminErr } = await admin
    .from("study_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (studyAdminErr) {
    throw httpError(studyAdminErr.message || "Study admin check failed", 500, "DB_LOOKUP_FAILED");
  }

  const isSuper = !!studyAdminRow?.user_id;

  // 2) Check rep/librarian scope
  const { data: repRow, error: repErr } = await admin
    .from("study_reps")
    // role may not exist in some older schemas; selecting it is safe
    .select("user_id, role, faculty_id, department_id, levels, active")
    .eq("user_id", userId)
    .maybeSingle();

  if (repErr) {
    throw httpError(repErr.message || "Study rep check failed", 500, "DB_LOOKUP_FAILED");
  }

  // If a valid active rep row exists, prefer it (fixes super+rep scope issues)
  if (repRow?.user_id && repRow?.active !== false) {
    const role = normalizeRole((repRow as any)?.role);
    const facultyId = (repRow as any)?.faculty_id ?? null;
    const departmentId = (repRow as any)?.department_id ?? null;

    // HARD REQUIREMENT for both course reps and dept librarians:
    // without department scope, permissions become dangerous.
    // Super admins fall back to unrestricted super scope if their rep row is broken.
    if (!departmentId) {
      if (isSuper) return { scope: { role: "super", facultyId: null, departmentId: null, levels: null }, isSuper: true };
      throw httpError(
        "Moderator scope misconfigured (missing department). Contact admin.",
        403,
        "REP_SCOPE_MISCONFIGURED"
      );
    }

    // Levels handling
    const parsedLevels = parseLevels((repRow as any)?.levels);

    if (role === "dept_librarian") {
      // Dept librarians: department-wide across all levels
      return {
        scope: { role, facultyId, departmentId, levels: null },
        isSuper,
      };
    }

    // course_rep: MUST have levels
    if (!parsedLevels) {
      if (isSuper) return { scope: { role: "super", facultyId: null, departmentId: null, levels: null }, isSuper: true };
      throw httpError(
        "Moderator scope misconfigured (missing levels). Contact admin.",
        403,
        "REP_SCOPE_MISCONFIGURED"
      );
    }

    return {
      scope: { role: "course_rep", facultyId, departmentId, levels: parsedLevels },
      isSuper,
    };
  }

  // No rep row; super-only can still pass for admin endpoints.
  if (isSuper) {
    return { scope: { role: "super", facultyId: null, departmentId: null, levels: null }, isSuper: true };
  }

  throw httpError("Forbidden", 403, "NOT_STUDY_MODERATOR");
}

/**
 * Verifies authenticated user AND that user is either:
 * - a super study admin (in `study_admins`), or
 * - a scoped course rep / dept librarian (in `study_reps`).
 */
export async function requireStudyModerator(): Promise<StudyModeratorAuthResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userData.user) {
    throw httpError("Unauthorized", 401, "NO_SESSION");
  }

  const userId = userData.user.id;
  const { scope, isSuper } = await getStudyModeratorScopeByUserId(userId);

  return { userId, scope, isSuper };
}
