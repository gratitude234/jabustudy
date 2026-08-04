"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, FileQuestion, Loader2, Play, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StartExamButton({
  setId,
  kind,
  children,
  className,
  questionCount,
  timeLimitMinutes,
}: {
  setId: string;
  kind: "diagnostic" | "mock";
  children: React.ReactNode;
  className?: string;
  questionCount: number;
  timeLimitMinutes: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!reviewing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => confirmRef.current?.focus(), 80);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || busyRef.current) return;
      setReviewing(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [reviewing]);

  function closeReview() {
    if (busy) return;
    setReviewing(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/exam/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, kind }),
      });
      const data = await response.json().catch(() => null) as {
        ok?: boolean;
        attempt?: { id?: string };
        checkoutUrl?: string;
        message?: string;
      } | null;
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (response.status === 402 && data?.checkoutUrl) {
        const checkout = new URL(data.checkoutUrl, window.location.origin);
        checkout.searchParams.set("returnTo", pathname);
        router.push(`${checkout.pathname}${checkout.search}${checkout.hash}`);
        return;
      }
      if (!response.ok || !data?.ok || !data.attempt?.id) {
        throw new Error(data?.message || "Could not start this attempt.");
      }
      setReviewing(false);
      router.push(`/exam/attempt/${encodeURIComponent(data.attempt.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start this attempt.");
    } finally {
      setBusy(false);
    }
  }

  const title = kind === "mock" ? "Ready for your timed mock?" : "Ready for your free diagnostic?";
  const action = kind === "mock" ? "Start mock now" : "Start diagnostic now";
  const descriptionId = `exam-instructions-description-${setId}`;

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setError(null); setReviewing(true); }}
        disabled={busy}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground shadow-sm transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60",
          className,
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
        {busy ? "Preparing your attempt…" : children}
      </button>
      {error && !reviewing ? <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">{error}</p> : null}

      {reviewing ? (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-zinc-950/55 backdrop-blur-[2px] sm:grid sm:place-items-center sm:p-4"
          onClick={(event) => { if (event.target === event.currentTarget) closeReview(); }}
        >
          <div
            className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-border bg-background px-4 pb-0 pt-3 text-left text-foreground shadow-2xl sm:max-w-lg sm:rounded-[1.5rem] sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`exam-instructions-${setId}`}
            aria-describedby={descriptionId}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Before you begin</p>
                <h2 id={`exam-instructions-${setId}`} className="mt-1 text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
                <p id={descriptionId} className="mt-2 text-sm leading-5 text-muted-foreground">Check the format, then start when you are settled and ready.</p>
              </div>
              <button type="button" onClick={closeReview} disabled={busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close and return to course"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2.5 p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileQuestion className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-lg font-black tabular-nums">{questionCount}</p><p className="text-[10px] font-bold text-muted-foreground">Questions</p></div></div>
              <div className="flex items-center gap-2.5 border-l border-border p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Clock3 className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-lg font-black tabular-nums">{timeLimitMinutes}</p><p className="text-[10px] font-bold text-muted-foreground">Minutes</p></div></div>
            </div>

            <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"><Clock3 className="h-4 w-4" aria-hidden="true" /></span>
              <div><p className="text-sm font-extrabold">The timer cannot be paused</p><p className="mt-0.5 text-xs leading-5 opacity-75">It starts when you tap the button below and keeps running if you leave this page.</p></div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-xl bg-secondary/55 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-xs font-extrabold">Answers save automatically</p><p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">A temporary copy stays on this phone if your network drops.</p></div></div>
              <div className="flex gap-3 rounded-xl bg-secondary/55 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-xs font-extrabold">Corrections come afterwards</p><p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Answers and explanations unlock after submission.</p></div></div>
            </div>

            {error ? <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-100/70 px-3 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-950/35 dark:text-rose-200" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p> : null}

            <div className="sticky bottom-0 -mx-4 mt-4 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:static sm:mx-0 sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0">
              <button ref={confirmRef} type="button" onClick={() => void start()} disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-sm transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />} {busy ? "Starting…" : action}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
