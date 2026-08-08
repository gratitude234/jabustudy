export const EXAM_CAMPAIGN_KEY = "supplementary-2026";
export const EXAM_SPRINT_NAME = "Exam Sprint";
export const EXAM_SPRINT_WEEKLY_PRICE_NAIRA = 400;
export const EXAM_SPRINT_REGULAR_PRICE_NAIRA = 1_500;
export const EXAM_SPRINT_PROMO_PRICE_NAIRA = 1_000;
export const EXAM_SPRINT_WEEKLY_DAYS = 7;
export const EXAM_SPRINT_MONTHLY_DAYS = 30;
export const EXAM_SPRINT_PROMO_START_AT = "2026-08-06T00:00:00+01:00";
export const EXAM_SPRINT_PROMO_END_AT = "2026-08-13T23:59:59+01:00";
export const EXAM_BANK_MINIMUM = 60;
export const EXAM_MOCK_QUESTION_COUNT = 40;
export const EXAM_MOCK_DURATION_MINUTES = 40;
export const EXAM_DIAGNOSTIC_QUESTION_COUNT = 10;
export const EXAM_DIAGNOSTIC_DURATION_MINUTES = 10;
export const EXAM_DIAGNOSTIC_PREVIEW_POOL_SIZE = 30;
export const EXAM_DIAGNOSTIC_COOLDOWN_HOURS = 5;

export type ExamCourse = {
  code: string;
  slug: string;
  title: string;
  examAt: string | null;
  priority: boolean;
  /**
   * Safety override for a course whose currently attached bank must not be used.
   * Remove this once verified source material has been used to build the real bank.
   */
  bankStateOverride?: "needs_material";
};

export type ExamSprintPricing = {
  currentPriceNaira: number;
  regularPriceNaira: number;
  weeklyPriceNaira: number;
  promoPriceNaira: number;
  weeklyDays: number;
  monthlyDays: number;
  weeklyAvailable: boolean;
  promoStartsAt: string;
  promoEndsAt: string;
  isPromo: boolean;
};

/**
 * One source of truth for the Exam Sprint promotional price. The timestamps include
 * the WAT offset so the offer switches without relying on the server timezone.
 */
export function getExamSprintPricing(at: Date = new Date()): ExamSprintPricing {
  const now = at.getTime();
  const promoStart = new Date(EXAM_SPRINT_PROMO_START_AT).getTime();
  const promoEnd = new Date(EXAM_SPRINT_PROMO_END_AT).getTime();
  const isPromo = Number.isFinite(now) && now >= promoStart && now <= promoEnd;

  return {
    currentPriceNaira: isPromo ? EXAM_SPRINT_PROMO_PRICE_NAIRA : EXAM_SPRINT_REGULAR_PRICE_NAIRA,
    regularPriceNaira: EXAM_SPRINT_REGULAR_PRICE_NAIRA,
    weeklyPriceNaira: EXAM_SPRINT_WEEKLY_PRICE_NAIRA,
    promoPriceNaira: EXAM_SPRINT_PROMO_PRICE_NAIRA,
    weeklyDays: EXAM_SPRINT_WEEKLY_DAYS,
    monthlyDays: EXAM_SPRINT_MONTHLY_DAYS,
    // Keep the live 30-day promo simple. The weekly option becomes a normal
    // post-promo choice rather than competing with a better temporary offer.
    weeklyAvailable: !isPromo,
    promoStartsAt: EXAM_SPRINT_PROMO_START_AT,
    promoEndsAt: EXAM_SPRINT_PROMO_END_AT,
    isPromo,
  };
}

export const EXAM_COURSES: readonly ExamCourse[] = [
  { code: "GNS 121", slug: "gns-121", title: "Communication in English II", examAt: "2026-08-17T12:00:00+01:00", priority: true, bankStateOverride: "needs_material" },
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
  { code: "BIO 101", slug: "bio-101", title: "Biology 101", examAt: null, priority: false },
  { code: "BIO 107", slug: "bio-107", title: "Biology 107", examAt: null, priority: false },
  { code: "CHM 101", slug: "chm-101", title: "Chemistry 101", examAt: "2026-08-13T08:00:00+01:00", priority: false },
  { code: "CHM 107", slug: "chm-107", title: "Chemistry 107", examAt: null, priority: false },
  { code: "PHY 101", slug: "phy-101", title: "Physics 101", examAt: null, priority: false },
  { code: "PHY 107", slug: "phy-107", title: "Physics 107", examAt: null, priority: false },
  { code: "MTH 101", slug: "mth-101", title: "Mathematics 101", examAt: null, priority: false },
  { code: "COS 101", slug: "cos-101", title: "Computer Science 101", examAt: "2026-08-10T11:30:00+01:00", priority: false },
  { code: "GNS 111", slug: "gns-111", title: "Communication in English", examAt: null, priority: false },
  { code: "GNS 112", slug: "gns-112", title: "Fundamentals of Computing I", examAt: null, priority: false },
  { code: "GNS 113", slug: "gns-113", title: "Use of Library", examAt: null, priority: false },
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

export function examCourseBankNeedsMaterial(course: ExamCourse | null | undefined) {
  return course?.bankStateOverride === "needs_material";
}

export function examCourseDateLabel(course: ExamCourse) {
  if (!course.examAt) return "Exam date to be announced";
  const date = new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(course.examAt));
  return `${date} WAT`;
}
