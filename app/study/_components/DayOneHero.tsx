"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { track } from "@/lib/studyAnalytics";
import { cn } from "@/lib/utils";
import { useStudyPrefs } from "./StudyPrefsContext";

type DayOneHeroProps = {
  displayName: string | null;
  loading: boolean;
};

type FirstSetSource =
  | "curated"
  | "curated_dept_fallback"
  | "auto_dept_level"
  | "auto_dept"
  | "auto_any";

type FirstSetPick = {
  id: string;
  title: string;
  course_code: string | null;
  level: number | null;
  question_count: number;
  estimated_minutes: number;
  source: FirstSetSource;
};

type FirstSetPickResponse = {
  ok: true;
  set: FirstSetPick | null;
};

function HeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="p-5 pb-4">
        <div className="h-6 w-1/2 animate-pulse rounded bg-secondary/70" />
        <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-secondary/70" />
        <div className="mt-4 h-36 animate-pulse rounded-2xl bg-secondary/70" />
      </div>
    </div>
  );
}

export default function DayOneHero({
  displayName,
  loading,
}: DayOneHeroProps) {
  const { prefs } = useStudyPrefs();
  const [fetching, setFetching] = useState(true);
  const [pickedSet, setPickedSet] = useState<FirstSetPick | null>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPick() {
      setFetching(true);
      try {
        const response = await fetch("/api/study/first-set-pick", {
          credentials: "same-origin",
        });
        const payload = (await response.json()) as FirstSetPickResponse | { ok: false };
        if (cancelled) return;
        setPickedSet(payload && "ok" in payload && payload.ok ? payload.set : null);
      } catch {
        if (!cancelled) setPickedSet(null);
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    void loadPick();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || fetching || viewedRef.current) return;
    viewedRef.current = true;
    track("study_home_day_one_viewed", {
      has_set: Boolean(pickedSet),
      source: pickedSet?.source,
    });
  }, [fetching, loading, pickedSet]);

  const greeting = useMemo(() => {
    return displayName ? `Welcome, ${displayName}` : "Welcome";
  }, [displayName]);

  const department = prefs?.department?.trim() || null;
  const label =
    pickedSet?.level != null && department
      ? `SUGGESTED FOR ${pickedSet.level}L · ${department}`
      : "SUGGESTED STARTER";

  if (loading || fetching) {
    return <HeroSkeleton />;
  }

  if (!pickedSet) {
    return (
      <div className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xl font-extrabold tracking-tight text-foreground">{greeting}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Let&apos;s get you to your first session.
        </p>

        <div className="mt-4 rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] p-4 dark:bg-[#5B35D5]/15">
          <p className="text-sm font-semibold text-foreground">
            {department
              ? `We don't have a starter set for ${department} yet.`
              : "We don't have a starter set for your department yet."}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href="/study/library"
              onClick={() =>
                track("study_home_day_one_cta_tapped", { cta: "browse_materials" })
              }
              className={cn(
                "inline-flex items-center justify-center rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground no-underline transition",
                "hover:bg-secondary/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              Browse materials
            </Link>
            <Link
              href="/study/practice"
              onClick={() =>
                track("study_home_day_one_cta_tapped", { cta: "explore_sets" })
              }
              className={cn(
                "inline-flex items-center justify-center rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground no-underline transition",
                "hover:bg-secondary/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              Explore practice sets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xl font-extrabold tracking-tight text-foreground">{greeting}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Let&apos;s get you to your first session.
      </p>

      <div className="mt-4 rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] p-4 dark:bg-[#5B35D5]/15">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#3B24A8] dark:text-indigo-200">
          {label}
        </p>
        <p className="mt-2 line-clamp-1 text-sm font-extrabold text-foreground">
          {pickedSet.course_code ? `${pickedSet.course_code} · ${pickedSet.title}` : pickedSet.title}
        </p>
        <p className="mt-1 text-xs text-[#5B35D5]/80 dark:text-indigo-200">
          {pickedSet.question_count} questions · ~{pickedSet.estimated_minutes} min · Gentle warm-up
        </p>

        <Link
          href={`/study/practice/${encodeURIComponent(pickedSet.id)}`}
          onClick={() =>
            track("study_home_day_one_cta_tapped", {
              cta: "start_first_set",
              set_id: pickedSet.id,
              source: pickedSet.source,
            })
          }
          className={cn(
            "mt-3 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 no-underline shadow-sm transition",
            "bg-[#5B35D5] text-white hover:bg-[#4526B8]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
          )}
        >
          <span className="text-sm font-extrabold">Start first set</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white" />
        </Link>
      </div>
    </div>
  );
}
