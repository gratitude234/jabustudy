"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Clock3, FileQuestion, Loader2, Play, ShieldCheck, Wifi, X } from "lucide-react";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!reviewing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [reviewing]);

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

  const title = kind === "mock" ? "Start this timed mock?" : "Start your free diagnostic?";
  const action = kind === "mock" ? "Start mock now" : "Start diagnostic";

  return (
    <div>
      <button
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
        <div className="fixed inset-0 z-[80] flex items-end bg-zinc-950/60 backdrop-blur-sm sm:grid sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={`exam-instructions-${setId}`}>
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-left text-foreground shadow-2xl sm:max-w-lg sm:rounded-[1.5rem] sm:p-6">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Before the timer starts</p>
                <h2 id={`exam-instructions-${setId}`} className="mt-1 text-2xl font-black tracking-tight">{title}</h2>
              </div>
              <button type="button" onClick={() => setReviewing(false)} disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-secondary" aria-label="Close instructions"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-3 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileQuestion className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-lg font-black tabular-nums">{questionCount}</p><p className="text-[11px] font-bold text-muted-foreground">Questions</p></div></div>
              <div className="flex items-center gap-3 border-l border-border p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Clock3 className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-lg font-black tabular-nums">{timeLimitMinutes}</p><p className="text-[11px] font-bold text-muted-foreground">Minutes</p></div></div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><Clock3 className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-sm font-extrabold">The timer cannot be paused</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">It starts when you continue and keeps running if you leave the screen.</p></div></div>
              <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Wifi className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-sm font-extrabold">Answer changes save automatically</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">If your network drops, this phone keeps a temporary copy and retries.</p></div></div>
              <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-sm font-extrabold">Corrections unlock after submission</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">There are no hints or revealed answers during the attempt.</p></div></div>
            </div>

            {error ? <p className="mt-5 flex items-start gap-2 rounded-xl bg-rose-100/70 px-3 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-950/35 dark:text-rose-200" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p> : null}

            <div className="mt-6 grid grid-cols-[0.72fr_1.28fr] gap-3">
              <button type="button" onClick={() => setReviewing(false)} disabled={busy} className="min-h-12 rounded-xl border border-border bg-card px-3 text-sm font-black disabled:opacity-50">Not yet</button>
              <button type="button" onClick={() => void start()} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-sm disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />} {busy ? "Starting…" : action}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
