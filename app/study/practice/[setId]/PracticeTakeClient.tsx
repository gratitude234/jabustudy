// app/study/practice/[setId]/PracticeTakeClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  FileText,
  Flag,
  Lightbulb,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Send,
  Timer,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Trophy,
  Star,
  X,
  RotateCcw,
  BookOpen,
  GraduationCap,
  CalendarClock,
  TrendingUp,
  Share2,
} from "lucide-react";
import { Card, EmptyState } from "../../_components/StudyUI";
import { BetterExplanationInline, type BetterExplanationOptionKey } from "../../_components/BetterExplanationInline";
import { GuidedSourceModal, type GuidedStudyRef } from "../../_components/GuidedSourceModal";
import { cn, msToClock, normalize } from "@/lib/utils";
import { publicUrl } from "@/lib/publicUrl";
import { usePracticeEngine } from "./usePracticeEngine";
import { supabase } from "@/lib/supabase";
import type { AnswerConfidence, WrittenAnswerGrade } from "@/lib/types";

type AnyOption = {
  id: string;
  text: string | null;
  // your engine may expose one of these:
  is_correct?: boolean | null;
  correct?: boolean | null;
  isCorrect?: boolean | null;
};

type WrittenGradeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; grade: WrittenAnswerGrade; cached: boolean }
  | { status: "error"; message: string };

function getIsCorrect(o: AnyOption) {
  return Boolean(o.is_correct ?? o.correct ?? o.isCorrect ?? false);
}

function verdictLabel(verdict: WrittenAnswerGrade["verdict"]) {
  if (verdict === "correct") return "Correct";
  if (verdict === "mostly_correct") return "Mostly correct";
  if (verdict === "partially_correct") return "Partially correct";
  if (verdict === "unanswered") return "Unanswered";
  return "Needs work";
}

const EXPLAIN_OPTION_KEYS = ["A", "B", "C", "D"] as const;

function optionKeyAt(index: number): BetterExplanationOptionKey | null {
  return EXPLAIN_OPTION_KEYS[index] ?? null;
}

// ── Milestone toast ───────────────────────────────────────────────────────────

type MilestoneLevel = "perfect" | "excellent" | "great" | "good" | "done";

type Milestone = {
  level: MilestoneLevel;
  emoji: string;
  heading: string;
  sub: string;
};

function getMilestone(correct: number, total: number): Milestone {
  if (total === 0) return { level: "done", emoji: "✅", heading: "Session saved", sub: "No questions to score." };
  const pct = Math.round((correct / total) * 100);
  if (pct === 100) return { level: "perfect",   emoji: "🎯", heading: "Perfect score!",     sub: `${correct}/${total} — flawless.` };
  if (pct >= 90)   return { level: "excellent", emoji: "⭐", heading: "Outstanding!",        sub: `${pct}% — keep it up!` };
  if (pct >= 80)   return { level: "great",     emoji: "🔥", heading: "Great work!",         sub: `${pct}% — solid performance.` };
  if (pct >= 60)   return { level: "good",      emoji: "💪", heading: "Good effort!",        sub: `${pct}% — practice makes perfect.` };
  return              { level: "done",      emoji: "✅", heading: "Session complete",     sub: `${pct}% — review your answers below.` };
}

function formatDue(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = t - Date.now();
  const hours = Math.round(diff / 3_600_000);
  if (hours <= 0) return "now";
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(diff / 86_400_000);
  return `in ${days}d`;
}

const STREAK_MILESTONES = [7, 14, 30, 60, 100] as const;
type StreakMilestone = typeof STREAK_MILESTONES[number];

function getStreakMilestone(streak: number): StreakMilestone | null {
  for (const m of [...STREAK_MILESTONES].reverse()) {
    if (streak === m) return m;
  }
  return null;
}

const MILESTONE_STYLES: Record<MilestoneLevel, string> = {
  perfect:   "border-amber-300/50  bg-amber-50   text-amber-900  dark:border-amber-700/50 dark:bg-amber-950/60 dark:text-amber-200",
  excellent: "border-[#5B35D5]/25 bg-[#EEEDFE] text-[#3B24A8] dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10 dark:text-indigo-300",
  great:     "border-teal-300/50 bg-teal-50/80 text-teal-900 dark:border-teal-700/50 dark:bg-teal-950/60 dark:text-teal-200",
  good:      "border-emerald-300/50 bg-emerald-50 text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/60 dark:text-emerald-200",
  done:      "border-border bg-card text-foreground",
};

/*

// ── AI Explain Inline ─────────────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className={cn("flex items-center gap-3 rounded-2xl border px-3 py-3", "border-[#5B35D5]/20 bg-[#EEEDFE]", "dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10")}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#5B35D5]/[0.10] text-[#5B35D5]">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
        <div>
          <p className="text-xs font-extrabold text-[#3B24A8] dark:text-indigo-300">Thinking…</p>
          <p className="text-[11px] text-[#5B35D5]/70">Gemini is generating your explanation</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={cn("rounded-2xl border px-3 py-2.5", "border-rose-200/60 bg-rose-50/60 dark:border-rose-800/40 dark:bg-rose-950/20")}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-rose-700 dark:text-rose-400">Couldn&apos;t generate explanation</p>
            <p className="mt-0.5 text-[11px] text-rose-600/80">{state.message}</p>
          </div>
          <button
            type="button"
            onClick={fetchExplanation}
            className="shrink-0 grid h-7 w-7 place-items-center rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
            aria-label="Retry"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className={cn("rounded-2xl border px-3 py-3 space-y-2", "border-[#5B35D5]/20 bg-[#EEEDFE]", "dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10")}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[#5B35D5]/[0.10] text-[#5B35D5] dark:text-indigo-300">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-extrabold text-[#3B24A8] dark:text-indigo-300">AI Explanation</p>
        <span className="ml-auto text-[10px] font-semibold text-[#5B35D5]/60">Gemini · {state.cached ? "cached" : "generated"}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{state.text}</p>
      <p className="text-[10px] text-muted-foreground">AI can make mistakes. Cross-check with your textbook or lecturer.</p>
    </div>
  );
}

*/

type PracticeStudyRef = {
  chunkId?: string;
  topic?: string;
  instruction?: string;
  quote?: string;
  page?: number;
} | null | undefined;

type PracticeSourceMaterial = {
  id: string;
  title: string | null;
  file_path: string | null;
  material_type: string | null;
};

function studyRefPage(page: unknown): number | undefined {
  if (typeof page !== "number" || !Number.isFinite(page)) return undefined;
  const rounded = Math.floor(page);
  return rounded >= 1 && rounded <= 2000 ? rounded : undefined;
}

function hasStudyRef(ref: PracticeStudyRef) {
  return Boolean(ref?.chunkId?.trim() || ref?.topic?.trim() || ref?.instruction?.trim() || ref?.quote?.trim() || studyRefPage(ref?.page));
}

const CONFIDENCE_OPTIONS: Array<{ value: AnswerConfidence; label: string; desc: string }> = [
  { value: "confident", label: "Got it", desc: "I can answer this again" },
  { value: "unsure", label: "Partly", desc: "I need one more review" },
  { value: "guessed", label: "Still weak", desc: "Keep this in revision" },
];

