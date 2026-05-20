"use client";
import { cn, formatWhen, normalizeQuery, buildHref, pctToColor } from "@/lib/utils";
import { getPracticeStreak } from "@/lib/studyPractice";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StudyTabs from "../_components/StudyTabs";
import { Card, EmptyState, SkeletonCard } from "../_components/StudyUI";
import { StudyPrefsProvider, useStudyPrefs } from "../_components/StudyPrefsContext";
import { RequestCourseModal } from "../_components/RequestCourseModal";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  GraduationCap,
  CheckCircle2,
  Clock,
  Hash,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
  SortAsc,
  SortDesc,
  Play,
  History,
  Flame,
  Layers,
  Loader2,
  Zap,
} from "lucide-react";

type SortKey = "newest" | "oldest";
const SORTS: Array<{ key: SortKey; label: string; icon: React.ReactNode }> = [
  { key: "newest", label: "Newest", icon: <SortDesc className="h-4 w-4" /> },
  { key: "oldest", label: "Oldest", icon: <SortAsc className="h-4 w-4" /> },
];

const LEVELS = ["100", "200", "300", "400", "500"] as const;
const SEMESTERS = ["1st", "2nd", "summer"] as const;
const PRACTICE_LEVEL_STORAGE_KEY = "jabu:practiceFilter:level";
const PRACTICE_SEMESTER_STORAGE_KEY = "jabu:practiceFilter:semester";

function semesterParamToStoredValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "1st" || normalized === "first") return "first";
  if (normalized === "2nd" || normalized === "second") return "second";
  if (normalized === "summer") return "summer";
  return "";
}

function storedSemesterToParam(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "first" || normalized === "1st") return "1st";
  if (normalized === "second" || normalized === "2nd") return "2nd";
  if (normalized === "summer") return "summer";
  return "";
}

type ViewKey = "for_you" | "recent" | "all";

type QuizSetRow = {
  id: string;
  title: string | null;
  description: string | null;

  course_code?: string | null;
  level?: number | null;
  semester?: string | null;

  published?: boolean | null;
  approved?: boolean | null;
  visibility?: "public" | "private" | "pending_review" | null;
  created_by?: string | null;
  source?: string | null;

  questions_count?: number | null;
  total_questions?: number | null;

  time_limit_minutes?: number | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  created_at?: string | null;
};

const PRACTICE_SET_BASE_FIELDS = [
  "id",
  "title",
  "description",
  "course_code",
  "level",
  "created_at",
  "created_by",
] as const;

const PRACTICE_SET_OPTIONAL_FIELDS = [
  "semester",
  "time_limit_minutes",
  "difficulty",
  "published",
  "questions_count",
  "visibility",
  "source",
] as const;

type PracticeSetOptionalField = (typeof PRACTICE_SET_OPTIONAL_FIELDS)[number];

function isMissingPracticeSetColumn(message: string, column: PracticeSetOptionalField) {
  const lower = message.toLowerCase();
  return lower.includes(`study_quiz_sets.${column}`) || lower.includes(`'${column}'`) || lower.includes(column);
}

function missingPracticeSetColumn(message: string) {
  return PRACTICE_SET_OPTIONAL_FIELDS.find((column) => isMissingPracticeSetColumn(message, column)) ?? null;
}

function practiceSetSelectFields(disabledColumns: Set<PracticeSetOptionalField>) {
  return [
    ...PRACTICE_SET_BASE_FIELDS,
    ...PRACTICE_SET_OPTIONAL_FIELDS.filter((field) => !disabledColumns.has(field)),
  ].join(",");
}

type LatestAttempt = {
  id: string;
  set_id: string | null;
  created_at: string | null;
  updated_at?: string | null;
  status?: string | null;

  score?: number | null;
  total_questions?: number | null;

  study_quiz_sets?: {
    id: string;
    title: string | null;
    course_code?: string | null;
  } | null;
};

// Per-set attempt summary â€" injected into QuizSetCard for personal context
type SetAttemptSummary = {
  attemptCount: number;         // total submitted attempts on this set
  bestPct: number | null;       // highest score % across submitted attempts
  lastPct: number | null;       // most recent submitted score %
  lastAttemptId: string | null; // id of the most recent submitted attempt
  inProgressId: string | null;  // id of an in_progress attempt, if any
  inProgressPct: number | null; // progress through in-progress attempt (answered/total)
};

type DuePracticeData = {
  total: number;
  sets: Array<{
    set_id: string;
    set_title: string;
    course_code: string | null;
    question_count: number;
    question_ids: string[];
    miss_counts: Record<string, number>;
  }>;
};

function Chip({
  active,
  children,
  onClick,
  title,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-border bg-secondary text-foreground"
          : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-background p-3">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm text-foreground outline-none"
      >
        <option value="">{placeholder ?? "All"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl border p-3 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked
          ? "border-border bg-secondary text-foreground"
          : "border-border/60 bg-background hover:bg-secondary/50"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {desc ? <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p> : null}
      </div>
      <div
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
          checked ? "border-border bg-background" : "border-border/60 bg-background"
        )}
      >
        {checked ? <CheckCircle2 className="h-4 w-4 text-foreground" /> : null}
      </div>
    </button>
  );
}

function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const first = root.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      first?.focus?.();
    }, 50);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        ref={panelRef}
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-t-3xl border border-border bg-card shadow-xl transition-transform",
          open ? "translate-y-0" : "translate-y-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-2xl border border-border bg-background",
              "hover:bg-secondary/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>

        {footer ? <div className="border-t border-border p-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function safeSemesterLabel(v?: string | null) {
  const s = (v ?? "").toString().trim().toLowerCase();
  if (!s) return "";
  if (s === "first") return "1st";
  if (s === "second") return "2nd";
  return s;
}

const DIFFICULTY_STYLES: Record<
  "easy" | "medium" | "hard",
  { label: string; className: string }
> = {
  easy:   { label: "Easy",   className: "border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300" },
  medium: { label: "Medium", className: "border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300" },
  hard:   { label: "Hard",   className: "border-rose-200/80 bg-rose-50/80 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-300" },
};

function DifficultyBadge({ difficulty }: { difficulty: "easy" | "medium" | "hard" }) {
  const s = DIFFICULTY_STYLES[difficulty];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-extrabold",
        s.className
      )}
    >
      {difficulty === "easy" ? "Easy" : difficulty === "medium" ? "Medium" : "Hard"}
    </span>
  );
}

function pill(text: string, icon?: React.ReactNode) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {icon ? icon : null}
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground",
        "hover:opacity-90 disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground",
        "hover:bg-secondary/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      {children}
    </button>
  );
}

