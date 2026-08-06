export type StudyAdminMembershipRow = {
  user_id?: string | null;
} | null;

export type StudyRepMembershipRow = {
  user_id?: string | null;
  role?: string | null;
  department_id?: string | null;
  levels?: unknown;
  active?: boolean | null;
} | null;

function normalizedRepRole(value: unknown) {
  const role = typeof value === "string" ? value.trim() : "";
  if (role === "dept_librarian" || role === "librarian") return "dept_librarian";
  return "course_rep";
}

function hasConfiguredLevels(value: unknown) {
  if (!Array.isArray(value)) return false;
  return value.some((level) => {
    const parsed = typeof level === "number" ? level : Number(level);
    return Number.isFinite(parsed);
  });
}

/**
 * Mirrors the Study Admin authorization rules without granting access to a
 * malformed or inactive rep record. Super admins always retain access.
 */
export function hasStudyModeratorMembership(
  studyAdmin: StudyAdminMembershipRow,
  studyRep: StudyRepMembershipRow,
) {
  if (studyAdmin?.user_id) return true;
  if (!studyRep?.user_id || studyRep.active === false || !studyRep.department_id) return false;
  if (normalizedRepRole(studyRep.role) === "dept_librarian") return true;
  return hasConfiguredLevels(studyRep.levels);
}
