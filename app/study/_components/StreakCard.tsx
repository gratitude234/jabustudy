"use client";

import { AlertTriangle, ArrowRight, Calendar, Flame, CheckCircle2, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Matches the PracticeAttemptRow shape from @/lib/studyPractice
export interface PracticeAttemptRow {
  id: string;
  user_id?: string | null;
  set_id?: string | null;
  score?: number | null;
  total?: number | null;
  completed_at?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

interface StreakCardProps {
  streak?: number | null;
  lastAttempt?: PracticeAttemptRow | null;
  className?: string;
  loading?: boolean;
  activeDays?: Set<string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

// ── Recovery prompt ───────────────────────────────────────────────────────────

type PromptVariant = "safe" | "milestone" | "at-risk" | "broken" | "cold";

type RecoveryPrompt = {
  variant: PromptVariant;
  icon: React.ReactNode;
  message: string;
};

function getRecoveryPrompt(
  streak: number,
  activeDates: Set<string>,
  todayStr: string,
  yesterdayStr: string,
  lastDate: string | null,
): RecoveryPrompt | null {
  const didToday     = activeDates.has(todayStr);
  const didYesterday = activeDates.has(yesterdayStr);

  // Gap in days since last practice
  let gapDays = 0;
  if (lastDate) {
    const last = new Date(lastDate + "T12:00:00");
    const today = new Date(todayStr + "T12:00:00");
    gapDays = Math.round((today.getTime() - last.getTime()) / 86_400_000);
  }

  // Never practiced
  if (!lastDate && streak === 0) {
    return {
      variant: "cold",
      icon: <Zap className="h-3.5 w-3.5 shrink-0" />,
      message: "Start your streak today — practice any set to begin.",
    };
  }

  // Practiced today — check for milestone first
  if (didToday) {
    if (streak === 30) return { variant: "milestone", icon: <Flame className="h-3.5 w-3.5 shrink-0" />, message: "🏆 30-day streak! Legendary dedication." };
    if (streak === 14) return { variant: "milestone", icon: <Flame className="h-3.5 w-3.5 shrink-0" />, message: "🔥 Two weeks straight! You're unstoppable." };
    if (streak === 7)  return { variant: "milestone", icon: <Flame className="h-3.5 w-3.5 shrink-0" />, message: "🎉 One week streak! Keep the fire burning." };
    if (streak >= 3)   return { variant: "safe", icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />, message: `${streak}-day streak and counting — come back tomorrow!` };
    return {
      variant: "safe",
      icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />,
      message: "Done for today! Practice again tomorrow to build your streak.",
    };
  }

  // Practiced yesterday but not today — streak is alive but at risk
  if (!didToday && didYesterday && streak > 0) {
    return {
      variant: "at-risk",
      icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
      message: `Your ${streak}-day streak ends at midnight — practice now to keep it!`,
    };
  }

  // Streak broken — last practice was 2+ days ago
  if (gapDays === 2) {
    return {
      variant: "broken",
      icon: <Zap className="h-3.5 w-3.5 shrink-0" />,
      message: "Your streak ended yesterday. Start a new one today!",
    };
  }
  if (gapDays >= 3 && gapDays <= 6) {
    return {
      variant: "broken",
      icon: <Zap className="h-3.5 w-3.5 shrink-0" />,
      message: `It's been ${gapDays} days. Jump back in — streaks rebuild fast!`,
    };
  }
  if (gapDays >= 7) {
    return {
      variant: "broken",
      icon: <Zap className="h-3.5 w-3.5 shrink-0" />,
      message: "It's been a while. Practice today to start fresh!",
    };
  }

  return null;
}

const PROMPT_STYLES: Record<PromptVariant, string> = {
  safe:      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  milestone: "border-teal-300/50 bg-teal-50/80 text-teal-900 dark:border-teal-700/50 dark:bg-teal-950/60 dark:text-teal-200",
  "at-risk": "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  broken:    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  cold:      "border-border bg-secondary/40 text-muted-foreground",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function StreakCard({
  streak,
  lastAttempt,
  className,
  loading,
  activeDays,
}: StreakCardProps) {

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-3xl border bg-card p-4 shadow-sm animate-pulse space-y-3",
          className
        )}
      >
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-6 w-16 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
          <div className="shrink-0 space-y-1 text-right">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-5 w-12 rounded bg-muted" />
          </div>
        </div>
        {/* (heatmap removed) */}
      </div>
    );
  }

  const currentStreak = streak ?? 0;
  const lastDate = lastAttempt?.completed_at ?? lastAttempt?.created_at ?? null;

  const streakColor =
    currentStreak >= 7
      ? "text-orange-500"
      : currentStreak >= 3
      ? "text-amber-500"
      : "text-muted-foreground";

  const now          = new Date(Date.now() + 3_600_000);
  const todayStr     = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() + 3_600_000 - 86_400_000).toISOString().slice(0, 10);

  const activeDates = new Set<string>();
  const prompt = getRecoveryPrompt(
    currentStreak,
    activeDates,
    todayStr,
    yesterdayStr,
    lastDate,
  );

  return (
    <div
      className={cn(
        "rounded-3xl border bg-card p-4 shadow-sm space-y-3",
        className
      )}
    >
      {/* Top row — flame + streak info + last score */}
      <div className="flex items-center gap-4">
        {/* Flame icon */}
        <div
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border",
            currentStreak > 0
              ? "bg-[#5B35D5]/[0.07] border-[#5B35D5]/20"
              : "bg-muted/40 border-border"
          )}
        >
          <Flame className={cn("h-6 w-6", streakColor)} />
        </div>

        {/* Streak info */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Practice Streak
          </p>
          <p className={cn("mt-0.5 text-2xl font-bold leading-none", streakColor)}>
            {currentStreak}
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              {currentStreak === 1 ? "day" : "days"}
            </span>
          </p>
          {lastDate ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Last practice: {formatRelativeDate(lastDate)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No practice sessions yet</p>
          )}
        </div>

        {/* Last score */}
        {lastAttempt &&
          lastAttempt.score != null &&
          lastAttempt.total != null &&
          (lastAttempt.total as number) > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-muted-foreground">Last score</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                {Math.round(
                  ((lastAttempt.score as number) / (lastAttempt.total as number)) * 100
                )}%
              </p>
            </div>
          )}
      </div>

      {/* Recovery / status prompt */}
      {prompt && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold",
            PROMPT_STYLES[prompt.variant]
          )}
        >
          {prompt.icon}
          <span>{prompt.message}</span>
        </div>
      )}

      {/* 28-day activity dot grid (2 rows × 14 cols) */}
      {activeDays !== undefined && (() => {
        const days: string[] = [];
        for (let i = 27; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 86_400_000);
          days.push(d.toISOString().slice(0, 10));
        }
        return (
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: "4px" }}
          >
            {days.map((d) => {
              const isToday = d === todayStr;
              const practiced = activeDays.has(d);
              return (
                <div
                  key={d}
                  title={d}
                  className={cn(
                    "h-3 w-3 rounded-full",
                    isToday
                      ? practiced
                        ? "bg-primary ring-2 ring-primary/40"
                        : "bg-muted ring-2 ring-primary/30"
                      : practiced
                      ? "bg-primary/70"
                      : "bg-muted"
                  )}
                />
              );
            })}
          </div>
        );
      })()}

      {/* M-9: Leaderboard link */}
      <Link
        href="/study/leaderboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground no-underline"
      >
        See leaderboard <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}