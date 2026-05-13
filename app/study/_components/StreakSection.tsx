"use client";

import { useEffect, useState } from "react";
import StreakCard, { type PracticeAttemptRow } from "./StreakCard";
import { getLatestAttempt, getPracticeStreak } from "@/lib/studyPractice";
import { supabase } from "@/lib/supabase";

export function StreakSection() {
  const [streak, setStreak] = useState<{
    streak: number;
    didPracticeToday: boolean;
  } | null>(null);
  const [lastAttempt, setLastAttempt] = useState<PracticeAttemptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [streakRes, attemptRes] = await Promise.all([
        getPracticeStreak().catch(() => null),
        getLatestAttempt().catch(() => null),
      ]);

      if (cancelled) return;
      setStreak(streakRes);
      setLastAttempt(attemptRes);
      setLoading(false);

      // Fetch 28-day activity for dot grid
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const since = new Date(Date.now() + 3_600_000 - 28 * 86_400_000).toISOString().slice(0, 10);
        const { data } = await supabase
          .from("study_daily_activity")
          .select("activity_date,did_practice")
          .eq("user_id", user.id)
          .gte("activity_date", since);
        if (!cancelled && data) {
          const s = new Set<string>();
          for (const r of data as { activity_date: string; did_practice: boolean }[]) {
            if (r?.did_practice === true && r?.activity_date) s.add(String(r.activity_date));
          }
          setActiveDays(s);
        }
      } catch {
        // silent
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <StreakCard
      streak={streak?.streak ?? 0}
      lastAttempt={lastAttempt}
      loading={loading}
      activeDays={activeDays}
    />
  );
}