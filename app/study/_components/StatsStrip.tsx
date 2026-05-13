"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trackHomeCta } from "@/lib/studyAnalytics";

type StatsStripProps = { userId: string };

type StripStats = {
  avgScore: number | null;
  rank: number | null;
  totalSessions: number;
};

type AttemptQueryRow = {
  score: number | null;
  total_questions: number | null;
};

type CompletedAttempt = {
  score: number;
  total_questions: number;
};

function getScoreClass(value: number | null) {
  if (value == null) return "text-foreground";
  if (value >= 70) return "text-[#3B6D11] dark:text-emerald-400";
  if (value >= 50) return "text-[#633806] dark:text-amber-400";
  return "text-[#791F1F] dark:text-red-400";
}

export default function StatsStrip({ userId }: StatsStripProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StripStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);
      try {
        const rankPromise = (async () => {
          const { data: leaderboardRow, error: leaderboardError } = await supabase
            .from("study_leaderboard_v")
            .select("points")
            .eq("user_id", userId)
            .maybeSingle();

          if (leaderboardError || !leaderboardRow) return null;

          const points = typeof leaderboardRow.points === "number" ? leaderboardRow.points : 0;
          const { count, error: rankError } = await supabase
            .from("study_leaderboard_v")
            .select("user_id", { count: "exact", head: true })
            .gt("points", points);

          if (rankError) return null;
          const rank = (count ?? 0) + 1;
          if (points === 0 && rank > 100) return null;
          return rank;
        })();

        const progressPromise = (async () => {
          const { data, error } = await supabase
            .from("study_practice_attempts")
            .select("score,total_questions")
            .eq("user_id", userId)
            .eq("status", "submitted")
            .not("score", "is", null)
            .not("total_questions", "is", null)
            .gt("total_questions", 0)
            .limit(200);

          if (error || !Array.isArray(data)) {
            return { avgScore: null, totalSessions: 0 };
          }

          const attempts = (data as AttemptQueryRow[]).filter(
            (row): row is CompletedAttempt =>
              typeof row.score === "number" &&
              typeof row.total_questions === "number" &&
              row.total_questions > 0
          );

          const totalSessions = attempts.length;
          if (!totalSessions) return { avgScore: null, totalSessions: 0 };

          const pcts = attempts.map((row) =>
            Math.round((row.score / row.total_questions) * 100)
          );

          return {
            avgScore: Math.round(pcts.reduce((sum, value) => sum + value, 0) / pcts.length),
            totalSessions,
          };
        })();

        const [rank, progress] = await Promise.all([rankPromise, progressPromise]);
        if (cancelled) return;

        if (rank == null && progress.totalSessions === 0) {
          setStats(null);
          return;
        }

        setStats({
          avgScore: progress.avgScore,
          rank,
          totalSessions: progress.totalSessions,
        });
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <div className="h-14 animate-pulse rounded-3xl bg-muted" />;
  }

  if (!stats) return null;

  return (
    <Link
      href="/study/history"
      onClick={() =>
        trackHomeCta("stats_strip", {
          avg_score: stats.avgScore,
          rank: stats.rank,
          total_sessions: stats.totalSessions,
        })
      }
      className="block no-underline"
    >
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-card px-4 py-3 shadow-sm transition hover:bg-secondary/20">
        <div className="grid flex-1 grid-cols-3 gap-3">
          <div>
            <p className={`text-base font-extrabold ${getScoreClass(stats.avgScore)}`}>
              {stats.avgScore != null ? `${stats.avgScore}%` : "--"}
            </p>
            <p className="text-[10px] text-muted-foreground">avg</p>
          </div>
          <div>
            <p className="text-base font-extrabold text-foreground">
              {stats.rank != null ? `#${stats.rank}` : "--"}
            </p>
            <p className="text-[10px] text-muted-foreground">dept rank</p>
          </div>
          <div>
            <p className="text-base font-extrabold text-foreground">
              {stats.totalSessions}
            </p>
            <p className="text-[10px] text-muted-foreground">sessions</p>
          </div>
        </div>

        <span className="shrink-0 text-xs font-semibold text-[#5B35D5]">
          Full progress →
        </span>
      </div>
    </Link>
  );
}
