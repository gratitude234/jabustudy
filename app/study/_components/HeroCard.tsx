"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { trackHomeCta, type StudyHomeHeroState } from "@/lib/studyAnalytics";
import {
  getInProgressAttempts,
  getLatestAttempt,
  getPracticeStreak,
  type PracticeAttemptRow,
} from "@/lib/studyPractice";
import DayOneHero from "./DayOneHero";

type DueCourseRow = {
  study_quiz_questions:
    | Array<{ study_quiz_sets: Array<{ course_code: string | null }> | null }>
    | { study_quiz_sets: Array<{ course_code: string | null }> | null }
    | null;
};

function extractCourseCode(row: DueCourseRow) {
  const q = Array.isArray(row.study_quiz_questions)
    ? row.study_quiz_questions[0]
    : row.study_quiz_questions;
  const s = Array.isArray(q?.study_quiz_sets) ? q.study_quiz_sets[0] : q?.study_quiz_sets;
  return (s as any)?.course_code ?? null;
}

export function HeroCard({
  displayName,
  userId,
  loading,
  onHeroStateResolved,
}: {
  displayName: string | null;
  userId: string | null;
  loading: boolean;
  onHeroStateResolved?: (payload: {
    heroState: StudyHomeHeroState;
    dueCount: number;
    streak: number;
  }) => void;
}) {
  const [streak, setStreak] = useState(0);
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [dueCourses, setDueCourses] = useState<string[]>([]);
  const [continueAttempt, setContinueAttempt] = useState<PracticeAttemptRow | null>(null);
  const [hasPracticeHistory, setHasPracticeHistory] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState<number | null>(null);
  const [streakLoading, setStreakLoading] = useState(true);
  const [ctaResolved, setCtaResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getPracticeStreak().catch(() => null);
        if (!cancelled) setStreak(res?.streak ?? 0);
      } finally {
        if (!cancelled) setStreakLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!userId) {
      setDueCount(0);
      setDueCourses([]);
      setContinueAttempt(null);
      setHasPracticeHistory(false);
      setTotalAttempts(1);
      setCtaResolved(true);
      return;
    }

    let cancelled = false;
    setCtaResolved(false);

    (async () => {
      try {
        const now = new Date().toISOString();
        const [countRes, coursesRes, inProgress, latestAttempt, submittedRes] = await Promise.all([
          supabase
            .from("study_weak_questions")
            .select("user_id", { count: "exact", head: true })
            .eq("user_id", userId)
            .lte("next_due_at", now)
            .is("graduated_at", null),
          supabase
            .from("study_weak_questions")
            .select("study_quiz_questions(study_quiz_sets(course_code))")
            .eq("user_id", userId)
            .lte("next_due_at", now)
            .is("graduated_at", null)
            .limit(10),
          getInProgressAttempts(1).catch(() => []),
          getLatestAttempt().catch(() => null),
          supabase
            .from("study_practice_attempts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "submitted"),
        ]);

        if (cancelled) return;

        setDueCount(!countRes.error ? countRes.count ?? 0 : 0);

        if (!coursesRes.error && Array.isArray(coursesRes.data)) {
          const nextCourses = Array.from(
            new Set(
              (coursesRes.data as DueCourseRow[])
                .map(extractCourseCode)
                .map((code) => code?.trim())
                .filter((code): code is string => Boolean(code))
            )
          ).slice(0, 2);
          setDueCourses(nextCourses);
        } else {
          setDueCourses([]);
        }

        setContinueAttempt(inProgress[0] ?? null);
        setHasPracticeHistory(Boolean(latestAttempt));
        setTotalAttempts(!submittedRes.error ? submittedRes.count ?? 0 : 0);
      } catch {
        if (!cancelled) {
          setDueCount(0);
          setDueCourses([]);
          setContinueAttempt(null);
          setHasPracticeHistory(false);
          setTotalAttempts(0);
        }
      } finally {
        if (!cancelled) setCtaResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, userId]);

  useEffect(() => {
    if (!ctaResolved || streakLoading || dueCount === null || totalAttempts === null || totalAttempts === 0) {
      return;
    }
    const heroState: StudyHomeHeroState =
      dueCount > 0
        ? "due_cards"
        : continueAttempt
        ? "continue"
        : hasPracticeHistory
        ? "idle"
        : "new_user";

    onHeroStateResolved?.({
      heroState,
      dueCount,
      streak,
    });
  }, [
    ctaResolved,
    streakLoading,
    dueCount,
    totalAttempts,
    continueAttempt,
    hasPracticeHistory,
    onHeroStateResolved,
    streak,
  ]);

  const streakColor =
    streak >= 7 ? "text-orange-500" : streak >= 3 ? "text-amber-500" : "text-muted-foreground";

  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const greeting = displayName ? `${timeGreeting}, ${displayName}` : `${timeGreeting}`;
  const dueMinutes = dueCount && dueCount > 0 ? Math.ceil(dueCount * 0.4) : 0;
  const answeredCount = typeof continueAttempt?.score === "number" ? continueAttempt.score : 0;
  const totalCount = typeof continueAttempt?.total_questions === "number" ? continueAttempt.total_questions : 0;

  if (!ctaResolved || totalAttempts === null) {
    return (
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="p-5 pb-4">
          <div className="h-6 w-1/2 animate-pulse rounded bg-secondary/70" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-secondary/70" />
          <div className="mt-4 h-[72px] animate-pulse rounded-2xl bg-secondary/70" />
        </div>
      </div>
    );
  }

  if (totalAttempts === 0) {
    return <DayOneHero displayName={displayName} loading={loading} />;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-extrabold tracking-tight text-foreground">{greeting}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick up where you left off and keep your streak moving.
            </p>
          </div>

          <Link
            href="/study/history"
            onClick={() =>
              trackHomeCta("hero_streak_chip", {
                streak,
                position: 2,
              })
            }
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2 py-1 shadow-sm no-underline"
          >
            <Flame className={cn("h-3.5 w-3.5", streakLoading ? "text-muted-foreground" : streakColor)} />
            <span className="text-xs font-extrabold text-foreground">{streakLoading ? "0" : streak}</span>
          </Link>
        </div>
        {dueCount !== null && dueCount > 0 ? (
          <Link
            href="/study/practice?due=1"
            onClick={() =>
              trackHomeCta("hero_primary", {
                variant: "due",
                due_count: dueCount,
                continue_attempt_id: continueAttempt?.id ?? null,
                position: 1,
              })
            }
            className={cn(
              "mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 no-underline shadow-sm transition",
              "bg-[#5B35D5] text-white hover:bg-[#4526B8]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-extrabold">
                Review {dueCount} due card{dueCount === 1 ? "" : "s"} · ~{dueMinutes} min
              </p>
              {dueCourses.length > 0 ? (
                <p className="mt-1 truncate text-xs text-white/70">{dueCourses.join(", ")}</p>
              ) : null}
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white" />
          </Link>
        ) : continueAttempt ? (
          <Link
            href={`/study/practice/${encodeURIComponent(continueAttempt.set_id)}?attempt=${encodeURIComponent(continueAttempt.id)}`}
            onClick={() =>
              trackHomeCta("hero_primary", {
                variant: "continue",
                due_count: dueCount ?? 0,
                continue_attempt_id: continueAttempt.id,
                position: 1,
              })
            }
            className={cn(
              "mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 no-underline transition",
              "hover:bg-secondary/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-foreground">
                Continue {continueAttempt.study_quiz_sets?.title ?? "Practice set"}
                {totalCount > 0 ? ` · ${answeredCount}/${totalCount}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Resume your in-progress practice attempt.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ) : (
          <Link
            href="/study/practice"
            onClick={() =>
              trackHomeCta("hero_primary", {
                variant: "start",
                due_count: dueCount ?? 0,
                continue_attempt_id: null,
                position: 1,
              })
            }
            className={cn(
              "mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 no-underline transition",
              "hover:bg-secondary/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            <div>
              <p className="text-sm font-extrabold text-foreground">Start practicing</p>
              <p className="mt-1 text-xs text-muted-foreground">Warm up with a fresh study session.</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/study/practice"
            onClick={() =>
              trackHomeCta("hero_secondary", {
                variant: "fresh",
              })
            }
            className={cn(
              "inline-flex items-center justify-center rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground no-underline transition",
              "hover:bg-secondary/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            Fresh session
          </Link>
          <Link
            href="/study/history"
            onClick={() =>
              trackHomeCta("hero_secondary", {
                variant: "resume",
              })
            }
            className={cn(
              "inline-flex items-center justify-center rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground no-underline transition",
              "hover:bg-secondary/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            Resume
          </Link>
        </div>
      </div>
    </div>
  );
}
