// lib/studyPractice.ts
// Practice attempts + streak helpers (Phase 1.2)

import { supabase } from "@/lib/supabase";
import { getAuthedUserId } from "@/lib/studySaved";

/** Returns today's date string (YYYY-MM-DD) in WAT (UTC+1) */
function watToday(): string {
  return new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
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
  time_spent_seconds: number | null;
  study_quiz_sets: {
    title: string | null;
    course_code: string | null;
  } | null;
};

export async function getLatestAttempt(): Promise<PracticeAttemptRow | null> {
  const userId = await getAuthedUserId();
  if (!userId) return null;

  // Prefer in-progress first, then most recent submitted.
  const { data, error } = await supabase
    .from("study_practice_attempts")
    .select("id,user_id,set_id,status,started_at,submitted_at,score,total_questions,time_spent_seconds,study_quiz_sets(title,course_code)")
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
    .select("id,user_id,set_id,status,started_at,submitted_at,score,total_questions,time_spent_seconds,study_quiz_sets(title,course_code)")
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

  // Try to upsert; ignore errors if table isn't created yet.
  await supabase
    .from("study_daily_activity")
    .upsert(
      {
        user_id: userId,
        activity_date: activityDate,
        did_practice: true,
        points: points,
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
    .select("activity_date,did_practice")
    .eq("user_id", userId)
    .gte("activity_date", sinceDate)
    .order("activity_date", { ascending: false });

  if (error || !Array.isArray(data)) return new Set();

  const active = new Set<string>();
  for (const r of data as any[]) {
    if (r?.activity_date && r?.did_practice === true) {
      active.add(String(r.activity_date));
    }
  }
  return active;
}

export async function getPracticeStreak(): Promise<{ streak: number; didPracticeToday: boolean }> {
  const userId = await getAuthedUserId();
  if (!userId) return { streak: 0, didPracticeToday: false };

  // Fetch enough days to cover the longest realistic streak without truncating.
  const STREAK_LOOKBACK_DAYS = 90;
  const since = new Date(Date.now() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("study_daily_activity")
    .select("activity_date,did_practice")
    .eq("user_id", userId)
    .gte("activity_date", sinceDate)
    .order("activity_date", { ascending: false });

  if (error || !Array.isArray(data)) return { streak: 0, didPracticeToday: false };

  const map = new Map<string, boolean>();
  for (const r of data as any[]) {
    if (r?.activity_date) map.set(String(r.activity_date), Boolean(r.did_practice));
  }

  const todayKey     = watToday();
  const yesterdayKey = new Date(Date.now() + 3_600_000 - 86_400_000).toISOString().slice(0, 10);
  const didToday = map.get(todayKey) === true;

  let streak = 0;
  // streak counts consecutive days up to today (or yesterday if not practiced today)
  let cursorMs = didToday
    ? Date.now() + 3_600_000
    : Date.now() + 3_600_000 - 86_400_000;
  void yesterdayKey; // used above for clarity

  for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
    const k = new Date(cursorMs).toISOString().slice(0, 10);
    if (map.get(k) === true) {
      streak += 1;
      cursorMs -= 86_400_000;
    } else {
      break;
    }
  }

  return { streak, didPracticeToday: didToday };
}