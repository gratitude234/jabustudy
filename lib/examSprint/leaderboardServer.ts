import "server-only";
import { adminSupabase } from "@/lib/supabase/admin";
import { EXAM_CAMPAIGN_KEY, EXAM_MOCK_QUESTION_COUNT } from "./config";
import {
  EXAM_LEADERBOARD_ATTEMPT_LIMIT,
  EXAM_LEADERBOARD_TOP_LIMIT,
  examLeaderboardAlias,
  examLeaderboardWeekBounds,
  examLeaderboardWeekLabel,
} from "./leaderboard";

type LeaderboardRpcRow = {
  user_id?: unknown;
  position?: unknown;
  best_percentage?: unknown;
  coverage?: unknown;
  qualifying_attempts?: unknown;
  participant_count?: unknown;
};

export type ExamWeeklyLeaderboardEntry = {
  rank: number;
  label: string;
  bestPercentage: number;
  coverage: number;
  qualifyingAttempts: number;
  isCurrentUser: boolean;
};

export type ExamWeeklyLeaderboard = {
  available: boolean;
  weekLabel: string;
  weekStart: string;
  weekEndExclusive: string;
  participantCount: number;
  topEntries: ExamWeeklyLeaderboardEntry[];
  currentEntry: ExamWeeklyLeaderboardEntry | null;
};

function toNonNegativeInteger(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function rpcIsNotInstalled(error: { code?: string | null; message?: string | null }) {
  const code = String(error.code ?? "");
  const message = String(error.message ?? "").toLowerCase();
  return code === "PGRST202"
    || code === "42883"
    || (message.includes("get_exam_sprint_weekly_leaderboard")
      && (message.includes("could not find") || message.includes("does not exist")));
}

export async function getExamWeeklyLeaderboard({
  setIds,
  userId,
  now = new Date(),
}: {
  setIds: string[];
  userId?: string | null;
  now?: Date;
}): Promise<ExamWeeklyLeaderboard> {
  const { start, endExclusive } = examLeaderboardWeekBounds(now);
  const base = {
    weekLabel: examLeaderboardWeekLabel(start, endExclusive),
    weekStart: start.toISOString(),
    weekEndExclusive: endExclusive.toISOString(),
  };

  if (setIds.length === 0) {
    return {
      available: true,
      ...base,
      participantCount: 0,
      topEntries: [],
      currentEntry: null,
    };
  }

  const { data, error } = await adminSupabase.rpc("get_exam_sprint_weekly_leaderboard", {
    p_campaign_key: EXAM_CAMPAIGN_KEY,
    p_set_ids: setIds,
    p_week_start: start.toISOString(),
    p_week_end: endExclusive.toISOString(),
    p_user_id: userId ?? null,
    p_attempt_limit: EXAM_LEADERBOARD_ATTEMPT_LIMIT,
    p_question_count: EXAM_MOCK_QUESTION_COUNT,
  });

  if (error) {
    if (!rpcIsNotInstalled(error)) {
      console.error("[Exam Sprint leaderboard] Unable to load standings:", error.message);
    }
    // The leaderboard is intentionally non-critical: a schema rollout or a
    // transient ranking failure must never block the course/CBT workflow.
    return {
      available: false,
      ...base,
      participantCount: 0,
      topEntries: [],
      currentEntry: null,
    };
  }

  const rows = (Array.isArray(data) ? data : []) as LeaderboardRpcRow[];
  const entries = rows.flatMap((row): ExamWeeklyLeaderboardEntry[] => {
    const rowUserId = typeof row.user_id === "string" ? row.user_id : "";
    const rank = toNonNegativeInteger(row.position);
    if (!rowUserId || rank < 1) return [];
    const isCurrentUser = Boolean(userId && rowUserId === userId);
    return [{
      rank,
      label: isCurrentUser ? "You" : examLeaderboardAlias(rowUserId),
      bestPercentage: Math.min(100, toNonNegativeInteger(row.best_percentage)),
      coverage: toNonNegativeInteger(row.coverage),
      qualifyingAttempts: toNonNegativeInteger(row.qualifying_attempts),
      isCurrentUser,
    }];
  });
  const participantCount = rows.length > 0
    ? toNonNegativeInteger(rows[0].participant_count)
    : 0;

  return {
    available: true,
    ...base,
    participantCount,
    topEntries: entries.filter((entry) => entry.rank <= EXAM_LEADERBOARD_TOP_LIMIT),
    currentEntry: entries.find((entry) => entry.isCurrentUser) ?? null,
  };
}
