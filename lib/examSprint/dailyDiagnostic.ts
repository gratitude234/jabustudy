import {
  EXAM_DIAGNOSTIC_COOLDOWN_HOURS,
  EXAM_DIAGNOSTIC_PREVIEW_POOL_SIZE,
} from "./config";

const WAT_OFFSET_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
export const EXAM_DIAGNOSTIC_COOLDOWN_MS = EXAM_DIAGNOSTIC_COOLDOWN_HOURS * 60 * 60 * 1_000;

export type ExamDiagnosticDayWindow = {
  key: string;
  startIso: string;
  endIso: string;
};

/**
 * WAT-day helper retained for policies that are intentionally calendar-day
 * based (for example, the once-per-day accidental-start grace). Diagnostic
 * availability itself uses the rolling cooldown helpers below.
 */
export function examDiagnosticDayWindow(at: Date = new Date()): ExamDiagnosticDayWindow {
  const now = at.getTime();
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const wat = new Date(safeNow + WAT_OFFSET_MS);
  const key = wat.toISOString().slice(0, 10);
  const startMs = Date.parse(`${key}T00:00:00+01:00`);

  return {
    key,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + DAY_MS).toISOString(),
  };
}

export function examAttemptStartedInDiagnosticDay(
  startedAt: unknown,
  window: ExamDiagnosticDayWindow,
) {
  if (typeof startedAt !== "string" || !startedAt) return false;
  const timestamp = new Date(startedAt).getTime();
  return Number.isFinite(timestamp)
    && timestamp >= new Date(window.startIso).getTime()
    && timestamp < new Date(window.endIso).getTime();
}

export function examDiagnosticCooldownEndsAt(startedAt: unknown) {
  if (typeof startedAt !== "string" || !startedAt) return 0;
  const startedAtMs = new Date(startedAt).getTime();
  return Number.isFinite(startedAtMs) ? startedAtMs + EXAM_DIAGNOSTIC_COOLDOWN_MS : 0;
}

export function examDiagnosticCooldownIsActive(startedAt: unknown, at: Date = new Date()) {
  const cooldownEndsAt = examDiagnosticCooldownEndsAt(startedAt);
  const now = at.getTime();
  return Number.isFinite(now) && cooldownEndsAt > now;
}

function stableQuestionHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/**
 * Free diagnostics intentionally draw from a stable subset of each reviewed
 * bank. This keeps repeat free checks useful without slowly exposing the
 * complete paid question bank.
 */
export function buildExamDiagnosticPreviewPool<T extends { id: string }>(
  candidates: readonly T[],
  poolSize = EXAM_DIAGNOSTIC_PREVIEW_POOL_SIZE,
) {
  const size = Math.max(0, Math.min(Math.floor(poolSize), candidates.length));
  return [...candidates]
    .sort((left, right) => stableQuestionHash(left.id) - stableQuestionHash(right.id)
      || left.id.localeCompare(right.id))
    .slice(0, size);
}