function ConfidencePicker({
  value,
  onChange,
  compact = false,
}: {
  value: AnswerConfidence | null | undefined;
  onChange: (value: AnswerConfidence) => void;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3">
      <p className="text-xs font-extrabold text-foreground">How sure were you?</p>
      <div className={cn("mt-2 grid gap-2", compact ? "sm:grid-cols-3" : "md:grid-cols-3")}>
        {CONFIDENCE_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-[#5B35D5]/35 bg-[#EEEDFE] text-[#3B24A8] dark:border-[#5B35D5]/40 dark:bg-[#5B35D5]/10 dark:text-indigo-300"
                  : "border-border bg-background text-foreground hover:bg-secondary/50"
              )}
            >
              <span className="block text-xs font-extrabold">{option.label}</span>
              <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{option.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PracticeGuidedHint({
  studyRef,
  sourceMaterial,
  onReadSource,
  onHide,
}: {
  studyRef: PracticeStudyRef;
  sourceMaterial: PracticeSourceMaterial | null;
  onReadSource: (page?: number, studyRef?: GuidedStudyRef) => void;
  onHide: () => void;
}) {
  if (!hasStudyRef(studyRef)) return null;

  const page = studyRefPage(studyRef?.page);
  const topic = studyRef?.topic?.trim();
  const instruction = studyRef?.instruction?.trim() || "Review the relevant part of the source material before answering.";
  const quote = studyRef?.quote?.trim();
  const sourceBacked = Boolean(studyRef?.chunkId?.trim());
  const sourceHref = sourceMaterial
    ? `/study/materials/${encodeURIComponent(sourceMaterial.id)}`
    : null;

  return (
    <div className="mt-3 rounded-2xl border border-amber-300/50 bg-amber-50 px-3 py-3 dark:border-amber-700/40 dark:bg-amber-950/20">
      <div className="flex items-start gap-2.5">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-extrabold text-amber-900 dark:text-amber-200">Review this first</p>
            {topic ? (
              <span className="rounded-full border border-amber-300/70 bg-background/80 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
                {topic}
              </span>
            ) : null}
            {page ? (
              <span className="rounded-full border border-amber-300/70 bg-background/80 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
                {sourceBacked ? `Source: Page ${page}` : `Page ${page}`}
              </span>
            ) : null}
            {sourceBacked ? (
              <span className="rounded-full border border-emerald-300/70 bg-background/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                Source-backed
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-300">
            {instruction}
          </p>
          {quote ? (
            <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-[11px] font-medium leading-relaxed text-amber-900/80 dark:border-amber-700 dark:text-amber-200/80">
              {quote}
            </blockquote>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {sourceHref ? (
              <button
                type="button"
                onClick={() => onReadSource(page, studyRef)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white no-underline transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <FileText className="h-3.5 w-3.5" />
                Read source
              </button>
            ) : null}
            <button
              type="button"
              onClick={onHide}
              className="inline-flex items-center rounded-xl border border-amber-300/70 bg-background/80 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300"
            >
              Hide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PracticeTakeClient() {
  const router = useRouter();
  const params = useParams<{ setId: string }>();
  const sp = useSearchParams();

  const setId = String(params?.setId ?? "");
  const attemptFromUrl = String(sp.get("attempt") ?? "").trim();
  const modeParam = sp.get("mode") ?? "exam";
  const isStudyMode = modeParam === "study";
  const isDueParam = sp.get("due") === "1";

  // Fetch the due question IDs for this set when ?due=1 is present.
  // Falls back to null (= full set) if the fetch fails or the table doesn't exist yet.
  const [dueQuestionIds, setDueQuestionIds] = useState<string[] | null>(null);
  const [dueFetching, setDueFetching] = useState(isDueParam);

  useEffect(() => {
    if (!isDueParam || !setId) { setDueFetching(false); return; }
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/study/practice/due");
        if (!mounted) return;
        if (res.ok) {
          const json = await res.json();
          const match = (json.sets ?? []).find((s: any) => s.set_id === setId);
          setDueQuestionIds(match?.question_ids ?? null);
        }
      } catch { /* non-fatal — fall back to full set */ } finally {
        if (mounted) setDueFetching(false);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, isDueParam]);

  // Don't mount the engine until we know the due IDs (avoids a double-load flash).
  const engineReady = !isDueParam || !dueFetching;

  const engine = usePracticeEngine({
    setId,
    attemptFromUrl,
    studyMode: isStudyMode || isDueParam,
    dueQuestionIds: isDueParam ? dueQuestionIds : null,
  });

  const {
    meta,
    questions,
    loading,
    err,
    idx,
    setIdx,
    current,
    opts,
    answers,
    writtenAnswers,
    writtenGrades,
    confidences,
    writtenSaving,
    submitted,
    setSubmitted,
    attemptId,
    timeLeftMs,
    stats,
    reviewItems,
    finalizing,
    weakSummary,
    choose,
    setAnswerConfidence,
    writeAnswer,
    setWrittenGrade,
    softReset,
    retryWeakQuestions,
    finalizeAttempt,
    isRetryMode,
    isDueMode,
    studyMode,
    goToQuestion,
  } = engine;

  // Inline submit confirmation (replaces window.confirm)
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Instant feedback: reveal correctness after first tap (per question)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [writtenGradeStates, setWrittenGradeStates] = useState<Record<string, WrittenGradeState>>({});
  const clearedGradeRef = useRef<Set<string>>(new Set());

  // Question navigator drawer
  const [navOpen, setNavOpen] = useState(false);
  const [studyHintOpen, setStudyHintOpen] = useState<Record<string, boolean>>({});

  // Milestone toast — fires once when finalization completes
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const milestoneShownRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!submitted || finalizing || milestoneShownRef.current) return;
    milestoneShownRef.current = true;
    const m = getMilestone(stats.correct, stats.scoredTotal);
    setMilestone(m);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setMilestone(null), 5000);
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [submitted, finalizing, stats.correct, stats.scoredTotal]);

  // Streak feedback — fetched once when results appear
  const [streakCount, setStreakCount] = useState<number | null>(null);
  const [streakMilestone, setStreakMilestone] = useState<StreakMilestone | null>(null);
  const streakFetchedRef = useRef(false);
  useEffect(() => {
    if (!submitted || finalizing || streakFetchedRef.current) return;
    streakFetchedRef.current = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
        const since = new Date(Date.now() + 3_600_000 - 90 * 86_400_000).toISOString().slice(0, 10);
        const { data } = await supabase
          .from("study_daily_activity")
          .select("activity_date,attempts_count")
          .eq("user_id", user.id)
          .gte("activity_date", since)
          .order("activity_date", { ascending: false });

        const activeDates = new Set(
          ((data ?? []) as { activity_date: string | null; attempts_count: number | null }[])
            .filter((row) => row.activity_date && (row.attempts_count ?? 0) > 0)
            .map((row) => String(row.activity_date))
        );
        if (activeDates.has(today)) {
          let count = 0;
          let cursorMs = Date.now() + 3_600_000;
          while (activeDates.has(new Date(cursorMs).toISOString().slice(0, 10))) {
            count += 1;
            cursorMs -= 86_400_000;
          }
          setStreakCount(count);
          const nextMilestone = getStreakMilestone(count);
          if (nextMilestone) setStreakMilestone(nextMilestone);
        }
      } catch {
        // silent
      }
    })();
  }, [submitted, finalizing]);

  const [sourceMaterial, setSourceMaterial] = useState<PracticeSourceMaterial | null>(null);
  const [readingRef, setReadingRef] = useState<{ open: boolean; page?: number; studyRef?: GuidedStudyRef } | null>(null);
  useEffect(() => {
    const sourceMaterialId = meta?.source_material_id?.trim();
    if (!sourceMaterialId) {
      setSourceMaterial(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: srcMat } = await supabase
          .from("study_materials")
          .select("id, title, file_path, material_type")
          .eq("id", sourceMaterialId)
          .maybeSingle();

        if (!cancelled && srcMat?.id) {
          setSourceMaterial({
            id: String(srcMat.id),
            title: srcMat.title ?? null,
            file_path: (srcMat as any).file_path ?? null,
            material_type: (srcMat as any).material_type ?? null,
          });
        } else if (!cancelled) {
          setSourceMaterial(null);
        }
      } catch {
        if (!cancelled) setSourceMaterial(null);
      }
    })();

    return () => { cancelled = true; };
  }, [meta?.source_material_id]);

  // M-3: Mark as understood
  const [understood, setUnderstood] = useState<Record<string, boolean>>({});

  async function handleMarkUnderstood(questionId: string) {
    setUnderstood(prev => ({ ...prev, [questionId]: true }));
    try {
      if (attemptId) {
        await supabase
          .from('study_attempt_answers')
          .update({ understood: true })
          .eq('attempt_id', attemptId)
          .eq('question_id', questionId);
      }
    } catch { /* non-critical */ }
  }

  const total = stats.total;
  const isLast = questions.length > 0 && idx >= questions.length - 1;
  const learningMode = studyMode || isDueMode || isRetryMode;

  const chosenId = current ? answers[current.id] : null;
  const currentQuestionType = current?.question_type === "short_answer" || current?.question_type === "theory"
    ? current.question_type
    : "mcq";
  const isWrittenCurrent = currentQuestionType !== "mcq";
  const currentWrittenAnswer = current ? writtenAnswers[current.id] ?? "" : "";
  const currentConfidence = current ? confidences[current.id] ?? null : null;
  const currentMarkingPoints = Array.isArray(current?.marking_points) ? current.marking_points : [];
  const currentGradeState: WrittenGradeState = current
    ? writtenGradeStates[current.id] ??
      (writtenGrades[current.id]
        ? { status: "done", grade: writtenGrades[current.id], cached: true }
        : { status: "idle" })
    : { status: "idle" };
  const writtenCompareOpen = current
    ? submitted || (learningMode && !!revealed[current.id]) || currentGradeState.status !== "idle"
    : false;

  const currentOptions = (opts as AnyOption[]) ?? [];
  const correctOptionId = useMemo(() => {
    const c = currentOptions.find((o) => getIsCorrect(o));
    return c?.id ?? null;
  }, [currentOptions]);
  const explanationOptions = useMemo(() => {
    if (currentOptions.length < 4) return null;
    const mapped = {} as Record<BetterExplanationOptionKey, string>;
    for (let i = 0; i < 4; i += 1) {
      const key = optionKeyAt(i);
      const text = currentOptions[i]?.text?.trim();
      if (!key || !text) return null;
      mapped[key] = text;
    }
    return mapped;
  }, [currentOptions]);
  const chosenOptionKey = useMemo(() => {
    const index = currentOptions.findIndex((o) => o.id === chosenId);
    return index >= 0 ? optionKeyAt(index) : null;
  }, [chosenId, currentOptions]);
  const correctOptionKey = useMemo(() => {
    const index = currentOptions.findIndex((o) => getIsCorrect(o));
    return index >= 0 ? optionKeyAt(index) : null;
  }, [currentOptions]);

  const isRevealed = current ? (learningMode && !!revealed[current.id]) && !isWrittenCurrent : false;

  const answeredPct = useMemo(() => {
    const t = Math.max(0, total || 0);
    const a = Math.max(0, stats.answered || 0);
    return t ? Math.round((a / t) * 100) : 0;
  }, [stats.answered, total]);
  const totalMs =
    typeof meta?.time_limit_minutes === "number" && Number.isFinite(meta.time_limit_minutes)
      ? meta.time_limit_minutes * 60_000
      : null;
  const timeIsLow = typeof timeLeftMs === "number" && timeLeftMs > 0 && timeLeftMs <= 60_000;
  const timeProgressPct =
    totalMs && typeof timeLeftMs === "number"
      ? Math.max(0, Math.min(100, (timeLeftMs / totalMs) * 100))
      : null;

  // Auto-submit when time hits 0
  const prevLeft = useRef<number | null>(null);
  useEffect(() => {
    if (submitted) return;
    if (typeof timeLeftMs !== "number") return;
    const was = prevLeft.current;
    prevLeft.current = timeLeftMs;
    if (was !== null && was > 0 && timeLeftMs <= 0) void finalizeAttempt("timeup");
  }, [timeLeftMs, submitted, finalizeAttempt]);

  // Finalize attempt when submitted
  useEffect(() => {
    if (!submitted) return;
    void finalizeAttempt(typeof timeLeftMs === "number" && timeLeftMs <= 0 ? "timeup" : "manual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  // Guard against accidental back-navigation mid-quiz
  useEffect(() => {
    if (submitted || loading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Your progress is saved — are you sure you want to leave?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitted, loading]);

  function submitNow() {
    if (submitted) return;
    setSubmitted(true);
  }

  function handleSubmitClick() {
    if (submitted) return;
    const unanswered = stats.total - stats.answered;
    if (unanswered > 0 && !pendingSubmit) {
      setPendingSubmit(true);
      return;
    }
    setPendingSubmit(false);
    setSubmitted(true);
  }

  function cancelSubmit() {
    setPendingSubmit(false);
  }

  function resetAll() {
    setRevealed({});
    setWrittenGradeStates({});
    clearedGradeRef.current.clear();
    setStudyHintOpen({});
    setReadingRef(null);
    softReset();
  }

  function goNext() {
    setIdx((v) => Math.min(questions.length - 1, v + 1));
  }

  function goPrev() {
    setIdx((v) => Math.max(0, v - 1));
  }

  function onPick(optionId: string) {
    if (!current) return;
    if (submitted) return;
    if (isWrittenCurrent) return;

    // Learning/revision flows lock after feedback. Exam mode allows changes before submit.
    if (learningMode && revealed[current.id]) return;

    choose(current.id, optionId);
    if (learningMode) setRevealed((m) => ({ ...m, [current.id]: true }));
  }

  function clearStoredWrittenGrade(questionId: string) {
    if (!attemptId || clearedGradeRef.current.has(questionId)) return;
    clearedGradeRef.current.add(questionId);
    void supabase
      .from("study_attempt_answers")
      .update({
        ai_grade_score: null,
        ai_grade_max_score: null,
        ai_grade_verdict: null,
        ai_grade_feedback: null,
        ai_grade_matched_points: [],
        ai_grade_missing_points: [],
        ai_grade_improved_answer: null,
        ai_grade_provider: null,
        ai_grade_model: null,
        ai_grade_answer_hash: null,
        ai_graded_at: null,
      } as any)
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId);
  }

  function onWrittenAnswerChange(questionId: string, value: string) {
    writeAnswer(questionId, value);
    if (writtenGradeStates[questionId]?.status === "done" || writtenGrades[questionId]) {
      clearStoredWrittenGrade(questionId);
    }
    setWrittenGrade(questionId, null);
    setWrittenGradeStates((prev) => ({ ...prev, [questionId]: { status: "idle" } }));
    setRevealed((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  async function gradeWrittenAnswer(questionId: string) {
    if (!attemptId || !current) return;
    const answer = (writtenAnswers[questionId] ?? "").trim();
    if (!answer) return;

    setRevealed((prev) => ({ ...prev, [questionId]: true }));
    setWrittenGradeStates((prev) => ({ ...prev, [questionId]: { status: "loading" } }));

    try {
      const res = await fetch("/api/ai/grade-written-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, questionId, answer }),
      });
      const data = await res.json().catch(() => null) as
        | { ok?: boolean; grade?: WrittenAnswerGrade; cached?: boolean; message?: string; error?: string }
        | null;

      if (!res.ok || !data?.ok || !data.grade) {
        throw new Error(data?.message || data?.error || "Could not grade this answer.");
      }

      clearedGradeRef.current.delete(questionId);
      setWrittenGrade(questionId, data.grade);
      setWrittenGradeStates((prev) => ({
        ...prev,
        [questionId]: { status: "done", grade: data.grade!, cached: Boolean(data.cached) },
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not grade this answer.";
      setWrittenGradeStates((prev) => ({ ...prev, [questionId]: { status: "error", message } }));
    }
  }

  // Keyboard shortcuts: A/B/C/D to select, Enter/ArrowRight to advance
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) return;
      if (submitted) return;
      if (navOpen) return;

      const keyMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
      const optionIndex = keyMap[e.key.toLowerCase()];

      if (optionIndex !== undefined) {
        if (current?.question_type === "short_answer" || current?.question_type === "theory") return;
        const option = opts[optionIndex] as AnyOption | undefined;
        if (!option) return;
        if (current && learningMode && revealed[current.id]) return;
        choose(current!.id, option.id);
        if (learningMode) setRevealed((m) => ({ ...m, [current!.id]: true }));
        return;
      }

      if (e.key === "ArrowRight" || (e.key === "Enter" && current && (learningMode ? revealed[current.id] : answers[current.id]) && current.question_type !== "short_answer" && current.question_type !== "theory")) {
        if (!isLast) {
          setIdx((v) => Math.min(questions.length - 1, v + 1));
        } else {
          handleSubmitClick();
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        setIdx((v) => Math.max(0, v - 1));
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, current, revealed, submitted, navOpen, isLast, questions.length, choose, setIdx, learningMode, answers]);

  if (dueFetching || (isDueParam && !engineReady)) {
    return (
      <div className="space-y-4 pb-28 md:pb-6">
        <div className="sticky top-0 z-20 -mx-4 bg-background/85 px-4 py-2 backdrop-blur border-b border-border">
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-2/5 animate-[progress_1.2s_ease-in-out_infinite] rounded-full bg-[#5B35D5]/70" />
          </div>
        </div>
        <div className="mt-4 rounded-3xl border border-[#5B35D5]/20 bg-[#EEEDFE] dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10 p-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-[#5B35D5] dark:text-indigo-300 shrink-0" />
            <div>
              <p className="text-sm font-extrabold text-foreground">Loading Due Today</p>
              <p className="text-xs text-muted-foreground mt-0.5">Finding your queued questions…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
  // Route-level skeleton (loading.tsx) will usually render first.
  // This is a minimal fallback for client-side transitions.
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <div className="sticky top-0 z-20 -mx-4 bg-background/85 px-4 py-2 backdrop-blur border-b border-border">
        <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/3 animate-[progress_1.2s_ease-in-out_infinite] rounded-full bg-[#5B35D5]/70" />
        </div>
      </div>
    </div>
  );
}
if (err || !meta) {
    return (
      <div className="pb-32">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-extrabold text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mt-4">
          <EmptyState
            title="Couldn’t open practice set"
            description={err ?? "Missing data"}
            action={
              <Link
                href="/study/practice"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-extrabold text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Go to Practice <ChevronRight className="h-4 w-4" />
              </Link>
            }
            icon={<AlertTriangle className="h-5 w-5 text-muted-foreground" />}
          />
        </div>
      </div>
    );
  }

  const resultPct = stats.scoredTotal > 0 ? Math.round((stats.correct / stats.scoredTotal) * 100) : 0;
  const retryWeakCount = reviewItems.filter((item) => {
    const isWritten = item.q.question_type === "short_answer" || item.q.question_type === "theory";
    if (isWritten) return false;
    if (item.isWrong || item.isUnanswered) return true;
    return item.confidence === "unsure" || item.confidence === "guessed";
  }).length;

  return (
    <div className="pb-28 md:pb-6">
      <GuidedSourceModal
        open={Boolean(readingRef?.open)}
        onResume={() => setReadingRef(null)}
        materialId={sourceMaterial?.id}
        title={sourceMaterial?.title ?? "Source material"}
        filePath={sourceMaterial?.file_path}
        materialType={sourceMaterial?.material_type}
        studyRef={readingRef?.studyRef}
        page={readingRef?.page}
      />

      {/* Sticky mobile header */}
      <div className="sticky top-0 z-20 -mx-4 bg-background/85 px-4 pb-3 pt-2 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-extrabold text-foreground",
              "hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              submitted ? "opacity-60" : ""
            )}
            disabled={submitted}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex items-center gap-2">
            {learningMode ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5B35D5]/25 bg-[#EEEDFE] px-2.5 py-2 text-xs font-extrabold text-[#3B24A8] dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10 dark:text-indigo-300">
                <GraduationCap className="h-4 w-4" />
                {isDueMode ? "Due" : isRetryMode ? "Retry" : "Study"}
              </span>
            ) : typeof timeLeftMs === "number" ? (
              <div className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-2 text-xs font-extrabold",
                    timeIsLow && "animate-pulse text-red-500",
                    timeIsLow
                      ? "border-rose-300/40 bg-rose-100/40 dark:bg-rose-950/30 dark:text-rose-300"
                      : timeLeftMs <= 120_000
                      ? "border-amber-300/40 bg-amber-100/40 text-foreground dark:bg-amber-950/30"
                      : "border-border bg-background text-foreground"
                  )}
                >
                  <Timer className="h-4 w-4" />
                  <span className="tabular-nums">{msToClock(timeLeftMs)}</span>
                </span>
                {timeProgressPct !== null ? (
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border/70">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        timeIsLow ? "bg-red-500" : "bg-[#5B35D5]"
                      )}
                      style={{ width: `${timeProgressPct}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-2 text-xs font-extrabold text-muted-foreground">
                Untimed
              </span>
            )}

            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              aria-label="Open question navigator"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-2 text-xs font-extrabold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                navOpen
                  ? "border-[#5B35D5]/25 bg-[#EEEDFE] text-[#3B24A8]"
                  : "border-border bg-background text-foreground hover:bg-secondary/50"
              )}
            >
              <span className="tabular-nums">{idx + 1}</span>
              <span className="text-muted-foreground">/</span>
              <span className="tabular-nums">{questions.length}</span>
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                {isDueMode && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[#5B35D5]/25 bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-extrabold text-[#3B24A8] dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10 dark:text-indigo-300">
                    Due
                  </span>
                )}
                <p className="truncate text-sm font-extrabold text-foreground">{normalize(meta.title)}</p>
              </div>
              <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground">
                Answered <span className="tabular-nums">{stats.answered}</span>
                {!learningMode ? (
                  <>
                    {" "}<span className="text-muted-foreground">•</span>{" "}
                    feedback after submit
                  </>
                ) : null}
              </p>
            </div>

          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            <div className="h-full rounded-full bg-[#5B35D5]" style={{ width: `${answeredPct}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span className="tabular-nums">{answeredPct}% done</span>
            <span className="tabular-nums">
              {stats.total - stats.answered} left
            </span>
          </div>
        </div>
      </div>

      {/* No questions */}
      {questions.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No questions in this set yet"
            description="Add questions and options, then come back."
            action={
              <Link
                href="/study/practice"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-extrabold text-foreground hover:bg-secondary/50"
              >
                Back to sets <ChevronRight className="h-4 w-4" />
              </Link>
            }
            icon={<AlertTriangle className="h-5 w-5 text-muted-foreground" />}
          />
        </div>
      ) : submitted ? (
        /* Results */
        <div className="mt-4 space-y-3">

          {/* ── Score hero ─────────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-3xl">
            <div className="bg-gradient-to-b from-[#5B35D5] to-[#4526B8] px-6 pb-6 pt-8 text-center">
              {/* SVG score ring */}
              <div className="relative mx-auto mb-3 h-36 w-36">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke="white" strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={`${resultPct * 2.5133} 251.33`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold tracking-tight text-white">{resultPct}%</span>
                </div>
              </div>

              <p className="text-sm font-semibold text-white/70">
                {stats.scoredTotal > 0
                  ? `MCQ score ${stats.correct} / ${stats.scoredTotal}`
                  : "Written practice complete"}
                {stats.writtenTotal > 0
                  ? ` · Written ${stats.writtenAnswered} / ${stats.writtenTotal}`
                  : ""}
              </p>
              <p className="mt-1.5 truncate px-6 text-xs font-medium text-white/45">
                {normalize(meta.title)}{meta.course_code ? ` · ${meta.course_code}` : ""}
              </p>

              {/* Status pills */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {streakCount !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    🔥 {streakCount}-day streak
                  </span>
                )}
                {isDueMode && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    📚 Due review
                  </span>
                )}
                {isRetryMode && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    🔁 Retry mode
                  </span>
                )}
                {finalizing ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    <CheckCircle2 className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 bg-[#3B1FA8] px-5 py-4">
              {/* Primary CTA */}
              {retryWeakCount > 0 ? (
                <button
                  type="button"
                  onClick={() => { setRevealed({}); setStudyHintOpen({}); retryWeakQuestions(); }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-[#5B35D5] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry weak ({retryWeakCount})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetAll}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-[#5B35D5] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Practice again
                </button>
              )}

              {/* Secondary row */}
              <div className="flex gap-2">
                <Link
                  href="/study/practice"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white no-underline transition hover:bg-white/20"
                >
                  Back to sets
                </Link>
                <button
                  type="button"
                  aria-label="Share score"
                  onClick={async () => {
                    const text = `I scored ${resultPct}% on "${normalize(meta.title)}" on Jabu Study!`;
                    try {
                      if (typeof navigator.share === "function") {
                        await navigator.share({ text, title: "My Practice Score" });
                      } else {
                        await navigator.clipboard.writeText(text);
                      }
                    } catch { /* user cancelled */ }
                  }}
                  className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-2xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                {stats.total > 0 && (
                  <button
                    type="button"
                    aria-label="Share on WhatsApp"
                    onClick={() => {
                      const streakLine = streakCount && streakCount > 1 ? `\n🔥 ${streakCount}-day streak!` : "";
                      const msg = encodeURIComponent(
                        `I scored ${resultPct}% on "${normalize(meta?.title ?? "a practice set")}"${meta?.course_code ? ` (${meta.course_code})` : ""} on Jabu Study!${streakLine}\n\nPractice for free: ${publicUrl("/study")}`
                      );
                      window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
                    }}
                    className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-2xl bg-[#25D366] text-white transition hover:bg-[#1EB856]"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Score breakdown ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-emerald-200/60 bg-emerald-50 py-4 dark:border-emerald-800/30 dark:bg-emerald-950/20">
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.correct}</span>
              <span className="text-[11px] font-semibold text-emerald-600/70 dark:text-emerald-500">Correct</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-rose-200/60 bg-rose-50 py-4 dark:border-rose-800/30 dark:bg-rose-950/20">
              <span className="text-2xl font-extrabold text-rose-500 dark:text-rose-400">{Math.max(0, stats.scoredTotal - stats.correct)}</span>
              <span className="text-[11px] font-semibold text-rose-500/70 dark:text-rose-500">MCQ missed</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-border bg-card py-4">
              <span className="text-2xl font-extrabold text-foreground">{stats.writtenAnswered}/{stats.writtenTotal}</span>
              <span className="text-[11px] font-semibold text-muted-foreground">Written</span>
            </div>
          </div>

          {reviewItems.length > 0 ? (
            <Card className="rounded-3xl">
              <div className="mb-3">
                <p className="text-sm font-extrabold text-foreground">Review answers</p>
                <p className="text-xs text-muted-foreground">Explanations and confidence update your revision queue.</p>
              </div>
              <div className="space-y-3">
                {reviewItems.map((item) => {
                  const isWritten = item.q.question_type === "short_answer" || item.q.question_type === "theory";
                  const answeredCorrectly = !isWritten && item.chosenOpt?.id && item.correctOpt?.id && item.chosenOpt.id === item.correctOpt.id;
                  return (
                    <div key={item.q.id} className="rounded-2xl border border-border bg-background p-3">
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-extrabold",
                            isWritten
                              ? "border-[#5B35D5]/30 bg-[#EEEDFE] text-[#3B24A8]"
                              : answeredCorrectly
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : item.chosen
                              ? "border-rose-500 bg-rose-500 text-white"
                              : "border-border bg-card text-muted-foreground"
                          )}
                        >
                          {item.index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="whitespace-pre-wrap text-sm font-extrabold leading-snug text-foreground">
                            {normalize(String(item.q.prompt ?? ""))}
                          </p>
                          {!isWritten ? (
                            <div className="mt-2 space-y-1 text-xs leading-relaxed">
                              <p className="text-muted-foreground">
                                Your answer: <span className="font-semibold text-foreground">{item.chosenOpt?.text ?? "Skipped"}</span>
                              </p>
                              <p className="text-muted-foreground">
                                Correct answer: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{item.correctOpt?.text ?? "Not set"}</span>
                              </p>
                            </div>
                          ) : (
                            <div className="mt-2 space-y-2">
                              <div className="rounded-xl border border-border bg-card p-2">
                                <p className="text-[11px] font-extrabold text-muted-foreground">Your answer</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.writtenAnswer.trim() || "Skipped"}</p>
                              </div>
                              {item.writtenGrade ? (
                                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">AI feedback</p>
                                    <span className="rounded-full border border-emerald-500/30 bg-background px-2 py-0.5 text-[11px] font-extrabold text-foreground">
                                      {item.writtenGrade.score}/{item.writtenGrade.maxScore} - {verdictLabel(item.writtenGrade.verdict)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm leading-relaxed text-foreground">{item.writtenGrade.feedback}</p>
                                </div>
                              ) : null}
                              <div className="rounded-xl border border-[#5B35D5]/20 bg-[#EEEDFE] p-2 dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10">
                                <p className="text-[11px] font-extrabold text-[#3B24A8] dark:text-indigo-300">Model answer</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                  {item.q.model_answer?.trim() || item.q.explanation?.trim() || "No model answer provided yet."}
                                </p>
                              </div>
                            </div>
                          )}
                          {item.q.explanation ? (
                            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-card p-2 text-xs leading-relaxed text-muted-foreground">
                              {item.q.explanation}
                            </p>
                          ) : null}
                          <div className="mt-3">
                            <ConfidencePicker
                              compact
                              value={item.confidence}
                              onChange={(value) => setAnswerConfidence(item.q.id, value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {/* ── Streak milestone ────────────────────────────────────────────── */}
          {streakMilestone && (
            <div className="overflow-hidden rounded-3xl border border-amber-300/50 bg-amber-50 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/20">
              <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔥</span>
                  <div>
                    <p className="text-base font-extrabold text-amber-900 dark:text-amber-200">
                      {streakMilestone}-day streak!
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {streakMilestone === 7 && "One full week of consistent study."}
                      {streakMilestone === 14 && "Two weeks straight — serious dedication."}
                      {streakMilestone === 30 && "30 days. That's a habit now."}
                      {streakMilestone === 60 && "60 days. You're in the top tier."}
                      {streakMilestone === 100 && "100 days. Legendary."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const msg = encodeURIComponent(
                      `🔥 I just hit a ${streakMilestone}-day study streak on Jabu Study!\n\n` +
                      `${streakMilestone === 7 ? "One full week" : streakMilestone === 14 ? "Two weeks straight" : streakMilestone === 30 ? "30 days straight" : streakMilestone === 60 ? "60 days of consistent study" : "100 days"} of consistent practice.\n\n` +
                      `Study smarter: ${publicUrl("/study")}`
                    );
                    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#1EB856] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Share on WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* ── Weak questions ──────────────────────────────────────────────── */}
          {weakSummary && weakSummary.filter((r) => r.reviewReason).length > 0 ? (
            <Card className="rounded-3xl">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#5B35D5]/[0.07] text-[#5B35D5] dark:text-indigo-300">
                  <CalendarClock className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-foreground">Weak questions</p>
                  <p className="text-xs text-muted-foreground">
                    {weakSummary.filter((r) => r.reviewReason).length} added to your review queue
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {weakSummary
                  .filter((r) => r.reviewReason)
                  .slice(0, 5)
                  .map((r) => (
                    <div key={r.questionId} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-start gap-2.5">
                        <span className={cn(
                          "mt-1 h-2 w-2 shrink-0 rounded-full",
                          r.missCount >= 4 ? "bg-rose-500" : r.missCount >= 2 ? "bg-amber-500" : "bg-muted-foreground/40"
                        )} />
                        <p className="flex-1 text-[13px] font-semibold leading-snug text-foreground line-clamp-2">
                          {r.prompt}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2 pl-4">
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                          {r.reviewReason === "low_confidence" ? "needs review" : `×${r.missCount} missed`}
                        </span>
                        {r.nextDueAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Due {formatDue(r.nextDueAt)}
                          </span>
                        )}
                        <div className="flex-1" />
                        <a
                          href={`/study/report?question=${encodeURIComponent(r.questionId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Report question"
                          className="grid h-6 w-6 place-items-center rounded-lg text-muted-foreground/40 transition hover:text-muted-foreground no-underline"
                        >
                          <Flag className="h-3 w-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleMarkUnderstood(r.questionId)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition",
                            understood[r.questionId]
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30"
                              : "border-border bg-background text-muted-foreground hover:bg-secondary/50"
                          )}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {understood[r.questionId] ? "Got it" : "Mark done"}
                        </button>
                      </div>
                    </div>
                  ))}
                {weakSummary.filter((r) => r.reviewReason).length > 5 && (
                  <p className="pl-4 text-[11px] text-muted-foreground">
                    +{weakSummary.filter((r) => r.reviewReason).length - 5} more tracked
                  </p>
                )}
              </div>

              <div className="mt-4">
                <a
                  href="/study/practice?view=due"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5B35D5]/[0.07] px-4 py-2.5 text-sm font-extrabold text-[#5B35D5] no-underline transition hover:bg-[#5B35D5]/[0.12] dark:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
                >
                  <CalendarClock className="h-4 w-4" />
                  View Due Today
                </a>
              </div>
            </Card>
          ) : weakSummary && weakSummary.every((r) => r.wasCorrect) && weakSummary.length > 0 ? (
            <Card className="rounded-3xl">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">No new weak questions!</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">All tracked questions answered correctly.</p>
                </div>
              </div>
            </Card>
          ) : null}

          {/* ── Keep going ──────────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <p className="border-b border-border px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Keep going
            </p>
            <div className="divide-y divide-border">
              {retryWeakCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setRevealed({}); setStudyHintOpen({}); retryWeakQuestions(); }}
                  className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 dark:bg-rose-950/30">
                    <RotateCcw className="h-4 w-4 text-rose-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Retry weak ({retryWeakCount})</p>
                    <p className="text-xs text-muted-foreground">Focus on what you missed</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </button>
              )}

              <button
                type="button"
                onClick={resetAll}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEEDFE] dark:bg-[#5B35D5]/10">
                  <RefreshCcw className="h-4 w-4 text-[#5B35D5]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Practice again</p>
                  <p className="text-xs text-muted-foreground">Redo all {stats.total} questions</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </button>

              {meta?.course_code && (
                <Link
                  href={`/study/library?course=${encodeURIComponent(meta.course_code)}`}
                  className="flex w-full items-center gap-3 p-4 no-underline transition-colors hover:bg-secondary/40"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                    <BookOpen className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{meta.course_code} materials</p>
                    <p className="text-xs text-muted-foreground">Brush up on weak topics</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </Link>
              )}

              {sourceMaterial && (
                <Link
                  href={`/study/materials/${encodeURIComponent(sourceMaterial.id)}`}
                  className="flex w-full items-center gap-3 p-4 no-underline transition-colors hover:bg-secondary/40"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEEDFE] dark:bg-[#5B35D5]/10">
                    <FileText className="h-4 w-4 text-[#5B35D5] dark:text-indigo-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Source material</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{sourceMaterial.title ?? "View PDF"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </Link>
              )}

              <Link
                href="/study/practice"
                className="flex w-full items-center gap-3 p-4 no-underline transition-colors hover:bg-secondary/40"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEEDFE] dark:bg-[#5B35D5]/10">
                  <GraduationCap className="h-4 w-4 text-[#5B35D5]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Another set</p>
                  <p className="text-xs text-muted-foreground">Browse all practice sets</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </Link>

              <Link
                href="/study/history"
                className="flex w-full items-center gap-3 p-4 no-underline transition-colors hover:bg-secondary/40"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 dark:bg-amber-950/30">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">View history</p>
                  <p className="text-xs text-muted-foreground">Track progress over time</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Question */
        <div className="mt-4 space-y-3">
          {pendingSubmit && (
            <div className="rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {stats.total - stats.answered} question{stats.total - stats.answered !== 1 ? "s" : ""} unanswered — submit anyway?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleSubmitClick}
                  className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                >
                  Submit anyway
                </button>
                <button
                  type="button"
                  onClick={cancelSubmit}
                  className="rounded-xl border border-amber-300/50 bg-background px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 dark:text-amber-200"
                >
                  Go back
                </button>
              </div>
            </div>
          )}

          <Card className="rounded-3xl">
            <p className="text-xs font-extrabold text-muted-foreground">
              Question <span className="tabular-nums">{idx + 1}</span> of{" "}
              <span className="tabular-nums">{total}</span>
            </p>

            <p className="mt-2 whitespace-pre-wrap text-base font-extrabold leading-snug text-foreground">
              {normalize(String(current?.prompt ?? ""))}
            </p>

            {/* hint row */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-muted-foreground">
                {isWrittenCurrent
                  ? currentQuestionType === "theory"
                    ? "Write your answer, then let AI grade it against the marking points."
                    : "Type a concise answer, then let AI grade it against the model answer."
                  : isRevealed
                  ? "Review the feedback, then tap Next when you're ready."
                  : learningMode
                  ? "Pick an answer to reveal feedback and explanation."
                  : "Choose an answer. Feedback appears after you submit."}
              </p>

              {!isWrittenCurrent && isRevealed ? (
                chosenId === correctOptionId ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] font-extrabold text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Correct
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[12px] font-extrabold text-foreground">
                    <XCircle className="h-4 w-4 text-rose-600" /> Wrong
                  </span>
                )
              ) : null}
            </div>

            {current && hasStudyRef(current.study_ref) && !isRevealed ? (
              studyHintOpen[current.id] ? (
                <PracticeGuidedHint
                  studyRef={current.study_ref}
                  sourceMaterial={sourceMaterial}
                  onReadSource={(page, studyRef) => setReadingRef({ open: true, page, studyRef })}
                  onHide={() => setStudyHintOpen((prev) => ({ ...prev, [current.id]: false }))}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setStudyHintOpen((prev) => ({ ...prev, [current.id]: true }))}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/40"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Show study hint
                </button>
              )
            ) : null}

            {isWrittenCurrent && current ? (
              <div className="mt-4 space-y-3">
                <textarea
                  value={currentWrittenAnswer}
                  onChange={(e) => onWrittenAnswerChange(current.id, e.target.value)}
                  rows={currentQuestionType === "theory" ? 8 : 4}
                  className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition focus:border-[#5B35D5] focus:ring-2 focus:ring-[#5B35D5]/20"
                  placeholder={currentQuestionType === "theory" ? "Write your theory answer here..." : "Type your answer here..."}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {writtenSaving ? "Saving..." : "Saved as you type"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void gradeWrittenAnswer(current.id)}
                    disabled={!currentWrittenAnswer.trim() || currentGradeState.status === "loading"}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold transition",
                      currentWrittenAnswer.trim() && currentGradeState.status !== "loading"
                        ? "border-[#5B35D5]/30 bg-[#EEEDFE] text-[#3B24A8] hover:bg-[#E2DFFE]"
                        : "border-border bg-background text-muted-foreground opacity-60"
                    )}
                  >
                    {currentGradeState.status === "loading" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <BookOpen className="h-3.5 w-3.5" />
                    )}
                    {currentGradeState.status === "loading"
                      ? "Grading..."
                      : currentGradeState.status === "done"
                        ? "Refresh grade"
                        : "Grade answer"}
                  </button>
                </div>

                {writtenCompareOpen ? (
                  <div className="space-y-2">
                    <div className="rounded-2xl border border-border bg-background p-3">
                      <p className="text-xs font-extrabold text-muted-foreground">Your answer</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {currentWrittenAnswer.trim() || "No answer submitted."}
                      </p>
                    </div>
                    {currentGradeState.status === "loading" ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] p-3 text-[#3B24A8] dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10 dark:text-indigo-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm font-semibold">AI is grading your answer...</p>
                      </div>
                    ) : currentGradeState.status === "error" ? (
                      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3">
                        <p className="text-xs font-extrabold text-rose-700 dark:text-rose-300">AI grading failed</p>
                        <p className="mt-1 text-sm text-foreground">{currentGradeState.message}</p>
                      </div>
                    ) : currentGradeState.status === "done" ? (
                      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">AI feedback</p>
                          <span className="rounded-full border border-emerald-500/30 bg-background px-2.5 py-1 text-xs font-extrabold text-foreground">
                            {currentGradeState.grade.score}/{currentGradeState.grade.maxScore} - {verdictLabel(currentGradeState.grade.verdict)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">{currentGradeState.grade.feedback}</p>
                        {currentGradeState.grade.matchedPoints.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">You covered</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                              {currentGradeState.grade.matchedPoints.map((point, pointIndex) => (
                                <li key={`${point}-${pointIndex}`}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {currentGradeState.grade.missingPoints.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-extrabold text-amber-700 dark:text-amber-300">Missing points</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                              {currentGradeState.grade.missingPoints.map((point, pointIndex) => (
                                <li key={`${point}-${pointIndex}`}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {currentGradeState.grade.improvedAnswer ? (
                          <div className="mt-3">
                            <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">Improved answer</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                              {currentGradeState.grade.improvedAnswer}
                            </p>
                          </div>
                        ) : null}
                        <p className="mt-3 text-[11px] font-semibold text-muted-foreground">
                          AI feedback only - official score stays MCQ-only.
                          {currentGradeState.cached ? " Loaded from saved feedback." : ""}
                        </p>
                      </div>
                    ) : null}
                    <div className="rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] p-3 dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10">
                      <p className="text-xs font-extrabold text-[#3B24A8] dark:text-indigo-300">Model answer</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {current.model_answer?.trim() || current.explanation?.trim() || "No model answer provided yet."}
                      </p>
                      {currentMarkingPoints.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-xs font-extrabold text-[#3B24A8] dark:text-indigo-300">Marking points</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                            {currentMarkingPoints.map((point, pointIndex) => (
                              <li key={`${point}-${pointIndex}`}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                    <ConfidencePicker
                      value={currentConfidence}
                      onChange={(value) => setAnswerConfidence(current.id, value)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Options */}
            {!isWrittenCurrent ? (
            <div className="mt-4 grid gap-2">
              {currentOptions.map((o, i) => {
                const checked = chosenId === o.id;
                const isCorrect = getIsCorrect(o);

                const show = isRevealed;

                const isGreen = show && isCorrect;
                const isRed = show && checked && !isCorrect;

                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onPick(o.id)}
                    className={cn(
                      "w-full text-left rounded-2xl border p-3 transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      show && "cursor-default",
                      isGreen && "border-emerald-500/35 bg-emerald-500/10",
                      isRed && "border-rose-500/35 bg-rose-500/10",
                      show && !isGreen && !isRed && "opacity-50",
                      !show && checked && "border-foreground bg-secondary",
                      !show && !checked && "border-border bg-background hover:bg-secondary/50"
                    )}
                    aria-pressed={checked}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-extrabold",
                          isGreen && "border-emerald-500 bg-emerald-500 text-white",
                          isRed && "border-rose-500 bg-rose-500 text-white",
                          !show && checked
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground"
                        )}
                        aria-hidden="true"
                      >
                        {isGreen ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : isRed ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : (
                          String.fromCharCode(65 + i)
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {normalize(o.text ?? "")}
                        </span>

                        {show ? (
                          isCorrect ? (
                            <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-4 w-4" /> Correct answer
                            </span>
                          ) : checked ? (
                            <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-rose-700 dark:text-rose-300">
                              <XCircle className="h-4 w-4" /> Your choice
                            </span>
                          ) : null
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            ) : null}

            {current?.id ? (
              <div className="mt-3 flex justify-end">
                <a
                  href={`/study/report?question=${encodeURIComponent(current.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px]",
                    "text-muted-foreground/60 hover:text-muted-foreground",
                    "transition no-underline"
                  )}
                >
                  <Flag className="h-3 w-3" />
                  Report an error
                </a>
              </div>
            ) : null}

            {/* Navigation + submit */}
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={idx === 0}
                className={cn(
                  "inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-extrabold",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  idx === 0
                    ? "border-border/50 bg-background text-muted-foreground opacity-60"
                    : "border-border bg-background text-foreground hover:bg-secondary/50"
                )}
              >
                Prev
              </button>

              <div className="flex items-center gap-2">
                {!isLast ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className={cn(
                      "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      isRevealed
                        ? "bg-[#5B35D5] text-white hover:bg-[#4526B8]"
                        : "bg-secondary text-foreground hover:opacity-90"
                    )}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitClick}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      learningMode
                        ? "bg-[#5B35D5] text-white hover:bg-[#4526B8]"
                        : "bg-secondary text-foreground"
                    )}
                  >
                    {learningMode ? (
                      <><GraduationCap className="h-4 w-4" /> Finish session</>
                    ) : (
                      <><Send className="h-4 w-4" /> Submit</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* ── Explanation Panel — appears after student answers ────────── */}
          {isRevealed && current ? (
            <div className="space-y-2">
              <ConfidencePicker
                value={currentConfidence}
                onChange={(value) => setAnswerConfidence(current.id, value)}
              />
              {current.explanation ? (
                <div className="rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] px-3 py-3 dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10">
                  <p className="text-xs font-extrabold text-[#3B24A8] dark:text-indigo-300 mb-1">Explanation</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {current.explanation}
                  </p>
                </div>
              ) : null}
              {current.source_topic || current.study_ref?.topic || current.study_ref?.page || current.study_ref?.quote ? (
                <div className="rounded-2xl border border-border bg-card px-3 py-3">
                  <p className="text-xs font-extrabold text-foreground">Source focus</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {current.source_topic || current.study_ref?.topic ? (
                      <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        {current.source_topic ?? current.study_ref?.topic}
                      </span>
                    ) : null}
                    {current.study_ref?.page ? (
                      <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        Page {current.study_ref.page}
                      </span>
                    ) : null}
                  </div>
                  {current.study_ref?.quote ? (
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {current.study_ref.quote}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {explanationOptions && chosenOptionKey && correctOptionKey ? (
                <BetterExplanationInline
                  questionId={current.id}
                  questionPrompt={String(current.prompt ?? "")}
                  options={explanationOptions}
                  chosenOptionKey={chosenOptionKey}
                  chosenOptionText={currentOptions.find((o) => o.id === chosenId)?.text ?? null}
                  correctOptionKey={correctOptionKey}
                  correctOptionText={currentOptions.find((o) => getIsCorrect(o))?.text ?? null}
                  isCorrect={chosenId === correctOptionId}
                  basicExplanation={current.explanation}
                  studyRef={current.study_ref}
                  sourceTopic={current.source_topic}
                />
              ) : null}
            </div>
          ) : null}

        </div>
      )}

      {/* ── Milestone toast ── */}
      {milestone && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
        >
          <div
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-3xl border px-4 py-3 shadow-lg",
              "animate-in slide-in-from-bottom-4 fade-in duration-300",
              MILESTONE_STYLES[milestone.level]
            )}
          >
            <span className="mt-0.5 text-xl leading-none" aria-hidden="true">
              {milestone.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">{milestone.heading}</p>
              <p className="mt-0.5 text-xs font-semibold opacity-80">{milestone.sub}</p>
            </div>
            <button
              type="button"
              onClick={() => setMilestone(null)}
              aria-label="Dismiss"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-xl opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Question navigator */}
      {navOpen && !submitted && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setNavOpen(false)}>
          <div
            className="w-full rounded-t-3xl border-t border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Jump to question</p>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-background hover:bg-secondary/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto">
              {questions.map((q, i) => {
                const isWritten = q.question_type === "short_answer" || q.question_type === "theory";
                const isAnswered = isWritten ? Boolean(writtenAnswers[q.id]?.trim()) : !!answers[q.id];
                const isCurrent = i === idx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => { goToQuestion(i); setNavOpen(false); }}
                    className={cn(
                      "grid h-9 w-full place-items-center rounded-xl border text-xs font-semibold transition",
                      isCurrent
                        ? "border-[#5B35D5] bg-[#5B35D5] text-white"
                        : isAnswered
                          ? "border-emerald-300/50 bg-emerald-50 text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-border bg-background text-muted-foreground hover:bg-secondary/50"
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border-[#5B35D5] bg-[#5B35D5] border inline-block" />
                Current
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border-emerald-300/50 bg-emerald-50 border inline-block" />
                Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border-border bg-background border inline-block" />
                Not yet
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
