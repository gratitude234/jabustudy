"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { isExamDeviceGuardErrorCode } from "@/lib/examSprint/device";

function localDraftHasPendingChanges(attemptId: string) {
  try {
    const raw = window.localStorage.getItem(`jabu-exam-draft:${attemptId}`);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { pending?: Record<string, unknown> };
    return Boolean(parsed?.pending && Object.keys(parsed.pending).length > 0);
  } catch {
    return false;
  }
}

export default function SwitchExamCourseButton({
  attemptId,
  currentCode,
  targetCode,
  targetHref,
  kind,
}: {
  attemptId: string;
  currentCode: string;
  targetCode: string;
  targetHref: string;
  kind: "mock" | "diagnostic";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchCourse() {
    if (switching) return;
    setError(null);

    if (localDraftHasPendingChanges(attemptId)) {
      setError("Some recent changes are still only on this phone. Resume the current attempt and reconnect before switching courses.");
      return;
    }

    setSwitching(true);
    try {
      const response = await fetch(`/api/exam/attempts/${attemptId}/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto" }),
      });
      const data = await response.json().catch(() => null) as { message?: string; code?: string } | null;
      if (!response.ok) {
        if (isExamDeviceGuardErrorCode(data?.code)) {
          router.push("/exam/me");
          return;
        }
        throw new Error(data?.message || "We couldn't switch courses. Your current attempt is still safe.");
      }

      window.localStorage.removeItem(`jabu-exam-draft:${attemptId}`);
      window.localStorage.removeItem(`jabu-exam-tab:${attemptId}`);
      setOpen(false);
      router.push(targetHref);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't switch courses. Your current attempt is still safe.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setError(null); setOpen(true); }} className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-bold text-primary transition hover:bg-secondary/45">
        Switch to {targetCode} instead
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !switching) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="direct-switch-heading" className="w-full max-w-md rounded-t-[1.75rem] border border-border bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[1.5rem]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-700 dark:text-amber-300">{currentCode} timer is running</p>
                <h2 id="direct-switch-heading" className="mt-1 text-xl font-extrabold tracking-tight">Switch to {targetCode}?</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={switching} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground disabled:opacity-50" aria-label="Close switch course dialog"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <div className="mt-4 rounded-xl bg-secondary/55 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
              {kind === "mock" ? (
                <p>An untouched attempt can use your one daily mistake change. Otherwise {currentCode} ends early with <strong className="font-bold text-foreground">no 0% score</strong>, but it uses one weekly leaderboard slot.</p>
              ) : (
                <p>An untouched attempt can use your one daily mistake change. Otherwise the {currentCode} diagnostic ends early and <strong className="font-bold text-foreground">its 5-hour free-check cooldown continues</strong>.</p>
              )}
            </div>

            {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p> : null}

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <Link href={`/exam/attempt/${attemptId}`} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground no-underline">Keep {currentCode}</Link>
              <button type="button" onClick={() => void switchCourse()} disabled={switching} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">{switching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Switch to {targetCode}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
