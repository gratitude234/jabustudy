export const EXAM_SPRINT_ONLY_ENV = "EXAM_SPRINT_ONLY_MODE";
export const EXAM_SPRINT_WEEKLY_PLAN_KEY = "plus_weekly";
export const EXAM_SPRINT_MONTHLY_PLAN_KEY = "plus_monthly";
/** @deprecated Prefer the explicit monthly key or isExamSprintBillingPlan(). */
export const EXAM_SPRINT_PLAN_KEY = EXAM_SPRINT_MONTHLY_PLAN_KEY;
export const EXAM_SPRINT_PLAN_KEYS = [
  EXAM_SPRINT_WEEKLY_PLAN_KEY,
  EXAM_SPRINT_MONTHLY_PLAN_KEY,
] as const;
export const EXAM_SPRINT_HOME = "/exam";

type Environment = Record<string, string | undefined>;

function matchesPath(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function isGoogleSiteVerificationPath(pathname: string) {
  return /^\/google[a-z0-9_-]+\.html$/i.test(pathname);
}

/**
 * Server-owned campaign switch. It intentionally defaults to off so a missing
 * deployment variable can never hide the main Study product by accident.
 */
export function isExamSprintOnlyMode(environment: Environment = process.env) {
  const value = environment[EXAM_SPRINT_ONLY_ENV]?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes" || value === "on";
}

/** Routes that still make sense while the public product is focused on exams. */
export function isExamOnlyPageAllowed(pathname: string) {
  if (pathname === "/") return true;
  if (isGoogleSiteVerificationPath(pathname)) return true;
  if (matchesPath(pathname, "/exam")) return true;
  if (pathname === "/login" || pathname === "/signup") return true;
  if (matchesPath(pathname, "/auth")) return true;
  if (pathname === "/offline" || pathname === "/support") return true;

  // Staff retain the tools required to publish and support Exam Sprint.
  if (matchesPath(pathname, "/study-admin")) return true;

  // Billing remains at its existing stable URL so active Paystack callbacks
  // and receipts continue to resolve. The proxy separately requires the Exam
  // Sprint offer on the billing landing page.
  if (pathname === "/study/billing") return true;
  if (matchesPath(pathname, "/study/billing/receipt")) return true;

  // Metadata and PWA runtime files handled by the App Router.
  return pathname === "/manifest.webmanifest"
    || pathname === "/robots.txt"
    || pathname === "/sitemap.xml";
}

/** API allowlist for Exam Sprint mode. Everything else receives a 423. */
export function isExamOnlyApiAllowed(pathname: string) {
  if (matchesPath(pathname, "/api/exam")) return true;
  if (matchesPath(pathname, "/api/billing")) return true;
  if (matchesPath(pathname, "/api/study-admin")) return true;
  if (matchesPath(pathname, "/api/cron")) return true;
  if (matchesPath(pathname, "/api/health")) return true;

  // Used solely by the protected Study Admin import screen. The route itself
  // also verifies a moderator bearer token.
  return pathname === "/api/ai/parse-mcq";
}

export function isExamOnlyBillingEntryAllowed(searchParams: URLSearchParams) {
  return searchParams.get("offer") === "exam-sprint";
}

export function isExamSprintBillingPlan(planKey: unknown) {
  return typeof planKey === "string"
    && (EXAM_SPRINT_PLAN_KEYS as readonly string[]).includes(planKey);
}

export function isBillingPlanAllowedInSystemMode(planKey: unknown, examOnlyMode: boolean) {
  return !examOnlyMode || isExamSprintBillingPlan(planKey);
}

function normalizeInternalDestination(value: string | null | undefined, fallback: string) {
  const candidate = (value ?? "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "https://jabustudy.invalid");
    if (parsed.origin !== "https://jabustudy.invalid") return fallback;
    const decodedPathname = decodeURIComponent(parsed.pathname);
    if (decodedPathname.includes("\\")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function isExamOnlyDestinationAllowed(destination: string) {
  try {
    const parsed = new URL(destination, "https://jabustudy.invalid");
    if (!isExamOnlyPageAllowed(parsed.pathname)) return false;
    if (parsed.pathname === "/study/billing") {
      return isExamOnlyBillingEntryAllowed(parsed.searchParams);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes auth return targets and collapses paused Study destinations to the
 * Exam Sprint home instead of making users experience a second redirect.
 */
export function sanitizeSystemDestination(
  value: string | null | undefined,
  options: { examOnlyMode: boolean; fallback: string }
) {
  const normalized = normalizeInternalDestination(value, options.fallback);
  if (options.examOnlyMode && !isExamOnlyDestinationAllowed(normalized)) {
    return EXAM_SPRINT_HOME;
  }
  return normalized;
}
