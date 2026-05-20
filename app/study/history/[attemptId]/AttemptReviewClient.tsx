"use client";
// app/study/history/[attemptId]/AttemptReviewClient.tsx
import { cn, normalize, pctToColor } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, EmptyState } from "../../_components/StudyUI";
import { BetterExplanationInline, type BetterExplanationOptionKey } from "../../_components/BetterExplanationInline";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flag,
  FlagOff,
  LayoutGrid,
  Loader2,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function scoreGrade(correct: number, total: number) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { pct };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AttemptRow = {
  id: string;
  user_id: string;
  set_id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_questions: number | null;
  scored_questions_count?: number | null;
  written_questions_count?: number | null;
  written_answered_count?: number | null;
  time_spent_seconds: number | null;
};

type SetRow = {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  level: string | null;
  time_limit_minutes: number | null;
};

type QuestionRow = {
  id: string;
  prompt: string;
  explanation: string | null;
  question_type?: "mcq" | "short_answer" | "theory" | null;
  model_answer?: string | null;
  marking_points?: string[] | null;
  source_topic?: string | null;
  study_ref?: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  } | null;
  position: number | null;
};

type OptionRow = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  position: number | null;
};

type ReviewTab = "wrong" | "flagged" | "unanswered" | "all";

function questionTypeOf(q: Pick<QuestionRow, "question_type"> | null | undefined) {
  return q?.question_type === "short_answer" || q?.question_type === "theory" ? q.question_type : "mcq";
}

function isWrittenQuestion(q: Pick<QuestionRow, "question_type"> | null | undefined) {
  return questionTypeOf(q) !== "mcq";
}

function normalizeMarkingPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function scoreDenominator(attempt: Pick<AttemptRow, "scored_questions_count" | "total_questions"> | null) {
  return typeof attempt?.scored_questions_count === "number"
    ? attempt.scored_questions_count
    : attempt?.total_questions ?? 0;
}

/*
type AiExplainState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

function AiExplainInline({
  questionId,
  questionPrompt,
  chosenOptionText,
  correctOptionText,
  isCorrect,
}: {
  questionId: string;
  questionPrompt: string;
  chosenOptionText: string | null | undefined;
  correctOptionText: string | null | undefined;
  isCorrect: boolean;
}) {
  const [state, setState] = useState<AiExplainState>({ status: "idle" });

  async function fetchExplanation() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          questionPrompt,
          chosenOptionText,
          correctOptionText,
          isCorrect,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setState({ status: "error", message: json.error ?? "Something went wrong." });
      } else {
        setState({ status: "done", text: json.explanation });
      }
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    }
  }

  if (state.status === "idle") {
    return (
      <button
        type="button"
        onClick={fetchExplanation}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all",
          "border-primary/20 bg-primary-light hover:bg-primary-light/80",
          "dark:border-primary/30 dark:bg-primary/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-indigo-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-primary-text dark:text-indigo-300">
            Ask AI to go deeper
          </p>
          <p className="text-[11px] text-primary/70 dark:text-primary/60">
            Expanded explanation powered by Gemini
          </p>
        </div>
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
      </button>
    );
  }

  if (state.status === "loading") {
    return (
      <div className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-3",
        "border-primary/20 bg-primary-light dark:border-primary/30 dark:bg-primary/10"
      )}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
        <div>
          <p className="text-xs font-extrabold text-primary-text dark:text-indigo-300">Thinking…</p>
          <p className="text-[11px] text-primary/70">Generating your explanation</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-200/60 bg-rose-50/60 px-3 py-2.5 dark:border-rose-800/40 dark:bg-rose-950/20">
        <p className="text-xs font-extrabold text-rose-700 dark:text-rose-400">
          Couldn&apos;t generate explanation
        </p>
        <button
          type="button"
          onClick={fetchExplanation}
          className="mt-1 text-[11px] text-rose-600 underline dark:text-rose-400"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border px-4 py-3",
      "border-primary/20 bg-primary-light dark:border-primary/30 dark:bg-primary/10"
    )}>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-extrabold text-primary-text dark:text-indigo-300">AI Explanation</p>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-primary-text/85 dark:text-indigo-200">
        {state.text}
      </p>
    </div>
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
// No grade label — just percentage. Less demoralizing, more informative.

*/

