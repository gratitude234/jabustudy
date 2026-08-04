"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

export default function ExamError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center py-10">
      <div className="w-full max-w-md rounded-2xl border border-rose-300/50 bg-card p-6 text-center dark:border-rose-800/50">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"><AlertTriangle className="h-6 w-6" aria-hidden="true" /></span>
        <h1 className="mt-4 text-xl font-black">Exam Sprint could not load</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Check your connection and try again. Your existing attempt and saved answers are not reset.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link href="/exam" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-black no-underline"><ArrowLeft className="h-4 w-4" /> Exam Sprint</Link>
          <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      </div>
    </div>
  );
}
