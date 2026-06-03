import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STREAK_LOOKBACK_DAYS = 400;
const WAT_OFFSET_MS = 3_600_000;
const DAY_MS = 86_400_000;

type DailyActivityRow = {
  activity_date: string | null;
  attempts_count: number | null;
  questions_answered: number | null;
};

type AttemptRow = {
  id: string;
  submitted_at: string | null;
};

type AnswerRow = {
  answered_at: string | null;
};

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
  const todayKey = watDateFromMs(Date.now());
  const didPracticeToday = activeDates.has(todayKey);
  let cursorMs = didPracticeToday ? Date.now() : Date.now() - DAY_MS;
  let streak = 0;

  for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
    const key = watDateFromMs(cursorMs);
    if (!activeDates.has(key)) break;
    streak += 1;
    cursorMs -= DAY_MS;
  }

  return { streak, didPracticeToday };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Sign in first." },
      { status: 401 }
    );
  }

  const admin = createSupabaseAdminClient();
  const sinceMs = Date.now() - (STREAK_LOOKBACK_DAYS + 1) * DAY_MS;
  const sinceIso = new Date(sinceMs).toISOString();
  const sinceDate = watDateFromMs(sinceMs);
  const activeDates = new Set<string>();

  const [activityRes, attemptsRes] = await Promise.all([
    admin
      .from("study_daily_activity")
      .select("activity_date,attempts_count,questions_answered")
      .eq("user_id", user.id)
      .gte("activity_date", sinceDate)
      .order("activity_date", { ascending: false }),
    admin
      .from("study_practice_attempts")
      .select("id,submitted_at")
      .eq("user_id", user.id)
      .or(`updated_at.gte.${sinceIso},submitted_at.gte.${sinceIso}`)
      .order("updated_at", { ascending: false }),
  ]);

  if (!activityRes.error && Array.isArray(activityRes.data)) {
    for (const row of activityRes.data as DailyActivityRow[]) {
      const key = row.activity_date ? String(row.activity_date).slice(0, 10) : "";
      const hasActivity =
        Number(row.attempts_count ?? 0) > 0 ||
        Number(row.questions_answered ?? 0) > 0;
      if (key && hasActivity) activeDates.add(key);
    }
  }

  const attempts = !attemptsRes.error && Array.isArray(attemptsRes.data)
    ? attemptsRes.data as AttemptRow[]
    : [];

  for (const attempt of attempts) {
    const key = watDateFromIso(attempt.submitted_at);
    if (key) activeDates.add(key);
  }

  const attemptIds = attempts.map((attempt) => attempt.id).filter(Boolean);
  for (let i = 0; i < attemptIds.length; i += 200) {
    const chunk = attemptIds.slice(i, i + 200);
    if (chunk.length === 0) continue;

    const { data, error } = await admin
      .from("study_attempt_answers")
      .select("answered_at")
      .in("attempt_id", chunk)
      .gte("answered_at", sinceIso)
      .order("answered_at", { ascending: false });

    if (error || !Array.isArray(data)) continue;

    for (const row of data as AnswerRow[]) {
      const key = watDateFromIso(row.answered_at);
      if (key) activeDates.add(key);
    }
  }

  return NextResponse.json({ ok: true, ...calculateStreak(activeDates) });
}
