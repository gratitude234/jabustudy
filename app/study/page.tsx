// app/study/page.tsx
import { Suspense } from "react";
import StudyHomeClient from "./StudyHomeClient";
import { SkeletonCard } from "./_components/StudyUI";

export const metadata = {
  title: "Study Hub",
  description:
    "Course materials, MCQ practice sets, Q&A forum, AI study plans and GPA calculator for JABU students.",
  openGraph: {
    title: "Study Hub — Jabumarket",
    description:
      "Course materials, MCQ practice sets, Q&A forum, AI study plans and GPA calculator for JABU students.",
    type: "website",
  },
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function StudyHomeFallback() {
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      {/* Hero card skeleton */}
      <div className="animate-pulse rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-6 w-36 rounded bg-muted" />
          </div>
          <div className="h-9 w-24 rounded-2xl bg-muted" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="h-14 rounded-2xl bg-muted" />
          <div className="h-14 rounded-2xl bg-muted" />
          <div className="h-14 rounded-2xl bg-muted" />
        </div>
        <div className="mt-3 h-11 rounded-2xl bg-muted" />
        <div className="mt-3 h-px rounded bg-muted" />
        <div className="mt-3 h-8 rounded bg-muted" />
      </div>

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-3xl bg-muted" />
        <div className="h-28 animate-pulse rounded-3xl border border-border bg-card shadow-sm" />
        <div className="h-28 animate-pulse rounded-3xl border border-border bg-card shadow-sm" />
      </div>

      {/* Content skeletons */}
      <div className="space-y-3">
        <SkeletonCard className="rounded-3xl" />
        <SkeletonCard className="rounded-3xl" />
        <SkeletonCard className="rounded-3xl" lines={3} />
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function StudyPage() {
  return (
    <Suspense fallback={<StudyHomeFallback />}>
      <StudyHomeClient />
    </Suspense>
  );
}
