"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  LockKeyhole,
  Play,
  Search,
} from "lucide-react";
import { cn, msToClock } from "@/lib/utils";

type CatalogSet = {
  id: string;
  title: string;
  attemptQuestionCount: number;
  timeLimitMinutes: number;
  coverage: { delivered: number; bankTotal: number; complete: boolean };
};

type CatalogActiveAttempt = {
  attemptId: string;
  courseCode: string;
  setTitle: string;
  deadlineAt: string;
  totalQuestions: number;
};

type CatalogCourse = {
  code: string;
  slug: string;
  title: string;
  dateLabel: string;
  priority: boolean;
  sets: CatalogSet[];
  progress: { bestPercentage: number; attempts: number; basedOn: "mock" | "diagnostic" } | null;
  activeAttempt: CatalogActiveAttempt | null;
};

type Filter = "ready" | "all" | "coming";

function remainingLabel(deadlineAt: string) {
  const remaining = Math.max(0, new Date(deadlineAt).getTime() - Date.now());
  return remaining > 0 ? `${msToClock(remaining)} left` : "Finishing attempt";
}

function RemainingTime({ deadlineAt }: { deadlineAt: string }) {
  const [label, setLabel] = useState("Timer is running");

  useEffect(() => {
    const tick = () => setLabel(remainingLabel(deadlineAt));
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);

  return <span className="font-mono tabular-nums">{label}</span>;
}

function courseCoverage(course: CatalogCourse) {
  return course.sets.reduce(
    (total, set) => ({
      delivered: total.delivered + set.coverage.delivered,
      bankTotal: total.bankTotal + set.coverage.bankTotal,
    }),
    { delivered: 0, bankTotal: 0 },
  );
}

export default function ExamCatalogClient({
  courses,
  activeAttempts,
}: {
  courses: CatalogCourse[];
  activeAttempts: CatalogActiveAttempt[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ready");
  const [showAllComing, setShowAllComing] = useState(false);
  const uniqueCourses = useMemo(
    () => Array.from(new Map(courses.map((course) => [course.slug, course])).values()),
    [courses],
  );
  const readyCount = uniqueCourses.filter((course) => course.sets.length > 0).length;
  const comingCount = uniqueCourses.length - readyCount;
  const normalizedQuery = query.trim().toLowerCase();

  const matching = useMemo(() => {
    return uniqueCourses
      .filter((course) => {
        const ready = course.sets.length > 0;
        if (filter === "ready" && !ready) return false;
        if (filter === "coming" && ready) return false;
        if (!normalizedQuery) return true;
        return `${course.code} ${course.title}`.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (Boolean(a.activeAttempt) !== Boolean(b.activeAttempt)) return a.activeAttempt ? -1 : 1;
        if ((a.sets.length > 0) !== (b.sets.length > 0)) return a.sets.length > 0 ? -1 : 1;
        if (a.priority !== b.priority) return a.priority ? -1 : 1;
        return a.code.localeCompare(b.code, undefined, { numeric: true });
      });
  }, [filter, normalizedQuery, uniqueCourses]);

  const visible = filter === "all" && !normalizedQuery && !showAllComing
    ? [
        ...matching.filter((course) => course.sets.length > 0),
        ...matching.filter((course) => course.sets.length === 0).slice(0, 3),
      ]
    : matching;
  const hiddenComing = Math.max(0, matching.length - visible.length);

  return (
    <section id="courses" className="scroll-mt-20 space-y-3.5" aria-labelledby="course-picker-heading">
      {activeAttempts.length > 0 ? (
        <div id="active-mock" className="scroll-mt-20 space-y-2">
          {activeAttempts.map((attempt) => (
            <Link
              key={attempt.attemptId}
              href={`/exam/attempt/${attempt.attemptId}`}
              className="group flex min-h-[4.75rem] items-center gap-3 rounded-2xl border border-amber-200/70 bg-card p-3.5 text-foreground no-underline transition hover:border-primary/30 hover:bg-secondary/25 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-amber-900/50"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300"><Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-bold uppercase tracking-[0.13em] text-amber-700 dark:text-amber-300">Mock in progress</span>
                <span className="mt-0.5 block text-[13px] font-bold">{attempt.courseCode} Mock</span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Clock3 className="h-3 w-3 text-amber-600" aria-hidden="true" /><RemainingTime deadlineAt={attempt.deadlineAt} /> · {attempt.totalQuestions} questions</span>
              </span>
              <span className="inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-lg bg-primary/10 px-2.5 text-[11px] font-bold text-primary transition group-hover:translate-x-0.5">Resume <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="pt-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Course library</p>
        <h2 id="course-picker-heading" className="mt-0.5 text-xl font-extrabold tracking-tight">Choose a course</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Start a mock or continue where you stopped.</p>
      </div>

      <div className="space-y-2">
        <label className="relative block">
          <span className="sr-only">Search by course code or title</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search code or course title"
            className="min-h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-base font-normal outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 dark:bg-background"
          />
        </label>
        <div className="grid grid-cols-3 rounded-xl bg-secondary p-1" role="group" aria-label="Filter courses">
          {([
            { key: "ready", label: "Ready", count: readyCount },
            { key: "all", label: "All", count: uniqueCourses.length },
            { key: "coming", label: "Soon", count: comingCount },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setFilter(item.key); setShowAllComing(false); }}
              aria-pressed={filter === item.key}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition",
                filter === item.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}<span className="font-mono text-[9px] opacity-60">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {visible.map((course, index) => {
            const ready = course.sets.length > 0;
            const set = course.sets[0];
            const coverage = courseCoverage(course);
            const destination = course.activeAttempt
              ? `/exam/attempt/${course.activeAttempt.attemptId}`
              : `/exam/${course.slug}`;
            const actionLabel = course.activeAttempt
              ? "Resume"
              : course.progress
                ? "Continue"
                : "Start";
            const content = (
              <>
                <span className={cn(
                  "grid h-10 w-[3.25rem] shrink-0 place-items-center rounded-lg px-1 text-center text-[10px] font-extrabold leading-3.5",
                  course.activeAttempt
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : ready
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground",
                )}>{course.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-start gap-2">
                    <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-bold leading-4">{course.title}</span>
                    {ready ? (
                      <span className={cn(
                        "inline-flex min-h-6 shrink-0 items-center gap-0.5 text-[10px] font-bold transition group-hover:translate-x-0.5",
                        course.activeAttempt ? "text-amber-700 dark:text-amber-300" : "text-primary",
                      )}>{actionLabel}<ChevronRight className="h-3 w-3" aria-hidden="true" /></span>
                    ) : (
                      <span className="inline-flex min-h-6 shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground"><LockKeyhole className="h-2.5 w-2.5" aria-hidden="true" /> Soon</span>
                    )}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                    <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{course.dateLabel}</span>
                  </span>
                  {ready ? (
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium text-muted-foreground">
                      <span>{set.attemptQuestionCount} questions · {set.timeLimitMinutes} min</span>
                      <span className="inline-flex items-center gap-2">
                        <span className="text-border" aria-hidden="true">•</span>
                        {course.progress ? <span className="font-semibold text-emerald-700 dark:text-emerald-300">Best {course.progress.bestPercentage}%</span> : <span>Not attempted</span>}
                      </span>
                      {coverage.bankTotal > 0 ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-border" aria-hidden="true">•</span>
                          <span>{coverage.delivered}/{coverage.bankTotal} seen</span>
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground"><LockKeyhole className="h-2.5 w-2.5" aria-hidden="true" /> Bank under review</span>
                  )}
                </span>
              </>
            );

            return ready ? (
              <Link
                key={course.code}
                href={destination}
                aria-label={`${actionLabel} ${course.code}, ${course.title}`}
                className={cn("group flex min-h-[4.75rem] items-center gap-3 px-3.5 py-3 no-underline transition hover:bg-secondary/35 focus-visible:bg-secondary/35 focus-visible:outline-none", index > 0 && "border-t border-border")}
              >
                {content}
              </Link>
            ) : (
              <article key={course.code} className={cn("flex min-h-[4.75rem] items-center gap-3 px-3.5 py-3", index > 0 && "border-t border-border")}>
                {content}
              </article>
            );
          })}

          {hiddenComing > 0 ? (
            <button type="button" onClick={() => setShowAllComing(true)} className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-border bg-secondary/35 px-4 text-xs font-bold text-primary hover:bg-secondary">
              <ChevronDown className="h-4 w-4" aria-hidden="true" /> Show {hiddenComing} more course{hiddenComing === 1 ? "" : "s"}
            </button>
          ) : filter === "all" && showAllComing && comingCount > 3 && !normalizedQuery ? (
            <button type="button" onClick={() => setShowAllComing(false)} className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-border bg-secondary/35 px-4 text-xs font-bold text-primary hover:bg-secondary">
              <ChevronUp className="h-4 w-4" aria-hidden="true" /> Hide coming-soon courses
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <Search className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-bold">No course found</h3>
          <p className="mt-1 text-xs text-muted-foreground">Check the course code or try a different filter.</p>
          <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-4 min-h-10 rounded-xl bg-secondary px-4 text-xs font-bold text-primary">Show all courses</button>
        </div>
      )}

      {readyCount > 0 ? (
        <p className="flex items-start gap-2 px-1 text-[10px] font-medium leading-4.5 text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          A course opens only after its questions have been reviewed and published.
        </p>
      ) : null}
    </section>
  );
}
