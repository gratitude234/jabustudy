import { sanitizeBillingReturnPath } from "../billingReturnPath";

const DAY_MS = 86_400_000;

export type ExamCheckoutContext = {
  diagnosticScore: number | null;
  focusTopic: string | null;
};

export function normalizeExamDiagnosticScore(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  return Math.round(score);
}

export function normalizeExamFocusTopic(value: unknown) {
  if (typeof value !== "string") return null;
  const topic = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return topic || null;
}

export function readExamCheckoutContext(params: Pick<URLSearchParams, "get">): ExamCheckoutContext {
  return {
    diagnosticScore: normalizeExamDiagnosticScore(params.get("diagnosticScore")),
    focusTopic: normalizeExamFocusTopic(params.get("focus")),
  };
}

export function buildExamSprintBillingHref(args: {
  returnTo: unknown;
  diagnosticScore?: unknown;
  focusTopic?: unknown;
}) {
  const params = new URLSearchParams({
    offer: "exam-sprint",
    returnTo: sanitizeBillingReturnPath(args.returnTo),
  });
  const diagnosticScore = normalizeExamDiagnosticScore(args.diagnosticScore);
  const focusTopic = normalizeExamFocusTopic(args.focusTopic);
  if (diagnosticScore !== null) params.set("diagnosticScore", String(diagnosticScore));
  if (focusTopic) params.set("focus", focusTopic);
  return `/study/billing?${params.toString()}`;
}

export function projectedExamAccessUntil(args: {
  activeUntil?: string | null;
  days?: number | null;
  nowMs?: number;
}) {
  const nowMs = Number.isFinite(args.nowMs) ? Number(args.nowMs) : Date.now();
  const activeUntilMs = args.activeUntil ? new Date(args.activeUntil).getTime() : 0;
  const baseMs = Number.isFinite(activeUntilMs) && activeUntilMs > nowMs ? activeUntilMs : nowMs;
  const days = Number.isFinite(args.days) && Number(args.days) > 0 ? Math.round(Number(args.days)) : 30;
  return new Date(baseMs + days * DAY_MS).toISOString();
}

export function examDailyEquivalent(amountNaira: number, days: number | null | undefined) {
  const safeDays = Number.isFinite(days) && Number(days) > 0 ? Number(days) : 30;
  return Math.max(1, Math.round(amountNaira / safeDays));
}
