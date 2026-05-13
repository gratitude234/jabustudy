export default function Loading() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="h-4 w-1/4 rounded bg-zinc-200 animate-pulse" />
          <div className="mt-3 h-3 w-2/3 rounded bg-zinc-200 animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded bg-zinc-200 animate-pulse" />
          <div className="mt-4 flex gap-2">
            <div className="h-10 flex-1 rounded-xl bg-zinc-200 animate-pulse" />
            <div className="h-10 flex-1 rounded-xl bg-zinc-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
