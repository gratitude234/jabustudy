export default function Loading() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm"
        >
          <div className="h-32 rounded-xl bg-zinc-200 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-zinc-200 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-zinc-200 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-zinc-200 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
