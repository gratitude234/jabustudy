// app/study/practice/[setId]/page.tsx
import { Suspense } from "react";
import PracticeTakeClient from "./PracticeTakeClient";
import { Card, SkeletonCard } from "../../_components/StudyUI";

export const dynamic = "force-dynamic";

function PracticeTakeFallback() {
  return (
    <div className="pb-28 md:pb-6">
      <Card className="rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="h-5 w-44 rounded bg-muted" />
            <div className="mt-2 h-4 w-72 max-w-full rounded bg-muted" />
            <div className="mt-2 h-3 w-56 rounded bg-muted" />
          </div>
          <div className="h-10 w-24 rounded-2xl bg-muted" />
        </div>

        <div className="mt-5 space-y-3">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-14 w-full rounded-2xl bg-muted" />
          <div className="h-14 w-full rounded-2xl bg-muted" />
          <div className="h-14 w-full rounded-2xl bg-muted" />
          <div className="h-14 w-full rounded-2xl bg-muted" />
        </div>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

export default function PracticeTakePage() {
  return (
    <Suspense fallback={<PracticeTakeFallback />}>
      <PracticeTakeClient />
    </Suspense>
  );
}