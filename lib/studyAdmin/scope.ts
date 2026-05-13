import type { StudyModeratorScope } from "./requireStudyModerator";

export type ScopedEntity = {
  faculty_id?: string | null;
  department_id?: string | null;
  level?: number | null;
};

/**
 * Strict scope check:
 * - super: always true
 * - dept_librarian: requires entity.department_id to exist and match scope.departmentId
 * - course_rep: requires entity.department_id + entity.level to exist and match scope.departmentId + scope.levels
 *
 * IMPORTANT: Missing required entity fields => DENY (prevents bypasses).
 */
export function isWithinScope(scope: StudyModeratorScope, entity: ScopedEntity) {
  if (scope.role === "super") return true;

  // We require department scope for both course reps and dept librarians.
  if (!scope.departmentId) return false;

  // Entity MUST contain department_id for scoped access checks.
  if (!entity.department_id) return false;
  if (scope.departmentId !== entity.department_id) return false;

  // Faculty check (optional restriction)
  if (scope.facultyId) {
    if (!entity.faculty_id) return false;
    if (scope.facultyId !== entity.faculty_id) return false;
  }

  if (scope.role === "dept_librarian") {
    // Departmental librarians can operate across all levels
    return true;
  }

  // course_rep: must have levels AND entity.level
  const levels = scope.levels;
  if (!levels || !Array.isArray(levels) || levels.length === 0) return false;

  if (typeof entity.level !== "number" || !Number.isFinite(entity.level)) return false;

  return levels.includes(entity.level);
}