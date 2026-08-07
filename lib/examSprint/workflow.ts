export type TimedExamAttemptCandidate = {
  id: string;
  status: string;
  deadline_at: string;
  started_at?: string | null;
};

export const EXAM_MISTAKE_GRACE_MS = 60_000;

/**
 * A genuine accidental start gets a short, server-verifiable escape hatch.
 * This only models the clock; the server additionally requires zero persisted
 * interactions and limits the grace cancellation to once per WAT day.
 */
export function examMistakeGraceEndsAt(startedAt: string) {
  const startedMs = new Date(startedAt).getTime();
  return Number.isFinite(startedMs) ? startedMs + EXAM_MISTAKE_GRACE_MS : 0;
}

export function examMistakeGraceIsOpen(startedAt: string, now = Date.now()) {
  const endsAt = examMistakeGraceEndsAt(startedAt);
  return endsAt > 0 && now < endsAt;
}

/**
 * Splits persisted attempt rows into expired and genuinely live attempts.
 * Live attempts are ordered by urgency so every screen and API sends the
 * learner back to the timer that will finish first.
 */
export function partitionTimedExamAttempts<T extends TimedExamAttemptCandidate>(
  attempts: readonly T[],
  now = Date.now(),
) {
  const active: T[] = [];
  const expired: T[] = [];

  for (const attempt of attempts) {
    if (attempt.status !== "in_progress") continue;
    const deadline = new Date(attempt.deadline_at).getTime();
    if (!Number.isFinite(deadline) || deadline <= now) expired.push(attempt);
    else active.push(attempt);
  }

  active.sort((left, right) => {
    const deadlineDifference = new Date(left.deadline_at).getTime() - new Date(right.deadline_at).getTime();
    if (deadlineDifference !== 0) return deadlineDifference;
    const leftStarted = new Date(left.started_at ?? 0).getTime() || 0;
    const rightStarted = new Date(right.started_at ?? 0).getTime() || 0;
    return leftStarted - rightStarted || left.id.localeCompare(right.id);
  });

  return {
    primary: active[0] ?? null,
    active,
    expired,
  };
}

export type ExamTabLease = {
  tabId: string;
  expiresAt: number;
};

export function parseExamTabLease(value: string | null): ExamTabLease | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ExamTabLease>;
    if (typeof parsed.tabId !== "string" || !parsed.tabId || !Number.isFinite(parsed.expiresAt)) return null;
    return { tabId: parsed.tabId, expiresAt: Number(parsed.expiresAt) };
  } catch {
    return null;
  }
}

export function examTabLeaseBelongsToAnotherTab(
  value: string | null,
  tabId: string,
  now = Date.now(),
) {
  const lease = parseExamTabLease(value);
  return Boolean(lease && lease.tabId !== tabId && lease.expiresAt > now);
}
