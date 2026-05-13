"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="text-xl font-bold text-zinc-900">You're offline</h1>
      <p className="text-sm text-zinc-500">
        Check your connection and try again. Pages you've visited before are still available.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-2xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
      >
        Try again
      </button>
    </div>
  );
}