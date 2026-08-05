import { normalizeExamCourseCode } from "./config";

type CourseIdentity = {
  code: string;
  slug: string;
  sets?: readonly unknown[];
  activeAttempt?: unknown | null;
  progress?: unknown | null;
};

function courseIdentity(course: CourseIdentity) {
  return normalizeExamCourseCode(course.code) || course.slug.trim().toLowerCase();
}

function courseCompleteness(course: CourseIdentity) {
  return (course.activeAttempt ? 10_000 : 0)
    + ((course.sets?.length ?? 0) * 100)
    + (course.progress ? 1 : 0);
}

/**
 * Protects the catalogue against repeated course configuration or differently
 * formatted course codes while retaining the row with the richest user state.
 */
export function dedupeExamCourses<T extends CourseIdentity>(courses: readonly T[]) {
  const unique = new Map<string, T>();

  for (const course of courses) {
    const identity = courseIdentity(course);
    if (!identity) continue;
    const existing = unique.get(identity);
    if (!existing || courseCompleteness(course) > courseCompleteness(existing)) {
      unique.set(identity, course);
    }
  }

  return Array.from(unique.values());
}
