// app/study/history/page.tsx
import { Suspense } from "react";
import HistoryClient from "./HistoryClient";
import { Card, SkeletonCard } from "../_components/StudyUI";

export const dynamic = "force-dynamic";

function HistoryFallback() {
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse rounded-3xl space-y-2">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-6 w-10 rounded bg-muted" />
          </Card>
        ))}
      </div>
      <Card className="animate-pulse rounded-3xl">
        <div className="h-4 w-32 rounded bg-muted mb-3" />
        <div className="h-32 rounded-2xl bg-muted" />
      </Card>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} className="rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export default function PracticeHistoryPage() {
  return (
    <Suspense fallback={<HistoryFallback />}>
      <HistoryClient />
    </Suspense>
  );
}
