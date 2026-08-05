const DEFAULT_RETURN_PATH = "/study";
export const LEGACY_EXAM_RETURN_PREFIX = "/study/exam-return";

function isAllowedReturnPath(pathname: string) {
  return pathname === "/study"
    || pathname.startsWith("/study/")
    || pathname === "/exam"
    || pathname.startsWith("/exam/");
}

export function sanitizeBillingReturnPath(value: unknown) {
  if (typeof value !== "string") return DEFAULT_RETURN_PATH;
  const candidate = value.trim().slice(0, 500);
  if (!candidate.startsWith("/")) return DEFAULT_RETURN_PATH;
  if (candidate.startsWith("//") || candidate.includes("\\")) return DEFAULT_RETURN_PATH;

  try {
    const parsed = new URL(candidate, "https://jabustudy.invalid");
    if (parsed.origin !== "https://jabustudy.invalid") return DEFAULT_RETURN_PATH;
    if (decodeURIComponent(parsed.pathname).includes("\\")) return DEFAULT_RETURN_PATH;
    if (!isAllowedReturnPath(parsed.pathname)) return DEFAULT_RETURN_PATH;
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (parsed.pathname === "/study/billing" || parsed.pathname.startsWith("/study/billing/")) return DEFAULT_RETURN_PATH;
    return normalized;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}

/**
 * Temporary storage form accepted by databases that still have the pre-Exam
 * Sprint /study-only check constraint. Public callers should always receive
 * the canonical /exam path again through restoreBillingReturnPath().
 */
export function legacyCompatibleExamReturnPath(value: unknown) {
  const safePath = sanitizeBillingReturnPath(value);
  const parsed = new URL(safePath, "https://jabustudy.invalid");
  if (parsed.pathname !== "/exam" && !parsed.pathname.startsWith("/exam/")) {
    return safePath;
  }

  const suffix = parsed.pathname.slice("/exam".length);
  const compatible = `${LEGACY_EXAM_RETURN_PREFIX}${suffix}${parsed.search}${parsed.hash}`;
  return compatible.length <= 500 ? compatible : LEGACY_EXAM_RETURN_PREFIX;
}

export function restoreBillingReturnPath(value: unknown) {
  const safePath = sanitizeBillingReturnPath(value);
  const parsed = new URL(safePath, "https://jabustudy.invalid");
  const isLegacyExamPath = parsed.pathname === LEGACY_EXAM_RETURN_PREFIX
    || parsed.pathname.startsWith(`${LEGACY_EXAM_RETURN_PREFIX}/`);
  if (!isLegacyExamPath) return safePath;

  const suffix = parsed.pathname.slice(LEGACY_EXAM_RETURN_PREFIX.length);
  return sanitizeBillingReturnPath(`/exam${suffix}${parsed.search}${parsed.hash}`);
}
