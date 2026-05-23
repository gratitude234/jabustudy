"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm">
        <WifiOff className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-bold text-foreground">You're offline</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Check your connection and try again. JabuStudy will reconnect as soon as the network is back.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