function MiniTabs({ value, onChange }: { value: ViewKey; onChange: (v: ViewKey) => void }) {
  const items: Array<{ k: ViewKey; label: string; icon: React.ReactNode }> = [
    { k: "for_you", label: "For you", icon: <Sparkles className="h-4 w-4" /> },
    { k: "recent", label: "Recent", icon: <History className="h-4 w-4" /> },
    { k: "all", label: "All sets", icon: <Layers className="h-4 w-4" /> },
  ];

  return (
    <div className="flex w-full items-center gap-2 overflow-x-auto pb-0.5">
      {items.map((it) => {
        const active = value === it.k;
        return (
          <button
            key={it.k}
            type="button"
            onClick={() => onChange(it.k)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "bg-primary-light text-primary-text"
                : "bg-secondary text-muted-brand hover:bg-primary-light/50 hover:text-foreground"
            )}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// â"€â"€â"€ Score ring â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function PracticeHeroV2({
  dueLoading,
  dueData,
  streak,
  avgScore,
  totalSessions,
  quickLoading,
  displayName,
  onReviewDue,
  onQuickSession,
}: {
  dueLoading: boolean;
  dueData: DuePracticeData | null;
  streak: number;
  avgScore: number | null;
  totalSessions: number;
  quickLoading: boolean;
  displayName: string | null;
  onReviewDue: (setId: string) => void;
  onQuickSession: () => void;
}) {
  const hour = new Date().getHours();
  const timeLabel = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const firstName = displayName?.split(" ")[0] ?? "there";
  const primaryDueSet = dueData?.sets?.[0] ?? null;
  const dueCount = dueData?.total ?? 0;
  const dueCourses = dueData?.sets?.slice(0, 2).map((s) => s.course_code ?? s.set_title).filter(Boolean).join(" / ") ?? null;

  return (
    <section className="overflow-hidden rounded-[26px] border border-border bg-card p-5 shadow-sm">
      {/* Top row: greeting + streak */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-brand">
            Good {timeLabel}, {firstName}
          </p>
          <h1 className="mt-0.5 font-[family-name:var(--font-bricolage)] text-[30px] font-extrabold leading-none tracking-tight text-foreground">
            Practice
          </h1>
        </div>
        {streak > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-200/60 bg-orange-50 px-3 py-2 dark:border-orange-800/40 dark:bg-orange-950/30">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-extrabold text-orange-700 dark:text-orange-400">{streak}</span>
            <span className="text-[11px] font-bold text-orange-600 dark:text-orange-500">streak</span>
          </div>
        )}
      </div>

      {/* Stat pills */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <div className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5",
          dueCount > 0
            ? "border-primary/20 bg-primary-light text-primary-text"
            : "border-border bg-background text-muted-brand"
        )}>
          <CalendarClock className="h-3.5 w-3.5" />
          <span className="text-xs font-extrabold">
            {dueLoading ? "..." : dueCount + " due"}
          </span>
        </div>
        {avgScore !== null && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50/80 px-3 py-1.5 dark:border-emerald-800/40 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">{avgScore}% avg score</span>
          </div>
        )}
        {totalSessions > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-muted-brand">
            <History className="h-3.5 w-3.5" />
            <span className="text-xs font-extrabold">{totalSessions} sessions</span>
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="mt-4 flex flex-col gap-2">
        {dueCount > 0 && (
          <button
            type="button"
            onClick={primaryDueSet ? () => onReviewDue(primaryDueSet.set_id) : undefined}
            disabled={!primaryDueSet || dueLoading}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-[18px] bg-primary px-5 py-3.5 text-left transition",
              "hover:opacity-90 disabled:opacity-60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              "shadow-[0_4px_18px_rgba(91,53,213,0.28)]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/20">
                <CalendarClock className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-white">Review {dueCount} due card{dueCount !== 1 ? "s" : ""}</p>
                {dueCourses && (
                  <p className="text-[11px] text-white/60">{dueCourses}</p>
                )}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/80" />
          </button>
        )}
        <button
          type="button"
          onClick={onQuickSession}
          disabled={quickLoading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-[18px] border border-border px-5 py-3 transition",
            "hover:bg-secondary/60 disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          )}
        >
          {quickLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Zap className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-bold text-foreground">Quick session</span>
        </button>
      </div>
    </section>
  );
}

function CourseChipsBar({
  courseCodes,
  activeCourse,
  onSelect,
}: {
  courseCodes: string[];
  activeCourse: string;
  onSelect: (code: string) => void;
}) {
  const codes = ["", ...Array.from(new Set(courseCodes.map((c) => c.toUpperCase()))).sort()];
  if (codes.length <= 1) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      {codes.map((code) => {
        const isActive = code === activeCourse.toUpperCase();
        return (
          <button
            key={code || "all"}
            type="button"
            onClick={() => onSelect(code)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "border-primary bg-primary text-white"
                : "border-border bg-card text-foreground hover:bg-secondary/60"
            )}
          >
            {code ? <Hash className="h-3 w-3" /> : null}
            {code || "All"}
          </button>
        );
      })}
    </div>
  );
}

function ScoreRingSmall({ pct }: { pct: number | null }) {
  const size = 48;
  const r = 19;
  const cx = 24;
  const circ = 2 * Math.PI * r;
  const offset = pct != null ? circ * (1 - Math.max(0, Math.min(100, pct)) / 100) : circ;
  const color = pct != null ? pctToColor(pct) : undefined;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0 }} aria-label={pct != null ? `Best score: ${pct}%` : "Not attempted"}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" strokeWidth={3} opacity={0.12} />
      {pct != null && (
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`} />
      )}
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
        fontSize={10} fontWeight={500} fill="currentColor">
        {pct != null ? `${pct}%` : "—"}
      </text>
    </svg>
  );
}

// â"€â"€â"€ Quiz set card â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function QuizSetCard({
  s,
  onStart,
  summary,
  currentUserId,
}: {
  s: QuizSetRow;
  onStart: () => void;
  summary?: SetAttemptSummary | null;
  currentUserId?: string | null;
}) {
  const title = (s.title ?? "Untitled set").trim() || "Untitled set";
  const code = (s.course_code ?? "").toString().trim().toUpperCase();
  const qCount =
    typeof s.questions_count === "number"
      ? s.questions_count
      : typeof s.total_questions === "number"
      ? s.total_questions
      : null;

  const hasInProgress = Boolean(summary?.inProgressId);
  const hasSubmitted  = (summary?.attemptCount ?? 0) > 0;
  const bestPct       = summary?.bestPct ?? null;
  const isMastered    = bestPct != null && bestPct >= 70;
  const isPrivate = s.visibility === "private" && s.created_by === currentUserId;

  return (
    <Card className={cn(
      "w-full max-w-full overflow-hidden rounded-3xl p-4",
      isMastered && "border-emerald-300/40 dark:border-emerald-700/30"
    )}>
      <div className="flex min-w-0 items-center gap-3">
        {/* Score ring or fallback icon */}
        <div className="shrink-0">
          {hasSubmitted || hasInProgress ? (
            <ScoreRingSmall pct={bestPct} />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-light">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>

        {/* Middle: title + meta + context */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{title}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {code ? (
              <span className="inline-block rounded-md bg-primary-light px-1.5 py-0.5 text-[10px] font-extrabold text-primary-text">
                {code}
              </span>
            ) : null}
            {qCount !== null ? (
              <span className="text-[11px] font-semibold text-muted-brand">{qCount} Q</span>
            ) : null}
            {s.difficulty ? <DifficultyBadge difficulty={s.difficulty} /> : null}
            {isPrivate && (
              <span className="rounded-full border border-amber-300/40 bg-amber-100/30 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                Private
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {hasInProgress && !hasSubmitted ? (
              <>
                <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-100/30 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  In progress
                </span>
                {summary?.inProgressPct != null && (
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {summary.inProgressPct}% answered
                  </span>
                )}
              </>
            ) : hasSubmitted ? (
              <>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {summary!.attemptCount}&times; tried
                </span>
                {bestPct != null && (
                  <span className="text-[11px] font-extrabold" style={{ color: pctToColor(bestPct) }}>
                    Best {bestPct}%
                  </span>
                )}
                {isMastered && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Mastered
                  </span>
                )}
                {hasInProgress && (
                  <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-100/30 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                    Resume available
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] font-semibold text-muted-foreground">Not attempted yet</span>
            )}
          </div>
        </div>

        {/* Arrow button */}
        <button
          type="button"
          onClick={onStart}
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary transition",
            "hover:opacity-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          )}
          aria-label={hasInProgress ? "Continue" : hasSubmitted ? "Retry" : "Start"}
        >
          <ArrowRight className="h-4 w-4 text-white" />
        </button>
      </div>
    </Card>
  );
}

// â"€â"€â"€ Rep status â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// â"€â"€â"€ Create Set Drawer â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// â"€â"€â"€ "Suggested for today" widget â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function SuggestedTodayWidget() {
  const [suggestion, setSuggestion] = React.useState<{
    courseCode: string;
    setId: string;
    setTitle: string;
  } | null>(null);
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // Check if user has any completed attempts
        const { data: attempts } = await supabase
          .from("study_practice_attempts")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "submitted")
          .limit(1);
        if (!attempts?.length || cancelled) return;

        // Find courses with most weak questions due (join to get course_code)
        const { data: weakRows } = await supabase
          .from("study_weak_questions")
          .select(`
            question_id,
            study_quiz_questions!inner(
              set_id,
              study_quiz_sets!inner(id, course_code)
            )
          `)
          .eq("user_id", user.id)
          .is("graduated_at", null)
          .limit(50);
        if (!weakRows?.length || cancelled) return;

        // Count by course_code from the nested join
        const counts: Record<string, number> = {};
        for (const r of weakRows as any[]) {
          const code = r?.study_quiz_questions?.study_quiz_sets?.course_code;
          if (code) counts[code] = (counts[code] ?? 0) + 1;
        }
        const topCourse = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!topCourse || cancelled) return;

        // Find a published quiz set for that course
        const { data: sets } = await supabase
          .from("study_quiz_sets")
          .select("id, title")
          .eq("course_code", topCourse)
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(1);
        if (!sets?.length || cancelled) return;

        const set = (sets as any[])[0];
        setSuggestion({ courseCode: topCourse, setId: set.id, setTitle: set.title ?? "Practice set" });
      } catch {
        // silent
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!checked || !suggestion) return null;

  return (
    <div className="rounded-3xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/[0.07] text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Suggested for today</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            Based on your weak areas in {suggestion.courseCode}, try this set.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{suggestion.setTitle}</p>
          <Link
            href={`/study/practice/${encodeURIComponent(suggestion.setId)}`}
            className={cn(
              "mt-3 inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-sm font-extrabold text-foreground no-underline",
              "hover:opacity-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            Start <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PracticeHomeClient() {
  return (
    <StudyPrefsProvider>
      <PracticeHomeInner />
    </StudyPrefsProvider>
  );
}

function PracticeHomeInner() {
  const {
    isProfileComplete,
    userId: authedUserId,
    displayName,
    courseCodes,
    prefs: contextPrefs,
  } = useStudyPrefs();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // URL params
  const qParam = sp.get("q") ?? "";
  const courseParam = sp.get("course") ?? "";
  const levelParam = sp.get("level") ?? "";
  const semesterParam = sp.get("semester") ?? "";
  const sortParam = (sp.get("sort") ?? "newest") as SortKey;
  const difficultyParam = sp.get("difficulty") ?? "";

  // view tab
  const viewParam = (sp.get("view") ?? "for_you") as ViewKey;

  // published-only toggle
  const publishedParam = sp.get("published") ?? "";
  const publishedOnly = publishedParam === "1";
  const personalizedOff = sp.get("personalized") === "0";

  // Local state
  const [q, setQ] = useState(qParam);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  // Preview sheet
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSet, setPreviewSet] = useState<QuizSetRow | null>(null);
  const [previewMode, setPreviewMode] = useState<"exam" | "study">("exam");

  // Drawer drafts
  const [draftCourse, setDraftCourse] = useState(courseParam);
  const [draftLevel, setDraftLevel] = useState(levelParam);
  const [draftSemester, setDraftSemester] = useState(semesterParam);
  const [draftSort, setDraftSort] = useState<SortKey>(sortParam);
  const [draftPublished, setDraftPublished] = useState(publishedOnly);
  const [draftDifficulty, setDraftDifficulty] = useState(difficultyParam);
  const filterBootstrapRef = useRef(false);
  const [filterStorageReady, setFilterStorageReady] = useState(false);

  // Data
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sets, setSets] = useState<QuizSetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schemaHint, setSchemaHint] = useState<string | null>(null);

  // Streak
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    if (!authedUserId) return;
    getPracticeStreak().then(({ streak: s }) => setStreak(s)).catch(() => {});
  }, [authedUserId]);

  // Due Today (SRS)
  const [dueData, setDueData] = useState<DuePracticeData | null>(null);
  const [dueLoading, setDueLoading] = useState(true);
  const [quickLoading, setQuickLoading] = useState(false);

  // Attempts
  const [recentAttempts, setRecentAttempts] = useState<LatestAttempt[]>([]);

  // User prefs â€" used to personalize the "For you" tab without requiring URL params
  const [userPrefs, setUserPrefs] = useState<{
    course_code?: string | null;
    level?: number | null;
    semester?: string | null;
    department_id?: string | null;
    faculty_id?: string | null;
  } | null>(null);

  // Load user prefs once on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) return;
        const { data } = await supabase
          .from("study_preferences")
          .select("level, semester, department_id, faculty_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data) setUserPrefs(data as any);
      } catch {
        // non-fatal â€" for_you falls back to URL params only
      }
    })();
  }, []);

  // toast
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Pagination
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);

  const filtersKey = useMemo(() => {
    return [
      normalizeQuery(qParam),
      courseParam.trim().toUpperCase(),
      levelParam,
      semesterParam,
      difficultyParam,
      sortParam,
      publishedOnly ? "p1" : "p0",
      viewParam,
      personalizedOff ? "personalized0" : "personalized1",
      courseCodes.join(","),
      authedUserId ?? "anon",
    ].join("|");
  }, [qParam, courseParam, levelParam, semesterParam, difficultyParam, sortParam, publishedOnly, viewParam, personalizedOff, courseCodes, authedUserId]);

  useEffect(() => setQ(qParam), [qParam]);

  useEffect(() => {
    let savedLevel = "";
    let savedSemester = "";

    try {
      savedLevel = localStorage.getItem(PRACTICE_LEVEL_STORAGE_KEY) ?? "";
      savedSemester = localStorage.getItem(PRACTICE_SEMESTER_STORAGE_KEY) ?? "";
    } catch {
      setFilterStorageReady(true);
      return;
    }

    const nextLevel = levelParam || savedLevel;
    const nextSemester = semesterParam || storedSemesterToParam(savedSemester);

    if (nextLevel !== levelParam || nextSemester !== semesterParam) {
      filterBootstrapRef.current = true;
      router.replace(
        buildHref(pathname, {
          q: qParam || null,
          course: courseParam || null,
          level: nextLevel || null,
          semester: nextSemester || null,
          difficulty: difficultyParam || null,
          sort: sortParam !== "newest" ? sortParam : null,
          published: publishedOnly ? "1" : null,
          view: viewParam !== "for_you" ? viewParam : null,
        })
      );
      return;
    }

    setFilterStorageReady(true);
  }, []);

  useEffect(() => {
    if (filterBootstrapRef.current) {
      filterBootstrapRef.current = false;
      setFilterStorageReady(true);
      return;
    }

    if (!filterStorageReady) return;

    try {
      if (levelParam) localStorage.setItem(PRACTICE_LEVEL_STORAGE_KEY, levelParam);
      else localStorage.removeItem(PRACTICE_LEVEL_STORAGE_KEY);

      const storedSemester = semesterParamToStoredValue(semesterParam);
      if (storedSemester) localStorage.setItem(PRACTICE_SEMESTER_STORAGE_KEY, storedSemester);
      else localStorage.removeItem(PRACTICE_SEMESTER_STORAGE_KEY);
    } catch {
      // localStorage is best-effort only
    }
  }, [filterStorageReady, levelParam, semesterParam]);

  // debounce search to URL
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const qNorm = normalizeQuery(q);
    if (qNorm === normalizeQuery(qParam)) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      router.replace(
        buildHref(pathname, {
          q: qNorm || null,
          course: courseParam || null,
          level: levelParam || null,
          semester: semesterParam || null,
          sort: sortParam !== "newest" ? sortParam : null,
          published: publishedOnly ? "1" : null,
          view: viewParam !== "for_you" ? viewParam : null,
        })
      );
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, qParam, router, pathname, courseParam, levelParam, semesterParam, sortParam, publishedOnly, viewParam]);

  // Reset list when filters change
  useEffect(() => {
    setPage(1);
    setSets([]);
    setHasMore(false);
    setTotal(0);
  }, [filtersKey]);

  // Load Due Today count on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setDueLoading(true);
        const res = await fetch("/api/study/practice/due");
        if (!mounted) return;
        if (res.ok) {
          const json = await res.json();
          setDueData(json);
        }
      } catch {
        // non-fatal â€" Due Today card just stays hidden
      } finally {
        if (mounted) setDueLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load latest + recent attempts
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          if (mounted) {
            setRecentAttempts([]);
          }
          return;
        }

        const res = await supabase
          .from("study_practice_attempts")
          .select(
            `
            id,set_id,created_at,updated_at,status,score,total_questions,
            study_quiz_sets(id,title,course_code)
          `
          )
          .eq("user_id", uid)
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6);

        if (!mounted) return;

        if (res.error) {
          setRecentAttempts([]);
          return;
        }

        const rows = ((res.data as any[]) ?? []).filter(Boolean) as LatestAttempt[];
        setRecentAttempts(rows.slice(0, 6));
      } catch {
        if (mounted) {
          setRecentAttempts([]);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Load user prefs for personalised For You scoring
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) return;
        const { data, error } = await supabase
          .from("study_preferences")
          .select("department_id,faculty_id,level,semester")
          .eq("user_id", uid)
          .maybeSingle();
        if (!mounted || error || !data) return;
        setUserPrefs({
          department_id: (data as any).department_id ?? null,
          faculty_id: (data as any).faculty_id ?? null,
          level: (data as any).level ?? null,
          semester: (data as any).semester ?? null,
        });
      } catch { /* prefs are optional */ }
    })();
    return () => { mounted = false; };
  }, []);

  // â"€â"€ Per-set attempt summaries â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  // Loaded whenever the visible set list changes. Gives each card personal
  // context: best score, attempt count, in-progress state.
  const [setAttemptMap, setSetAttemptMap] = useState<Record<string, SetAttemptSummary>>({});

  useEffect(() => {
    const setIds = sets.map((s) => s.id).filter(Boolean);
    if (!setIds.length) return;

    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) return;

        // Fetch all attempts for visible sets in one query
        const { data, error } = await supabase
          .from("study_practice_attempts")
          .select("id,set_id,status,score,total_questions")
          .eq("user_id", uid)
          .in("set_id", setIds);

        if (cancelled || error || !data) return;

        // Group by set_id and compute summary
        const map: Record<string, SetAttemptSummary> = {};

        for (const row of data as any[]) {
          const sid = String(row.set_id);
          if (!map[sid]) {
            map[sid] = {
              attemptCount: 0,
              bestPct: null,
              lastPct: null,
              lastAttemptId: null,
              inProgressId: null,
              inProgressPct: null,
            };
          }

          const s = map[sid];
          const isSubmitted = row.status === "submitted";
          const isInProgress = row.status === "in_progress";

          if (isSubmitted) {
            s.attemptCount += 1;
            s.lastAttemptId = s.lastAttemptId ?? String(row.id);

            if (
              typeof row.score === "number" &&
              typeof row.total_questions === "number" &&
              row.total_questions > 0
            ) {
              const pct = Math.round((row.score / row.total_questions) * 100);
              // Track last (first encountered = most recent due to DB ordering)
              if (s.lastPct === null) s.lastPct = pct;
              // Track best
              if (s.bestPct === null || pct > s.bestPct) s.bestPct = pct;
            }
          }

          if (isInProgress && !s.inProgressId) {
            s.inProgressId = String(row.id);
            if (
              typeof row.score === "number" &&
              typeof row.total_questions === "number" &&
              row.total_questions > 0
            ) {
              s.inProgressPct = Math.round((row.score / row.total_questions) * 100);
            }
          }
        }

        if (!cancelled) setSetAttemptMap(map);
      } catch {
        // Non-fatal â€" cards just show without personal context
      }
    })();

    return () => { cancelled = true; };
  }, [sets]);

  async function fetchPage(nextPage: number) {
    const isFirst = nextPage === 1;

    if (isFirst) {
      setLoading(true);
      setLoadError(null);
      setSchemaHint(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const from = (nextPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const disabledColumns = new Set<PracticeSetOptionalField>();

      const buildQuery = () => {
        let query = supabase
          .from("study_quiz_sets")
          .select(practiceSetSelectFields(disabledColumns), { count: "exact" });

        if (!disabledColumns.has("published")) {
          query = query.eq("published", true);
        }

        const qNorm = normalizeQuery(qParam);
        const hasVisibility = !disabledColumns.has("visibility");
        if (authedUserId) {
          if (qNorm) {
            query = query.or(
              hasVisibility
                ? [
                    `and(visibility.eq.public,title.ilike.%${qNorm}%)`,
                    `and(visibility.eq.public,description.ilike.%${qNorm}%)`,
                    `and(visibility.eq.public,course_code.ilike.%${qNorm}%)`,
                    `and(created_by.eq.${authedUserId},title.ilike.%${qNorm}%)`,
                    `and(created_by.eq.${authedUserId},description.ilike.%${qNorm}%)`,
                    `and(created_by.eq.${authedUserId},course_code.ilike.%${qNorm}%)`,
                  ].join(",")
                : `title.ilike.%${qNorm}%,description.ilike.%${qNorm}%,course_code.ilike.%${qNorm}%`
            );
          } else if (hasVisibility) {
            query = query.or(`visibility.eq.public,created_by.eq.${authedUserId}`);
          }
        } else {
          if (hasVisibility) query = query.eq("visibility", "public");
          if (qNorm) {
            query = query.or(`title.ilike.%${qNorm}%,description.ilike.%${qNorm}%,course_code.ilike.%${qNorm}%`);
          }
        }

        const course = courseParam.trim().toUpperCase();
        if (course) query = query.eq("course_code", course);
        else if (viewParam === "for_you" && !personalizedOff && courseCodes.length > 0) {
          query = query.in("course_code", courseCodes);
        }

        if (levelParam) {
          const lv = Number(levelParam);
          if (Number.isFinite(lv)) query = query.eq("level", lv);
        } else if (viewParam === "for_you" && !personalizedOff && typeof contextPrefs?.level === "number") {
          query = query.eq("level", contextPrefs.level);
        }

        if (!disabledColumns.has("semester")) {
          if (semesterParam) {
            const semMap: Record<string, string> = { "1st": "first", "2nd": "second", summer: "summer" };
            const s = semMap[semesterParam.trim()] ?? semesterParam.trim().toLowerCase();
            if (s) query = query.eq("semester", s);
          } else if (viewParam === "for_you" && !personalizedOff && contextPrefs?.semester) {
            const semMap: Record<string, string> = { "1st": "first", "2nd": "second", summer: "summer" };
            const s = semMap[contextPrefs.semester.trim()] ?? contextPrefs.semester.trim().toLowerCase();
            if (s) query = query.eq("semester", s);
          }
        }

        if (!disabledColumns.has("difficulty") && difficultyParam) {
          const d = difficultyParam.trim().toLowerCase();
          if (d === "easy" || d === "medium" || d === "hard") {
            query = query.eq("difficulty", d);
          }
        }

        if (sortParam === "oldest") query = query.order("created_at", { ascending: true });
        else query = query.order("created_at", { ascending: false });

        return query.range(from, to);
      };

      let res = await buildQuery();
      while (res.error) {
        const missingColumn = missingPracticeSetColumn(res.error.message || "");
        if (!missingColumn || disabledColumns.has(missingColumn)) break;

        disabledColumns.add(missingColumn);
        setSchemaHint(
          `Your database is missing optional practice set column "${missingColumn}". The list is loading without that metadata; run the latest Supabase migrations to restore the full filters.`
        );
        res = await buildQuery();
      }

      if (res.error) {
        const msg = res.error.message || "Unknown error";
        setLoadError(msg);

        if (
          msg.includes("published") ||
          msg.includes("visibility") ||
          msg.includes("approved") ||
          msg.includes("questions_count") ||
          msg.includes("time_limit_minutes") ||
          msg.includes("difficulty") ||
          msg.includes("semester")
        ) {
          setSchemaHint(
            "Some optional columns are missing (e.g., semester/time_limit/difficulty/questions_count/published). Run the latest Supabase migrations to restore the full practice set experience."
          );
        }

        if (isFirst) {
          setSets([]);
          setTotal(0);
        }
        return;
      }

      const totalCount = res.count ?? 0;
      setTotal(totalCount);

      const rows = ((res.data as any[]) ?? []).filter(Boolean) as QuizSetRow[];

      setSets((prev) => {
        if (isFirst) return rows;
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const r of rows) if (!seen.has(r.id)) merged.push(r);
        return merged;
      });

      const loaded = (nextPage - 1) * PAGE_SIZE + rows.length;
      setHasMore(loaded < totalCount);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  function openFilters() {
    setDraftCourse(courseParam);
    setDraftLevel(levelParam);
    setDraftSemester(semesterParam);
    setDraftSort(sortParam);
    setDraftPublished(publishedOnly);
    setDraftDifficulty(difficultyParam);
    setDrawerOpen(true);
  }

  function applyFilters() {
    router.replace(
      buildHref(pathname, {
        q: normalizeQuery(q) || null,
        course: draftCourse.trim().toUpperCase() || null,
        level: draftLevel || null,
        semester: draftSemester || null,
        difficulty: draftDifficulty || null,
        sort: draftSort !== "newest" ? draftSort : null,
        published: draftPublished ? "1" : null,
        view: viewParam !== "for_you" ? viewParam : null,
      })
    );
    setDrawerOpen(false);
  }

  function clearAll() {
    setQ("");
    router.replace(buildHref(pathname, { view: viewParam !== "for_you" ? viewParam : null }));
  }

  function setView(v: ViewKey) {
    router.replace(
      buildHref(pathname, {
        q: qParam || null,
        course: courseParam || null,
        level: levelParam || null,
        semester: semesterParam || null,
        sort: sortParam !== "newest" ? sortParam : null,
        published: publishedOnly ? "1" : null,
        view: v !== "for_you" ? v : null,
      })
    );
  }

  const hasAnyFilters = Boolean(
    qParam ||
      courseParam ||
      levelParam ||
      semesterParam ||
      difficultyParam ||
      (sortParam && sortParam !== "newest") ||
      publishedOnly
  );

  const activeSortLabel = SORTS.find((s) => s.key === sortParam)?.label ?? "Newest";
  const showingFrom = total === 0 ? 0 : 1;
  const showingTo = Math.min(total, sets.length);

  const forYouSets = useMemo(() => {
    if (!sets.length) return [];

    // URL params take priority; fall back to loaded user prefs
    const wantCourse = (courseParam.trim() || "").toUpperCase();
    const wantLevel =
      levelParam
        ? Number(levelParam)
        : typeof userPrefs?.level === "number"
        ? userPrefs.level
        : NaN;
    const wantSem =
      semesterParam.trim().toLowerCase() ||
      (userPrefs?.semester ?? "").toLowerCase();

    const scored = sets.map((s) => {
      let score = 0;
      const code = (s.course_code ?? "").toString().trim().toUpperCase();

      // Strong match: exact course code
      if (wantCourse && code === wantCourse) score += 3;

      // Level match: from prefs or URL param
      if (
        Number.isFinite(wantLevel) &&
        typeof s.level === "number" &&
        s.level === wantLevel
      )
        score += 2;

      // Semester match
      if (
        wantSem &&
        (s.semester ?? "").toString().trim().toLowerCase() === wantSem
      )
        score += 1;

      // Difficulty score: prefer sets appropriate for user's level
      // Upper levels (400+) get a boost for harder sets; lower levels for easier ones.
      const diff = (s.difficulty ?? "").toLowerCase();
      if (Number.isFinite(wantLevel)) {
        if (wantLevel >= 400 && diff === "hard")   score += 1.5;
        if (wantLevel >= 300 && diff === "medium")  score += 0.5;
        if (wantLevel <= 200 && diff === "easy")    score += 1.5;
        if (wantLevel <= 200 && diff === "hard")    score -= 1;
      }

      // Slight recency boost
      if (s.created_at) score += 0.2;

      const summary = setAttemptMap[s.id];
      const bestPct = summary?.bestPct ?? null;
      const neverAttempted = bestPct === null && !summary?.inProgressId;

      if (neverAttempted) score += 2;
      if (bestPct !== null && bestPct >= 70) score -= 2;
      if (bestPct !== null && bestPct < 50) score += 1;

      return { s, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.s);
  }, [sets, courseParam, levelParam, semesterParam, userPrefs, setAttemptMap]);

  const visibleSets = useMemo(() => {
    if (viewParam === "for_you") return forYouSets.length ? forYouSets : sets;
    return sets;
  }, [viewParam, forYouSets, sets]);

  const resumeAttempt = useMemo(
    () => recentAttempts.find((attempt) => attempt.status === "in_progress" && attempt.set_id) ?? null,
    [recentAttempts]
  );

  const timedExamSet = useMemo(() => {
    const seen = new Set<string>();
    const candidates = [...visibleSets, ...forYouSets, ...sets].filter((set) => {
      if (!set.id || seen.has(set.id)) return false;
      seen.add(set.id);
      return true;
    });

    return candidates.find((set) => (set.time_limit_minutes ?? 0) > 0) ?? null;
  }, [visibleSets, forYouSets, sets]);

  const showRecentEmpty = viewParam === "recent" && recentAttempts.length === 0;

  const attemptedSummaries = Object.values(setAttemptMap).filter((s) => s.bestPct !== null);
  const avgScore = attemptedSummaries.length
    ? Math.round(attemptedSummaries.reduce((sum, s) => sum + s.bestPct!, 0) / attemptedSummaries.length)
    : null;
  const totalSessions = Object.values(setAttemptMap).reduce((sum, s) => sum + s.attemptCount, 0);

  function openPreview(s: QuizSetRow) {
    setPreviewSet(s);
    setPreviewMode("exam"); // reset to default each time
    setPreviewOpen(true);
  }

  function startSet(id: string, mode: "exam" | "study" = "exam") {
    const url = mode === "study"
      ? `/study/practice/${id}?mode=study`
      : `/study/practice/${id}`;
    router.push(url);
  }

  async function handleQuickSession() {
    if (quickLoading) return;
    setQuickLoading(true);
    let navigated = false;
    try {
      const level = contextPrefs?.level ?? userPrefs?.level ?? null;
      const semester = contextPrefs?.semester ?? userPrefs?.semester ?? null;
      const semMap: Record<string, string> = { "1st": "first", "2nd": "second", summer: "summer" };
      const normalizedSemester = semester
        ? semMap[semester.trim()] ?? semester.trim().toLowerCase()
        : null;

      let query = supabase
        .from("study_quiz_sets")
        .select("id, title, questions_count, total_questions, level, semester")
        .eq("published", true)
        .eq("visibility", "public")
        .gt("questions_count", 4);

      if (typeof level === "number") query = query.eq("level", level);
      if (normalizedSemester) query = query.eq("semester", normalizedSemester);
      if (courseCodes.length > 0) query = query.in("course_code", courseCodes);

      const { data: candidates } = await query.limit(20);
      const preferred = ((candidates ?? []) as QuizSetRow[]).filter((row) => typeof row.id === "string");

      if (preferred.length > 0) {
        const pick = preferred[Math.floor(Math.random() * preferred.length)];
        navigated = true;
        startSet(pick.id, "study");
        return;
      }

      const { data: fallback } = await supabase
        .from("study_quiz_sets")
        .select("id")
        .eq("published", true)
        .eq("visibility", "public")
        .gt("questions_count", 4)
        .limit(20);

      const fallbackRows = ((fallback ?? []) as Array<{ id: string }>).filter((row) => typeof row.id === "string");
      if (fallbackRows.length === 0) return;

      const pick = fallbackRows[Math.floor(Math.random() * fallbackRows.length)];
      navigated = true;
      startSet(pick.id, "study");
    } catch {
      // non-fatal â€" button simply stops loading
    } finally {
      if (!navigated) setQuickLoading(false);
    }
  }

  return (
    // FIX: prevent any horizontal overflow across the whole page
    <div className="w-full max-w-full overflow-x-hidden space-y-4 pb-28 md:pb-6">
      <StudyTabs />

      {/* M-7: Onboarding nudge */}
      {!isProfileComplete && (
        <Link
          href="/study/onboarding"
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-light px-4 py-3 text-sm font-semibold text-primary-text no-underline hover:bg-primary/10 dark:border-primary/30 dark:bg-primary/10 dark:text-indigo-200"
        >
          <span><strong>Tip:</strong> Set your department to personalise your practice sets.</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {isProfileComplete && viewParam === "for_you" && !personalizedOff ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-light px-4 py-3 text-sm text-primary-text dark:border-primary/30 dark:bg-primary/10 dark:text-indigo-200">
          <span>For You is scoped to your courses, level and semester.</span>
          <Link
            href={buildHref(pathname, { view: "all", personalized: "0" })}
            className="shrink-0 text-xs font-bold underline underline-offset-2"
          >
            Browse all
          </Link>
        </div>
      ) : null}

      <PracticeHeroV2
        dueLoading={dueLoading}
        dueData={dueData}
        streak={streak}
        avgScore={avgScore}
        totalSessions={totalSessions}
        quickLoading={quickLoading}
        displayName={displayName}
        onReviewDue={(setId) => router.push(`/study/practice/${setId}?mode=study&due=1`)}
        onQuickSession={handleQuickSession}
      />

      {/* Course chips filter */}
      <CourseChipsBar
        courseCodes={courseCodes}
        activeCourse={courseParam}
        onSelect={(code) =>
          router.replace(
            buildHref(pathname, {
              q: qParam || null,
              course: code || null,
              level: levelParam || null,
              semester: semesterParam || null,
              sort: sortParam !== "newest" ? sortParam : null,
              published: publishedOnly ? "1" : null,
              view: viewParam !== "for_you" ? viewParam : null,
            })
          )
        }
      />

      {/* Tabs: For you / Recent / All */}
      <div className="flex items-center justify-between gap-3">
        <MiniTabs value={viewParam} onChange={setView} />
      </div>

      {/* Suggested for today widget */}
      <SuggestedTodayWidget />

      {/* NOT STICKY: Search + filters (regular block) */}
      <Card className="w-full max-w-full overflow-hidden rounded-3xl border bg-background/85 backdrop-blur p-3">
        <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search course code, title, topic..."
            className="min-w-0 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />

          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background hover:bg-secondary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={openFilters}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground",
              "hover:bg-secondary/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </div>

        {hasAnyFilters ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Showing <span className="text-foreground">{total === 0 ? 0 : 1}</span>-
              <span className="text-foreground">{Math.min(total, sets.length)}</span> of{" "}
              <span className="text-foreground">{total}</span>
            </p>
            <button
              type="button"
              onClick={clearAll}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold",
                "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: try <span className="font-semibold">GST101</span> or "Anatomy".
          </p>
        )}

        <div className="mt-3 flex max-w-full flex-wrap items-center gap-2">
          {courseParam ? (
            <Chip
              active
              onClick={() =>
                router.replace(
                  buildHref(pathname, {
                    q: qParam || null,
                    course: null,
                    level: levelParam || null,
                    semester: semesterParam || null,
                    sort: sortParam !== "newest" ? sortParam : null,
                    published: publishedOnly ? "1" : null,
                    view: viewParam !== "for_you" ? viewParam : null,
                  })
                )
              }
              title="Clear course"
            >
              <Hash className="h-4 w-4" />
              {courseParam.toUpperCase()}
              <X className="h-4 w-4" />
            </Chip>
          ) : null}

          {levelParam ? (
            <Chip
              active
              onClick={() =>
                router.replace(
                  buildHref(pathname, {
                    q: qParam || null,
                    course: courseParam || null,
                    level: null,
                    semester: semesterParam || null,
                    sort: sortParam !== "newest" ? sortParam : null,
                    published: publishedOnly ? "1" : null,
                    view: viewParam !== "for_you" ? viewParam : null,
                  })
                )
              }
              title="Clear level"
            >
              {levelParam}L <X className="h-4 w-4" />
            </Chip>
          ) : null}

          {semesterParam ? (
            <Chip
              active
              onClick={() =>
                router.replace(
                  buildHref(pathname, {
                    q: qParam || null,
                    course: courseParam || null,
                    level: levelParam || null,
                    semester: null,
                    sort: sortParam !== "newest" ? sortParam : null,
                    published: publishedOnly ? "1" : null,
                    view: viewParam !== "for_you" ? viewParam : null,
                  })
                )
              }
              title="Clear semester"
            >
              <Clock className="h-4 w-4" />
              {semesterParam} <X className="h-4 w-4" />
            </Chip>
          ) : null}
        </div>
      </Card>

      {/* Errors */}
      {loadError ? (
        <div className="rounded-3xl border border-border bg-background p-4">
          <p className="text-sm font-semibold text-foreground">Couldn't load practice sets</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          {schemaHint ? (
            <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{schemaHint}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* RECENT VIEW */}
      {viewParam === "recent" ? (
        recentAttempts.length === 0 ? (
          <div className="pl-14">
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="No recent activity"
            description="Sets you've recently attempted will appear here."
            action={
              <Link
                href="/study/library"
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground no-underline",
                  "hover:opacity-90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <Flame className="h-4 w-4" />
                Browse Materials
              </Link>
            }
          />
          </div>
        ) : (
          <div className="space-y-3">
            {recentAttempts.map((a) => (
              <Card key={a.id} className="w-full max-w-full overflow-hidden rounded-3xl p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-foreground">
                      {(a.study_quiz_sets?.title ?? "Practice set").trim() || "Practice set"}
                    </p>
                    <div className="mt-2 flex max-w-full flex-wrap items-center gap-2">
                      {a.study_quiz_sets?.course_code ? (
                        <span className="max-w-full truncate rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground">
                          {String(a.study_quiz_sets.course_code).toUpperCase()}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatWhen(a.updated_at ?? a.created_at)}
                      </span>
                    </div>
                  </div>

                  {a.set_id ? (
                    <button
                      type="button"
                      onClick={() => startSet(String(a.set_id))}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground",
                        "hover:opacity-90",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      )}
                    >
                      <Play className="h-4 w-4" />
                      Open
                    </button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <>
          {/* RESULTS */}
          <div className="flex min-w-0 flex-col gap-3">
            {loading ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} className="rounded-3xl" />
                ))}
              </>
            ) : visibleSets.length === 0 ? (
              <div className="pl-14">
                <EmptyState
                  icon={<BookOpen className="h-5 w-5" />}
                  title={
                    viewParam === "for_you"
                      ? "No sets for your department yet"
                      : "No practice sets published yet"
                  }
                  description={
                    viewParam === "for_you"
                      ? "For you shows practice sets matched to your department and level. Browse All sets or request content below."
                      : "Check back soon, or request content for your course."
                  }
                  action={
                    <div className="flex flex-wrap gap-2">
                      {courseParam ? (
                        <button
                          type="button"
                          onClick={() => setRequestModalOpen(true)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-foreground",
                            "hover:opacity-90",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          )}
                        >
                          Request this course
                        </button>
                      ) : null}
                      <Link
                        href="/study/library"
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground no-underline",
                          "hover:bg-secondary/50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        )}
                      >
                        <Flame className="h-4 w-4" />
                        Browse Materials
                      </Link>
                    </div>
                  }
                />
              </div>
            ) : (
              visibleSets.map((s) => (
                <QuizSetCard
                  key={s.id}
                  s={s}
                  onStart={() => startSet(s.id)}
                  summary={setAttemptMap[s.id] ?? null}
                  currentUserId={authedUserId}
                />
              ))
            )}
          </div>

          {/* Load more (only on All sets view) */}
          {!loading && sets.length > 0 && viewParam === "all" ? (
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
                    "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground",
                    "hover:bg-secondary/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    loadingMore ? "opacity-70" : ""
                  )}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">You've reached the end.</p>
              )}
            </div>
          ) : null}
        </>
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
              onClick={() => {
                setDraftCourse("");
                setDraftLevel("");
                setDraftSemester("");
                setDraftSort("newest");
                setDraftPublished(false);
                setDraftDifficulty("");
              }}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground",
                "hover:bg-secondary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              )}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground",
                "hover:opacity-90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              )}
            >
              Apply
            </button>
          </div>
        }
      >
        <div className="rounded-3xl border border-border bg-background p-3">
          <p className="text-sm font-semibold text-foreground">Sort</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setDraftSort(s.key)}
                className={cn(
                  "inline-flex items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  draftSort === s.key
                    ? "border-border bg-secondary text-foreground"
                    : "border-border/60 bg-background text-foreground hover:bg-secondary/50"
                )}
              >
                <span className="inline-flex items-center gap-2">
                  {s.icon}
                  {s.label}
                </span>
                {draftSort === s.key ? <span className="text-xs font-semibold">Selected</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-3xl border border-border bg-background p-3">
          <p className="text-sm font-semibold text-foreground">Course</p>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <input
              value={draftCourse}
              onChange={(e) => setDraftCourse(e.target.value)}
              placeholder="e.g., GST101 or CSC201"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {draftCourse ? (
              <button
                type="button"
                onClick={() => setDraftCourse("")}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl border border-border bg-background hover:bg-secondary/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                aria-label="Clear course"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">You can also search course codes in the main search bar.</p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <SelectRow
            label="Level"
            value={draftLevel}
            onChange={setDraftLevel}
            options={LEVELS.map((l) => ({ value: l, label: `${l}L` }))}
            placeholder="All levels"
          />
          <SelectRow
            label="Semester"
            value={draftSemester}
            onChange={setDraftSemester}
            options={SEMESTERS.map((s) => ({ value: s, label: s }))}
            placeholder="All semesters"
          />
        </div>

        {/* Difficulty */}
        <div className="mt-3 rounded-3xl border border-border bg-background p-3">
          <p className="text-sm font-semibold text-foreground">Difficulty</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["", "easy", "medium", "hard"] as const).map((d) => {
              const label = d === "" ? "Any" : d === "easy" ? "Easy" : d === "medium" ? "Medium" : "Hard";
              const active = draftDifficulty === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDraftDifficulty(d)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    active
                      ? d === "" ? "border-border bg-secondary text-foreground"
                        : d === "easy" ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : d === "medium" ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <ToggleRow
            label="Published only"
            desc="Show only published sets (if supported by your DB)"
            checked={draftPublished}
            onChange={setDraftPublished}
          />
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            Filters apply when you tap <span className="font-semibold">Apply</span>. Search updates automatically.
          </p>
        </div>
      </Drawer>

      {/* Preview sheet */}
      <Drawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Preview"
        footer={
          previewSet ? (
            <div className="space-y-3">
              {/* Mode picker */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Practice mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Show answers immediately?</p>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/50 p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("study")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      previewMode === "study"
                        ? "bg-primary-light text-primary-text border border-primary/25 dark:bg-primary/10 dark:text-indigo-200 dark:border-primary/30"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    Study
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("exam")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      previewMode === "exam"
                        ? "bg-background text-foreground border border-border shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Exam
                  </button>
                </div>
              </div>
              <p className="px-1 text-xs text-muted-foreground">
                {previewMode === "study" ? (
                  <><span className="font-semibold text-primary-text dark:text-indigo-300">Study mode:</span>{" "}answer revealed with explanation after each pick. No timer.</>
                ) : (
                  <><span className="font-semibold">Exam mode:</span>{" "}answers shown after you submit. Timer active if set.</>
                )}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOpen(false);
                    startSet(previewSet.id, previewMode);
                  }}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                    "hover:opacity-90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    previewMode === "study"
                      ? "bg-primary text-white border border-primary hover:opacity-90"
                      : "border border-border bg-secondary text-foreground"
                  )}
                >
                  {previewMode === "study" ? (
                    <><GraduationCap className="h-4 w-4" /> Start in Study mode</>
                  ) : (
                    <><Play className="h-4 w-4" /> Start</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground",
                    "hover:bg-secondary/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  )}
                >
                  Close
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {previewSet ? (
          <div className="space-y-3">
            <div className="rounded-3xl border border-border bg-background p-4">
              <p className="text-base font-semibold text-foreground">
                {(previewSet.title ?? "Untitled set").trim() || "Untitled set"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {previewSet.description ? previewSet.description : "Practice past questions and test yourself."}
              </p>
              {previewSet.difficulty ? (
                <div className="mt-3">
                  <DifficultyBadge difficulty={previewSet.difficulty} />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing to preview.</p>
        )}
      </Drawer>

      {/* Request course modal */}
      <RequestCourseModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        initialCourseCode={courseParam}
      />

      {/* Toast */}
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-lg"
          >
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
