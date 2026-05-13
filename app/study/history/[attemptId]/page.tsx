// app/study/history/[attemptId]/page.tsx
import { Suspense } from "react";
import AttemptReviewClient from "./AttemptReviewClient";
import { Card, SkeletonCard } from "../../_components/StudyUI";

export const dynamic = "force-dynamic";

function AttemptReviewFallback() {
  return (
    <div className="pb-28 md:pb-6">
      <Card className="rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="h-5 w-44 rounded bg-muted" />
            <div className="mt-2 h-4 w-72 max-w-full rounded bg-muted" />
            <div className="mt-2 h-3 w-56 rounded bg-muted" />
          </div>
          <div className="h-10 w-28 rounded-2xl bg-muted" />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <div className="h-8 w-28 rounded-full bg-muted" />
          <div className="h-8 w-28 rounded-full bg-muted" />
          <div className="h-8 w-28 rounded-full bg-muted" />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px,1fr]">
        <SkeletonCard />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}

export default function AttemptReviewPage() {
  return (
    <Suspense fallback={<AttemptReviewFallback />}>
      <AttemptReviewClient />
    </Suspense>
  );
}