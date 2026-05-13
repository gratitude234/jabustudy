// app/auth/callback/page.tsx
import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

function Skeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-3xl border bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 animate-pulse rounded-2xl border bg-zinc-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-44 animate-pulse rounded-lg bg-zinc-100" />
              <div className="h-4 w-72 animate-pulse rounded-lg bg-zinc-100" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
          </div>

          <div className="mt-5 h-4 w-56 animate-pulse rounded-lg bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <CallbackClient />
    </Suspense>
  );
}
