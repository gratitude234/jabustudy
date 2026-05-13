export default function Loading() {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-zinc-200 animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-zinc-200 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-zinc-200 animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-zinc-200 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 h-10 rounded-2xl bg-zinc-200 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
