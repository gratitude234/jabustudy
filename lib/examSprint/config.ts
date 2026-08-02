export const EXAM_CAMPAIGN_KEY = "supplementary-2026";
export const EXAM_SPRINT_NAME = "Exam Sprint";
export const EXAM_SPRINT_PRICE_NAIRA = 1_300;
export const EXAM_BANK_MINIMUM = 60;
export const EXAM_MOCK_QUESTION_COUNT = 40;
export const EXAM_MOCK_DURATION_MINUTES = 40;
export const EXAM_DIAGNOSTIC_QUESTION_COUNT = 10;
export const EXAM_DIAGNOSTIC_DURATION_MINUTES = 10;

export type ExamCourse = {
  code: string;
  slug: string;
  title: string;
  examAt: string;
  priority: boolean;
};

export const EXAM_COURSES: readonly ExamCourse[] = [
  { code: "GNS 121", slug: "gns-121", title: "Communication in English II", examAt: "2026-08-17T12:00:00+01:00", priority: true },
  { code: "GNS 123", slug: "gns-123", title: "Nigeria People and Culture", examAt: "2026-08-17T12:00:00+01:00", priority: true },
  { code: "GNS 124", slug: "gns-124", title: "Communication in French", examAt: "2026-08-17T12:00:00+01:00", priority: false },
  { code: "GNS 125", slug: "gns-125", title: "Fresher Induction Seminar", examAt: "2026-08-17T12:00:00+01:00", priority: false },
  { code: "GNS 126", slug: "gns-126", title: "Contemporary Health Issue", examAt: "2026-08-17T12:00:00+01:00", priority: true },
  { code: "GNS 221", slug: "gns-221", title: "Introduction to Entrepreneurial Skills II", examAt: "2026-08-18T12:00:00+01:00", priority: false },
  { code: "GNS 222", slug: "gns-222", title: "Peace Studies and Conflict Resolution", examAt: "2026-08-18T12:00:00+01:00", priority: false },
  { code: "GNS 223", slug: "gns-223", title: "General Introduction to the Bible", examAt: "2026-08-18T12:00:00+01:00", priority: false },
  { code: "PHY 122", slug: "phy-122", title: "Physics 122", examAt: "2026-08-18T12:00:00+01:00", priority: false },
  { code: "BIO 121", slug: "bio-121", title: "Biology 121", examAt: "2026-08-18T12:00:00+01:00", priority: false },
  { code: "GNS 321", slug: "gns-321", title: "CAC and Apostle Joseph Ayo Babalola", examAt: "2026-08-19T12:00:00+01:00", priority: false },
] as const;

export function normalizeExamCourseCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function findExamCourse(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  const normalized = normalizeExamCourseCode(value);
  return EXAM_COURSES.find(
    (course) => course.slug === raw || normalizeExamCourseCode(course.code) === normalized,
  ) ?? null;
}

export function examCourseIsClosed(course: ExamCourse, now = Date.now()) {
  return now >= new Date(course.examAt).getTime();
}

export function examCourseDateLabel(course: ExamCourse) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(course.examAt));
}
