import { Suspense } from "react";
import MaterialsClient from "../materials/MaterialsClient";
import { Card, SkeletonCard } from "../_components/StudyUI";

function LibraryFallback() {
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <Card className="rounded-3xl">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="mt-2 h-4 w-64 rounded bg-muted" />
        <div className="mt-4 h-11 w-full rounded-2xl bg-muted" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-20 rounded-full bg-muted" />
          ))}
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={3} className="rounded-3xl" />
        ))}
      </section>
    </div>
  );
}

export default function StudyLibraryPage() {
  return (
    <Suspense fallback={<LibraryFallback />}>
      <MaterialsClient />
    </Suspense>
  );
}
