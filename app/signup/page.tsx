// app/signup/page.tsx
import { Suspense } from "react";
import SignupClient from "./SignupClient";

function Skeleton() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-3xl border bg-white p-4 sm:p-5">
        <div className="space-y-2">
          <div className="h-5 w-44 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-zinc-100" />
        </div>

        <div className="mt-5 space-y-3">
          <div className="h-4 w-16 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-4 w-24 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-4 w-32 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
        </div>

        <div className="mt-5 h-11 w-full animate-pulse rounded-2xl bg-zinc-100" />
        <div className="mt-3 h-4 w-60 animate-pulse rounded-lg bg-zinc-100" />
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <Suspense fallback={<Skeleton />}>
          <SignupClient />
        </Suspense>
      </div>
    </div>
  );
}
