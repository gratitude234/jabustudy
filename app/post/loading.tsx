export default function Loading() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-10 w-1/3 rounded bg-zinc-200 animate-pulse" />
      <div className="h-12 rounded-2xl bg-zinc-200 animate-pulse" />
      <div className="h-40 rounded-3xl bg-zinc-200 animate-pulse" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-12 rounded-2xl bg-zinc-200 animate-pulse" />
        <div className="h-12 rounded-2xl bg-zinc-200 animate-pulse" />
      </div>
      <div className="h-12 rounded-2xl bg-zinc-200 animate-pulse" />
    </div>
  );
}
