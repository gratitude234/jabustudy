export default function ExamLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12" role="status" aria-label="Loading Exam Sprint">
      <div className="h-5 w-24 animate-pulse rounded-md bg-secondary" />
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2"><div className="h-3 w-28 animate-pulse rounded bg-secondary" /><div className="h-6 w-2/3 animate-pulse rounded-md bg-secondary" /></div>
          <div className="h-7 w-20 animate-pulse rounded-full bg-secondary" />
        </div>
        <div className="mt-7 h-12 w-28 animate-pulse rounded-lg bg-secondary" />
        <div className="mt-4 h-1.5 animate-pulse rounded-full bg-secondary" />
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-4"><div className="h-9 animate-pulse rounded bg-secondary" /><div className="h-9 animate-pulse rounded bg-secondary" /><div className="h-9 animate-pulse rounded bg-secondary" /></div>
      </div>
      <div className="h-20 animate-pulse rounded-2xl bg-secondary/70" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {[0, 1, 2].map((item) => (
          <div key={item} className={`flex min-h-[4.5rem] gap-3 p-4 ${item > 0 ? "border-t border-border" : ""}`}>
            <div className="h-8 w-8 animate-pulse rounded-lg bg-secondary" />
            <div className="flex-1 space-y-2 py-0.5"><div className="h-3 w-24 animate-pulse rounded bg-secondary" /><div className="h-4 w-3/4 animate-pulse rounded bg-secondary" /></div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading your exam page…</span>
    </div>
  );
}
