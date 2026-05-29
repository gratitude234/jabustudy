// app/notifications/page.tsx
import { Suspense } from "react";
import NotificationsClient from "./NotificationsClient";

function NotificationsFallback() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28 pt-4 md:pb-6">
      <div className="h-6 w-32 rounded bg-muted animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 animate-pulse">
            <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationsClient />
    </Suspense>
  );
}
