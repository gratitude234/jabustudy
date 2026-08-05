import Link from "next/link";
import { Home } from "lucide-react";
import { isExamSprintOnlyMode } from "@/lib/systemMode";

export default function NotFound() {
  const examOnlyMode = isExamSprintOnlyMode();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm text-center">
        <p className="text-5xl font-black text-muted-foreground/30">404</p>
        <h1 className="mt-2 text-base font-extrabold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href={examOnlyMode ? "/exam" : "/study"}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground no-underline hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Home className="h-4 w-4" />
          {examOnlyMode ? "Go to Exam Sprint" : "Go to Study Hub"}
        </Link>
      </div>
    </div>
  );
}
