"use client";
import { cn, normalizeQuery, formatWhen, formatDuration, buildHref, pctToColor, pctToBg } from "@/lib/utils";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StudyTabs from "../_components/StudyTabs";
import { HistorySavedTabs } from "../_components/HistorySavedTabs";
import { Card, EmptyState, SkeletonCard } from "../_components/StudyUI";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  History,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { SelectRow } from "@/components/ui/study-filters";

// ─── Brand accent ─────────────────────────────────────────────────────────────
// Study Hub accent — indigo. Keep separate from marketplace orange (#FF5C00).
const ACCENT = "#5B35D5";
const ACCENT_BG = "#EEEDFE"; // purple-50
const ACCENT_TEXT = "#3C3489"; // purple-800

// ─── Utilities ────────────────────────────────────────────────────────────────

function watToday(): string {
  return new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
}

function getDateGroup(iso: string | null | undefined): string {
  if (!iso) return "Older";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Older";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const thisWeekStart = new Date(today.getTime() - today.getDay() * 86_400_000);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 86_400_000);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (itemDay >= today) return "Today";
  if (itemDay >= yesterday) return "Yesterday";
  if (itemDay >= thisWeekStart) return "This week";
  if (itemDay >= lastWeekStart) return "Last week";
  return d.toLocaleString("default", { month: "long", year: "numeric" });
}

function pctToTextColor(pct: number): string {
  if (pct >= 70) return "#3B6D11";
  if (pct >= 50) return "#854F0B";
  return "#A32D2D";
}

// ─── Types ────────────────────────────────────────────────────────────────────

const TABLE_ATTEMPTS = "study_practice_attempts";
const TABLE_SETS = "study_quiz_sets";

type AttemptRow = {
  id: string;
  set_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  submitted_at?: string | null;
  status?: string | null;
  score?: number | null;
  total_questions?: number | null;
  time_spent_seconds?: number | null;
  study_quiz_sets?: {
    id: string;
    title: string | null;
    course_code?: string | null;
  } | null;
};

// A set group: all attempts for the same quiz set
type SetGroup = {
  setId: string | null;
  title: string;
  courseCode: string;
  attempts: AttemptRow[];
  latestAt: string | null;
};

type StatsData = {
  totalAttempts: number;
  avgScore: number | null;
  firstScore: number | null; // for delta
  bestScore: number | null;
  bestCourseCode: string;
  worstCourseCode: string | null;
  worstCourseAvg: number | null;
  totalTimeSeconds: number;
};

type WeekBar = {
  label: string; // "Mon", "Tue" …
  date: string;  // "YYYY-MM-DD"
  avgPct: number | null;
  active: boolean;
};

type ActivityDay = {
  date: string;
  did_practice: boolean;
  points: number;
};

// ─── Stats Cards ──────────────────────────────────────────────────────────────

