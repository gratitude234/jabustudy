"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { trackHomeCta } from "@/lib/studyAnalytics";

const SEARCH_LAUNCHED_AT = "2026-04-13";

type CourseSearchResult = {
  id: string;
  course_code: string;
  course_title: string | null;
};

function shouldShowNewBadge(now = new Date()) {
  const launch = new Date(`${SEARCH_LAUNCHED_AT}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastBadgeDay = new Date(launch.getFullYear(), launch.getMonth(), launch.getDate() + 14);
  return today <= lastBadgeDay;
}

export default function CourseSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseSearchResult[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (!term) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("study_courses")
        .select("id, course_code, course_title")
        .ilike("course_code", `%${term}%`)
        .eq("status", "approved")
        .limit(5);

      if (cancelled) return;
      setResults(!error ? ((data as CourseSearchResult[]) ?? []) : []);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const showDropdown = focused && query.trim().length > 0 && results.length > 0;
  const showNewBadge = shouldShowNewBadge() && query.trim().length === 0;
  const trimmedQuery = query.trim();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    trackHomeCta("course_search_submit", {
      query_length: trimmedQuery.length,
      position: 1,
    });
    if (!trimmedQuery) return;
    const exactMatch = results.find(
      (result) => result.course_code.trim().toUpperCase() === trimmedQuery
    );
    if (!exactMatch) return;
    setFocused(false);
    setResults([]);
    setQuery("");
    router.push(`/study/courses/${encodeURIComponent(exactMatch.course_code)}`);
  }

  return (
    <form
      className="relative"
      onSubmit={handleSubmit}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3">
        <input
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value.toUpperCase();
            setQuery(nextQuery);
            if (!nextQuery.trim()) setResults([]);
          }}
          onFocus={() => setFocused(true)}
          placeholder="Search by course code…"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          aria-label="Search by course code"
        />

        {showNewBadge ? (
          <span className="shrink-0 rounded-md bg-[#EEEDFE] px-1.5 py-0.5 text-[10px] font-bold text-[#3B24A8]">
            NEW
          </span>
        ) : null}
      </div>

      {showDropdown ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setFocused(false);
                setResults([]);
                setQuery("");
                router.push(`/study/courses/${encodeURIComponent(result.course_code)}`);
              }}
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-secondary/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{result.course_code}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {result.course_title ?? "Course"}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
