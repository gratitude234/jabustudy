export default function MaterialDetailLoading() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-background">
      {/* Back button */}
      <div className="px-4 pb-0 pt-3 md:px-6 md:pt-4">
        <div className="h-9 w-28 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Mobile tab switcher */}
      <div className="sticky top-[56px] z-20 bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="grid grid-cols-3 rounded-2xl border border-border bg-card p-1 shadow-sm">
          {[0, 1, 2].map((i) => (
            <div key={i} className="mx-0.5 h-9 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl items-start gap-4 p-4 pb-24 pt-2 md:grid-cols-[minmax(0,1fr)_420px] md:gap-5 md:p-6 md:pt-5 md:pb-12">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Hero gradient card */}
          <div className="animate-pulse overflow-hidden rounded-3xl bg-primary/25 shadow-sm">
            <div className="px-5 pb-5 pt-5 sm:px-6">
              <div className="mb-3 flex gap-1.5">
                <div className="h-5 w-16 rounded-full bg-white/20" />
                <div className="h-5 w-10 rounded-full bg-white/20" />
                <div className="h-5 w-14 rounded-full bg-white/20" />
              </div>
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/20 sm:h-12 sm:w-12" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-24 rounded bg-white/20" />
                  <div className="h-5 w-3/4 rounded bg-white/20" />
                  <div className="h-3 w-40 rounded bg-white/20" />
                </div>
              </div>
              <div className="mt-4 flex gap-4 border-t border-white/15 pt-3.5">
                <div className="h-3 w-24 rounded bg-white/20" />
                <div className="h-3 w-20 rounded bg-white/20" />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_44px_44px] gap-2">
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
          </div>

          {/* Practice/content card */}
          <div className="animate-pulse rounded-3xl border border-border bg-card p-5 space-y-4">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-5/6 rounded bg-muted" />
              <div className="h-3 w-4/6 rounded bg-muted" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-9 flex-1 rounded-xl bg-muted" />
              <div className="h-9 flex-1 rounded-xl bg-muted" />
              <div className="h-9 flex-1 rounded-xl bg-muted" />
            </div>
            <div className="h-12 rounded-2xl bg-muted" />
          </div>
        </div>

        {/* Right column — desktop only */}
        <div className="hidden flex-col gap-4 md:flex">
          <div className="animate-pulse rounded-3xl border border-border bg-card p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-5/6 rounded bg-muted" />
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
          <div className="animate-pulse rounded-3xl border border-border bg-card p-5 space-y-3">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-muted" />
                    <div className="h-2.5 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
