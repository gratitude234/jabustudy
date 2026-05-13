"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { BookOpen, CheckCircle2 } from "lucide-react";

export function DueTodayWidget({ userId }: { userId: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchDue() {
      setLoading(true);
      try {
        const now = new Date().toISOString();
        const { count: dueCount, error } = await supabase
          .from("study_weak_questions")
          .select("user_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .lte("next_due_at", now)
          .is("graduated_at", null);

        if (!cancelled && !error) {
          setCount(dueCount ?? 0);
        }
      } catch {
        // silently fail — widget is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDue();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="h-12 w-full animate-pulse rounded-2xl bg-muted" />
    );
  }

  if (count === null) return null;

  if (count === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        Nothing due today — you&apos;re on track
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-[#5B35D5]/20 bg-[#5B35D5]/[0.07] px-4 py-3",
        "dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <BookOpen className="h-4 w-4 shrink-0 text-[#5B35D5]" />
        <p className="text-sm font-semibold text-[#3B24A8] dark:text-indigo-200">
          You have{" "}
          <span className="font-extrabold">{count}</span>{" "}
          {count === 1 ? "question" : "questions"} due today
        </p>
      </div>
      <Link
        href="/study/practice?due=1"
        className={cn(
          "shrink-0 rounded-xl bg-[#5B35D5] px-3 py-1.5 text-xs font-bold text-white",
          "hover:bg-[#4526B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2",
          "dark:bg-[#5B35D5] dark:hover:bg-[#4526B8]"
        )}
      >
        Start review →
      </Link>
    </div>
  );
}