"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Loader2,
  MessageCircle,
  Play,
  Search,
  X,
} from "lucide-react";
import { dedupeExamCourses } from "@/lib/examSprint/catalog";
import { isExamDeviceGuardErrorCode } from "@/lib/examSprint/device";
import { buildExamMaterialRequestWhatsAppUrl } from "@/lib/examSprint/materialRequest";
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

type CatalogActiveDiagnostic = {
  attemptId: string;
  courseCode: string | null;
  deadlineAt: string | null;
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

type Filter = "ready" | "needs_material" | "all";

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
  activeDiagnostic,
  materialRequestPhone,
}: {
  courses: CatalogCourse[];
  activeAttempts: CatalogActiveAttempt[];
  activeDiagnostic: CatalogActiveDiagnostic | null;
  materialRequestPhone: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ready");
  const [showAllNeedsMaterial, setShowAllNeedsMaterial] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<CatalogCourse | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const activeSessionId = activeAttempts[0]?.attemptId ?? activeDiagnostic?.attemptId ?? null;
  const activeSessionCourseCode = activeAttempts[0]?.courseCode ?? activeDiagnostic?.courseCode ?? null;
  const activeSessionKind = activeAttempts[0] ? "mock" : activeDiagnostic ? "diagnostic" : null;
  const uniqueCourses = useMemo(() => dedupeExamCourses(courses), [courses]);
  const readyCount = uniqueCourses.filter((course) => course.sets.length > 0).length;
  const needsMaterialCount = uniqueCourses.length - readyCount;
  const normalizedQuery = query.trim().toLowerCase();
  const missingCourseHref = buildExamMaterialRequestWhatsAppUrl({
    phone: materialRequestPhone,
    searchQuery: query,
  });

  const matching = useMemo(() => {
    return uniqueCourses
      .filter((course) => {
        const ready = course.sets.length > 0;
        if (filter === "ready" && !ready) return false;
        if (filter === "needs_material" && ready) return false;
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

  const visible = filter === "all" && !normalizedQuery && !showAllNeedsMaterial
    ? [
        ...matching.filter((course) => course.sets.length > 0),
        ...matching.filter((course) => course.sets.length === 0).slice(0, 3),
      ]
    : matching;
  const hiddenNeedsMaterial = Math.max(0, matching.length - visible.length);

  function localDraftHasPendingChanges(attemptId: string) {
    try {
      const raw = window.localStorage.getItem(`jabu-exam-draft:${attemptId}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { pending?: Record<string, unknown> };
      return Boolean(parsed?.pending && Object.keys(parsed.pending).length > 0);
    } catch {
      return false;
    }
  }

  async function endCurrentAndSwitch() {
    if (!activeSessionId || !switchTarget || switching) return;
    setSwitchError(null);

    if (localDraftHasPendingChanges(activeSessionId)) {
      setSwitchError("Some recent changes are still only on this phone. Resume the current attempt and reconnect before switching courses.");
      return;
    }

    setSwitching(true);
    try {
      const response = await fetch(`/api/exam/attempts/${activeSessionId}/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto" }),
      });
      const data = await response.json().catch(() => null) as { message?: string; code?: string } | null;
      if (!response.ok) {
        if (isExamDeviceGuardErrorCode(data?.code)) {
          router.push("/exam/me");
          return;
        }
        throw new Error(data?.message || "We couldn't switch courses. Your current attempt is still safe.");
      }

      window.localStorage.removeItem(`jabu-exam-draft:${activeSessionId}`);
      window.localStorage.removeItem(`jabu-exam-tab:${activeSessionId}`);
      const target = switchTarget;
      setSwitchTarget(null);
      router.push(`/exam/${target.slug}`);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "We couldn't switch courses. Your current attempt is still safe.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <section id="courses" className="scroll-mt-20 space-y-3.5" aria-labelledby="course-picker-heading">
      {activeDiagnostic ? (
        <Link
          href={`/exam/attempt/${activeDiagnostic.attemptId}`}
          className="group flex min-h-[4.75rem] items-center gap-3 rounded-2xl border border-amber-200/70 bg-card p-3.5 text-foreground no-underline transition hover:border-primary/30 hover:bg-secondary/25 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-amber-900/50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300"><Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-bold uppercase tracking-[0.13em] text-amber-700 dark:text-amber-300">Free diagnostic in progress</span>
            <span className="mt-0.5 block text-[13px] font-bold">{activeDiagnostic.courseCode ? `${activeDiagnostic.courseCode} Diagnostic` : "Exam Sprint Diagnostic"}</span>
            <span className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Clock3 className="h-3 w-3 text-amber-600" aria-hidden="true" />{activeDiagnostic.deadlineAt ? <RemainingTime deadlineAt={activeDiagnostic.deadlineAt} /> : "Timer is running"} · {activeDiagnostic.totalQuestions} questions</span>
          </span>
          <span className="inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-lg bg-primary/10 px-2.5 text-[11px] font-bold text-primary transition group-hover:translate-x-0.5">Resume <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
        </Link>
      ) : null}

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
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery.trim()) {
                setFilter("all");
                setShowAllNeedsMaterial(true);
              }
            }}
            placeholder="Search code or course title"
            className="min-h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-base font-normal outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 dark:bg-background"
          />
        </label>
        <div className="grid grid-cols-3 rounded-xl bg-secondary p-1" role="group" aria-label="Filter courses">
          {([
            { key: "ready", label: "Ready", count: readyCount },
            { key: "needs_material", label: "Needs material", count: needsMaterialCount },
            { key: "all", label: "All", count: uniqueCourses.length },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setFilter(item.key); setShowAllNeedsMaterial(false); }}
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
            const isActiveCourse = Boolean(
              activeSessionId
              && activeSessionCourseCode
              && activeSessionCourseCode.trim().toUpperCase() === course.code.trim().toUpperCase(),
            );
            const destination = isActiveCourse && activeSessionId
              ? `/exam/attempt/${activeSessionId}`
              : `/exam/${course.slug}`;
            const materialHref = buildExamMaterialRequestWhatsAppUrl({
              phone: materialRequestPhone,
              courseCode: course.code,
              courseTitle: course.title,
            });
            const actionLabel = isActiveCourse
              ? "Resume"
              : activeSessionId
                ? "Switch"
                : course.progress
                  ? "Continue"
                  : "Start";
            const content = (
              <>
                <span className={cn(
                  "grid h-10 w-[3.25rem] shrink-0 place-items-center rounded-lg px-1 text-center text-[10px] font-extrabold leading-3.5",
                  isActiveCourse
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : ready
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground",
                )}>{course.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-start gap-2">
                    <span className="line-clamp-2 min-w-0 flex-1 text-sm font-bold leading-[1.15rem]">{course.title}</span>
                    {ready ? (
                      <span className={cn(
                        "inline-flex min-h-8 shrink-0 items-center gap-0.5 rounded-lg px-2 text-[11px] font-bold transition group-hover:translate-x-0.5",
                        isActiveCourse
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-primary/10 text-primary",
                      )}>{actionLabel}<ChevronRight className="h-3 w-3" aria-hidden="true" /></span>
                    ) : (
                      <span className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300">
                        {!activeSessionId ? <MessageCircle className="h-3 w-3" aria-hidden="true" /> : null}
                        {activeSessionId ? "Needs material" : "Send material"}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-foreground/65 dark:text-foreground/70">
                    <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{course.dateLabel}</span>
                  </span>
                  {ready ? (
                    <span className="mt-1 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 text-[10px] font-medium tracking-tight text-foreground/65 min-[380px]:gap-x-2 min-[380px]:text-[11px] dark:text-foreground/70">
                      <span
                        className="whitespace-nowrap"
                        aria-label={`${set.attemptQuestionCount} questions, ${set.timeLimitMinutes} minutes`}
                      >
                        <span className="min-[380px]:hidden">{set.attemptQuestionCount} Q</span>
                        <span className="hidden min-[380px]:inline">{set.attemptQuestionCount} questions</span>
                        {" · "}{set.timeLimitMinutes} min
                      </span>
                      <span className="min-w-0 truncate text-center">
                        {course.progress
                          ? course.progress.bestPercentage > 0
                            ? <span className="font-semibold text-emerald-700 dark:text-emerald-300">Best {course.progress.bestPercentage}%</span>
                            : <span className="font-semibold text-foreground/75 dark:text-foreground/80">Attempted</span>
                          : <span>No attempts</span>}
                      </span>
                      {coverage.bankTotal > 0 ? (
                        <span className="whitespace-nowrap text-right">{coverage.delivered}/{coverage.bankTotal} seen</span>
                      ) : <span aria-hidden="true" />}
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground"><MessageCircle className="h-2.5 w-2.5" aria-hidden="true" /> Question bank needs material</span>
                  )}
                </span>
              </>
            );

            return ready && activeSessionId && !isActiveCourse ? (
              <button
                key={course.slug}
                type="button"
                onClick={() => { setSwitchError(null); setSwitchTarget(course); }}
                aria-label={`Switch to ${course.code}, ${course.title}`}
                className={cn("group flex min-h-[5.25rem] w-full items-center gap-3 px-3.5 py-3 text-left text-foreground transition hover:bg-secondary/35 focus-visible:bg-secondary/35 focus-visible:outline-none", index > 0 && "border-t border-border")}
              >
                {content}
              </button>
            ) : ready ? (
              <Link
                key={course.slug}
                href={destination}
                aria-label={`${actionLabel} ${course.code}, ${course.title}`}
                className={cn("group flex min-h-[5.25rem] items-center gap-3 px-3.5 py-3 no-underline transition hover:bg-secondary/35 focus-visible:bg-secondary/35 focus-visible:outline-none", index > 0 && "border-t border-border")}
              >
                {content}
              </Link>
            ) : (
              activeSessionId ? (
                <article key={course.slug} className={cn("flex min-h-[5.25rem] items-center gap-3 px-3.5 py-3", index > 0 && "border-t border-border")}>
                  {content}
                </article>
              ) : (
                <a
                  key={course.slug}
                  href={materialHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Send material for ${course.code}, ${course.title}, on WhatsApp`}
                  className={cn("group flex min-h-[5.25rem] items-center gap-3 px-3.5 py-3 text-foreground no-underline transition hover:bg-secondary/35 focus-visible:bg-secondary/35 focus-visible:outline-none", index > 0 && "border-t border-border")}
                >
                  {content}
                </a>
              )
            );
          })}

          {hiddenNeedsMaterial > 0 ? (
            <button type="button" onClick={() => setShowAllNeedsMaterial(true)} className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-border bg-secondary/35 px-4 text-xs font-bold text-primary hover:bg-secondary">
              <ChevronDown className="h-4 w-4" aria-hidden="true" /> Show {hiddenNeedsMaterial} more course{hiddenNeedsMaterial === 1 ? "" : "s"}
            </button>
          ) : filter === "all" && showAllNeedsMaterial && needsMaterialCount > 3 && !normalizedQuery ? (
            <button type="button" onClick={() => setShowAllNeedsMaterial(false)} className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-border bg-secondary/35 px-4 text-xs font-bold text-primary hover:bg-secondary">
              <ChevronUp className="h-4 w-4" aria-hidden="true" /> Show fewer courses
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <Search className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-bold">{normalizedQuery ? `Can't find “${query.trim()}”?` : "No courses in this filter"}</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{normalizedQuery ? "Request it and send any notes, slides, handouts or past questions you have." : "Try another course filter."}</p>
          {normalizedQuery && missingCourseHref && !activeSessionId ? (
            <a href={missingCourseHref} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground no-underline"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Request on WhatsApp</a>
          ) : (
            <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-4 min-h-10 rounded-xl bg-secondary px-4 text-xs font-bold text-primary">Show all courses</button>
          )}
        </div>
      )}

      <aside className="rounded-2xl border border-emerald-200/70 bg-emerald-50/55 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/15" aria-labelledby="missing-course-heading">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><MessageCircle className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h3 id="missing-course-heading" className="text-[13px] font-bold">Can’t find your course?</h3>
            <p className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">Send the course code plus any lecture notes, slides, handouts or past questions. We use that material to build and review the bank.</p>
          </div>
        </div>
        {!activeSessionId && missingCourseHref ? (
          <a href={missingCourseHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white no-underline transition hover:bg-emerald-700"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Request course on WhatsApp</a>
        ) : (
          <p className="mt-3 rounded-xl bg-card/70 px-3 py-2.5 text-center text-[11px] font-semibold text-muted-foreground">Finish your timed attempt first, then request a course here.</p>
        )}
        <p className="mt-2 text-center text-[10px] leading-4 text-muted-foreground">After we receive usable material, we aim to prepare and review the bank within 24 hours.</p>
      </aside>

      {readyCount > 0 ? (
        <p className="flex items-start gap-2 px-1 text-[10px] font-medium leading-4.5 text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          A bank becomes Ready only after we receive usable source material and review its questions.
        </p>
      ) : null}

      {switchTarget && activeSessionId ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !switching) setSwitchTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="switch-course-heading" className="w-full max-w-md rounded-t-[1.75rem] border border-border bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[1.5rem]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-700 dark:text-amber-300">Timer already running</p>
                <h2 id="switch-course-heading" className="mt-1 text-xl font-extrabold tracking-tight">Switch to {switchTarget.code}?</h2>
              </div>
              <button type="button" onClick={() => setSwitchTarget(null)} disabled={switching} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground disabled:opacity-50" aria-label="Close switch course dialog"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <div className="mt-4 rounded-xl bg-secondary/55 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
              {activeSessionKind === "mock" ? (
                <p>If you just started and have not interacted, Exam Sprint will treat this as your one daily mistake change. Otherwise the current mock ends early: <strong className="font-bold text-foreground">no 0% score</strong>, but it uses a weekly leaderboard slot.</p>
              ) : (
                <p>If you just started and have not interacted, Exam Sprint will treat this as your one daily mistake change. Otherwise the current diagnostic ends early and <strong className="font-bold text-foreground">its 5-hour free-check cooldown continues</strong>.</p>
              )}
            </div>

            {switchError ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{switchError}</p> : null}

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <Link href={`/exam/attempt/${activeSessionId}`} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground no-underline">Keep current</Link>
              <button type="button" onClick={() => void endCurrentAndSwitch()} disabled={switching} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">{switching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Switch to {switchTarget.code}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
