import { Suspense } from "react";
import PracticeHomeClient from "./PracticeHomeClient";
import { Card, SkeletonCard } from "../_components/StudyUI";
import { ArrowLeft, History, Search, Sparkles } from "lucide-react";

function PracticeFallback() {
  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-4 pb-28 md:pb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          <div className="h-4 w-14 rounded bg-muted" />
        </div>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5">
          <History className="h-4 w-4 text-muted-foreground" />
          <div className="h-4 w-14 rounded bg-muted" />
        </div>
      </div>

      <Card className="rounded-3xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="h-6 w-40 rounded bg-muted" />
            <div className="mt-2 h-4 w-72 max-w-full rounded bg-muted" />
          </div>

          <div className="hidden sm:inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        </div>
      </Card>

      <div className="flex w-full items-center gap-2 overflow-x-auto rounded-3xl border border-border bg-background p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-28 shrink-0 rounded-2xl bg-muted" />
        ))}
      </div>

      <Card className="rounded-3xl border bg-background/85 backdrop-blur p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-9 w-24 rounded-xl bg-muted" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-full bg-muted" />
          ))}
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={3} className="rounded-3xl" />
        ))}
      </section>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<PracticeFallback />}>
      <PracticeHomeClient />
    </Suspense>
  );
}