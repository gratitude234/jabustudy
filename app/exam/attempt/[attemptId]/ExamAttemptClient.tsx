"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Flag,
  Grid3X3,
  Loader2,
  RefreshCw,
  Send,
  WifiOff,
  X,
} from "lucide-react";
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

type ResponseChanges = {
  selectedOptionId?: string | null;
  flagged?: boolean;
};

type PendingResponse = {
  changes: ResponseChanges;
  revision: number;
  queuedAt: string;
};

type LocalDraft = {
  deadlineAt: string;
  responses: Record<string, ExamResponse>;
  pending: Record<string, PendingResponse>;
};

type SyncState = "saved" | "saving" | "retrying" | "offline" | "error";

function parseLocalDraft(value: string | null): LocalDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as LocalDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.responses || !parsed.pending) return null;
    return parsed;
  } catch {
    return null;
  }
}

function coursePath(courseCode: string) {
  const slug = courseCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? `/exam/${slug}` : "/exam";
}

export default function ExamAttemptClient() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const attemptId = String(params.attemptId ?? "");
  const storageKey = `jabu-exam-draft:${attemptId}`;

  const [attempt, setAttempt] = useState<AttemptPayload | null>(null);
  const [responses, setResponses] = useState<Record<string, ExamResponse>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("saved");
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);

  const attemptRef = useRef<AttemptPayload | null>(null);
  const responsesRef = useRef<Record<string, ExamResponse>>({});
  const pendingRef = useRef<Record<string, PendingResponse>>({});
  const revisionRef = useRef(0);
  const flushPromiseRef = useRef<Promise<boolean> | null>(null);
  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const updateResponses = useCallback((next: Record<string, ExamResponse>) => {
    responsesRef.current = next;
    setResponses(next);
  }, []);

  const updatePendingCount = useCallback(() => {
    setPendingCount(Object.keys(pendingRef.current).length);
  }, []);

  const persistPendingDraft = useCallback(() => {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || typeof window === "undefined") return;
    if (Object.keys(pendingRef.current).length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    const draft: LocalDraft = {
      deadlineAt: currentAttempt.deadlineAt,
      responses: responsesRef.current,
      pending: pendingRef.current,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [storageKey]);

  const flushPending = useCallback(async () => {
    if (flushPromiseRef.current) return flushPromiseRef.current;

    const task = (async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOnline(false);
        setSyncState("offline");
        persistPendingDraft();
        return false;
      }

      while (Object.keys(pendingRef.current).length > 0) {
        const entry = Object.entries(pendingRef.current)[0];
        if (!entry) break;
        const [questionId, pending] = entry;
        setSyncState("saving");
        setSaveError(null);

        try {
          const response = await fetch(`/api/exam/attempts/${encodeURIComponent(attemptId)}/responses`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId, ...pending.changes }),
          });
          const data = await response.json().catch(() => null) as {
            ok?: boolean;
            savedAt?: string;
            code?: string;
            message?: string;
          } | null;

          if (response.status === 409 && (data?.code === "ATTEMPT_EXPIRED" || data?.code === "ATTEMPT_SUBMITTED")) {
            pendingRef.current = {};
            updatePendingCount();
            window.localStorage.removeItem(storageKey);
            router.replace(`/exam/result/${encodeURIComponent(attemptId)}`);
            return false;
          }
          if (!response.ok || !data?.ok) throw new Error(data?.message || "Your answer could not reach the server.");

          if (pendingRef.current[questionId]?.revision === pending.revision) {
            delete pendingRef.current[questionId];
          }
          const nextResponses = {
            ...responsesRef.current,
            [questionId]: {
              ...(responsesRef.current[questionId] ?? { selectedOptionId: null, flagged: false }),
              savedAt: data.savedAt ?? new Date().toISOString(),
            },
          };
          updateResponses(nextResponses);
          updatePendingCount();
          persistPendingDraft();
        } catch (cause) {
          const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
          setOnline(!isOffline);
          setSyncState(isOffline ? "offline" : "error");
          setSaveError(cause instanceof Error ? cause.message : "Your answer is saved on this phone but has not synced yet.");
          persistPendingDraft();
          return false;
        }
      }

      setSyncState("saved");
      setSaveError(null);
      return true;
    })();

    flushPromiseRef.current = task;
    try {
      return await task;
    } finally {
      flushPromiseRef.current = null;
    }
  }, [attemptId, persistPendingDraft, router, storageKey, updatePendingCount, updateResponses]);

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
        if (cancelled) return;

        const loadedAttempt = data.attempt;
        attemptRef.current = loadedAttempt;
        setAttempt(loadedAttempt);

        const localDraft = parseLocalDraft(window.localStorage.getItem(storageKey));
        const canRestore = localDraft?.deadlineAt === loadedAttempt.deadlineAt;
        const pending = canRestore ? localDraft.pending : {};
        pendingRef.current = pending;
        const mergedResponses = { ...loadedAttempt.responses };
        if (canRestore) {
          for (const questionId of Object.keys(pending)) {
            if (localDraft.responses[questionId]) mergedResponses[questionId] = localDraft.responses[questionId];
          }
        } else {
          window.localStorage.removeItem(storageKey);
        }
        updateResponses(mergedResponses);
        updatePendingCount();

        const firstUnanswered = loadedAttempt.questions.findIndex((question) => !mergedResponses[question.id]?.selectedOptionId);
        setIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
        setRemainingMs(Math.max(0, new Date(loadedAttempt.deadlineAt).getTime() - Date.now()));
        if (Object.keys(pending).length > 0) {
          setSyncState(navigator.onLine ? "retrying" : "offline");
          window.setTimeout(() => void flushPending(), 0);
        }
      } catch (cause) {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : "Could not load this exam.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [attemptId, flushPending, router, storageKey, updatePendingCount, updateResponses]);

  const queueResponse = useCallback((questionId: string, changes: ResponseChanges) => {
    const previous = responsesRef.current[questionId] ?? { selectedOptionId: null, flagged: false };
    const next = { ...previous, ...changes };
    updateResponses({ ...responsesRef.current, [questionId]: next });

    revisionRef.current += 1;
    const existing = pendingRef.current[questionId];
    pendingRef.current[questionId] = {
      changes: { ...(existing?.changes ?? {}), ...changes },
      revision: revisionRef.current,
      queuedAt: new Date().toISOString(),
    };
    updatePendingCount();
    setSyncState(navigator.onLine ? "saving" : "offline");
    persistPendingDraft();
    void flushPending();
  }, [flushPending, persistPendingDraft, updatePendingCount, updateResponses]);

  const submitAttempt = useCallback(async (reason: "manual" | "timeup") => {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);

    try {
      const flushed = await flushPending();
      if (!flushed && Object.keys(pendingRef.current).length > 0) {
        throw new Error(reason === "timeup"
          ? "Time is up. Reconnect so we can finish submitting the answers that reached this phone."
          : "Some answers are still only on this phone. Reconnect or retry before submitting.");
      }

      const response = await fetch(`/api/exam/attempts/${encodeURIComponent(currentAttempt.id)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; resultUrl?: string; message?: string } | null;
      if (!response.ok || !data?.ok || !data.resultUrl) throw new Error(data?.message || "Could not submit this attempt.");
      window.localStorage.removeItem(storageKey);
      router.replace(data.resultUrl);
    } catch (cause) {
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitDialogOpen(true);
      setSaveError(cause instanceof Error ? cause.message : "Could not submit this attempt. Retry safely.");
    }
  }, [flushPending, router, storageKey]);

  const leaveAttempt = useCallback(async () => {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || leaving) return;
    setLeaving(true);
    try {
      await flushPending();
      persistPendingDraft();
      router.push(coursePath(currentAttempt.courseCode));
    } finally {
      setLeaving(false);
    }
  }, [flushPending, leaving, persistPendingDraft, router]);

  useEffect(() => {
    if (!attempt) return;
    const tick = () => setRemainingMs(Math.max(0, new Date(attempt.deadlineAt).getTime() - Date.now()));
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (remainingMs !== 0 || !attempt || submittingRef.current) return;
    setTimeExpired(true);
    void submitAttempt("timeup");
  }, [attempt, remainingMs, submitAttempt]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      if (Object.keys(pendingRef.current).length > 0) {
        setSyncState("retrying");
        void flushPending();
      }
      if (timeExpired && !submittingRef.current) void submitAttempt("timeup");
    };
    const onOffline = () => {
      setOnline(false);
      if (Object.keys(pendingRef.current).length > 0) setSyncState("offline");
    };
    const initialStatusTimer = window.setTimeout(() => setOnline(navigator.onLine), 0);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const retryTimer = window.setInterval(() => {
      if (navigator.onLine && Object.keys(pendingRef.current).length > 0 && !flushPromiseRef.current) {
        setSyncState("retrying");
        void flushPending();
      }
    }, 5_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearTimeout(initialStatusTimer);
      window.clearInterval(retryTimer);
    };
  }, [flushPending, submitAttempt, timeExpired]);

  useEffect(() => {
    if (!attempt) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (submittingRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [attempt]);

  const overlayOpen = paletteOpen || submitDialogOpen || leaveDialogOpen || submitting;

  useEffect(() => {
    if (!overlayOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [overlayOpen]);

  useEffect(() => {
    if (!overlayOpen || submitting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (submitDialogOpen && !timeExpired) setSubmitDialogOpen(false);
      else if (leaveDialogOpen && !leaving) setLeaveDialogOpen(false);
      else if (paletteOpen) setPaletteOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [leaveDialogOpen, leaving, overlayOpen, paletteOpen, submitDialogOpen, submitting, timeExpired]);

  useEffect(() => {
    if (!attempt) return;
    window.requestAnimationFrame(() => {
      headingRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }, [attempt, index]);

  const current = attempt?.questions[index] ?? null;
  const answered = useMemo(() => attempt?.questions.filter((question) => responses[question.id]?.selectedOptionId).length ?? 0, [attempt, responses]);
  const flagged = useMemo(() => attempt?.questions.filter((question) => responses[question.id]?.flagged).length ?? 0, [attempt, responses]);
  const unanswered = Math.max(0, (attempt?.questions.length ?? 0) - answered);

  useEffect(() => {
    if (!attempt || !current || submitting || timeExpired || overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if (["a", "b", "c", "d"].includes(key)) {
        const option = current.options[key.charCodeAt(0) - 97];
        if (option) {
          event.preventDefault();
          queueResponse(current.id, { selectedOptionId: option.id });
        }
      } else if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
      } else if (event.key === "ArrowRight" && index < attempt.questions.length - 1) {
        event.preventDefault();
        setIndex((value) => Math.min(attempt.questions.length - 1, value + 1));
      } else if (key === "f") {
        event.preventDefault();
        queueResponse(current.id, { flagged: !Boolean(responsesRef.current[current.id]?.flagged) });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attempt, current, index, overlayOpen, queueResponse, submitting, timeExpired]);

  if (loading) {
    return <div className="grid min-h-dvh place-items-center bg-background"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm font-semibold text-muted-foreground">Preparing your secure exam…</p></div></div>;
  }
  if (loadError || !attempt || !current) {
    return <div className="grid min-h-dvh place-items-center bg-background px-4"><div className="w-full max-w-md rounded-2xl border border-rose-300/40 bg-card p-6 text-center"><AlertTriangle className="mx-auto h-7 w-7 text-rose-500" /><h1 className="mt-3 text-xl font-black">Could not open attempt</h1><p className="mt-2 text-sm text-muted-foreground">{loadError || "Attempt not found."}</p><button onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground">Try again</button></div></div>;
  }

  const currentResponse = responses[current.id] ?? { selectedOptionId: null, flagged: false };
  const lowTime = remainingMs !== null && remainingMs <= 5 * 60_000;
  const criticalTime = remainingMs !== null && remainingMs <= 60_000;
  const status = !online
    ? { label: pendingCount > 0 ? "Offline — saved on this phone" : "Offline", icon: WifiOff, tone: "text-amber-700 dark:text-amber-300" }
    : syncState === "saving"
      ? { label: "Saving", icon: Loader2, tone: "text-primary" }
      : syncState === "retrying"
        ? { label: "Retrying", icon: RefreshCw, tone: "text-primary" }
        : syncState === "error"
          ? { label: "Not synced", icon: AlertTriangle, tone: "text-rose-600 dark:text-rose-300" }
          : { label: "Saved", icon: CheckCircle2, tone: "text-emerald-700 dark:text-emerald-300" };
  const StatusIcon = status.icon;
  const atLast = index >= attempt.questions.length - 1;
  const answeredPercentage = attempt.questions.length > 0 ? Math.round((answered / attempt.questions.length) * 100) : 0;
  const firstUnansweredIndex = attempt.questions.findIndex((question) => !responses[question.id]?.selectedOptionId);
  const firstFlaggedIndex = attempt.questions.findIndex((question) => responses[question.id]?.flagged);

  return (
    <div className="min-h-dvh bg-[#f8f7fc] pb-24 text-foreground dark:bg-[#0d0a18] lg:pb-8">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:px-5">
          <button type="button" onClick={() => setLeaveDialogOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary" aria-label="Exit this exam"><X className="h-4 w-4" aria-hidden="true" /></button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="truncate text-xs font-black sm:text-sm">{attempt.courseCode}</p>
            <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">Question {index + 1}/{attempt.questions.length}</p>
          </div>
          <button type="button" onClick={() => setPaletteOpen(true)} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary lg:hidden" aria-label={`Open question map. ${answered} of ${attempt.questions.length} answered`}><Grid3X3 className="h-4 w-4" aria-hidden="true" />{flagged > 0 ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-amber-950">{flagged}</span> : null}</button>
          <div aria-label={`${msToClock(remainingMs ?? 0)} remaining`} className={cn("inline-flex h-10 min-w-[5.45rem] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 font-mono text-sm font-black tabular-nums", criticalTime ? "border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300" : lowTime ? "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-border bg-card")}>
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {msToClock(remainingMs ?? 0)}
          </div>
        </div>
        <div className="border-t border-border/60 px-3 py-1.5 sm:px-5">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className={cn("inline-flex min-w-0 items-center gap-1.5 truncate text-[10px] font-black", status.tone)} role="status" aria-live="polite">
              <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", (syncState === "saving" || syncState === "retrying") && online && "animate-spin")} aria-hidden="true" /> {status.label}
            </p>
            <p className="shrink-0 text-[10px] font-bold text-muted-foreground">{answered} answered{flagged > 0 ? ` · ${flagged} flagged` : ""}</p>
          </div>
        </div>
        <div className="h-0.5 bg-secondary"><div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${answeredPercentage}%` }} /></div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-4 sm:py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <main className="min-w-0">
          {saveError ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-100/50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{saveError}</span>
              {pendingCount > 0 && online ? <button type="button" onClick={() => void flushPending()} className="shrink-0 font-black underline">Retry</button> : null}
            </div>
          ) : null}

          <section className="-mx-4 border-y border-border bg-card px-4 py-4 sm:mx-0 sm:rounded-2xl sm:border sm:p-6 md:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Question {index + 1}</p>
              {currentResponse.flagged ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><Flag className="h-3 w-3 fill-current" aria-hidden="true" /> Flagged</span> : null}
            </div>
            <h1 ref={headingRef} tabIndex={-1} className="scroll-mt-28 pt-2.5 text-lg font-bold leading-7 outline-none sm:text-xl sm:leading-8">{current.prompt}</h1>

            <div className="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3" role="radiogroup" aria-label={`Answer options for question ${index + 1}`}>
              {current.options.map((option, optionIndex) => {
                const selected = currentResponse.selectedOptionId === option.id;
                const key = String.fromCharCode(65 + optionIndex);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={submitting || timeExpired}
                    onClick={() => queueResponse(current.id, { selectedOptionId: option.id })}
                    className={cn("flex min-h-14 w-full items-start gap-3 rounded-xl border p-3.5 text-left transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 sm:p-4", selected ? "border-primary bg-primary/[0.09] shadow-[inset_0_0_0_1px_var(--primary)]" : "border-border bg-background hover:border-primary/35 hover:bg-secondary/40")}
                  >
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-black", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>{key}</span>
                    <span className="min-w-0 flex-1 pt-1 text-base font-semibold leading-6">{option.text}</span>
                    {selected ? <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
              <button type="button" disabled={submitting || timeExpired} onClick={() => queueResponse(current.id, { flagged: !currentResponse.flagged })} className={cn("inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-black transition disabled:opacity-50", currentResponse.flagged ? "border-amber-300/60 bg-amber-100/50 text-amber-800 dark:bg-amber-950/35 dark:text-amber-300" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground")}><Flag className={cn("h-4 w-4", currentResponse.flagged && "fill-current")} aria-hidden="true" /> {currentResponse.flagged ? "Remove flag" : "Flag for review"}</button>
              {currentResponse.selectedOptionId ? <button type="button" disabled={submitting || timeExpired} onClick={() => queueResponse(current.id, { selectedOptionId: null })} className="min-h-10 rounded-xl px-3 text-xs font-black text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50">Clear answer</button> : null}
            </div>
          </section>

          <div className="mt-4 hidden items-center justify-between gap-3 lg:flex">
            <button type="button" disabled={index === 0 || submitting || timeExpired} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-black disabled:opacity-35"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous</button>
            <button type="button" disabled={submitting || timeExpired} onClick={() => atLast ? setSubmitDialogOpen(true) : setIndex((value) => Math.min(attempt.questions.length - 1, value + 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground disabled:opacity-35">{atLast ? "Review & submit" : "Next question"} {atLast ? <Send className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}</button>
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><p className="text-sm font-black">Question map</p><span className="text-xs font-bold text-muted-foreground">{answered}/{attempt.questions.length}</span></div>
            <QuestionPalette questions={attempt.questions} responses={responses} currentIndex={index} onPick={setIndex} />
            <PaletteLegend />
            {firstUnansweredIndex >= 0 ? <button type="button" onClick={() => setIndex(firstUnansweredIndex)} className="mt-4 min-h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-black text-primary">First unanswered</button> : null}
            <button type="button" onClick={() => setSubmitDialogOpen(true)} disabled={submitting || timeExpired} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground disabled:opacity-60"><Send className="h-4 w-4" aria-hidden="true" /> Review & submit</button>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Keyboard: A–D answers · arrows navigate · F flags.</p>
          </div>
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl lg:hidden" aria-label="Exam navigation">
        <div className="mx-auto grid max-w-lg grid-cols-[3.25rem_1fr] gap-2.5">
          <button type="button" disabled={index === 0 || submitting || timeExpired} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="grid min-h-13 place-items-center rounded-xl border border-border bg-card disabled:opacity-35" aria-label="Previous question"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" disabled={submitting || timeExpired} onClick={() => atLast ? setPaletteOpen(true) : setIndex((value) => Math.min(attempt.questions.length - 1, value + 1))} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground disabled:opacity-35" aria-label={atLast ? "Open question review" : `Go to question ${index + 2}`}>{atLast ? "Review answers" : "Next question"}{atLast ? <Grid3X3 className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}</button>
        </div>
      </nav>

      {paletteOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-zinc-950/60 backdrop-blur-sm lg:hidden" onClick={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
          <div className="max-h-[min(90dvh,760px)] w-full overflow-y-auto rounded-t-[1.75rem] border border-border bg-background px-4 pb-0 pt-3 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="question-review-title" aria-describedby="question-review-description">
            <div className="mx-auto max-w-lg">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Question map</p><h2 id="question-review-title" className="mt-0.5 text-2xl font-black">Navigate your paper</h2><p id="question-review-description" className="mt-1 text-xs leading-5 text-muted-foreground">Jump to any question or find the ones that still need attention.</p></div><button type="button" onClick={() => setPaletteOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close question map"><X className="h-4 w-4" aria-hidden="true" /></button></div>
              <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-card text-center">
                <div className="p-3"><p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{answered}</p><p className="text-[10px] font-bold text-muted-foreground">Answered</p></div>
                <div className="border-l border-border p-3"><p className="text-xl font-black text-amber-700 dark:text-amber-300">{unanswered}</p><p className="text-[10px] font-bold text-muted-foreground">Unanswered</p></div>
                <div className="border-l border-border p-3"><p className="text-xl font-black text-amber-700 dark:text-amber-300">{flagged}</p><p className="text-[10px] font-bold text-muted-foreground">Flagged</p></div>
              </div>
              <QuestionPalette questions={attempt.questions} responses={responses} currentIndex={index} onPick={(next) => { setIndex(next); setPaletteOpen(false); }} />
              <PaletteLegend />
              {(firstUnansweredIndex >= 0 || firstFlaggedIndex >= 0) ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {firstUnansweredIndex >= 0 ? <button type="button" onClick={() => { setIndex(firstUnansweredIndex); setPaletteOpen(false); }} className={cn("min-h-10 rounded-xl border border-border bg-card px-3 text-xs font-black text-primary", firstFlaggedIndex < 0 && "col-span-2")}>First unanswered</button> : null}
                  {firstFlaggedIndex >= 0 ? <button type="button" onClick={() => { setIndex(firstFlaggedIndex); setPaletteOpen(false); }} className={cn("min-h-10 rounded-xl border border-amber-300/60 bg-amber-50 px-3 text-xs font-black text-amber-800 dark:bg-amber-950/35 dark:text-amber-300", firstUnansweredIndex < 0 && "col-span-2")}>First flagged</button> : null}
                </div>
              ) : null}
              <div className="sticky bottom-0 -mx-4 mt-4 grid grid-cols-[0.8fr_1.2fr] gap-2.5 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
                <button type="button" onClick={() => setPaletteOpen(false)} className="min-h-12 rounded-xl border border-border bg-card px-3 text-sm font-black">Continue</button>
                <button type="button" onClick={() => { setPaletteOpen(false); setSubmitDialogOpen(true); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground"><Send className="h-4 w-4" aria-hidden="true" /> Review & submit</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {leaveDialogOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-zinc-950/60 backdrop-blur-sm sm:grid sm:place-items-center sm:p-4" onClick={(event) => { if (event.target === event.currentTarget && !leaving) setLeaveDialogOpen(false); }}>
          <div className="w-full rounded-t-[1.75rem] border border-border bg-background p-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="leave-exam-title" aria-describedby="leave-exam-description">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Your timer will continue</p>
            <h2 id="leave-exam-title" className="mt-1 text-2xl font-black">Exit to the course page?</h2>
            <p id="leave-exam-description" className="mt-2 text-sm leading-6 text-muted-foreground">Your saved answers will remain, but the countdown cannot be paused while you are away.</p>
            {pendingCount > 0 ? <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-100/60 px-3 py-2.5 text-xs font-bold text-amber-900 dark:bg-amber-950/35 dark:text-amber-200"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{pendingCount} recent change{pendingCount === 1 ? " is" : "s are"} still syncing. This phone is keeping a temporary copy.</p> : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => void leaveAttempt()} disabled={leaving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-black text-muted-foreground disabled:opacity-60">{leaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4" aria-hidden="true" />}{leaving ? "Saving…" : "Return to course"}</button>
              <button type="button" onClick={() => setLeaveDialogOpen(false)} disabled={leaving} className="min-h-12 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground">Keep answering</button>
            </div>
          </div>
        </div>
      ) : null}

      {submitDialogOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-zinc-950/60 backdrop-blur-sm sm:grid sm:place-items-center sm:p-4" onClick={(event) => { if (event.target === event.currentTarget && !timeExpired && !submitting) setSubmitDialogOpen(false); }}>
          <div className="w-full rounded-t-[1.75rem] border border-border bg-background p-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="submit-exam-title">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">{timeExpired ? "Time is up" : "Final check"}</p><h2 id="submit-exam-title" className="mt-1 text-2xl font-black">{timeExpired ? "Finish submitting" : "Ready to submit?"}</h2></div>{!timeExpired ? <button type="button" onClick={() => setSubmitDialogOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close submission dialog"><X className="h-4 w-4" aria-hidden="true" /></button> : null}</div>
            <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-card text-center">
              <div className="p-3"><p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{answered}</p><p className="text-[11px] font-bold text-muted-foreground">Answered</p></div>
              <div className="border-l border-border p-3"><p className="text-2xl font-black text-amber-700 dark:text-amber-300">{unanswered}</p><p className="text-[11px] font-bold text-muted-foreground">Unanswered</p></div>
              <div className="border-l border-border p-3"><p className="text-2xl font-black text-amber-700 dark:text-amber-300">{flagged}</p><p className="text-[11px] font-bold text-muted-foreground">Flagged</p></div>
            </div>
            {!timeExpired && unanswered > 0 ? <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{unanswered} unanswered question{unanswered === 1 ? "" : "s"} will count as unanswered if you submit now.</p> : null}
            <p className={cn("mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-bold", pendingCount > 0 ? "bg-amber-100/60 text-amber-900 dark:bg-amber-950/35 dark:text-amber-200" : "bg-emerald-100/60 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200")}>
              {pendingCount > 0 ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              {pendingCount > 0 ? `${pendingCount} answer change${pendingCount === 1 ? " is" : "s are"} still syncing. Submission will wait.` : "Every answer change has reached the server."}
            </p>
            {saveError ? <p className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300" role="alert">{saveError}</p> : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {!timeExpired ? <button type="button" onClick={() => { setSubmitDialogOpen(false); if (firstUnansweredIndex >= 0) setIndex(firstUnansweredIndex); else if (firstFlaggedIndex >= 0) setIndex(firstFlaggedIndex); }} className="min-h-12 rounded-xl border border-border px-3 text-sm font-black">{firstUnansweredIndex >= 0 ? "Review unanswered" : firstFlaggedIndex >= 0 ? "Review flagged" : "Back to paper"}</button> : null}
              <button type="button" onClick={() => void submitAttempt(timeExpired ? "timeup" : "manual")} disabled={submitting} className={cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground disabled:opacity-60", timeExpired && "col-span-2")}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} {submitting ? "Submitting…" : timeExpired ? "Retry submission" : unanswered > 0 ? "Submit anyway" : "Submit paper"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {submitting ? <div className="fixed inset-0 z-[70] grid place-items-center bg-background/90 backdrop-blur-sm"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-3 font-black">Saving and submitting…</p><p className="mt-1 text-xs text-muted-foreground">Keep this screen open.</p></div></div> : null}
    </div>
  );
}

function PaletteLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-muted-foreground" aria-label="Question status legend">
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Current</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Answered</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Flagged</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-border bg-card" /> Unanswered</span>
    </div>
  );
}

function QuestionPalette({ questions, responses, currentIndex, onPick }: { questions: ExamQuestion[]; responses: Record<string, ExamResponse>; currentIndex: number; onPick: (index: number) => void }) {
  return (
    <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
      {questions.map((question, index) => {
        const response = responses[question.id];
        const states = [currentIndex === index ? "current" : null, response?.selectedOptionId ? "answered" : "unanswered", response?.flagged ? "flagged" : null].filter(Boolean).join(", ");
        return (
          <button
            key={question.id}
            type="button"
            onClick={() => onPick(index)}
            aria-label={`Question ${index + 1}, ${states}`}
            aria-current={currentIndex === index ? "step" : undefined}
            className={cn("relative grid min-h-11 aspect-square place-items-center rounded-xl border text-xs font-black transition", currentIndex === index ? "border-primary bg-primary text-primary-foreground" : response?.selectedOptionId ? "border-emerald-400/40 bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-300" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground")}
          >
            {index + 1}
            {response?.flagged ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-amber-400" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
