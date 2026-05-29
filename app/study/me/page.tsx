import { Suspense } from "react";
import StudyMeClient from "./StudyMeClient";
import { Card, SkeletonCard } from "../_components/StudyUI";

export const metadata = {
  title: "Study Profile",
  description: "Your Study Hub profile, saved resources, practice history and contributor tools.",
};

function StudyMeFallback() {
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <Card className="animate-pulse rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-muted shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-36 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-muted" />
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} className="rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export default function StudyMePage() {
  return (
    <Suspense fallback={<StudyMeFallback />}>
      <StudyMeClient />
    </Suspense>
  );
}
