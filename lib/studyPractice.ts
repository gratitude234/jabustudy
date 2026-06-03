// lib/studyPractice.ts
// Practice attempts + streak helpers (Phase 1.2)

import { supabase } from "@/lib/supabase";
import { getAuthedUserId } from "@/lib/studySaved";

const STREAK_LOOKBACK_DAYS = 400;
const WAT_OFFSET_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Returns today's date string (YYYY-MM-DD) in WAT (UTC+1) */
function watToday(): string {
  return watDateFromMs(Date.now());
}

function watDateFromMs(ms: number): string {
  return new Date(ms + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

function watDateFromIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return watDateFromMs(ms);
}

function calculateStreak(activeDates: Set<string>) {
  const todayKey = watToday();
  const didToday = activeDates.has(todayKey);

  let streak = 0;
  // Streak counts consecutive days through today, or through yesterday before today's practice.
  let cursorMs = didToday ? Date.now() : Date.now() - DAY_MS;

  for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
    const key = watDateFromMs(cursorMs);
    if (!activeDates.has(key)) break;
    streak += 1;
    cursorMs -= DAY_MS;
  }

  return { streak, didPracticeToday: didToday };
}

export type PracticeAttemptRow = {
  id: string;
  user_id: string;
  set_id: string;
  status: "in_progress" | "submitted" | "abandoned";
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_questions: number | null;
  scored_questions_count?: number | null;
  time_spent_seconds: number | null;
  study_quiz_sets: {
    title: string | null;
    course_code: string | null;
  } | null;
};

type DailyActivityStreakRow = {
  activity_date: string | null;
  attempts_count: number | null;
  questions_answered?: number | null;
};

type SubmittedAttemptStreakRow = {
  submitted_at: string | null;
};

type PracticeStreakResult = {
  streak: number;
  didPracticeToday: boolean;
};

async function getPracticeStreakFromApi(): Promise<PracticeStreakResult | null> {
  try {
    const res = await fetch("/api/study/practice/streak", { cache: "no-store" });
    const json = await res.json().catch(() => null) as
      | {
          ok?: boolean;
          streak?: unknown;
          didPracticeToday?: unknown;
        }
      | null;

    if (!res.ok || !json?.ok) return null;

    return {
      streak: Math.max(0, Math.trunc(Number(json.streak ?? 0))),
      didPracticeToday: json.didPracticeToday === true,
    };
  } catch {
    return null;
  }
}

export async function getLatestAttempt(): Promise<PracticeAttemptRow | null> {
  const userId = await getAuthedUserId();
  if (!userId) return null;

  // Prefer in-progress first, then most recent submitted.
  const { data, error } = await supabase
    .from("study_practice_attempts")
    .select("id,user_id,set_id,status,started_at,submitted_at,score,total_questions,scored_questions_count,time_spent_seconds,study_quiz_sets(title,course_code)")
    .eq("user_id", userId)
    .order("status", { ascending: true })
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) return null;
  const row = (data as any[])?.[0];
  if (!row?.id) return null;
  return row as PracticeAttemptRow;
}

export async function getInProgressAttempts(limit = 3): Promise<PracticeAttemptRow[]> {
  const userId = await getAuthedUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("study_practice_attempts")
    .select("id,user_id,set_id,status,started_at,submitted_at,score,total_questions,scored_questions_count,time_spent_seconds,study_quiz_sets(title,course_code)")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return [];
  return (data as any[]).filter((r) => r?.id) as PracticeAttemptRow[];
}

export async function upsertDailyPracticeActivity(points: number) {
  const userId = await getAuthedUserId();
  if (!userId) return;

  const activityDate = watToday(); // YYYY-MM-DD in WAT (UTC+1)

  const { data: existingActivity } = await supabase
    .from("study_daily_activity")
    .select("attempts_count,correct_answers")
    .eq("user_id", userId)
    .eq("activity_date", activityDate)
    .maybeSingle();

  const prevAttempts = (existingActivity as any)?.attempts_count ?? 0;
  const prevCorrect = (existingActivity as any)?.correct_answers ?? 0;

  // Try to upsert; ignore errors if table isn't created yet.
  await supabase
    .from("study_daily_activity")
    .upsert(
      {
        user_id: userId,
        activity_date: activityDate,
        attempts_count: prevAttempts + 1,
        correct_answers: prevCorrect + points,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id,activity_date" }
    );
}

/**
 * Returns the set of YYYY-MM-DD date strings on which the user practiced,
 * for the last `days` calendar days (default 14).
 */
export async function get14DayActivity(days = 14): Promise<Set<string>> {
  const userId = await getAuthedUserId();
  if (!userId) return new Set();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("study_daily_activity")
    .select("activity_date,attempts_count")
    .eq("user_id", userId)
    .gte("activity_date", sinceDate)
    .order("activity_date", { ascending: false });

  if (error || !Array.isArray(data)) return new Set();

  const active = new Set<string>();
  for (const r of data as any[]) {
    if (r?.activity_date && Number(r?.attempts_count ?? 0) > 0) {
      active.add(String(r.activity_date));
    }
  }
  return active;
}

export async function getPracticeStreak(): Promise<PracticeStreakResult> {
  const apiResult = await getPracticeStreakFromApi();
  if (apiResult) return apiResult;

  const userId = await getAuthedUserId();
  if (!userId) return { streak: 0, didPracticeToday: false };

  // Fetch enough days to cover long streak milestones without truncating.
  const since = new Date(Date.now() + WAT_OFFSET_MS - STREAK_LOOKBACK_DAYS * DAY_MS);
  const sinceDate = since.toISOString().slice(0, 10);

  const activeDates = new Set<string>();

  const [activityRes, attemptsRes] = await Promise.all([
    supabase
      .from("study_daily_activity")
      .select("activity_date,attempts_count,questions_answered")
      .eq("user_id", userId)
      .gte("activity_date", sinceDate)
      .order("activity_date", { ascending: false }),
    supabase
      .from("study_practice_attempts")
      .select("submitted_at")
      .eq("user_id", userId)
      .eq("status", "submitted")
      .gte("submitted_at", new Date(Date.now() - (STREAK_LOOKBACK_DAYS + 1) * DAY_MS).toISOString())
      .order("submitted_at", { ascending: false }),
  ]);

  if (!activityRes.error && Array.isArray(activityRes.data)) {
    for (const row of activityRes.data as DailyActivityStreakRow[]) {
      const key = row?.activity_date ? String(row.activity_date).slice(0, 10) : "";
      const hadActivity =
        Number(row?.attempts_count ?? 0) > 0 ||
        Number(row?.questions_answered ?? 0) > 0;
      if (key && hadActivity) activeDates.add(key);
    }
  }

  if (!attemptsRes.error && Array.isArray(attemptsRes.data)) {
    for (const row of attemptsRes.data as SubmittedAttemptStreakRow[]) {
      const key = watDateFromIso(row?.submitted_at);
      if (key) activeDates.add(key);
    }
  }

  return calculateStreak(activeDates);
}
