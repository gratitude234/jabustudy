// app/study/practice/[setId]/loading.tsx
import type React from "react";

function Bar() {
  return <div className="h-2 w-full rounded-full bg-secondary overflow-hidden" />;
}

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className,
      ].join(" ")}
    />
  );
}

function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card text-card-foreground shadow-sm p-4">
      {children}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-20 -mx-4 bg-background/85 px-4 pb-3 pt-2 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <Shimmer className="h-10 w-24 rounded-2xl" />
          <div className="flex items-center gap-2">
            <Shimmer className="h-9 w-24 rounded-full" />
            <Shimmer className="h-9 w-16 rounded-full" />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <Shimmer className="h-4 w-48" />
              <Shimmer className="h-3 w-32" />
            </div>
            <Shimmer className="h-9 w-28 rounded-full" />
          </div>
          <Bar />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="h-3 w-12" />
          </div>
        </div>
      </div>

      {/* Question card skeleton */}
      <Surface>
        <Shimmer className="h-3 w-36" />
        <div className="mt-3 space-y-2">
          <Shimmer className="h-5 w-full" />
          <Shimmer className="h-5 w-11/12" />
          <Shimmer className="h-5 w-9/12" />
        </div>

        <div className="mt-5 grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-background p-3">
              <div className="flex items-start gap-3">
                <Shimmer className="h-7 w-7 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-3 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Shimmer className="h-10 w-24 rounded-2xl" />
          <Shimmer className="h-10 w-24 rounded-2xl" />
        </div>
      </Surface>
    </div>
  );
}
