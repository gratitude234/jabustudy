"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Clock3, FileQuestion, Loader2, Play, ShieldCheck, X } from "lucide-react";
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

  return (
    <div>
      <button
        type="button"
        onClick={() => setReviewing(true)}
        disabled={busy}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-60",
          className,
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : kind === "diagnostic" ? <Play className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        {busy ? "Preparing your attempt…" : children}
      </button>
      {error ? <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">{error}</p> : null}
      {reviewing ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`exam-instructions-${setId}`}>
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-5 text-left text-white shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">Before you begin</p><h2 id={`exam-instructions-${setId}`} className="mt-1 text-2xl font-black">CBT instructions</h2></div>
              <button type="button" onClick={() => setReviewing(false)} disabled={busy} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-300" aria-label="Close instructions"><X className="h-4 w-4" /></button>
            </div>
            {/* This dialog is always dark because it is the doorway into the exam
                runner, which is always dark. Naming it stops the switch reading as a bug. */}
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-xs font-semibold leading-5 text-zinc-400">
              The next screen is exam mode: no navigation, no hints, and a timer that keeps running if you leave.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><FileQuestion className="h-4 w-4 text-violet-300" /><p className="mt-2 text-sm font-black">{questionCount} questions</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><Clock3 className="h-4 w-4 text-violet-300" /><p className="mt-2 text-sm font-black">{timeLimitMinutes} minutes</p></div>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
              <li className="flex gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-400" /> The timer starts only after you press Begin. Refreshing will not reset it or change your question order.</li>
              <li className="flex gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-400" /> Answers and flags save immediately. Check the saved indicator before submitting if your connection is unstable.</li>
              <li className="flex gap-2"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-400" /> There are no hints or corrections during the attempt. Saved answers submit automatically when time expires.</li>
            </ul>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setReviewing(false)} disabled={busy} className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-zinc-200 disabled:opacity-50">Not yet</button>
              <button type="button" onClick={() => void start()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {busy ? "Creating attempt…" : "Begin exam"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
