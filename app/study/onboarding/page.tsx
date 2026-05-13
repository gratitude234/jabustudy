// app/study/onboarding/page.tsx
import { Suspense } from "react";
import OnboardingClient from "./OnboardingClient";
import { Card } from "../_components/StudyUI";

export const dynamic = "force-dynamic";

function OnboardingFallback() {
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <Card className="rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="h-5 w-44 rounded bg-muted" />
            <div className="mt-2 h-4 w-72 max-w-full rounded bg-muted" />
            <div className="mt-2 h-3 w-56 rounded bg-muted" />
          </div>
          <div className="h-10 w-20 rounded-2xl bg-muted" />
        </div>

        <div className="mt-5 space-y-3">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-11 w-full rounded-2xl bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-11 w-full rounded-2xl bg-muted" />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="h-11 w-full rounded-2xl bg-muted" />
          <div className="h-11 w-full rounded-2xl bg-muted" />
        </div>

        <div className="mt-5 h-12 w-full rounded-2xl bg-muted" />
      </Card>
    </div>
  );
}

export default function StudyOnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingClient />
    </Suspense>
  );
}