// app/study/ai-plan/page.tsx
// Migration
// CREATE TABLE IF NOT EXISTS public.study_plans (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id uuid NOT NULL REFERENCES auth.users(id),
//   plan jsonb NOT NULL,
//   created_at timestamptz NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS study_plans_user_id_created_at_idx
//   ON public.study_plans (user_id, created_at DESC);

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  BookOpen,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { cn, formatWhen } from "@/lib/utils";
import StudyTabs from "../_components/StudyTabs";

// ── Types ──────────────────────────────────────────────────────────────────────

type StudyDay  = { day: string; focus: string; tasks: string[]; hours: number };
type StudyWeek = { week: number; theme: string; weeklyGoal: string; days: StudyDay[] };
type StudyPlan = { summary: string; totalWeeks: number; weeks: StudyWeek[]; generalTips: string[] };
type StudyPreferencesRow = {
  level: number | null;
  department: string | null;
  department_id: string | null;
  faculty: string | null;
  last_study_plan_at: string | null;
  last_study_plan_progress: unknown;
};
type StudyPlanRow = {
  plan: unknown;
  created_at: string | null;
};
type PersonalizationPayload = {
  ok?: boolean;
  profileStatus?: "complete" | "incomplete" | "missing";
  scopeLabel?: string | null;
  courses?: Array<{ course_code?: string | null }>;
};

function parseStoredPlan(value: unknown): StudyPlan | null {
  if (!value) return null;

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") return null;

    const maybePlan = parsed as Partial<StudyPlan>;
    if (
      typeof maybePlan.summary !== "string" ||
      typeof maybePlan.totalWeeks !== "number" ||
      !Array.isArray(maybePlan.weeks) ||
      !Array.isArray(maybePlan.generalTips)
    ) {
      return null;
    }

    return maybePlan as StudyPlan;
  } catch {
    return null;
  }
}

// ── Constants ──────────────────────────────────────────────────────────────────

const WEEK_OPTIONS  = [1, 2, 3, 4, 6, 8, 12];
const HOURS_OPTIONS = [1, 2, 3, 4, 5, 6, 8];

const DAY_COLORS: Record<string, string> = {
  Monday:    "bg-violet-50 border-violet-200/60 dark:bg-violet-950/20 dark:border-violet-700/30",
  Tuesday:   "bg-indigo-50 border-indigo-200/60 dark:bg-indigo-950/20 dark:border-indigo-700/30",
  Wednesday: "bg-blue-50 border-blue-200/60 dark:bg-blue-950/20 dark:border-blue-700/30",
  Thursday:  "bg-cyan-50 border-cyan-200/60 dark:bg-cyan-950/20 dark:border-cyan-700/30",
  Friday:    "bg-emerald-50 border-emerald-200/60 dark:bg-emerald-950/20 dark:border-emerald-700/30",
  Saturday:  "bg-amber-50 border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-700/30",
  Sunday:    "bg-rose-50 border-rose-200/60 dark:bg-rose-950/20 dark:border-rose-700/30",
};

// ── Urgency helpers ────────────────────────────────────────────────────────────

type Urgency = "red" | "amber" | "green";

function getUrgency(weeks: number): Urgency {
  if (weeks <= 2) return "red";
  if (weeks <= 5) return "amber";
  return "green";
}

const URGENCY_NOTE: Record<Urgency, string> = {
  red:   "⚠ Crunch mode — plan will be intensive",
  amber: "⏰ Moderate pace — still focused",
  green: "✓ Comfortable pace — thorough coverage",
};

const URGENCY_WEEK_CHIP: Record<Urgency, string> = {
  red:   "border-red-400 bg-red-50 text-red-800 dark:border-red-700/60 dark:bg-red-950/30 dark:text-red-300",
  amber: "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-300",
  green: "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/30 dark:text-emerald-300",
};

const URGENCY_NOTE_TEXT: Record<Urgency, string> = {
  red:   "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-emerald-600 dark:text-emerald-400",
};

// ── Section Card wrapper ───────────────────────────────────────────────────────

