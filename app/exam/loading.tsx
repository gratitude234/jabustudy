export default function ExamLoading() {
  return (
    <div className="space-y-5 pb-12" role="status" aria-label="Loading Exam Sprint">
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="h-12 animate-pulse rounded-xl border border-border bg-card" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={`flex gap-3 p-4 ${item > 0 ? "border-t border-border" : ""}`}>
            <div className="h-11 w-20 animate-pulse rounded-xl bg-secondary" />
            <div className="flex-1 space-y-2 py-1"><div className="h-4 w-2/3 animate-pulse rounded bg-secondary" /><div className="h-3 w-1/2 animate-pulse rounded bg-secondary" /></div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading courses and attempts…</span>
    </div>
  );
}
