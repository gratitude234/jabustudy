import { Suspense } from "react";
import SavedClient from "./SavedClient";

function SavedFallback() {
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <div className="rounded-3xl border border-border bg-background p-4">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-muted" />
        <div className="mt-4 h-11 w-full rounded-2xl bg-muted" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-border bg-background p-4">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
            <div className="mt-4 h-10 w-full rounded-2xl bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudySavedPage() {
  return (
    <Suspense fallback={<SavedFallback />}>
      <SavedClient />
    </Suspense>
  );
}
