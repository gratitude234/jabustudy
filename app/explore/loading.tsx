function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="aspect-[4/3] w-full animate-pulse bg-zinc-100" />
      <div className="space-y-3 p-3">
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-100" />
        </div>
        <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
        <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
      </div>
    </div>
  );
}

export default function LoadingExplore() {
  return (
    <>
      {/* Mobile */}
      <div className="space-y-4 md:hidden">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="h-6 w-24 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="hidden h-10 w-32 animate-pulse rounded-xl bg-zinc-100 sm:block" />
        </div>

        {/* Sticky controls placeholder */}
        <div className="sticky top-0 z-10 -mx-4 border-b bg-white/90 px-4 py-3 backdrop-blur">
          <div className="h-[52px] w-full animate-pulse rounded-2xl bg-zinc-100" />
          <div className="mt-3 flex gap-2 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 w-20 shrink-0 animate-pulse rounded-full bg-zinc-100" />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Desktop: sidebar + results */}
      <div className="hidden md:grid md:grid-cols-[320px,1fr] md:gap-6">
        {/* Sidebar skeleton */}
        <aside className="space-y-4">
          <div className="rounded-3xl border bg-white p-4">
            <div className="h-4 w-16 animate-pulse rounded bg-zinc-100" />
            <div className="mt-3 h-[52px] w-full animate-pulse rounded-2xl bg-zinc-100" />
          </div>
          <div className="rounded-3xl border bg-white p-4">
            <div className="h-4 w-14 animate-pulse rounded bg-zinc-100" />
            <div className="mt-4 space-y-3">
              {/* Type */}
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-zinc-100" />
                ))}
              </div>
              {/* Sort */}
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-2xl bg-zinc-100" />
                ))}
              </div>
              {/* Price range */}
              <div className="flex gap-2">
                <div className="h-10 w-full animate-pulse rounded-xl bg-zinc-100" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-zinc-100" />
                <div className="h-10 w-12 shrink-0 animate-pulse rounded-xl bg-zinc-100" />
              </div>
              {/* Categories */}
              <div className="space-y-2 pt-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-10 w-full animate-pulse rounded-xl bg-zinc-100" />
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Results skeleton */}
        <section className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="h-7 w-20 animate-pulse rounded bg-zinc-100" />
              <div className="mt-2 h-4 w-48 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="h-9 w-16 animate-pulse rounded-2xl bg-zinc-100" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}