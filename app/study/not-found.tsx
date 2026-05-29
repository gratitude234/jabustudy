import Link from "next/link";
import { Home, BookOpen } from "lucide-react";

export default function StudyNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4 pb-28 md:pb-6">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-base font-extrabold tracking-tight text-foreground">
            Page not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page doesn&apos;t exist or has been moved.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/study"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground no-underline hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Home className="h-4 w-4" />
              Study home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
