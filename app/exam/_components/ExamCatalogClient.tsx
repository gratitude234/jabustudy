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
  const readyCount = courses.filter((course) => course.sets.length > 0).length;
  const comingCount = courses.length - readyCount;
  const normalizedQuery = query.trim().toLowerCase();

  const matching = useMemo(() => {
    return courses
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
  }, [courses, filter, normalizedQuery]);

  const visible = filter === "all" && !normalizedQuery && !showAllComing
    ? [
        ...matching.filter((course) => course.sets.length > 0),
        ...matching.filter((course) => course.sets.length === 0).slice(0, 3),
      ]
    : matching;
  const hiddenComing = Math.max(0, matching.length - visible.length);

  return (
    <section id="courses" className="scroll-mt-20 space-y-4" aria-labelledby="course-picker-heading">
      {activeAttempts.length > 0 ? (
        <div className="space-y-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Timer still running</p>
              <h2 className="mt-0.5 text-xl font-black tracking-tight">Continue your mock</h2>
            </div>
          </div>
          {activeAttempts.map((attempt) => (
            <Link
              key={attempt.attemptId}
              href={`/exam/attempt/${attempt.attemptId}`}
              className="group flex min-h-[5.75rem] items-center gap-3 rounded-2xl bg-[#21164f] p-4 text-white no-underline shadow-[0_12px_30px_rgba(33,22,79,0.14)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-violet-100"><Play className="h-4 w-4 fill-current" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">{attempt.courseCode} · {attempt.setTitle}</span>
                <span className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-violet-200/80"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /><RemainingTime deadlineAt={attempt.deadlineAt} /> · {attempt.totalQuestions} questions</span>
              </span>
              <span className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-white px-3 text-xs font-black text-[#21164f] transition group-hover:translate-x-0.5">Resume <ChevronRight className="h-4 w-4" aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="pt-1">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Course library</p>
        <h2 id="course-picker-heading" className="mt-0.5 text-2xl font-black tracking-tight">Choose a course to practise</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">Tap any ready course to start or continue your CBT preparation.</p>
      </div>

      <div className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-30 -mx-4 space-y-2.5 border-y border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-card sm:p-3">
        <label className="relative block">
          <span className="sr-only">Search by course code or title</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search code or course title"
            className="min-h-12 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-base font-semibold outline-none transition placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 dark:bg-background"
          />
        </label>
        <div className="grid grid-cols-3 rounded-xl bg-secondary p-1" role="group" aria-label="Filter courses">
          {([
            { key: "ready", label: "Ready", count: readyCount },
            { key: "all", label: "All", count: courses.length },
            { key: "coming", label: "Soon", count: comingCount },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setFilter(item.key); setShowAllComing(false); }}
              aria-pressed={filter === item.key}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-black transition",
                filter === item.key
                  ? "bg-card text-primary shadow-sm dark:bg-primary dark:text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}<span className="font-mono text-[10px] opacity-70">{item.count}</span>
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
                  "grid h-12 w-[3.7rem] shrink-0 place-items-center rounded-xl px-1 text-center text-xs font-black leading-4",
                  course.activeAttempt
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : ready
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground",
                )}>{course.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{course.title}</span>
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{course.dateLabel}</span>
                  </span>
                  {ready ? (
                    <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-muted-foreground">
                      <span>{set.attemptQuestionCount} questions · {set.timeLimitMinutes} min</span>
                      {course.progress ? <span className="text-emerald-700 dark:text-emerald-300">Best {course.progress.bestPercentage}%</span> : <span>Not attempted</span>}
                      {coverage.bankTotal > 0 ? <span>{coverage.delivered}/{coverage.bankTotal} seen</span> : null}
                    </span>
                  ) : (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground"><LockKeyhole className="h-3 w-3" aria-hidden="true" /> Bank under review</span>
                  )}
                </span>
                {ready ? (
                  <span className={cn(
                    "inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-lg px-2.5 text-[10px] font-black transition group-hover:translate-x-0.5",
                    course.activeAttempt
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-primary text-primary-foreground",
                  )}>{actionLabel}<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                ) : (
                  <span className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-secondary px-2.5 text-[10px] font-black text-muted-foreground"><LockKeyhole className="h-3 w-3" aria-hidden="true" /> Soon</span>
                )}
              </>
            );

            return ready ? (
              <Link
                key={course.code}
                href={destination}
                aria-label={`${actionLabel} ${course.code}, ${course.title}`}
                className={cn("group flex min-h-[5.75rem] items-center gap-3 px-4 py-3.5 no-underline transition hover:bg-secondary/45 focus-visible:bg-secondary/45 focus-visible:outline-none", index > 0 && "border-t border-border")}
              >
                {content}
              </Link>
            ) : (
              <article key={course.code} className={cn("flex min-h-[5.75rem] items-center gap-3 px-4 py-3.5", index > 0 && "border-t border-border")}>
                {content}
              </article>
            );
          })}

          {hiddenComing > 0 ? (
            <button type="button" onClick={() => setShowAllComing(true)} className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-border bg-secondary/40 px-4 text-sm font-extrabold text-primary hover:bg-secondary">
              <ChevronDown className="h-4 w-4" aria-hidden="true" /> Show {hiddenComing} more course{hiddenComing === 1 ? "" : "s"}
            </button>
          ) : filter === "all" && showAllComing && comingCount > 3 && !normalizedQuery ? (
            <button type="button" onClick={() => setShowAllComing(false)} className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-border bg-secondary/40 px-4 text-sm font-extrabold text-primary hover:bg-secondary">
              <ChevronUp className="h-4 w-4" aria-hidden="true" /> Hide coming-soon courses
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <Search className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 font-extrabold">No course found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Check the course code or try a different filter.</p>
          <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-4 min-h-11 rounded-xl bg-secondary px-4 text-sm font-extrabold text-primary">Show all courses</button>
        </div>
      )}

      {readyCount > 0 ? (
        <p className="flex items-start gap-2 px-1 text-[11px] font-semibold leading-5 text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          A course opens only after its questions have been reviewed and published.
        </p>
      ) : null}
    </section>
  );
}
