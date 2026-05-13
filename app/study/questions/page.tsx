import { Suspense } from "react";
import QuestionsClient from "./QuestionsClient";

function QuestionsFallback() {
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      {/* Header skeleton */}
      <div className="rounded-3xl border border-border bg-background p-4">
        <div className="h-6 w-44 rounded bg-muted" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-muted" />
        <div className="mt-4 h-11 w-full rounded-2xl bg-muted" />
        <div className="mt-3 flex gap-2">
          <div className="h-9 w-28 rounded-full bg-muted" />
          <div className="h-9 w-28 rounded-full bg-muted" />
          <div className="h-9 w-28 rounded-full bg-muted" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
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

export default function QuestionsPage() {
  return (
    <Suspense fallback={<QuestionsFallback />}>
      <QuestionsClient />
    </Suspense>
  );
}