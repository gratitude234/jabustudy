"use client";

// app/study/_components/StudyError.tsx
// Shared error UI used by every error.tsx boundary under /study.

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function StudyError({
  error,
  reset,
  context,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Short label shown in the heading, e.g. "Materials", "Practice" */
  context?: string;
}) {
  useEffect(() => {
    // Log to your error tracking service here (e.g. Sentry.captureException(error))
    console.error("[StudyError]", error);
  }, [error]);

  const heading = context
    ? `${context} failed to load`
    : "Something went wrong";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          {/* Icon */}
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>

          {/* Copy */}
          <h1 className="text-center text-base font-extrabold tracking-tight text-foreground">
            {heading}
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            A temporary error occurred. Your data is safe — try reloading the
            page.
          </p>

          {/* Digest for support reference */}
          {error.digest ? (
            <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground/70">
              ref: {error.digest}
            </p>
          ) : null}

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>

            <Link
              href="/study"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground no-underline hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Home className="h-4 w-4" />
              Study home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}