function SectionCard({
  icon,
  iconBg,
  title,
  sub,
  children,
}: {
  icon: string;
  iconBg: string;
  title: React.ReactNode;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
          style={{ background: iconBg }}
        >
          {icon}
        </span>
        <div>
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="text-[12px] text-muted-foreground mt-px">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Course pill tag input ──────────────────────────────────────────────────────

function CourseTagInput({
  courses,
  onChange,
}: {
  courses: string[];
  onChange: (courses: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  function commit() {
    const val = draft.trim().toUpperCase();
    if (val && !courses.includes(val)) {
      onChange([...courses, val]);
    }
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && courses.length > 0) {
      onChange(courses.slice(0, -1));
    }
  }

  return (
    <div>
      {/* Tag area */}
      <div
        className={cn(
          "flex min-h-[44px] flex-wrap gap-1.5 rounded-xl border border-border bg-secondary/40 px-2.5 py-2 cursor-text transition-colors",
          "focus-within:border-violet-400 focus-within:bg-background focus-within:ring-2 focus-within:ring-violet-500/20"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {courses.map((code, i) => (
          <span
            key={code}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
              i === courses.length - 1
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                : "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
            )}
          >
            {code}
            <button
              type="button"
              aria-label={`Remove ${code}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(courses.filter((c) => c !== code));
              }}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={courses.length === 0 ? "e.g. MTH 201, PHY 301…" : "Add more…"}
          className="min-w-[100px] flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none py-0.5"
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        ↵ Enter to add · Backspace to remove last ·{" "}
        <span className="font-medium text-foreground">
          {courses.length} course{courses.length !== 1 ? "s" : ""} added
        </span>
      </p>
    </div>
  );
}

// ── GPA bar ────────────────────────────────────────────────────────────────────

function GpaSection({
  currentCgpa,
  targetCgpa,
  currentPrefilled,
  targetPrefilled,
  onCurrentChange,
  onTargetChange,
}: {
  currentCgpa: string;
  targetCgpa: string;
  currentPrefilled: boolean;
  targetPrefilled: boolean;
  onCurrentChange: (v: string) => void;
  onTargetChange: (v: string) => void;
}) {
  const cur  = parseFloat(currentCgpa) || 0;
  const tgt  = parseFloat(targetCgpa)  || 0;
  const pct  = Math.min(100, Math.max(0, (cur / 5) * 100));
  const diff = (tgt - cur).toFixed(2);
  const hasBoth = currentCgpa && targetCgpa;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        {/* Current */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current CGPA
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="5"
            value={currentCgpa}
            onChange={(e) => onCurrentChange(e.target.value)}
            placeholder="e.g. 3.20"
            className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[15px] font-semibold text-foreground outline-none transition focus:border-violet-400 focus:bg-background focus:ring-2 focus:ring-violet-500/20"
          />
          {currentPrefilled && (
            <p className="mt-1 text-[10px] text-[#5B35D5] dark:text-indigo-300">
              Pre-filled from your GPA calculator
            </p>
          )}
        </div>
        {/* Arrow */}
        <span className="pb-2.5 text-lg text-muted-foreground/50">→</span>
        {/* Target */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Target CGPA
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="5"
            value={targetCgpa}
            onChange={(e) => onTargetChange(e.target.value)}
            placeholder="e.g. 4.00"
            className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[15px] font-semibold text-foreground outline-none transition focus:border-violet-400 focus:bg-background focus:ring-2 focus:ring-violet-500/20"
          />
          {targetPrefilled && (
            <p className="mt-1 text-[10px] text-[#5B35D5] dark:text-indigo-300">
              Pre-filled from your GPA calculator
            </p>
          )}
        </div>
      </div>

      {/* Progress bar — only show when at least currentCgpa is filled */}
      {currentCgpa ? (
        <div className="rounded-xl bg-secondary/50 px-3 py-2.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px]">
            <span className="text-muted-foreground">{cur.toFixed(2)}</span>
            {hasBoth && (
              <span
                className={cn(
                  "font-semibold",
                  parseFloat(diff) > 0
                    ? "text-violet-600 dark:text-violet-400"
                    : parseFloat(diff) < 0
                    ? "text-rose-500"
                    : "text-muted-foreground"
                )}
              >
                Target: {tgt.toFixed(2)}{" "}
                ({parseFloat(diff) > 0 ? "+" : ""}{diff})
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Week Card (plan output) ────────────────────────────────────────────────────

function extractCourseCode(focus: string): string | null {
  const match = focus.match(/\b([A-Z]{2,4})\s*(\d{3})\b/);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

function WeekCard({
  week,
  weekIdx,
  progress,
  onToggle,
}: {
  week: StudyWeek;
  weekIdx: number;
  progress: Record<string, boolean>;
  onToggle: (key: string, val: boolean) => void;
}) {
  const [open, setOpen] = useState(week.week === 1);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-extrabold text-white">
              {week.week}
            </span>
            <p className="text-sm font-extrabold text-foreground">{week.theme}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{week.weeklyGoal}</p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground mb-3">
            Goal: <span className="text-foreground">{week.weeklyGoal}</span>
          </p>
          {week.days.map((d, dayIdx) => {
            const key  = `week-${weekIdx}-day-${dayIdx}`;
            const done = !!progress[key];
            return (
              <div
                key={d.day}
                className={cn(
                  "rounded-xl border p-3",
                  DAY_COLORS[d.day] ?? "bg-background border-border",
                  done && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => onToggle(key, e.target.checked)}
                      aria-label={`Mark ${d.day} complete`}
                      className="h-3.5 w-3.5 cursor-pointer accent-emerald-600"
                    />
                    <p className={cn("text-xs font-extrabold text-foreground", done && "line-through")}>
                      {d.day}
                    </p>
                    {done && <span className="text-emerald-600 text-xs font-semibold">✓</span>}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <Clock className="h-3 w-3" /> {d.hours}h
                  </span>
                </div>
                <p className={cn("text-xs font-semibold text-foreground mb-1.5", done && "line-through")}>
                  {d.focus}
                </p>
                <ul className="space-y-1">
                  {d.tasks.map((t, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                      {t}
                    </li>
                  ))}
                </ul>
                {(() => {
                  const code = extractCourseCode(d.focus);
                  if (!code || done) return null;
                  return (
                    <Link
                      href={`/study/practice?course=${encodeURIComponent(code)}&view=for_you`}
                      className={cn(
                        "mt-2 inline-flex items-center gap-1.5 rounded-xl",
                        "border border-[#AFA9EC] bg-[#EEEDFE]/70 px-3 py-1.5",
                        "text-[11px] font-extrabold text-[#3C3489] no-underline",
                        "transition hover:bg-[#EEEDFE]",
                        "dark:border-[#5B35D5]/40 dark:bg-[#5B35D5]/10",
                        "dark:text-indigo-200 dark:hover:bg-[#5B35D5]/20"
                      )}
                    >
                      <Zap className="h-3 w-3" />
                      Practice {code} now
                    </Link>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AiStudyPlanPage() {
  // ── Form state
  const [courses,       setCourses]       = useState<string[]>([]);
  const [currentCgpa,   setCurrentCgpa]   = useState("");
  const [targetCgpa,    setTargetCgpa]    = useState("");
  const [weeksUntilExam, setWeeksUntilExam] = useState(4);
  const [dailyHours,    setDailyHours]    = useState(4);
  const [weakCourses,   setWeakCourses]   = useState<string[]>([]);
  const [autoWeakSources, setAutoWeakSources] = useState<Array<{ code: string; avgPct: number }>>([]);

  // ── Prefill state
  const [prefilling,    setPrefilling]    = useState(true);
  const [prefillSource, setPrefillSource] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [cgpaPrefilled, setCgpaPrefilled] = useState(false);
  const [targetPrefilled, setTargetPrefilled] = useState(false);

  // ── Generation state
  const [loading,       setLoading]       = useState(false);
  const [streaming,     setStreaming]     = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error,         setError]         = useState<string | null>(null);
  const [plan,          setPlan]          = useState<StudyPlan | null>(null);

  // ── Persistence
  const [userId,      setUserId]      = useState<string | null>(null);
  const [savedPlan,   setSavedPlan]   = useState<StudyPlan | null>(null);
  const [savedPlanAt, setSavedPlanAt] = useState<string | null>(null);
  const [progress,    setProgress]    = useState<Record<string, boolean>>({});
  const currentCgpaRef = useRef(currentCgpa);
  const targetCgpaRef = useRef(targetCgpa);
  const progressSaveTimer = useRef<number | null>(null);

  // ── Derived
  const urgency = getUrgency(weeksUntilExam);

  useEffect(() => {
    currentCgpaRef.current = currentCgpa;
  }, [currentCgpa]);

  useEffect(() => {
    targetCgpaRef.current = targetCgpa;
  }, [targetCgpa]);

  // ── Pre-fill from Supabase preferences ────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function prefill() {
      setPrefilling(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        setUserId(user.id);
        // Fetch study personalization, preferences + latest saved plan
        const [personalization, { data: prefs }, { data: latestPlan, error: latestPlanError }] = await Promise.all([
          fetch("/api/study/personalization", { cache: "no-store" })
            .then((r) => r.json() as Promise<PersonalizationPayload>)
            .catch(() => null),
          supabase
            .from("study_preferences")
            .select("level, department, department_id, faculty, last_study_plan_at, last_study_plan_progress")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("study_plans")
            .select("plan, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const prefsData = (prefs as StudyPreferencesRow | null) ?? null;
        const personalizationOk = personalization?.ok === true;
        setProfileComplete(personalizationOk && personalization.profileStatus === "complete");
        const latestPlanMissingTable =
          latestPlanError?.code === "42P01" ||
          latestPlanError?.message?.includes("does not exist");
        const restoredPlan = latestPlanMissingTable
          ? null
          : parseStoredPlan((latestPlan as StudyPlanRow | null)?.plan);
        if (restoredPlan) {
          setSavedPlan(restoredPlan);
          setSavedPlanAt((latestPlan as StudyPlanRow | null)?.created_at ?? prefsData?.last_study_plan_at ?? null);
        }

        if (
          prefsData?.last_study_plan_progress &&
          typeof prefsData.last_study_plan_progress === "object" &&
          !Array.isArray(prefsData.last_study_plan_progress)
        ) {
          setProgress(prefsData.last_study_plan_progress as Record<string, boolean>);
        } else {
          try {
            const progressRaw = localStorage.getItem(`jabu_study_plan_progress:${user.id}`);
            if (progressRaw) {
              setProgress(JSON.parse(progressRaw) as Record<string, boolean>);
            }
          } catch {
            // silently ignore malformed progress
          }
        }

        const { data: gpaRow } = await supabase
          .from("study_gpa_data")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        let prefillCgpa: string | null = null;
        let prefillTarget: string | null = null;
        if (gpaRow?.data) {
          try {
            const parsed = JSON.parse(
              typeof gpaRow.data === "string" ? gpaRow.data : JSON.stringify(gpaRow.data)
            );
            const tt = parsed?.targetTool;
            if (tt?.currentCgpa && String(tt.currentCgpa).trim()) {
              prefillCgpa = String(tt.currentCgpa).trim();
            }
            if (tt?.targetCgpa && String(tt.targetCgpa).trim()) {
              prefillTarget = String(tt.targetCgpa).trim();
            }
          } catch {}
        }

        if (prefillCgpa && !currentCgpaRef.current) {
          setCurrentCgpa(prefillCgpa);
          setCgpaPrefilled(true);
        }
        if (prefillTarget && !targetCgpaRef.current) {
          setTargetCgpa(prefillTarget);
          setTargetPrefilled(true);
        }

        let paramCgpa = "";
        let paramTarget = "";
        try {
          const params = new URLSearchParams(window.location.search);
          paramCgpa = params.get("currentCgpa")?.trim() ?? "";
          paramTarget = params.get("targetCgpa")?.trim() ?? "";
        } catch {}
        const hasCurrentValue = !!(currentCgpaRef.current || prefillCgpa);
        const hasTargetValue = !!(targetCgpaRef.current || prefillTarget);

        if (paramCgpa && !hasCurrentValue) {
          setCurrentCgpa(paramCgpa);
          setCgpaPrefilled(true);
        }
        if (paramTarget && !hasTargetValue) {
          setTargetCgpa(paramTarget);
          setTargetPrefilled(true);
        }

        const personalizedCourses = personalizationOk && Array.isArray(personalization.courses)
          ? personalization.courses
          : [];

        if (personalizedCourses.length > 0) {
          const codes = personalizedCourses
            .map((course: { course_code?: string | null }) => String(course.course_code ?? "").trim().toUpperCase())
            .filter(Boolean);
          setCourses(codes);
          setPrefillSource(
            personalization?.scopeLabel ?? (prefsData?.department
              ? `${prefsData.level ? `${prefsData.level}L · ` : ""}${prefsData.department}`
              : prefsData?.level
              ? `${prefsData.level}L`
              : null)
          );

          try {
            type PracticeAttemptRow = {
              score: number | null;
              total_questions: number | null;
              study_quiz_sets?:
                | { course_code?: string | null }
                | Array<{ course_code?: string | null }>
                | null;
            };

            const { data: attempts } = await supabase
              .from("study_practice_attempts")
              .select("score, total_questions, study_quiz_sets(course_code)")
              .eq("user_id", user.id)
              .eq("status", "submitted")
              .not("score", "is", null)
              .not("total_questions", "is", null)
              .gt("total_questions", 0)
              .limit(150);

            if (!cancelled && attempts && attempts.length > 0) {
              const byCode = new Map<string, number[]>();
              for (const attempt of attempts as PracticeAttemptRow[]) {
                const joined = attempt.study_quiz_sets;
                const code = (
                  Array.isArray(joined) ? joined[0]?.course_code : joined?.course_code
                )?.trim().toUpperCase();
                if (!code) continue;
                const pct =
                  typeof attempt.score === "number" &&
                  typeof attempt.total_questions === "number" &&
                  attempt.total_questions > 0
                    ? Math.round((attempt.score / attempt.total_questions) * 100)
                    : null;
                if (pct === null) continue;
                if (!byCode.has(code)) byCode.set(code, []);
                byCode.get(code)!.push(pct);
              }

              const weak: Array<{ code: string; avgPct: number }> = [];
              for (const [code, pcts] of byCode.entries()) {
                if (pcts.length < 2) continue;
                const avgPct = Math.round(pcts.reduce((sum, pct) => sum + pct, 0) / pcts.length);
                if (avgPct < 60) weak.push({ code, avgPct });
              }

              const allowedCodes = new Set(codes.map((code) => code.trim().toUpperCase()));
              const eligibleWeak = weak.filter((item) => allowedCodes.has(item.code));
              if (eligibleWeak.length > 0) {
                setAutoWeakSources(eligibleWeak);
                setWeakCourses((prev) => {
                  const toAdd = eligibleWeak
                    .map((item) => item.code)
                    .filter((code) => !prev.includes(code));
                  return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
                });
              } else {
                setAutoWeakSources([]);
              }
            }
          } catch {
            // non-critical — silently fail
          }
        } else {
          setAutoWeakSources([]);
        }
      } catch {
        // silently fail — user can still type manually
      } finally {
        if (!cancelled) setPrefilling(false);
      }
    }

    prefill();
    return () => { cancelled = true; };
  }, []);

  // ── Generation ──────────────────────────────────────────────────────────────

  async function generate() {
    if (profileComplete === false) {
      setError("Complete your academic profile before generating a personalized study plan.");
      return;
    }
    const validCourses = courses.filter(Boolean);
    if (!validCourses.length) {
      setError("Add at least one course.");
      return;
    }
    setLoading(true);
    setStreaming(false);
    setStreamingText("");
    setError(null);
    setPlan(null);

    try {
      const res = await fetch("/api/ai/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courses: validCourses,
          currentCgpa:   currentCgpa ? parseFloat(currentCgpa) : null,
          targetCgpa:    targetCgpa  ? parseFloat(targetCgpa)  : null,
          weeksUntilExam,
          dailyHours,
          weakCourses,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as any).error ?? "Failed to generate plan.");
        return;
      }

      // Switch to streaming phase
      setLoading(false);
      setStreaming(true);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamingText(accumulated);
      }

      // Parse accumulated JSON
      try {
        const clean = accumulated
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const parsed = JSON.parse(clean) as StudyPlan;
        const generatedAt = new Date().toISOString();

        setPlan(parsed);
        setSavedPlan(parsed);
        setSavedPlanAt(generatedAt);
        setProgress({});

        if (userId) {
          try {
            localStorage.removeItem(`jabu_study_plan_progress:${userId}`);
          } catch {}
          const { error: planInsertError } = await supabase
            .from("study_plans")
            .insert({ user_id: userId, plan: parsed });
          if (
            planInsertError &&
            planInsertError.code !== "42P01" &&
            !planInsertError.message?.includes("does not exist")
          ) {
            console.error("[study-plan] failed to persist plan:", planInsertError.message);
          } else if (!planInsertError) {
            await supabase
              .from("study_preferences")
              .upsert(
                {
                  user_id: userId,
                  last_study_plan_at: generatedAt,
                  last_study_plan_progress: null,
                },
                { onConflict: "user_id" }
              );
          }
        }
      } catch {
        setError("The AI response was too long or malformed. Try fewer weeks or fewer courses.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setStreaming(false);
      setStreamingText("");
    }
  }

  function clearPlan() {
    if (userId) {
      try {
        localStorage.removeItem(`jabu_study_plan_progress:${userId}`);
      } catch {}
      supabase
        .from("study_preferences")
        .update({ last_study_plan_progress: null })
        .eq("user_id", userId)
        .then(
          () => {},
          () => {}
        );
    }
    setPlan(null);
    setSavedPlan(null);
    setSavedPlanAt(null);
    setProgress({});
  }

  function handleToggleDay(key: string, val: boolean) {
    setProgress((prev) => {
      const next = { ...prev, [key]: val };
      if (userId) {
        try {
          localStorage.setItem(`jabu_study_plan_progress:${userId}`, JSON.stringify(next));
        } catch {}
        if (progressSaveTimer.current) {
          window.clearTimeout(progressSaveTimer.current);
        }
        progressSaveTimer.current = window.setTimeout(async () => {
          try {
            await supabase
              .from("study_preferences")
              .upsert(
                {
                  user_id: userId,
                  last_study_plan_progress: next,
                },
                { onConflict: "user_id" }
              );
          } catch {
            // non-critical — localStorage is the fallback
          }
        }, 500);
      }
      return next;
    });
  }

  useEffect(() => {
    return () => {
      if (progressSaveTimer.current) {
        window.clearTimeout(progressSaveTimer.current);
      }
    };
  }, []);

  function exportAsText() {
    if (!plan) return;
    const lines: string[] = [`AI Study Plan — ${plan.totalWeeks} weeks`, ""];
    if (plan.summary) lines.push(plan.summary, "");
    if (plan.generalTips?.length) {
      lines.push("General Tips:");
      plan.generalTips.forEach((t) => lines.push(`  • ${t}`));
      lines.push("");
    }
    plan.weeks.forEach((w) => {
      lines.push(`Week ${w.week}: ${w.theme}`);
      lines.push(`Goal: ${w.weeklyGoal}`);
      w.days.forEach((d) => {
        lines.push(`  ${d.day} (${d.hours}h) — ${d.focus}`);
        d.tasks.forEach((t) => lines.push(`    - ${t}`));
      });
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "study-plan.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Toggle weak course ─────────────────────────────────────────────────────

  function toggleWeakCourse(code: string) {
    setWeakCourses((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  // When courses change, prune any weak selections that no longer exist
  useEffect(() => {
    setWeakCourses((prev) => prev.filter((c) => courses.includes(c)));
  }, [courses]);

  const planCompletionStats = useMemo(() => {
    if (!plan) return null;
    let totalDays = 0;
    let doneDays = 0;
    plan.weeks.forEach((w, wIdx) => {
      w.days.forEach((_, dIdx) => {
        totalDays++;
        if (progress[`week-${wIdx}-day-${dIdx}`]) doneDays++;
      });
    });
    if (totalDays === 0) return null;
    return {
      totalDays,
      doneDays,
      pct: Math.round((doneDays / totalDays) * 100),
      weeksTotal: plan.weeks.length,
      currentWeek: (() => {
        for (let wIdx = 0; wIdx < plan.weeks.length; wIdx++) {
          const w = plan.weeks[wIdx];
          const allDone = w.days.every((_, dIdx) => !!progress[`week-${wIdx}-day-${dIdx}`]);
          if (!allDone) return wIdx + 1;
        }
        return plan.weeks.length;
      })(),
    };
  }, [plan, progress]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 pb-28 md:pb-6">
      <StudyTabs />

      {/* ── Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/study"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card hover:bg-secondary/50 transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[17px] font-extrabold text-foreground">AI Study Plan</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-extrabold text-violet-600 dark:border-violet-700/40 dark:bg-violet-950/30 dark:text-violet-400">
              <Sparkles className="h-3 w-3" /> Gemini
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">Personalised week-by-week study schedule</p>
        </div>
      </div>

      {profileComplete === false ? (
        <div className="rounded-3xl border border-[#5B35D5]/20 bg-card p-5 shadow-sm">
          <p className="text-base font-extrabold text-foreground">Set up your academic profile first</p>
          <p className="mt-1 text-sm text-muted-foreground">
            AI Study Plan needs your official department, level, semester and courses to generate a useful plan.
          </p>
          <Link
            href="/study/onboarding?next=/study/ai-plan"
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#5B35D5] px-4 py-3 text-sm font-bold text-white no-underline hover:bg-[#4a2bb0]"
          >
            Complete setup <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}

      {savedPlan ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-foreground">Your last study plan</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Generated {savedPlanAt ? formatWhen(savedPlanAt) : "recently"} - {savedPlan.totalWeeks} weeks
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPlan(savedPlan)}
              className="rounded-xl border border-[#AFA9EC] px-3 py-1.5 text-xs font-bold text-[#5B35D5] transition hover:bg-[#EEEDFE] dark:border-[#5B35D5]/40 dark:text-indigo-200 dark:hover:bg-[#5B35D5]/10"
            >
              View →
            </button>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{savedPlan.summary}</p>
        </div>
      ) : null}

      {/* ── Prefill banner */}
      {prefilling ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Loading your courses…</p>
        </div>
      ) : prefillSource ? (
        <div className="flex items-center gap-2 rounded-xl border border-violet-200/60 bg-violet-50/60 px-3 py-2 dark:border-violet-700/30 dark:bg-violet-950/20">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <p className="text-[12px] font-semibold text-violet-700 dark:text-violet-300">
            Pre-filled from your profile ·{" "}
            <span className="font-normal">{prefillSource}</span>
          </p>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — COURSES
      ══════════════════════════════════════════════════════════════ */}
      <SectionCard
        icon="📚"
        iconBg="#EDE9FE"
        title="Your courses"
        sub="Type a code and press Enter to add"
      >
        <CourseTagInput courses={courses} onChange={setCourses} />
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — GOAL
      ══════════════════════════════════════════════════════════════ */}
      <SectionCard
        icon="🎯"
        iconBg="#D1FAE5"
        title="Your goal"
        sub="Optional — helps Gemini prioritise harder content"
      >
        <GpaSection
          currentCgpa={currentCgpa}
          targetCgpa={targetCgpa}
          currentPrefilled={cgpaPrefilled}
          targetPrefilled={targetPrefilled}
          onCurrentChange={(value) => {
            setCurrentCgpa(value);
            if (cgpaPrefilled) setCgpaPrefilled(false);
          }}
          onTargetChange={(value) => {
            setTargetCgpa(value);
            if (targetPrefilled) setTargetPrefilled(false);
          }}
        />
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — CAPACITY
      ══════════════════════════════════════════════════════════════ */}
      <SectionCard
        icon="⏱"
        iconBg="#FEF3C7"
        title="Study capacity"
        sub="Sets the pace and intensity of your plan"
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Weeks until exam */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Weeks until exam
            </span>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_OPTIONS.map((w) => {
                const isActive = weeksUntilExam === w;
                const urg      = getUrgency(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeeksUntilExam(w)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                      isActive
                        ? URGENCY_WEEK_CHIP[urg]
                        : "border-border bg-secondary/50 text-muted-foreground hover:border-border/80 hover:bg-secondary"
                    )}
                  >
                    {w}w
                  </button>
                );
              })}
            </div>
            {/* Urgency note */}
            <p className={cn("mt-0.5 text-[11px] font-semibold", URGENCY_NOTE_TEXT[urgency])}>
              {URGENCY_NOTE[urgency]}
            </p>
          </div>

          {/* Daily hours */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Daily study hours
            </span>
            <div className="flex flex-wrap gap-1.5">
              {HOURS_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDailyHours(h)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                    dailyHours === h
                      ? "border-violet-400 bg-violet-50 text-violet-800 dark:border-violet-700/60 dark:bg-violet-950/30 dark:text-violet-200"
                      : "border-border bg-secondary/50 text-muted-foreground hover:border-border/80 hover:bg-secondary"
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — WEAK COURSES
      ══════════════════════════════════════════════════════════════ */}
      <SectionCard
        icon="⚡"
        iconBg="#FEE2E2"
        title={
          <>
            Weak courses{" "}
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">optional</span>
          </>
        }
        sub="These get extra days in your plan — tick any you're struggling with"
      >
        {courses.length === 0 ? (
          <p className="text-[12px] text-muted-foreground py-1">
            Add courses above to select weak ones.
          </p>
        ) : (
          <>
            {autoWeakSources.length > 0 && (
              <div
                className={cn(
                  "mb-3 flex items-start gap-2 rounded-xl px-3 py-2.5",
                  "border border-amber-200/60 bg-amber-50/60",
                  "dark:border-amber-800/40 dark:bg-amber-950/20"
                )}
              >
                <span className="mt-0.5 text-amber-500 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  Auto-detected from your practice history:{" "}
                  {autoWeakSources.map((w) => `${w.code} (${w.avgPct}%)`).join(", ")}
                  . Pre-selected below — untick if wrong.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
            {courses.map((code) => {
              const isWeak = weakCourses.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleWeakCourse(code)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                    isWeak
                      ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200"
                      : "border-border bg-secondary/50 text-muted-foreground hover:border-amber-300 hover:bg-amber-50/50 dark:hover:border-amber-700/40 dark:hover:bg-amber-950/10"
                  )}
                >
                  {/* Checkbox dot */}
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[8px] font-extrabold transition",
                      isWeak
                        ? "border-amber-400 bg-amber-400 text-white"
                        : "border-border bg-background"
                    )}
                  >
                    {isWeak ? "✓" : ""}
                  </span>
                  {code}
                </button>
              );
            })}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Generate button */}
      <button
        type="button"
        onClick={generate}
        disabled={loading || streaming}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold transition",
          "bg-violet-600 text-white hover:bg-violet-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
          (loading || streaming) && "opacity-70 cursor-not-allowed"
        )}
      >
        {loading || streaming ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Generating your plan…</>
        ) : (
          <><Sparkles className="h-4 w-4" /> Generate Study Plan</>
        )}
      </button>

      {/* ── Streaming indicator */}
      {streaming && (
        <div className="rounded-2xl border border-violet-200/70 bg-violet-50/50 p-4 dark:border-violet-700/30 dark:bg-violet-950/20">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <p className="text-sm font-extrabold text-violet-700 dark:text-violet-300">
              Writing your plan…
            </p>
            <span className="ml-auto text-[11px] text-violet-400/80">
              {streamingText.length} chars
            </span>
          </div>
          <pre className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap max-h-40 overflow-hidden leading-relaxed">
            {streamingText.length > 600
              ? "…" + streamingText.slice(-580)
              : streamingText}
          </pre>
        </div>
      )}

      {/* Preview row — what the output contains */}
      {!plan && !loading && !streaming && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {[
            { dot: "#7C3AED", label: "Week-by-week schedule" },
            { dot: "#10B981", label: "Daily tasks" },
            { dot: "#F59E0B", label: "Study tips" },
            { dot: "#EF4444", label: "Progress tracking" },
          ].map(({ dot, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
              {label}
            </span>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PLAN OUTPUT
      ══════════════════════════════════════════════════════════════ */}
      {plan && (
        <div className="space-y-3">

          {/* Saved plan banner */}
          {savedPlanAt && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-2.5">
              <p className="text-xs text-muted-foreground">Generated {formatWhen(savedPlanAt)}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { clearPlan(); generate(); }}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={clearPlan}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Summary card */}
          <div className="rounded-2xl border border-violet-200/70 bg-violet-50/50 p-4 dark:border-violet-700/30 dark:bg-violet-950/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <p className="text-sm font-extrabold text-violet-700 dark:text-violet-300">Your Plan</p>
              <span className="ml-auto text-xs font-semibold text-violet-400/80">
                {plan.totalWeeks} weeks · Gemini
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{plan.summary}</p>
          </div>

          {/* General tips */}
          {plan.generalTips?.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-extrabold text-foreground">General Tips</p>
              </div>
              <ul className="space-y-2">
                {plan.generalTips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Week-by-week header */}
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-extrabold text-foreground">Week-by-Week Schedule</p>
          </div>

          {planCompletionStats && (
            <div className={cn("rounded-2xl border border-border bg-card px-4 py-3 shadow-sm")}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-foreground">
                    Week {planCompletionStats.currentWeek} of {planCompletionStats.weeksTotal}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {planCompletionStats.doneDays} of {planCompletionStats.totalDays} days complete
                  </p>
                </div>
                <span
                  className={cn(
                    "text-lg font-extrabold tabular-nums",
                    planCompletionStats.pct === 100
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[#5B35D5] dark:text-indigo-300"
                  )}
                >
                  {planCompletionStats.pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    planCompletionStats.pct === 100 ? "bg-emerald-500" : "bg-[#5B35D5]"
                  )}
                  style={{ width: `${planCompletionStats.pct}%` }}
                />
              </div>
              {planCompletionStats.pct === 100 && (
                <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Plan complete — well done!
                </p>
              )}
            </div>
          )}

          {/* Week cards */}
          {plan.weeks.map((w, weekIdx) => (
            <WeekCard
              key={w.week}
              week={w}
              weekIdx={weekIdx}
              progress={progress}
              onToggle={handleToggleDay}
            />
          ))}

          <p className="text-center text-[11px] text-muted-foreground px-4">
            AI can make mistakes. Adjust this plan based on your actual syllabus and exam schedule.
          </p>

          {/* Export */}
          <button
            type="button"
            onClick={exportAsText}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-border py-2.5 text-sm font-extrabold text-foreground hover:bg-secondary/50 transition"
          >
            Export as text
          </button>

          {/* Regenerate */}
          {!savedPlanAt && (
            <button
              type="button"
              onClick={generate}
              disabled={loading || streaming}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-200 py-2.5 text-sm font-extrabold text-violet-600",
                "hover:bg-violet-50 dark:border-violet-700/40 dark:text-violet-400 dark:hover:bg-violet-950/30 transition",
                (loading || streaming) && "opacity-60 cursor-not-allowed"
              )}
            >
              <Sparkles className="h-4 w-4" /> Regenerate Plan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
