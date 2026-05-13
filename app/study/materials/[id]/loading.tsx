export default function MaterialDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5 animate-pulse">
      {/* back + breadcrumb */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
      </div>

      {/* title */}
      <div className="space-y-2">
        <div className="h-6 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>

      {/* badge row */}
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded-full bg-muted" />
        <div className="h-6 w-24 rounded-full bg-muted" />
      </div>

      {/* file viewer placeholder */}
      <div className="h-[300px] w-full rounded-xl bg-muted" />

      {/* action buttons */}
      <div className="flex gap-3">
        <div className="h-10 w-28 rounded-lg bg-muted" />
        <div className="h-10 w-28 rounded-lg bg-muted" />
        <div className="h-10 w-28 rounded-lg bg-muted" />
      </div>

      {/* AI summary card */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}
