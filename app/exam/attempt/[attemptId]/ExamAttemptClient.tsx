"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock3, Flag, Grid3X3, Loader2, Send, WifiOff, X } from "lucide-react";
import { cn, msToClock } from "@/lib/utils";

type ExamOption = { id: string; text: string };
type ExamQuestion = { id: string; position: number; prompt: string; options: ExamOption[] };
type ExamResponse = { selectedOptionId: string | null; flagged: boolean; savedAt?: string | null };
type AttemptPayload = {
  id: string;
  setId: string;
  setTitle: string;
  courseCode: string;
  kind: "diagnostic" | "mock";
  startedAt: string;
  deadlineAt: string;
  questions: ExamQuestion[];
  responses: Record<string, ExamResponse>;
};

export default function ExamAttemptClient() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const attemptId = String(params.attemptId ?? "");
  const [attempt, setAttempt] = useState<AttemptPayload | null>(null);
  const [responses, setResponses] = useState<Record<string, ExamResponse>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/exam/attempts/${encodeURIComponent(attemptId)}`, { cache: "no-store" });
        const data = await response.json().catch(() => null) as {
          ok?: boolean;
          attempt?: AttemptPayload;
          resultUrl?: string;
          message?: string;
        } | null;
        if (response.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent(`/exam/attempt/${attemptId}`)}`);
          return;
        }
        if (response.status === 409 && data?.resultUrl) {
          router.replace(data.resultUrl);
          return;
        }
        if (!response.ok || !data?.ok || !data.attempt) throw new Error(data?.message || "Could not load this exam.");
        if (!cancelled) {
          setAttempt(data.attempt);
          setResponses(data.attempt.responses ?? {});
          const firstUnanswered = data.attempt.questions.findIndex((question) => !data.attempt?.responses?.[question.id]?.selectedOptionId);
          setIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
          setRemainingMs(Math.max(0, new Date(data.attempt.deadlineAt).getTime() - Date.now()));
        }
      } catch (cause) {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : "Could not load this exam.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [attemptId, router]);

  const submitAttempt = useCallback(async (reason: "manual" | "timeup") => {
    if (!attempt || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/exam/attempts/${encodeURIComponent(attempt.id)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; resultUrl?: string; message?: string } | null;
      if (!response.ok || !data?.ok || !data.resultUrl) throw new Error(data?.message || "Could not submit this attempt.");
      router.replace(data.resultUrl);
    } catch (cause) {
      submittingRef.current = false;
      setSubmitting(false);
      setSaveError(cause instanceof Error ? cause.message : "Could not submit this attempt.");
    }
  }, [attempt, router]);

  useEffect(() => {
    if (!attempt) return;
    const tick = () => setRemainingMs(Math.max(0, new Date(attempt.deadlineAt).getTime() - Date.now()));
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (remainingMs !== 0 || !attempt || submittingRef.current) return;
    void submitAttempt("timeup");
  }, [attempt, remainingMs, submitAttempt]);

  useEffect(() => {
    if (!attempt) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (submittingRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [attempt]);

  async function saveResponse(questionId: string, changes: Partial<ExamResponse>) {
    const previous = responses[questionId] ?? { selectedOptionId: null, flagged: false };
    const next = { ...previous, ...changes };
    setResponses((current) => ({ ...current, [questionId]: next }));
    setSaving((current) => ({ ...current, [questionId]: true }));
    setSaveError(null);
    try {
      const response = await fetch(`/api/exam/attempts/${encodeURIComponent(attemptId)}/responses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, ...changes }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; savedAt?: string; code?: string; message?: string } | null;
      if (response.status === 409 && (data?.code === "ATTEMPT_EXPIRED" || data?.code === "ATTEMPT_SUBMITTED")) {
        await submitAttempt("timeup");
        return;
      }
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Your answer was not saved.");
      setResponses((current) => ({ ...current, [questionId]: { ...next, savedAt: data.savedAt } }));
    } catch (cause) {
      setResponses((current) => ({ ...current, [questionId]: previous }));
      setSaveError(cause instanceof Error ? cause.message : "Your answer was not saved.");
    } finally {
      setSaving((current) => ({ ...current, [questionId]: false }));
    }
  }

  const answered = useMemo(() => attempt?.questions.filter((question) => responses[question.id]?.selectedOptionId).length ?? 0, [attempt, responses]);
  const flagged = useMemo(() => attempt?.questions.filter((question) => responses[question.id]?.flagged).length ?? 0, [attempt, responses]);
  const hasPendingSaves = useMemo(() => Object.values(saving).some(Boolean), [saving]);

  if (loading) {
    return <div className="grid min-h-dvh place-items-center"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-violet-400" /><p className="mt-3 text-sm font-semibold text-zinc-300">Preparing your secure exam…</p></div></div>;
  }
  if (loadError || !attempt) {
    return <div className="grid min-h-dvh place-items-center px-4"><div className="w-full max-w-md rounded-3xl border border-rose-400/20 bg-zinc-900 p-6 text-center"><AlertTriangle className="mx-auto h-7 w-7 text-rose-400" /><h1 className="mt-3 text-xl font-black">Could not open attempt</h1><p className="mt-2 text-sm text-zinc-400">{loadError || "Attempt not found."}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-zinc-950">Try again</button></div></div>;
  }

  const current = attempt.questions[index];
  const currentResponse = responses[current.id] ?? { selectedOptionId: null, flagged: false };
  const lowTime = remainingMs !== null && remainingMs <= 5 * 60_000;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{attempt.courseCode} · {attempt.setTitle}</p><p className="mt-0.5 text-[11px] font-semibold text-zinc-500">{attempt.kind === "diagnostic" ? "Free diagnostic" : "Full mock exam"}</p></div>
          <div className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-2 font-mono text-sm font-black tabular-nums", lowTime ? "border-rose-400/40 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/5 text-white")}>
            <Clock3 className="h-4 w-4" /> {msToClock(remainingMs ?? 0)}
          </div>
          <button type="button" onClick={() => setPaletteOpen(true)} className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-200 lg:hidden" aria-label="Open question navigator"><Grid3X3 className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 md:px-6 lg:grid-cols-[1fr_280px]">
        <main className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3 text-xs font-bold text-zinc-400"><span>Question {index + 1} of {attempt.questions.length}</span><span>{saving[current.id] ? "Saving…" : currentResponse.savedAt ? "Saved · " : ""}{answered} answered · {flagged} flagged</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${((index + 1) / attempt.questions.length) * 100}%` }} /></div>

          {saveError ? <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> {saveError}</div> : null}

          <section className="mt-5 rounded-3xl border border-white/10 bg-zinc-900 p-5 shadow-2xl md:p-7">
            <div className="flex items-start gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-sm font-black text-violet-300">{index + 1}</span>
              <h1 className="pt-1 text-lg font-bold leading-8 text-white md:text-xl">{current.prompt}</h1>
            </div>
            <div className="mt-7 space-y-3">
              {current.options.map((option, optionIndex) => {
                const selected = currentResponse.selectedOptionId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={submitting || Boolean(saving[current.id])}
                    onClick={() => void saveResponse(current.id, { selectedOptionId: option.id })}
                    className={cn("flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition", selected ? "border-violet-400 bg-violet-500/15 text-white" : "border-white/10 bg-zinc-950/50 text-zinc-200 hover:border-white/25 hover:bg-white/5")}
                  >
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-xs font-black", selected ? "border-violet-300 bg-violet-400 text-zinc-950" : "border-white/15 bg-white/5 text-zinc-400")}>{selected ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + optionIndex)}</span>
                    <span className="pt-1 text-sm font-semibold leading-6">{option.text}</span>
                    {saving[current.id] && selected ? <Loader2 className="ml-auto mt-1 h-4 w-4 shrink-0 animate-spin text-violet-300" /> : null}
                  </button>
                );
              })}
            </div>
            <button type="button" disabled={submitting || Boolean(saving[current.id])} onClick={() => void saveResponse(current.id, { flagged: !currentResponse.flagged })} className={cn("mt-5 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50", currentResponse.flagged ? "border-amber-300/40 bg-amber-400/10 text-amber-300" : "border-white/10 text-zinc-400 hover:text-white")}><Flag className="h-4 w-4" /> {currentResponse.flagged ? "Flagged for review" : "Flag for review"}</button>
          </section>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" disabled={index === 0 || submitting} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-200 disabled:opacity-35"><ArrowLeft className="h-4 w-4" /> Previous</button>
            {index < attempt.questions.length - 1 ? (
              <button type="button" disabled={submitting} onClick={() => setIndex((value) => Math.min(attempt.questions.length - 1, value + 1))} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950">Next <ArrowRight className="h-4 w-4" /></button>
            ) : (
              <button type="button" disabled={submitting || hasPendingSaves} onClick={() => { if (window.confirm(`Submit now? You answered ${answered} of ${attempt.questions.length} questions.`)) void submitAttempt("manual"); }} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-emerald-950 disabled:opacity-60">{submitting || hasPendingSaves ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {hasPendingSaves ? "Saving answer" : "Submit exam"}</button>
            )}
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-21 rounded-3xl border border-white/10 bg-zinc-900 p-4">
            <div className="flex items-center justify-between"><p className="text-sm font-black">Questions</p><span className="text-xs font-bold text-zinc-500">{answered}/{attempt.questions.length}</span></div>
            <QuestionPalette questions={attempt.questions} responses={responses} currentIndex={index} onPick={setIndex} />
            <button type="button" disabled={submitting || hasPendingSaves} onClick={() => { if (window.confirm(`Submit now? You answered ${answered} of ${attempt.questions.length} questions.`)) void submitAttempt("manual"); }} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-emerald-950 disabled:opacity-60">{submitting || hasPendingSaves ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {hasPendingSaves ? "Saving answer" : "Submit exam"}</button>
          </div>
        </aside>
      </div>

      {paletteOpen ? (
        <div className="fixed inset-0 z-50 bg-black/75 p-4 backdrop-blur-sm lg:hidden" role="dialog" aria-modal="true">
          <div className="mx-auto mt-12 max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-5">
            <div className="flex items-center justify-between"><p className="font-black">Jump to question</p><button onClick={() => setPaletteOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5"><X className="h-4 w-4" /></button></div>
            <QuestionPalette questions={attempt.questions} responses={responses} currentIndex={index} onPick={(next) => { setIndex(next); setPaletteOpen(false); }} />
          </div>
        </div>
      ) : null}

      {submitting ? <div className="fixed inset-0 z-[60] grid place-items-center bg-zinc-950/85 backdrop-blur-sm"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-400" /><p className="mt-3 font-black">Submitting your saved answers…</p></div></div> : null}
    </div>
  );
}

function QuestionPalette({ questions, responses, currentIndex, onPick }: { questions: ExamQuestion[]; responses: Record<string, ExamResponse>; currentIndex: number; onPick: (index: number) => void }) {
  return (
    <div className="mt-4 grid grid-cols-5 gap-2">
      {questions.map((question, index) => {
        const response = responses[question.id];
        return <button key={question.id} type="button" onClick={() => onPick(index)} className={cn("relative grid aspect-square place-items-center rounded-xl border text-xs font-black transition", currentIndex === index ? "border-violet-300 bg-violet-500 text-white" : response?.selectedOptionId ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white")}>
          {index + 1}
          {response?.flagged ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" /> : null}
        </button>;
      })}
    </div>
  );
}
