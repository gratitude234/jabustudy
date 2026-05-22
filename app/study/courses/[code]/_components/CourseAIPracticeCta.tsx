"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "checking" | "ready" | "idle" | "generating" | "error";

export function CourseAIPracticeCta({
  courseId,
  courseCode,
}: {
  courseId: string;
  courseCode: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [setId, setSetId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ai/generate-questions-course?courseId=${encodeURIComponent(courseId)}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean; setId?: string }) => {
        if (cancelled) return;
        if (data?.setId) {
          setSetId(data.setId);
          setStatus("ready");
        } else {
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("idle");
      });
    return () => { cancelled = true; };
  }, [courseId]);

  async function handleGenerate() {
    setStatus("generating");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/generate-questions-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, count: 10 }),
      });
      const data = await res.json() as { ok?: boolean; setId?: string; message?: string };
      if (data?.setId) {
        router.push(`/study/practice/${encodeURIComponent(data.setId)}`);
      } else {
        setErrorMsg(data?.message ?? "Couldn't generate — materials may still be indexing");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Couldn't generate — materials may still be indexing");
      setStatus("error");
    }
  }

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center py-1">
        <Loader2 className="h-4 w-4 animate-spin text-muted-brand" />
      </div>
    );
  }

  if (status === "ready" && setId) {
    return (
      <Link
        href={`/study/practice/${encodeURIComponent(setId)}`}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3.5 no-underline transition hover:opacity-90 active:scale-[0.98]"
        )}
      >
        <div>
          <p className="text-sm font-extrabold text-white">Start AI Practice</p>
          <p className="mt-0.5 text-xs text-white/70">AI-generated questions for {courseCode}</p>
        </div>
        <Sparkles className="h-5 w-5 shrink-0 text-white/80" />
      </Link>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3.5 transition hover:bg-primary/10 focus-visible:outline-none"
        >
          <div>
            <p className="text-sm font-extrabold text-primary">Generate AI Practice</p>
            <p className="mt-0.5 text-xs text-muted-brand">Questions from course materials</p>
          </div>
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
        </button>
        <p className="px-1 text-xs text-rose-500">{errorMsg}</p>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3.5 opacity-70"
      >
        <div>
          <p className="text-sm font-extrabold text-primary">Generating…</p>
          <p className="mt-0.5 text-xs text-muted-brand">Building questions from course materials</p>
        </div>
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
      </button>
    );
  }

  // idle
  return (
    <button
      type="button"
      onClick={() => void handleGenerate()}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3.5 transition hover:bg-primary/10 focus-visible:outline-none"
    >
      <div>
        <p className="text-sm font-extrabold text-primary">Generate AI Practice</p>
        <p className="mt-0.5 text-xs text-muted-brand">Questions from course materials</p>
      </div>
      <Sparkles className="h-5 w-5 shrink-0 text-primary" />
    </button>
  );
}
