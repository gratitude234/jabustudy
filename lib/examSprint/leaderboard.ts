export const EXAM_LEADERBOARD_TOP_LIMIT = 10;
export const EXAM_LEADERBOARD_ATTEMPT_LIMIT = 3;

const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type ExamLeaderboardWeekBounds = {
  start: Date;
  endExclusive: Date;
};

/**
 * Returns Monday 00:00 WAT -> next Monday 00:00 WAT for the week containing now.
 * WAT is UTC+1 year-round, so this deliberately avoids host/server timezone state.
 */
export function examLeaderboardWeekBounds(now = new Date()): ExamLeaderboardWeekBounds {
  const watNow = new Date(now.getTime() + WAT_OFFSET_MS);
  const daysSinceMonday = (watNow.getUTCDay() + 6) % 7;
  const watMondayMidnight = Date.UTC(
    watNow.getUTCFullYear(),
    watNow.getUTCMonth(),
    watNow.getUTCDate() - daysSinceMonday,
  );
  const startMs = watMondayMidnight - WAT_OFFSET_MS;
  return {
    start: new Date(startMs),
    endExclusive: new Date(startMs + WEEK_MS),
  };
}

export function examLeaderboardWeekLabel(start: Date, endExclusive: Date) {
  const endInclusive = new Date(endExclusive.getTime() - 1);
  const dayFormatter = new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    timeZone: "Africa/Lagos",
  });
  const monthFormatter = new Intl.DateTimeFormat("en-NG", {
    month: "short",
    timeZone: "Africa/Lagos",
  });
  const startDay = dayFormatter.format(start);
  const endDay = dayFormatter.format(endInclusive);
  const startMonth = monthFormatter.format(start);
  const endMonth = monthFormatter.format(endInclusive);
  return startMonth === endMonth
    ? `${startDay}\u2013${endDay} ${endMonth}`
    : `${startDay} ${startMonth}\u2013${endDay} ${endMonth}`;
}

/** Stable, non-identifying public label. Raw auth IDs never need to reach the UI. */
export function examLeaderboardAlias(userId: string) {
  let hash = 2166136261;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const token = (hash >>> 0).toString(36).toUpperCase().padStart(4, "0").slice(-4);
  return `Student ${token}`;
}