function StatsCards({ stats, loading }: { stats: StatsData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-border bg-background p-3">
            <div className="h-5 w-10 rounded bg-muted" />
            <div className="mt-1.5 h-3 w-14 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (!stats || stats.totalAttempts === 0) return null;

  const delta =
    stats.avgScore != null && stats.firstScore != null
      ? Math.round(stats.avgScore - stats.firstScore)
      : null;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
      {/* Attempts */}
      <div className="rounded-2xl border border-border bg-background p-3">
        <p className="text-[11px] text-muted-foreground">Attempts</p>
        <p className="mt-1 text-xl font-medium tabular-nums text-foreground">
          {stats.totalAttempts}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">all time</p>
      </div>

      {/* Avg score */}
      <div className="rounded-2xl border border-border bg-background p-3">
        <p className="text-[11px] text-muted-foreground">Avg score</p>
        <p className="mt-1 text-xl font-medium tabular-nums text-foreground">
          {stats.avgScore != null ? `${stats.avgScore}%` : "—"}
        </p>
        {delta != null && delta !== 0 && (
          <p
            className="mt-0.5 text-[10px]"
            style={{ color: delta > 0 ? "#3B6D11" : "#A32D2D" }}
          >
            {delta > 0 ? `+${delta}%` : `${delta}%`} vs first
          </p>
        )}
      </div>

      {/* Best */}
      <div className="rounded-2xl border border-border bg-background p-3">
        <p className="text-[11px] text-muted-foreground">Best</p>
        <p className="mt-1 text-xl font-medium tabular-nums text-foreground">
          {stats.bestScore != null ? `${stats.bestScore}%` : "—"}
        </p>
        {stats.bestCourseCode && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">{stats.bestCourseCode}</p>
        )}
      </div>

      </div>

      {stats.worstCourseCode && stats.worstCourseAvg !== null && stats.worstCourseAvg < 65 && (
        <Link
          href={`/study/practice?course=${encodeURIComponent(stats.worstCourseCode)}&view=all`}
          className={cn(
            "mt-3 flex items-center justify-between gap-3 rounded-2xl",
            "border border-rose-200/60 bg-rose-50/60 px-4 py-3 no-underline transition",
            "hover:bg-rose-50 dark:border-rose-800/40 dark:bg-rose-950/20"
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-rose-800 dark:text-rose-300">
              Needs work: {stats.worstCourseCode}
            </p>
            <p className="text-xs text-rose-700/70 dark:text-rose-400">
              {stats.worstCourseAvg}% avg · tap to practice
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
        </Link>
      )}
    </div>
  );
}

// ─── Streak Banner ────────────────────────────────────────────────────────────

function StreakBanner({ streak }: { streak: number }) {
  if (streak === 0) return null;
  return (
    <div
      className="flex items-center justify-between rounded-2xl px-4 py-3"
      style={{ background: ACCENT }}
    >
      <div>
        <p className="text-sm font-medium text-white">Active streak</p>
        <p className="mt-0.5 text-[11px]" style={{ color: "rgba(255,255,255,0.75)" }}>
          Practice every day to keep it going
        </p>
      </div>
      <div className="text-center">
        <p className="text-3xl font-medium leading-none text-white">{streak}</p>
        <p className="mt-0.5 text-[10px]" style={{ color: "rgba(255,255,255,0.75)" }}>
          {streak === 1 ? "day" : "days"}
        </p>
      </div>
    </div>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────

function WeeklyBarChart({ bars }: { bars: WeekBar[] }) {
  const maxPct = Math.max(...bars.map((b) => b.avgPct ?? 0), 1);

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 56 }}>
        {bars.map((bar) => {
          const height = bar.avgPct != null ? Math.round((bar.avgPct / 100) * 48) + 4 : 0;
          const isToday = bar.date === watToday();
          return (
            <div key={bar.date} className="flex flex-1 flex-col items-center gap-1">
              {bar.avgPct != null ? (
                <div
                  className="w-full rounded-t-[3px]"
                  style={{
                    height,
                    background: ACCENT,
                    opacity: isToday ? 1 : 0.35 + (bar.avgPct / 100) * 0.55,
                  }}
                />
              ) : bar.active ? (
                // practiced but no graded score (all in-progress)
                <div
                  className="w-full rounded-t-[3px]"
                  style={{ height: 4, background: ACCENT, opacity: 0.2 }}
                />
              ) : (
                <div className="w-full" style={{ height: 0 }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {bars.map((bar) => (
          <div
            key={bar.date}
            className="flex-1 text-center text-[9px] text-muted-foreground"
          >
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Score Trend (line, unchanged logic) ─────────────────────────────────────

type TrendPoint = { submittedAt: string; pct: number; courseCode: string };

const CHART_W = 300;
const CHART_H = 72;
const CHART_PAD_X = 8;
const CHART_PAD_Y = 8;

function ScoreTrendLine({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-[72px] items-center justify-center text-xs text-muted-foreground">
        Need at least 2 graded attempts to plot a trend.
      </div>
    );
  }
  const innerW = CHART_W - CHART_PAD_X * 2;
  const innerH = CHART_H - CHART_PAD_Y * 2;
  const coords = points.map((p, i) => ({
    x: CHART_PAD_X + (i / (points.length - 1)) * innerW,
    y: CHART_PAD_Y + (1 - p.pct / 100) * innerH,
    p,
  }));
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const fillPath =
    linePath +
    ` L ${coords[coords.length - 1].x.toFixed(1)} ${(CHART_H - CHART_PAD_Y).toFixed(1)}` +
    ` L ${coords[0].x.toFixed(1)} ${(CHART_H - CHART_PAD_Y).toFixed(1)} Z`;
  const lastPct = points[points.length - 1].pct;

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" height={CHART_H} overflow="visible">
      <path d={fillPath} fill={ACCENT} fillOpacity={0.1} />
      <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(({ x, y, p }, i) => (
        <circle key={i} cx={x} cy={y} r={3.5} fill="white" stroke={pctToColor(p.pct)} strokeWidth={2} />
      ))}
    </svg>
  );
}

// ─── Progress Section ─────────────────────────────────────────────────────────

type ProgressTab = "trend" | "activity";

function ProgressSection({
  trendPoints,
  weekBars,
  activityDays,
  loading,
  courseCodes,
}: {
  trendPoints: TrendPoint[];
  weekBars: WeekBar[];
  activityDays: ActivityDay[];
  loading: boolean;
  courseCodes: string[];
}) {
  const [tab, setTab] = useState<ProgressTab>("trend");
  const [trendView, setTrendView] = useState<"week" | "all">("week");
  const [activeCourse, setActiveCourse] = useState<string | null>(null);

  const filteredTrend = activeCourse
    ? trendPoints.filter((p) => p.courseCode === activeCourse)
    : trendPoints;

  if (loading) {
    return (
      <Card className="animate-pulse rounded-3xl">
        <div className="h-[88px] rounded-xl bg-muted" />
      </Card>
    );
  }
  if (trendPoints.length === 0 && activityDays.length === 0) return null;

  const activeCount = activityDays.filter((d) => d.did_practice).length;

  return (
    <Card className="rounded-3xl space-y-3">
      {/* Tab row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Progress</p>
        <div className="flex rounded-xl border border-border bg-background p-0.5 text-xs">
          {(["trend", "activity"] as ProgressTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-[9px] px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === t
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "trend" ? "Score trend" : "Activity"}
            </button>
          ))}
        </div>
      </div>

      {tab === "trend" ? (
        <div className="space-y-3">
          {/* Week / All toggle */}
          <div className="flex items-center gap-2">
            {(["week", "all"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTrendView(v)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] transition",
                  trendView === v
                    ? "font-medium text-white"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
                style={
                  trendView === v
                    ? { background: ACCENT, borderColor: ACCENT }
                    : undefined
                }
              >
                {v === "week" ? "Week" : "All"}
              </button>
            ))}
          </div>

          {trendView === "week" ? (
            <WeeklyBarChart bars={weekBars} />
          ) : (
            <div className="space-y-2">
              {courseCodes.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveCourse(null)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      !activeCourse
                        ? "border-border bg-secondary font-medium text-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All
                  </button>
                  {courseCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setActiveCourse(activeCourse === code ? null : code)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] transition",
                        activeCourse === code
                          ? "border-border bg-secondary font-medium text-foreground"
                          : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              )}
              <ScoreTrendLine points={filteredTrend} />
              {filteredTrend.length >= 2 && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {new Date(filteredTrend[0].submittedAt).toLocaleDateString(undefined, {
                      month: "short", day: "numeric",
                    })}
                  </span>
                  <span>
                    {new Date(filteredTrend[filteredTrend.length - 1].submittedAt).toLocaleDateString(
                      undefined, { month: "short", day: "numeric" }
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            {activeCount} active day{activeCount !== 1 ? "s" : ""} in the last 30 days
          </p>
          <div className="flex flex-wrap gap-1">
            {activityDays.map(({ date, did_practice }) => (
              <div
                key={date}
                title={date}
                className="h-4 w-4 shrink-0 rounded-[3px]"
                style={{
                  background: did_practice ? ACCENT : "var(--color-background-secondary)",
                  opacity: did_practice ? 1 : 0.5,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Score Dot (mini attempt history) ────────────────────────────────────────

function ScoreDot({ pct, inProgress }: { pct: number | null; inProgress?: boolean }) {
  if (inProgress) {
    return (
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-full border"
        style={{ borderColor: ACCENT, background: ACCENT_BG }}
      />
    );
  }
  if (pct == null) {
    return (
      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted" />
    );
  }
  return (
    <div
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: pctToColor(pct) }}
    />
  );
}

// ─── Set Group Card ───────────────────────────────────────────────────────────
// Groups all attempts for one quiz set into a single card.

function SetGroupCard({ group }: { group: SetGroup }) {
  const { setId, title, courseCode, attempts } = group;

  // Sort attempts newest-first for display
  const sorted = [...attempts].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });

  const latest = sorted[0];
  const inProgressAttempt = sorted.find(
    (a) => !a.submitted_at && a.status === "in_progress"
  );

  const latestSubmitted = sorted.find(
    (a) => a.submitted_at || (a.status && a.status !== "in_progress")
  );

  // Score for the pill: most recent submitted score
  const pilotScore =
    latestSubmitted &&
    typeof latestSubmitted.score === "number" &&
    typeof latestSubmitted.total_questions === "number" &&
    latestSubmitted.total_questions > 0
      ? Math.round((latestSubmitted.score / latestSubmitted.total_questions) * 100)
      : null;

  const hasAnyInProgress = Boolean(inProgressAttempt);

  // Dots: show last 7 attempts, oldest left
  const dotsSource = sorted.slice(0, 7).reverse();

  const totalCount = attempts.length;
  const lastAt = latest?.updated_at ?? latest?.created_at ?? null;

  return (
    <Card className="rounded-3xl space-y-3 p-4">
      {/* Title + score pill */}
      <div className="flex items-start justify-between gap-3">
        <p className="flex-1 text-sm font-medium leading-snug text-foreground">{title}</p>

        {pilotScore != null ? (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              background: pctToBg(pilotScore),
              color: pctToTextColor(pilotScore),
            }}
          >
            {pilotScore}%
          </span>
        ) : hasAnyInProgress ? (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: ACCENT_BG, color: ACCENT_TEXT }}
          >
            In progress
          </span>
        ) : null}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2">
        {courseCode && (
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
            {courseCode}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">
          {totalCount} attempt{totalCount !== 1 ? "s" : ""}
        </span>
        {lastAt && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatWhen(lastAt)}
          </span>
        )}
      </div>

      {/* Score dots */}
      {dotsSource.length > 0 && (
        <div className="flex items-center gap-1.5">
          {dotsSource.map((a) => {
            const isIP = !a.submitted_at && a.status === "in_progress";
            const pct =
              !isIP &&
              typeof a.score === "number" &&
              typeof a.total_questions === "number" &&
              a.total_questions > 0
                ? Math.round((a.score / a.total_questions) * 100)
                : null;
            return <ScoreDot key={a.id} pct={pct} inProgress={isIP} />;
          })}
          {hasAnyInProgress && (
            <span className="ml-1 text-[10px] text-muted-foreground">1 in progress</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Secondary: see individual attempts */}
        {setId && (
          <Link
            href={`/study/history/${latest.id}`}
            className={cn(
              "inline-flex items-center justify-center rounded-2xl border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground no-underline",
              "hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {totalCount > 1 ? `See all ${totalCount}` : "Review"}
          </Link>
        )}

        {/* Primary CTA */}
        {inProgressAttempt ? (
          <Link
            href={`/study/practice/${setId}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ background: ACCENT }}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : setId ? (
          <>
            <Link
              href={`/study/history/${latest.id}`}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground no-underline",
                "hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              Review
            </Link>
            <Link
              href={`/study/practice/${setId}`}
              title="Retry"
              aria-label="Retry this set"
              className={cn(
                "inline-flex items-center justify-center rounded-2xl border border-border bg-background px-3 py-2.5 text-foreground no-underline",
                "hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <RotateCcw className="h-4 w-4" />
            </Link>
          </>
        ) : null}
      </div>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HistoryClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const qParam = sp.get("q") ?? "";
  const statusParam = sp.get("status") ?? "";
  const courseParam = sp.get("course") ?? "";
  const recentParam = sp.get("recent") ?? "";

  const [q, setQ] = useState(qParam);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(statusParam);
  const [draftCourse, setDraftCourse] = useState(courseParam);
  const [draftRecent, setDraftRecent] = useState(recentParam || "30");

  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [weekBars, setWeekBars] = useState<WeekBar[]>([]);
  const [activityDays, setActivityDays] = useState<ActivityDay[]>([]);
  const [streak, setStreak] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState<AttemptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 40; // fetch more since we group by set

  useEffect(() => setQ(qParam), [qParam]);

  const filtersKey = useMemo(
    () =>
      [normalizeQuery(qParam), statusParam, courseParam.trim().toUpperCase(), recentParam].join("|"),
    [qParam, statusParam, courseParam, recentParam]
  );

  useEffect(() => {
    setPage(1);
    setItems([]);
    setHasMore(false);
    setTotal(0);
  }, [filtersKey]);

  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const qNorm = normalizeQuery(q);
    if (qNorm === normalizeQuery(qParam)) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      router.replace(
        buildHref(pathname, {
          q: qNorm || null,
          status: statusParam || null,
          course: courseParam || null,
          recent: recentParam || null,
        })
      );
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, qParam, router, pathname, statusParam, courseParam, recentParam]);

  // ── Fetch stats + activity on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) return;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

        const [submittedRes, trendRes, actRes] = await Promise.all([
          // All submitted attempts for stats
          supabase
            .from(TABLE_ATTEMPTS)
            .select(`score,total_questions,time_spent_seconds,${TABLE_SETS}(course_code)`)
            .eq("user_id", uid)
            .eq("status", "submitted")
            .order("submitted_at", { ascending: true })
            .limit(500),

          // Trend points (chronological, graded)
          supabase
            .from(TABLE_ATTEMPTS)
            .select(`submitted_at,score,total_questions,${TABLE_SETS}(course_code)`)
            .eq("user_id", uid)
            .eq("status", "submitted")
            .not("score", "is", null)
            .not("total_questions", "is", null)
            .gt("total_questions", 0)
            .order("submitted_at", { ascending: true })
            .limit(60),

          // Daily activity (30 days)
          supabase
            .from("study_daily_activity")
            .select("activity_date,did_practice,points")
            .eq("user_id", uid)
            .gte("activity_date", thirtyDaysAgo)
            .order("activity_date", { ascending: true }),
        ]);

        if (cancelled) return;

        // ── Stats ──
        type SubmittedRow = { score: number | null; total_questions: number | null; time_spent_seconds: number | null; study_quiz_sets?: { course_code?: string | null } | null };
        const submittedRows = ((submittedRes.data ?? []) as SubmittedRow[]).filter(Boolean);
        const graded = submittedRows.filter(
          (r) => typeof r.score === "number" && typeof r.total_questions === "number" && r.total_questions! > 0
        );

        const avgScore =
          graded.length > 0
            ? Math.round(graded.reduce((s, r) => s + (r.score! / r.total_questions!) * 100, 0) / graded.length)
            : null;

        const firstScore =
          graded.length > 0
            ? Math.round((graded[0].score! / graded[0].total_questions!) * 100)
            : null;

        let bestScore: number | null = null;
        let bestCourseCode = "";
        for (const r of graded) {
          const pct = Math.round((r.score! / r.total_questions!) * 100);
          if (bestScore == null || pct > bestScore) {
            bestScore = pct;
            bestCourseCode = (r.study_quiz_sets as any)?.course_code?.trim().toUpperCase() ?? "";
          }
        }

        const courseAvgs = new Map<string, number[]>();
        for (const attempt of graded) {
          const code = attempt.study_quiz_sets?.course_code?.trim().toUpperCase();
          if (!code) continue;
          const pct = Math.round((attempt.score! / attempt.total_questions!) * 100);
          if (!courseAvgs.has(code)) courseAvgs.set(code, []);
          courseAvgs.get(code)!.push(pct);
        }

        let worstCourseCode: string | null = null;
        let worstCourseAvg: number | null = null;
        for (const [code, pcts] of courseAvgs.entries()) {
          if (pcts.length < 2) continue;
          const avg = Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length);
          if (worstCourseAvg === null || avg < worstCourseAvg) {
            worstCourseAvg = avg;
            worstCourseCode = code;
          }
        }

        if (worstCourseCode === bestCourseCode) {
          worstCourseCode = null;
          worstCourseAvg = null;
        }

        const totalTimeSeconds = submittedRows.reduce((s, r) => s + (r.time_spent_seconds ?? 0), 0);

        if (!cancelled) {
          setStats({
            totalAttempts: submittedRows.length,
            avgScore,
            firstScore,
            bestScore,
            bestCourseCode,
            worstCourseCode,
            worstCourseAvg,
            totalTimeSeconds,
          });
        }

        // ── Trend points ──
        const rawTrend = (trendRes.data ?? []) as any[];
        const parsedTrend: TrendPoint[] = rawTrend
          .filter((r) => r.submitted_at && typeof r.score === "number" && r.total_questions > 0)
          .map((r) => ({
            submittedAt: r.submitted_at as string,
            pct: Math.round((r.score / r.total_questions) * 100),
            courseCode: (r[TABLE_SETS]?.course_code ?? "").toString().trim().toUpperCase(),
          }));
        if (!cancelled) setTrendPoints(parsedTrend);

        // ── Activity days ──
        const rawAct = (actRes.data ?? []) as any[];
        const parsedAct: ActivityDay[] = rawAct.map((r) => ({
          date: r.activity_date as string,
          did_practice: Boolean(r.did_practice),
          points: r.points ?? 0,
        }));
        if (!cancelled) setActivityDays(parsedAct);

        // ── Streak (consecutive days ending today, WAT) ──
        const today = watToday();
        const actMap = new Map(parsedAct.map((d) => [d.date, d.did_practice]));
        let s = 0;
        let cursor = new Date(today);
        while (true) {
          const key = cursor.toISOString().slice(0, 10);
          if (actMap.get(key)) {
            s++;
            cursor = new Date(cursor.getTime() - 86_400_000);
          } else {
            break;
          }
        }
        if (!cancelled) setStreak(s);

        // ── Weekly bars (Mon–Sun of current week) ──
        const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const nowWAT = new Date(Date.now() + 3_600_000);
        const dayOfWeek = nowWAT.getDay(); // 0=Sun
        const weekDates: string[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(nowWAT.getTime() - (dayOfWeek - i) * 86_400_000);
          weekDates.push(d.toISOString().slice(0, 10));
        }

        // Group trend points by date (WAT)
        const pctByDate = new Map<string, number[]>();
        for (const tp of parsedTrend) {
          const dateKey = new Date(new Date(tp.submittedAt).getTime() + 3_600_000)
            .toISOString()
            .slice(0, 10);
          if (!pctByDate.has(dateKey)) pctByDate.set(dateKey, []);
          pctByDate.get(dateKey)!.push(tp.pct);
        }

        const bars: WeekBar[] = weekDates.map((date) => {
          const d = new Date(date + "T00:00:00");
          const label = DAY_NAMES[d.getDay()];
          const ptsList = pctByDate.get(date) ?? [];
          const avgPct =
            ptsList.length > 0
              ? Math.round(ptsList.reduce((s, p) => s + p, 0) / ptsList.length)
              : null;
          const active = actMap.get(date) ?? false;
          return { label, date, avgPct, active };
        });
        if (!cancelled) setWeekBars(bars);
      } catch {
        // Non-blocking
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch attempts ─────────────────────────────────────────────────────────
  async function fetchPage(nextPage: number) {
    const isFirst = nextPage === 1;
    if (isFirst) { setLoading(true); setError(null); }
    else setLoadingMore(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) { setItems([]); setTotal(0); setHasMore(false); return; }

      let query = supabase
        .from(TABLE_ATTEMPTS)
        .select(
          `id,set_id,created_at,updated_at,submitted_at,status,score,total_questions,time_spent_seconds,${TABLE_SETS}(id,title,course_code)`,
          { count: "exact" }
        )
        .eq("user_id", uid);

      const recent = (recentParam || "").trim();
      if (recent && recent !== "all") {
        const days = Number(recent);
        if (Number.isFinite(days) && days > 0) {
          query = query.gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString());
        }
      }

      if (statusParam === "completed") {
        query = query.or("submitted_at.not.is.null,status.ilike.%submitted%");
      } else if (statusParam === "in_progress") {
        query = query.or("submitted_at.is.null,status.ilike.%progress%");
      }

      const course = courseParam.trim().toUpperCase();
      if (course) query = query.eq(`${TABLE_SETS}.course_code`, course);

      const qNorm = normalizeQuery(qParam);
      if (qNorm) {
        query = query.or(
          `${TABLE_SETS}.title.ilike.%${qNorm}%,${TABLE_SETS}.course_code.ilike.%${qNorm}%`
        );
      }

      query = query
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });

      const from = (nextPage - 1) * PAGE_SIZE;
      const res = await query.range(from, from + PAGE_SIZE - 1);

      if (res.error) {
        setError(res.error.message || "Could not load history.");
        if (isFirst) { setItems([]); setTotal(0); }
        return;
      }

      const totalCount = res.count ?? 0;
      const rows = ((res.data as any[]) ?? []).filter(Boolean) as AttemptRow[];

      setTotal(totalCount);
      setItems((prev) => {
        if (isFirst) return rows;
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const r of rows) if (!seen.has(r.id)) merged.push(r);
        return merged;
      });
      setHasMore((nextPage - 1) * PAGE_SIZE + rows.length < totalCount);
    } catch (e: any) {
      setError(e?.message ?? "Could not load history.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  // ── Group attempts by set_id ───────────────────────────────────────────────
  const setGroups = useMemo((): SetGroup[] => {
    const map = new Map<string, SetGroup>();
    const order: string[] = [];

    for (const item of items) {
      const key = item.set_id ?? `orphan-${item.id}`;
      if (!map.has(key)) {
        map.set(key, {
          setId: item.set_id ?? null,
          title: item.study_quiz_sets?.title?.trim() || "Practice attempt",
          courseCode: (item.study_quiz_sets?.course_code ?? "").trim().toUpperCase(),
          attempts: [],
          latestAt: null,
        });
        order.push(key);
      }
      const g = map.get(key)!;
      g.attempts.push(item);
      const at = item.updated_at ?? item.created_at ?? null;
      if (at && (!g.latestAt || at > g.latestAt)) g.latestAt = at;
    }

    return order.map((k) => map.get(k)!);
  }, [items]);

  // Group set groups by date of their latest attempt
  const groupedSets = useMemo(() => {
    const mapLabel = new Map<string, SetGroup[]>();
    const labelOrder: string[] = [];
    for (const g of setGroups) {
      const label = getDateGroup(g.latestAt);
      if (!mapLabel.has(label)) { mapLabel.set(label, []); labelOrder.push(label); }
      mapLabel.get(label)!.push(g);
    }
    return labelOrder.map((label) => ({ label, groups: mapLabel.get(label)! }));
  }, [setGroups]);

  // Course chips from loaded items
  const courseCodes = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) {
      const code = item.study_quiz_sets?.course_code?.trim().toUpperCase();
      if (code) seen.add(code);
    }
    return [...seen].sort();
  }, [items]);

  const hasAnyFilters = Boolean(qParam || statusParam || courseParam || (recentParam && recentParam !== "30"));

  function applyFilters() {
    router.replace(
      buildHref(pathname, {
        q: normalizeQuery(q) || null,
        status: draftStatus || null,
        course: draftCourse.trim().toUpperCase() || null,
        recent: draftRecent || null,
      })
    );
    setDrawerOpen(false);
  }

  function clearAll() {
    setQ("");
    router.replace(pathname);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <StudyTabs />
      <HistorySavedTabs active="history" />

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/study"
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground no-underline",
            "hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <Link
          href="/study/practice"
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ background: ACCENT }}
        >
          <BookOpen className="h-4 w-4" />
          Practice
        </Link>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-medium text-foreground">History</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track your progress and review every attempt.
          </p>
        </div>
        <History className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>

      {/* Stats */}
      <StatsCards stats={stats} loading={statsLoading} />

      {/* Streak */}
      {!statsLoading && <StreakBanner streak={streak} />}

      {/* Progress */}
      <ProgressSection
        trendPoints={trendPoints}
        weekBars={weekBars}
        activityDays={activityDays}
        loading={statsLoading}
        courseCodes={[...new Set(trendPoints.map((p) => p.courseCode).filter(Boolean))].sort()}
      />

      {/* Search + filter row */}
      <div className="sticky top-16 z-30">
        <Card className="rounded-3xl border bg-background/85 backdrop-blur space-y-3">
          {/* Search bar */}
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by course code or set title…"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border bg-background hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => { setDraftStatus(statusParam); setDraftCourse(courseParam); setDraftRecent(recentParam || "30"); setDrawerOpen(true); }}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
          </div>

          {/* Quick chips: All / course codes / status */}
          <div className="flex flex-wrap gap-1.5">
            {/* All */}
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { q: qParam || null, status: null, course: null, recent: recentParam || null }))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !courseParam && !statusParam
                  ? "border-border bg-foreground font-medium text-background"
                  : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>

            {/* Course chips */}
            {courseCodes.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() =>
                  router.replace(
                    buildHref(pathname, {
                      q: qParam || null,
                      status: statusParam || null,
                      course: courseParam === code ? null : code,
                      recent: recentParam || null,
                    })
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  courseParam === code
                    ? "border-border bg-foreground font-medium text-background"
                    : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {code}
              </button>
            ))}

            {/* Status chips */}
            {(["in_progress", "completed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  router.replace(
                    buildHref(pathname, {
                      q: qParam || null,
                      status: statusParam === s ? null : s,
                      course: courseParam || null,
                      recent: recentParam || null,
                    })
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  statusParam === s
                    ? "font-medium text-white"
                    : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
                )}
                style={statusParam === s ? { background: ACCENT, borderColor: ACCENT } : undefined}
              >
                {s === "in_progress" ? "In progress" : "Completed"}
              </button>
            ))}
          </div>

          {hasAnyFilters && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {setGroups.length} set{setGroups.length !== 1 ? "s" : ""} · {items.length} attempt{items.length !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-3xl border border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">Couldn&apos;t load history</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => fetchPage(1)}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="rounded-3xl" />
          ))}
        </div>
      ) : setGroups.length === 0 ? (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="No attempts yet"
          description={
            hasAnyFilters
              ? "Try clearing filters to see all attempts."
              : "Start a practice set and your attempts will show here."
          }
          action={
            <Link
              href="/study/practice"
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-white no-underline hover:opacity-90"
              style={{ background: ACCENT }}
            >
              <BookOpen className="h-4 w-4" />
              Go to Practice
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {groupedSets.map(({ label, groups }) => (
            <section key={label}>
              <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.map((g, i) => (
                  <SetGroupCard key={g.setId ?? i} group={g} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Load more */}
      {!loading && setGroups.length > 0 && (
        <div className="flex justify-center">
          {hasMore ? (
            <button
              type="button"
              onClick={async () => {
                const next = page + 1;
                setPage(next);
                await fetchPage(next);
              }}
              disabled={loadingMore}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground",
                "hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                loadingMore ? "opacity-60" : ""
              )}
            >
              {loadingMore ? "Loading…" : "Load more"}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">You&apos;ve reached the end.</p>
          )}
        </div>
      )}

      {/* Filters drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setDraftStatus(""); setDraftCourse(""); setDraftRecent("30"); }}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex flex-1 items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ background: ACCENT }}
            >
              Apply
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectRow
            label="Status"
            value={draftStatus}
            onChange={setDraftStatus}
            placeholder="All"
            options={[
              { value: "completed", label: "Completed" },
              { value: "in_progress", label: "In progress" },
            ]}
          />
          <SelectRow
            label="Time range"
            value={draftRecent}
            onChange={setDraftRecent}
            placeholder="Last 30 days"
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "all", label: "All time" },
            ]}
          />
        </div>
        <div className="mt-3 rounded-3xl border border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">Course code</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Or tap a course chip above the list for a quick filter.
          </p>
          <input
            value={draftCourse}
            onChange={(e) => setDraftCourse(e.target.value)}
            placeholder="e.g. GST101"
            className="mt-3 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>
      </Drawer>
    </div>
  );
}
