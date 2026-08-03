"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
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
  coverage: {
    delivered: number;
    bankTotal: number;
    complete: boolean;
  };
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
  progress: {
    bestPercentage: number;
    attempts: number;
    basedOn: "mock" | "diagnostic";
  } | null;
  activeAttempt: CatalogActiveAttempt | null;
};

type Filter = "ready" | "all" | "coming";

function remainingLabel(deadlineAt: string) {
  const remaining = Math.max(0, new Date(deadlineAt).getTime() - Date.now());
  return remaining > 0 ? `${msToClock(remaining)} remaining` : "Finishing attempt";
}

function RemainingTime({ deadlineAt }: { deadlineAt: string }) {
  const [label, setLabel] = useState("Timer still running");

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
    const filtered = courses.filter((course) => {
      const ready = course.sets.length > 0;
      if (filter === "ready" && !ready) return false;
      if (filter === "coming" && ready) return false;
      if (!normalizedQuery) return true;
      return `${course.code} ${course.title}`.toLowerCase().includes(normalizedQuery);
    });

    return filtered.sort((a, b) => {
      if (Boolean(a.activeAttempt) !== Boolean(b.activeAttempt)) return a.activeAttempt ? -1 : 1;
      if ((a.sets.length > 0) !== (b.sets.length > 0)) return a.sets.length > 0 ? -1 : 1;
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
  }, [courses, filter, normalizedQuery]);

  const visible = filter === "all" && !normalizedQuery && !showAllComing
    ? matching.filter((course, index) => course.sets.length > 0 || index < readyCount + 3)
    : matching;
  const hiddenComing = Math.max(0, matching.length - visible.length);

  return (
    <section id="courses" className="scroll-mt-24 space-y-4" aria-labelledby="course-picker-heading">
      {activeAttempts.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.06]">
          {activeAttempts.map((attempt, index) => (
            <div key={attempt.attemptId} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", index > 0 && "border-t border-primary/15")}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Play className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Exam in progress</p>
                <p className="mt-0.5 truncate font-extrabold">Resume {attempt.courseCode} mock</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <RemainingTime deadlineAt={attempt.deadlineAt} />
                </p>
              </div>
              <Link href={`/exam/attempt/${attempt.attemptId}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground no-underline hover:brightness-105">
                Resume <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Supplementary 2026</p>
          <h2 id="course-picker-heading" className="mt-1 text-2xl font-black tracking-tight">Choose your course</h2>
        </div>
        <p className="text-sm text-muted-foreground">Ready courses appear first.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <label className="relative block">
          <span className="sr-only">Search course code or title</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search course code or title"
            className="min-h-12 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-base outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Filter courses">
          {([
            { key: "ready", label: "Ready", count: readyCount },
            { key: "all", label: "All", count: courses.length },
            { key: "coming", label: "Coming soon", count: comingCount },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setFilter(item.key); setShowAllComing(false); }}
              aria-pressed={filter === item.key}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-extrabold transition",
                filter === item.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-secondary",
              )}
            >
              {item.label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", filter === item.key ? "bg-white/20" : "bg-secondary text-muted-foreground")}>{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {visible.map((course, index) => {
            const ready = course.sets.length > 0;
            const coverage = courseCoverage(course);
            return (
              <article key={course.code} className={cn("p-4 sm:p-5", index > 0 && "border-t border-border")}>
                <div className="flex items-start gap-3">
                  <span className={cn("grid min-h-11 min-w-20 place-items-center rounded-xl px-2 text-sm font-black", ready ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>{course.code}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold leading-6">{course.title}</h3>
                      {course.activeAttempt ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">In progress</span> : null}
                      {!course.activeAttempt && ready ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Ready</span> : null}
                    </div>
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold leading-5 text-muted-foreground">
                      <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {course.dateLabel}
                    </p>
                    {ready ? (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted-foreground">
                        <span>{course.sets[0].attemptQuestionCount} questions · {course.sets[0].timeLimitMinutes} minutes</span>
                        <span>Questions seen: {coverage.delivered}/{coverage.bankTotal}</span>
                        {course.progress ? <span className="text-emerald-700 dark:text-emerald-400">Best: {course.progress.bestPercentage}%</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex justify-end sm:mt-0 sm:-translate-y-1">
                  {course.activeAttempt ? (
                    <Link href={`/exam/attempt/${course.activeAttempt.attemptId}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground no-underline sm:w-auto">
                      Resume mock <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : ready ? (
                    <Link href={`/exam/${course.slug}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 text-sm font-black text-primary no-underline hover:bg-primary/10 sm:w-auto">
                      Open course <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-sm font-bold text-muted-foreground sm:w-auto">
                      <LockKeyhole className="h-4 w-4" aria-hidden="true" /> Coming soon
                    </span>
                  )}
                </div>
              </article>
            );
          })}
          {hiddenComing > 0 ? (
            <button type="button" onClick={() => setShowAllComing(true)} className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-border bg-secondary/50 px-4 text-sm font-extrabold text-primary hover:bg-secondary">
              <ChevronDown className="h-4 w-4" aria-hidden="true" /> View {hiddenComing} more coming-soon course{hiddenComing === 1 ? "" : "s"}
            </button>
          ) : filter === "all" && showAllComing && comingCount > 3 && !normalizedQuery ? (
            <button type="button" onClick={() => setShowAllComing(false)} className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-border bg-secondary/50 px-4 text-sm font-extrabold text-primary hover:bg-secondary">
              <ChevronUp className="h-4 w-4" aria-hidden="true" /> Collapse coming-soon courses
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center shadow-sm">
          <Search className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 font-extrabold">No matching courses</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try another code, title or filter.</p>
        </div>
      )}

      {readyCount > 0 ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Course availability follows reviewed and published question banks.
        </p>
      ) : null}
    </section>
  );
}