function ScoreRing({ pct }: { pct: number }) {
  const size = 56;
  const r = 22;
  const cx = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const color = pctToColor(pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" strokeWidth={4} opacity={0.1} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
        fontSize={11} fontWeight={500} fill="currentColor">
        {pct}%
      </text>
    </svg>
  );
}

// ─── Question Palette (modal) ─────────────────────────────────────────────────

const EXPLAIN_OPTION_KEYS = ["A", "B", "C", "D"] as const;

function optionKeyAt(index: number): BetterExplanationOptionKey | null {
  return EXPLAIN_OPTION_KEYS[index] ?? null;
}

function QuestionPalette({
  open, questions, answers, writtenAnswers, optionsByQ, flagged,
  selectedQ, tab, onSelectQ, onSetTab, onClose,
}: {
  open: boolean;
  questions: QuestionRow[];
  answers: Record<string, string>;
  writtenAnswers: Record<string, string>;
  optionsByQ: Record<string, OptionRow[]>;
  flagged: Record<string, boolean>;
  selectedQ: string | null;
  tab: ReviewTab;
  onSelectQ: (id: string) => void;
  onSetTab: (t: ReviewTab) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-5xl p-3 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6">
        <div className="w-full rounded-3xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-medium text-foreground">Questions</p>
              <p className="mt-1 text-xs text-muted-brand">
                Green = correct · Red = wrong · Grey = skipped
              </p>
            </div>
            <button
              type="button" onClick={onClose}
              className="rounded-2xl p-2 text-xl leading-none hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ×
            </button>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10">
            {questions.map((q, i) => {
              const chosenId = answers[q.id];
              const isWritten = isWrittenQuestion(q);
              const hasWrittenAnswer = Boolean(writtenAnswers[q.id]?.trim());
              const opts = optionsByQ[q.id] ?? [];
              const chosen = chosenId ? opts.find((o) => o.id === chosenId) ?? null : null;
              const ok = Boolean(chosen && chosen.is_correct);
              const isActive = selectedQ === q.id;
              const isFlagged = !!flagged[q.id];
              const tone = isWritten
                ? hasWrittenAnswer
                  ? "border-[#5B35D5]/30 bg-[#EEEDFE] text-foreground dark:bg-[#5B35D5]/10"
                  : "border-border bg-background text-foreground hover:bg-secondary/50"
                : !chosenId
                ? "border-border bg-background text-foreground hover:bg-secondary/50"
                : ok
                ? "border-emerald-300/40 bg-emerald-100/30 text-foreground dark:bg-emerald-950/20"
                : "border-rose-300/40 bg-rose-100/30 text-foreground dark:bg-rose-950/20";

              return (
                <button
                  key={q.id} type="button"
                  onClick={() => onSelectQ(q.id)}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "relative rounded-2xl border py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    tone,
                    isActive ? "ring-2 ring-ring ring-offset-2 ring-offset-card" : ""
                  )}
                >
                  {i + 1}
                  {isFlagged && <span className="absolute -right-1 -top-1 text-xs">🚩</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["wrong", "flagged", "unanswered", "all"] as ReviewTab[]).map((t) => (
              <button
                key={t} type="button" onClick={() => onSetTab(t)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === t
                    ? "border-border bg-secondary text-foreground"
                    : "border-border/60 bg-background text-muted-brand hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                {t === "wrong" ? "Wrong" : t === "flagged" ? "Flagged" : t === "unanswered" ? "Skipped" : "All"}
              </button>
            ))}
            <button
              type="button" onClick={onClose}
              className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AttemptReviewClient() {
  const router = useRouter();
  const params = useParams<{ attemptId: string }>();
  const attemptId = String(params?.attemptId ?? "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [setMeta, setSetMeta] = useState<SetRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [optionsByQ, setOptionsByQ] = useState<Record<string, OptionRow[]>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({});
  const [prevPct, setPrevPct] = useState<number | null>(null);

  const [tab, setTab] = useState<ReviewTab>("all");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);

  const flagsKey = useMemo(() => `jabu:reviewFlags:${attemptId}`, [attemptId]);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [expOpen, setExpOpen] = useState<Record<string, boolean>>({});
  const [understood, setUnderstood] = useState<Record<string, boolean>>({});
  const [understoodSaving, setUnderstoodSaving] = useState<Record<string, boolean>>({});

  const retryKey = useMemo(() => `jabu:retryWrong:${attemptId}`, [attemptId]);



  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        if (!attemptId) throw new Error("Missing attempt id");

        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          router.replace(`/login?next=${encodeURIComponent(`/study/history/${attemptId}`)}`);
          return;
        }

        const { data: att, error: attErr } = await supabase
          .from("study_practice_attempts")
          .select("id,user_id,set_id,status,started_at,submitted_at,score,total_questions,scored_questions_count,written_questions_count,written_answered_count,time_spent_seconds")
          .eq("id", attemptId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (attErr) throw attErr;
        if (!att) throw new Error("Attempt not found");

        const setId = String((att as any).set_id);

        const [setRes, qRes, prevRes] = await Promise.all([
          supabase
            .from("study_quiz_sets")
            .select("id,title,description,course_code,level,time_limit_minutes")
            .eq("id", setId)
            .maybeSingle(),
          supabase
            .from("study_quiz_questions")
            .select("id,prompt,explanation,question_type,model_answer,marking_points,source_topic,study_ref,position")
            .eq("set_id", setId)
            .order("position", { ascending: true }),
          supabase
            .from("study_practice_attempts")
            .select("score,total_questions,scored_questions_count")
            .eq("user_id", user.id)
            .eq("set_id", setId)
            .eq("status", "submitted")
            .neq("id", attemptId)
            .order("submitted_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (setRes.error) throw setRes.error;
        if (qRes.error) throw qRes.error;

        const qs = (qRes.data as any[] | null) ?? [];
        const qIds = qs.map((q) => String(q.id));

        const [optRes, aRes] = await Promise.all([
          qIds.length
            ? supabase
                .from("study_quiz_options")
                .select("id,question_id,text,is_correct,position")
                .in("question_id", qIds)
                .order("position", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("study_attempt_answers")
            .select("question_id,selected_option_id,text_answer")
            .eq("attempt_id", attemptId),
        ]);

        if (optRes.error) throw optRes.error;
        if (aRes.error) throw aRes.error;

        const grouped: Record<string, OptionRow[]> = {};
        for (const o of (optRes.data ?? []) as any[]) {
          const qid = String(o.question_id);
          if (!grouped[qid]) grouped[qid] = [];
          grouped[qid].push({
            id: String(o.id), question_id: qid,
            text: String(o.text ?? ""), is_correct: Boolean(o.is_correct),
            position: typeof o.position === "number" ? o.position : null,
          });
        }

        const aMap: Record<string, string> = {};
        const wMap: Record<string, string> = {};
        for (const r of (aRes.data ?? []) as any[]) {
          if (r?.question_id && r?.selected_option_id) {
            aMap[String(r.question_id)] = String(r.selected_option_id);
          }
          if (r?.question_id && typeof r?.text_answer === "string") {
            wMap[String(r.question_id)] = String(r.text_answer);
          }
        }

        const understoodMap: Record<string, boolean> = {};
        try {
          const { data: uData } = await supabase
            .from("study_attempt_answers")
            .select("question_id,understood")
            .eq("attempt_id", attemptId)
            .eq("understood", true);
          for (const r of (uData ?? []) as any[]) {
            if (r?.question_id) understoodMap[String(r.question_id)] = true;
          }
        } catch { /* column not yet migrated */ }

        let localFlags: Record<string, boolean> = {};
        try {
          const raw = window.localStorage.getItem(flagsKey);
          if (raw) localFlags = JSON.parse(raw);
        } catch { /* ignore */ }

        // Pre-open explanations for wrong answers
        const expSeed: Record<string, boolean> = {};
        for (const q of qs) {
          if (questionTypeOf(q) !== "mcq") continue;
          const qid = String(q.id);
          const chosenId = aMap[qid];
          if (!chosenId) continue;
          const chosen = (grouped[qid] ?? []).find((x) => x.id === chosenId);
          if (chosen && !chosen.is_correct) expSeed[qid] = true;
        }

        let prevPctValue: number | null = null;
        const prevDenominator = scoreDenominator(prevRes.data as any);
        if (prevRes.data?.score != null && prevDenominator > 0) {
          prevPctValue = Math.round((prevRes.data.score / prevDenominator) * 100);
        }

        if (!cancelled) {
          setAttempt(att as any);
          setSetMeta(setRes.data as any);

          const normalizedQs: QuestionRow[] = qs.map((q) => ({
            id: String(q.id),
            prompt: String(q.prompt ?? ""),
            explanation: q.explanation ? String(q.explanation) : null,
            question_type: questionTypeOf(q),
            model_answer: q.model_answer ? String(q.model_answer) : null,
            marking_points: normalizeMarkingPoints(q.marking_points),
            source_topic: q.source_topic ? String(q.source_topic) : null,
            study_ref: q.study_ref && typeof q.study_ref === "object" ? q.study_ref : null,
            position: typeof q.position === "number" ? q.position : null,
          }));

          setQuestions(normalizedQs);
          setOptionsByQ(grouped);
          setAnswers(aMap);
          setWrittenAnswers(wMap);
          setFlagged(localFlags);
          setExpOpen(expSeed);
          setUnderstood(understoodMap);
          setPrevPct(prevPctValue);

          // Default: first wrong → first unanswered → first
          const firstWrong = normalizedQs.find((qq) => {
            if (isWrittenQuestion(qq)) return false;
            const chosen = (grouped[qq.id] ?? []).find((x) => x.id === aMap[qq.id]);
            return !!chosen && !chosen.is_correct;
          })?.id ?? null;
          const firstUnanswered = normalizedQs.find((qq) =>
            isWrittenQuestion(qq) ? !wMap[qq.id]?.trim() : !aMap[qq.id]
          )?.id ?? null;

          // Default tab to "wrong" if any wrong answers exist, else "all"
          if (firstWrong) setTab("wrong");

          setSelectedQ(firstWrong ?? firstUnanswered ?? normalizedQs[0]?.id ?? null);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load review");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [attemptId, router, flagsKey]);

  useEffect(() => {
    try { window.localStorage.setItem(flagsKey, JSON.stringify(flagged)); }
    catch { /* ignore */ }
  }, [flagged, flagsKey]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const derived = useMemo(() => {
    let correct = 0, wrong = 0, unanswered = 0;
    const wrongIds: string[] = [], unansweredIds: string[] = [];
    let scoredTotal = 0, writtenTotal = 0, writtenAnswered = 0;

    for (const q of questions) {
      if (isWrittenQuestion(q)) {
        writtenTotal++;
        if (writtenAnswers[q.id]?.trim()) {
          writtenAnswered++;
        } else {
          unanswered++;
          unansweredIds.push(q.id);
        }
        continue;
      }
      scoredTotal++;
      const chosenId = answers[q.id];
      const opts = optionsByQ[q.id] ?? [];
      if (!chosenId) { unanswered++; unansweredIds.push(q.id); continue; }
      const chosen = opts.find((o) => o.id === chosenId);
      if (chosen?.is_correct) correct++;
      else { wrong++; wrongIds.push(q.id); }
    }

    const flaggedIds = questions.filter((q) => !!flagged[q.id]).map((q) => q.id);

    return { total: questions.length, correct, wrong, unanswered, wrongIds, unansweredIds, flaggedIds, scoredTotal, writtenTotal, writtenAnswered };
  }, [questions, answers, writtenAnswers, optionsByQ, flagged]);

  const filteredList = useMemo(() => {
    if (tab === "wrong") return derived.wrongIds;
    if (tab === "unanswered") return derived.unansweredIds;
    if (tab === "flagged") return derived.flaggedIds;
    return questions.map((q) => q.id);
  }, [tab, derived, questions]);

  const selectedIndexInAll = useMemo(() => {
    if (!selectedQ) return 0;
    const i = questions.findIndex((q) => q.id === selectedQ);
    return i >= 0 ? i : 0;
  }, [selectedQ, questions]);

  const selected = useMemo(() =>
    selectedQ ? questions.find((q) => q.id === selectedQ) ?? null : null,
    [selectedQ, questions]
  );

  const selectedOpts = selected ? optionsByQ[selected.id] ?? [] : [];
  const selectedIsWritten = isWrittenQuestion(selected);
  const selectedWrittenAnswer = selected ? writtenAnswers[selected.id] ?? "" : "";
  const selectedMarkingPoints = Array.isArray(selected?.marking_points) ? selected.marking_points : [];
  const chosenId = selected ? answers[selected.id] : undefined;
  const chosenOpt = selected ? selectedOpts.find((o) => o.id === chosenId) ?? null : null;
  const correctOpt = selected ? selectedOpts.find((o) => o.is_correct) ?? null : null;
  const explanationOptions = useMemo(() => {
    if (selectedOpts.length < 4) return null;
    const mapped = {} as Record<BetterExplanationOptionKey, string>;
    for (let i = 0; i < 4; i += 1) {
      const key = optionKeyAt(i);
      const text = selectedOpts[i]?.text?.trim();
      if (!key || !text) return null;
      mapped[key] = text;
    }
    return mapped;
  }, [selectedOpts]);
  const chosenOptionKey = useMemo(() => {
    const index = selectedOpts.findIndex((o) => o.id === chosenId);
    return index >= 0 ? optionKeyAt(index) : null;
  }, [chosenId, selectedOpts]);
  const correctOptionKey = useMemo(() => {
    const index = selectedOpts.findIndex((o) => o.is_correct);
    return index >= 0 ? optionKeyAt(index) : null;
  }, [selectedOpts]);
  const isWrong = !selectedIsWritten && Boolean(chosenId && chosenOpt && !chosenOpt.is_correct);
  const isUnanswered = Boolean(selected && (selectedIsWritten ? !selectedWrittenAnswer.trim() : !chosenId));

  // ── Handlers ─────────────────────────────────────────────────────────────

  function prev() {
    const i = selectedIndexInAll;
    if (i <= 0) return;
    setSelectedQ(questions[i - 1]?.id ?? selectedQ);
  }

  function next() {
    const i = selectedIndexInAll;
    if (i >= questions.length - 1) return;
    setSelectedQ(questions[i + 1]?.id ?? selectedQ);
  }

  function goToQ(qid: string) {
    setSelectedQ(qid);
    setPaletteOpen(false);
  }

  function toggleFlag(qid: string) {
    setFlagged((p) => ({ ...p, [qid]: !p[qid] }));
  }

  function toggleExplanation(qid: string) {
    setExpOpen((p) => ({ ...p, [qid]: !p[qid] }));
  }

  async function toggleUnderstood(qid: string) {
    const nextVal = !understood[qid];
    setUnderstood((p) => ({ ...p, [qid]: nextVal }));
    setUnderstoodSaving((p) => ({ ...p, [qid]: true }));

    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("study_attempt_answers")
        .update({ understood: nextVal } as any)
        .eq("attempt_id", attemptId)
        .eq("question_id", qid)
        .eq("user_id", uid);

      if (error && !error.message?.includes("understood")) throw error;
    } catch (e: any) {
      if (!e?.message?.includes("understood")) {
        setUnderstood((p) => ({ ...p, [qid]: !nextVal }));
      }
    } finally {
      setUnderstoodSaving((p) => ({ ...p, [qid]: false }));
    }
  }

  function retryWrong() {
    if (!setMeta) return;
    try {
      window.localStorage.setItem(
        retryKey,
        JSON.stringify({ attemptId, setId: setMeta.id, questionIds: derived.wrongIds, createdAt: Date.now() })
      );
    } catch { /* ignore */ }
    router.push(
      `/study/practice/${encodeURIComponent(setMeta.id)}?retry=wrong&fromAttempt=${encodeURIComponent(attemptId)}`
    );
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 pb-10">
        <Card className="rounded-3xl">
          <div className="flex items-center gap-2 text-sm text-muted-brand">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading review…
          </div>
        </Card>
      </div>
    );
  }

  if (err || !attempt || !setMeta) {
    return (
      <div className="space-y-4 pb-10">
        <button
          type="button" onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <EmptyState
          title="Couldn't open review" description={err ?? "Missing data"}
          icon={<AlertTriangle className="h-5 w-5" />}
          action={
            <Link href="/study/history" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-secondary/50">
              Back to history <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </div>
    );
  }

  const scoreTotal = scoreDenominator(attempt) || derived.scoredTotal;
  const { pct } = scoreGrade(derived.correct, scoreTotal);
  const headerCode = normalize(String(setMeta.course_code ?? "")).toUpperCase();
  const scoreDiff = attempt.score != null && scoreTotal > 0 && prevPct != null
    ? pct - prevPct : null;

  // Progress bar: position in all questions
  const progressPct = derived.total > 0 ? Math.round(((selectedIndexInAll + 1) / derived.total) * 100) : 0;

  return (
    <div className="space-y-4 pb-28">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button" onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Continue attempt = resume in-progress */}
          <Link
            href={`/study/practice/${encodeURIComponent(setMeta.id)}?attempt=${encodeURIComponent(attempt.id)}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground no-underline hover:bg-secondary/50"
          >
            <RefreshCcw className="h-4 w-4" />
            Continue attempt
          </Link>

          {/* Retry wrong — persistent CTA, only visible when wrongs exist */}
          {derived.wrongIds.length > 0 && (
            <button
              type="button" onClick={retryWrong}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retry wrong ({derived.wrongIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Thin progress line */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/30">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Score summary card ─────────────────────────────────────────────── */}
      <Card className="rounded-3xl">
        <div className="flex items-start gap-3">
          <ScoreRing pct={pct} />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-foreground">
              {normalize(String(setMeta.title ?? "Practice"))}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {headerCode && (
                <Link
                  href={`/study/courses/${encodeURIComponent(headerCode)}`}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground no-underline hover:bg-secondary/50"
                >
                  {headerCode}
                </Link>
              )}
              {setMeta.level && (
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-brand">
                  {String(setMeta.level)}L
                </span>
              )}
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  attempt.status !== "submitted" && "border-primary/30 bg-primary-light text-primary-text"
                )}
                style={
                  attempt.status === "submitted"
                    ? { background: "#EAF3DE", color: "#3B6D11", borderColor: "#97C459" }
                    : undefined
                }
              >
                {attempt.status === "submitted" ? "Submitted" : "In progress"}
              </span>
            </div>

            {/* vs previous attempt */}
            {scoreDiff != null && scoreDiff !== 0 && (
              <div
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 text-xs font-medium",
                  scoreDiff > 0
                    ? "border border-emerald-300/40 bg-emerald-100/30 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border border-rose-300/40 bg-rose-100/30 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
                )}
              >
                {scoreDiff > 0
                  ? <TrendingUp className="h-3.5 w-3.5" />
                  : <TrendingDown className="h-3.5 w-3.5" />}
                {scoreDiff > 0 ? "+" : ""}{scoreDiff}% vs last attempt
              </div>
            )}
          </div>
        </div>

        {/* Stats row — neutral framing: skipped is grey, correct is green */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: "Wrong", value: derived.wrong, color: derived.wrong > 0 ? "#A32D2D" : undefined },
            { label: "Skipped", value: derived.unanswered, color: undefined },
            { label: "MCQ correct", value: `${derived.correct}/${scoreTotal || derived.scoredTotal}`, color: derived.correct > 0 ? "#3B6D11" : undefined },
            { label: "Written", value: `${derived.writtenAnswered}/${derived.writtenTotal}`, color: undefined },
            { label: "Time", value: fmtDuration(attempt.time_spent_seconds), color: undefined },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl bg-secondary/50 p-2 text-center">
              <p className="text-base font-medium tabular-nums text-foreground" style={color ? { color } : undefined}>
                {value}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-brand">{label}</p>
            </div>
          ))}
        </div>

        {/* Single filter chip row — replaces the two-tab system */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: "all" as ReviewTab, label: "All", count: derived.total },
              { key: "wrong" as ReviewTab, label: "Wrong", count: derived.wrong },
              { key: "unanswered" as ReviewTab, label: "Skipped", count: derived.unanswered },
              { key: "flagged" as ReviewTab, label: "Flagged", count: derived.flaggedIds.length },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key} type="button"
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/60 bg-background text-muted-brand hover:text-foreground"
              )}
            >
              {label}
              <span className="opacity-60">{count}</span>
            </button>
          ))}

          <button
            type="button" onClick={() => setPaletteOpen(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid view
          </button>
        </div>
      </Card>

      {/* ── Main two-column layout ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[300px,1fr]">

        {/* LEFT — Question list (desktop sidebar, hidden on mobile) */}
        <Card className="hidden rounded-3xl lg:block">
          <p className="text-sm font-medium text-foreground">Questions</p>
          <p className="mt-1 text-xs text-muted-brand">
            Tap a question to review it.
          </p>

          {filteredList.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                variant="compact"
                title="Nothing here"
                description="No questions match this filter."
                icon={<AlertTriangle className="h-5 w-5" />}
              />
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              {filteredList.map((qid) => {
                const qIndex = questions.findIndex((q) => q.id === qid);
                const q = questions[qIndex];
                const isActive = selectedQ === qid;
                const isWritten = isWrittenQuestion(q);
                const hasWrittenAnswer = Boolean(writtenAnswers[qid]?.trim());
                const chosenIdForQ = answers[qid];
                const opts = optionsByQ[qid] ?? [];
                const chosen = chosenIdForQ ? opts.find((o) => o.id === chosenIdForQ) : null;
                const ok = Boolean(chosen && chosen.is_correct);
                const isUnderstood = !!understood[qid];

                return (
                  <button
                    key={qid} type="button"
                    onClick={() => setSelectedQ(qid)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive ? "border-border bg-secondary" : "border-border/70 bg-card hover:bg-secondary/40"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted-brand">Question {qIndex + 1}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                        {normalize(q?.prompt ?? "")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        {flagged[qid] && <span className="rounded-full border border-border bg-background px-2 py-0.5">🚩</span>}
                        {isUnderstood && (
                          <span className="rounded-full border border-emerald-300/40 bg-emerald-100/30 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
                            Got it
                          </span>
                        )}
                        {isWritten ? (
                          <span className="rounded-full border border-[#5B35D5]/20 bg-[#EEEDFE] px-2 py-0.5 text-[#3B24A8]">
                            {hasWrittenAnswer ? "Written" : "Skipped"}
                          </span>
                        ) : !chosenIdForQ ? (
                          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-muted-brand">Skipped</span>
                        ) : ok ? (
                          <span className="rounded-full border border-emerald-300/40 bg-emerald-100/30 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">Correct</span>
                        ) : (
                          <span className="rounded-full border border-rose-300/40 bg-rose-100/30 px-2 py-0.5 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300">Wrong</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-0.5 shrink-0">
                      {isWritten ? (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] text-sm font-medium text-[#3B24A8]">
                          T
                        </span>
                      ) : !chosenIdForQ ? (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-border bg-background text-sm text-muted-brand">—</span>
                      ) : ok ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <Link
            href="/study/history"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground no-underline hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookOpen className="h-4 w-4" />
            All attempts
          </Link>
        </Card>

        {/* RIGHT — Question detail */}
        <Card className="rounded-3xl">
          {!selected ? (
            <p className="text-sm text-muted-brand">Select a question to review.</p>
          ) : (
            <>
              {/* Question header row */}
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-brand">
                  Question <span className="font-medium text-foreground">{selectedIndexInAll + 1}</span> of {derived.total}
                </p>
                <button
                  type="button"
                  onClick={() => toggleFlag(selected.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    flagged[selected.id]
                      ? "border-border bg-secondary text-foreground"
                      : "border-border bg-background text-muted-brand hover:text-foreground"
                  )}
                >
                  {flagged[selected.id]
                    ? <><FlagOff className="h-3.5 w-3.5" /> Flagged</>
                    : <><Flag className="h-3.5 w-3.5" /> Flag</>
                  }
                </button>
              </div>

              {/* Prompt */}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {normalize(selected.prompt)}
              </p>

              {selectedIsWritten ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-xs font-medium text-muted-brand">Your answer</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {selectedWrittenAnswer.trim() || "No answer submitted."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary-light p-4 dark:border-primary/30 dark:bg-primary/10">
                    <p className="text-xs font-medium text-primary-text dark:text-indigo-300">Model answer</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {selected.model_answer?.trim() || selected.explanation?.trim() || "No model answer provided yet."}
                    </p>
                    {selectedMarkingPoints.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-primary-text dark:text-indigo-300">Marking points</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                          {selectedMarkingPoints.map((point, pointIndex) => (
                            <li key={`${point}-${pointIndex}`}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Options */}
              {!selectedIsWritten ? (
              <div className="mt-4 grid gap-2">
                {selectedOpts.map((o, i) => {
                  const isChosen = chosenId === o.id;
                  const isCorrect = o.is_correct;
                  const showWrongChosen = isChosen && !isCorrect;

                  return (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border px-4 py-3",
                        isCorrect
                          ? "border-emerald-300/40 bg-emerald-100/30 dark:bg-emerald-950/20"
                          : showWrongChosen
                          ? "border-rose-300/40 bg-rose-100/30 dark:bg-rose-950/20"
                          : "border-border bg-background"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isCorrect ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" style={{ width: 18, height: 18 }} />
                        ) : showWrongChosen ? (
                          <XCircle className="h-4.5 w-4.5 text-rose-600" style={{ width: 18, height: 18 }} />
                        ) : (
                          <div className="h-4.5 w-4.5 rounded-full border border-border" style={{ width: 18, height: 18 }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                          {String.fromCharCode(65 + i)}. {normalize(o.text)}
                        </p>
                        {isChosen && (
                          <p className={cn("mt-0.5 text-xs font-medium", isCorrect ? "text-emerald-700" : "text-rose-700")}>
                            {isCorrect ? "Correct answer" : "Your choice"}
                          </p>
                        )}
                        {!isChosen && isCorrect && (
                          <p className="mt-0.5 text-xs font-medium text-emerald-700">Correct answer</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : null}

              {/* Explanation */}
              {!selectedIsWritten ? (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                <button
                  type="button"
                  onClick={() => toggleExplanation(selected.id)}
                  className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Explanation</p>
                    {isWrong && (
                      <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] text-primary-text">
                        Auto-opened
                      </span>
                    )}
                  </div>
                  {expOpen[selected.id]
                    ? <ChevronUp className="h-4 w-4 text-muted-brand" />
                    : <ChevronDown className="h-4 w-4 text-muted-brand" />
                  }
                </button>

                {expOpen[selected.id] && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-brand">
                    {normalize(selected.explanation ?? "No explanation provided.")}
                  </p>
                )}
              </div>
              ) : null}

              {/* Mark as understood + correct answer label */}
              {(isWrong || isUnanswered) && (
                <>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleUnderstood(selected.id)}
                      disabled={understoodSaving[selected.id]}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        understood[selected.id]
                          ? "border-emerald-300/40 bg-emerald-100/30 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                          : "border-border bg-background text-foreground hover:bg-secondary/50",
                        understoodSaving[selected.id] ? "opacity-60" : ""
                      )}
                    >
                      <div
                        className={cn("h-3.5 w-3.5 rounded-full border-2 flex-shrink-0", understood[selected.id] ? "border-emerald-600 bg-emerald-600" : "border-border")}
                      />
                      {understood[selected.id] ? "Got it" : "Mark as understood"}
                    </button>

                    {!selectedIsWritten && correctOpt && (
                      <p className="text-right text-xs text-muted-brand">
                        Correct: <span className="font-medium text-foreground">{normalize(correctOpt.text)}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-3">
                    {!selectedIsWritten && explanationOptions && chosenOptionKey && correctOptionKey ? (
                      <BetterExplanationInline
                        questionId={selected.id}
                        questionPrompt={selected.prompt}
                        options={explanationOptions}
                        chosenOptionKey={chosenOptionKey}
                        chosenOptionText={chosenOpt?.text ?? null}
                        correctOptionKey={correctOptionKey}
                        correctOptionText={correctOpt?.text ?? null}
                        isCorrect={false}
                        basicExplanation={selected.explanation}
                        studyRef={selected.study_ref}
                        sourceTopic={selected.source_topic}
                      />
                    ) : null}
                  </div>
                </>
              )}
            </>
          )}
        </Card>
      </div>

      {/* ── Sticky bottom nav ─────────────────────────────────────────────── */}
      {/* Global BottomNav is hidden on this page via layout.tsx — so bottom-0 is clean */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
        <div>
          <div className="rounded-3xl border border-border bg-background/90 p-3 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button" onClick={prev}
                disabled={selectedIndexInAll <= 0}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedIndexInAll <= 0
                    ? "border-border/50 bg-background text-muted-brand opacity-50"
                    : "border-border bg-background text-foreground hover:bg-secondary/50"
                )}
              >
                <ArrowLeft className="h-4 w-4" /> Prev
              </button>

              {/* Counter + mini summary */}
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {selectedIndexInAll + 1} / {derived.total}
                </p>
                <p className="text-[10px] text-muted-brand">
                  {derived.wrong > 0 ? `${derived.wrong} wrong` : ""}
                  {derived.wrong > 0 && derived.unanswered > 0 ? " · " : ""}
                  {derived.unanswered > 0 ? `${derived.unanswered} skipped` : ""}
                  {derived.wrong === 0 && derived.unanswered === 0 ? "all answered" : ""}
                </p>
              </div>

              <button
                type="button" onClick={next}
                disabled={selectedIndexInAll >= questions.length - 1}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedIndexInAll >= questions.length - 1 ? "opacity-50" : ""
                )}
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Question palette modal */}
      <QuestionPalette
        open={paletteOpen}
        questions={questions}
        answers={answers}
        writtenAnswers={writtenAnswers}
        optionsByQ={optionsByQ}
        flagged={flagged}
        selectedQ={selectedQ}
        tab={tab}
        onSelectQ={goToQ}
        onSetTab={setTab}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
