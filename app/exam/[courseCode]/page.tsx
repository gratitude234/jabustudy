import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileQuestion,
  History,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXAM_SPRINT_PRICE_NAIRA,
  examCourseDateLabel,
  findExamCourse,
  normalizeExamCourseCode,
} from "@/lib/examSprint/config";
import { getExamCatalog, type ExamRecentAttempt } from "@/lib/examSprint/server";
import { cn, formatNaira } from "@/lib/utils";
import StartExamButton from "../_components/StartExamButton";
import CoverageMeter from "../_components/CoverageMeter";
import ExamRemainingTime from "../_components/ExamRemainingTime";

export const dynamic = "force-dynamic";
const ATTEMPT_PREVIEW_COUNT = 3;

function attemptDate(value: string | null) {
  if (!value) return "Completed recently";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function scoreTone(percentage: number) {
  if (percentage >= 75) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (percentage >= 50) return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
}

function AttemptLink({ attempt, bordered = false }: { attempt: ExamRecentAttempt; bordered?: boolean }) {
  return (
    <Link
      href={`/exam/result/${attempt.attemptId}`}
      className={cn(
        "group flex min-h-14 items-center gap-3 px-3.5 py-2 no-underline transition hover:bg-secondary/35 focus-visible:bg-secondary/35 focus-visible:outline-none",
        bordered && "border-t border-border",
      )}
    >
      <span className={cn("grid h-9 w-11 shrink-0 place-items-center rounded-lg text-xs font-extrabold tabular-nums", scoreTone(attempt.percentage))}>{attempt.percentage}%</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">{attempt.kind === "mock" ? "Full mock" : "Free diagnostic"}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{attempt.score}/{attempt.total} correct · {attemptDate(attempt.submittedAt)}</span>
      </span>
      <span className="inline-flex min-h-8 shrink-0 items-center gap-0.5 text-[11px] font-bold text-primary">
        Review <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default async function ExamCoursePage({ params }: { params: Promise<{ courseCode: string }> }) {
  const { courseCode } = await params;
  const course = findExamCourse(courseCode);
  if (!course) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const catalog = await getExamCatalog(user?.id);
  const courseState = catalog.courses.find((item) => item.slug === course.slug);
  const sets = courseState?.sets ?? [];
  const activeAttempt = courseState?.activeAttempt ?? null;
  const recentAttempts = courseState?.recentAttempts ?? [];
  const progress = courseState?.progress ?? null;
  const diagnostic = catalog.diagnostic;
  const resumableDiagnostic = diagnostic?.resumable ? diagnostic : null;
  const diagnosticBelongsToCourse = diagnostic?.courseCode
    ? normalizeExamCourseCode(diagnostic.courseCode) === normalizeExamCourseCode(course.code)
    : false;
  const primarySet = sets.find((set) => !set.coverage.complete) ?? sets[0] ?? null;
  const diagnosticSet = sets[0] ?? null;
  const returnPath = `/exam/${course.slug}`;
  const billingHref = `/study/billing?offer=exam-sprint&returnTo=${encodeURIComponent(returnPath)}`;
  const coverage = sets.reduce(
    (value, set) => ({ delivered: value.delivered + set.coverage.delivered, bankTotal: value.bankTotal + set.coverage.bankTotal }),
    { delivered: 0, bankTotal: 0 },
  );
  const mockAttempts = progress?.basedOn === "mock" ? progress.attempts : 0;
  const latestAttempts = recentAttempts.slice(0, ATTEMPT_PREVIEW_COUNT);
  const olderAttempts = recentAttempts.slice(ATTEMPT_PREVIEW_COUNT);

  const primaryAction = () => {
    if (activeAttempt) {
      return (
        <Link href={`/exam/attempt/${activeAttempt.attemptId}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground no-underline shadow-sm transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          <PlayCircle className="h-4 w-4" aria-hidden="true" /> Resume timed mock
        </Link>
      );
    }
    if (resumableDiagnostic) {
      return (
        <Link href={`/exam/attempt/${resumableDiagnostic.attemptId}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground no-underline shadow-sm transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          <PlayCircle className="h-4 w-4" aria-hidden="true" /> Resume free diagnostic
        </Link>
      );
    }
    if (!primarySet) {
      return <span className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-sm font-bold text-muted-foreground"><FileQuestion className="h-4 w-4" aria-hidden="true" /> Course coming soon</span>;
    }
    if (catalog.access.active) {
      return (
        <StartExamButton setId={primarySet.id} kind="mock" questionCount={primarySet.attemptQuestionCount} timeLimitMinutes={primarySet.timeLimitMinutes} className="min-h-11 rounded-xl">
          {mockAttempts > 0 ? "Start next full mock" : "Start first full mock"}
        </StartExamButton>
      );
    }
    if (!diagnostic && user && diagnosticSet) {
      return (
        <StartExamButton setId={diagnosticSet.id} kind="diagnostic" questionCount={diagnosticSet.diagnosticQuestionCount} timeLimitMinutes={diagnosticSet.diagnosticTimeLimitMinutes} className="min-h-11 rounded-xl">
          Start free diagnostic
        </StartExamButton>
      );
    }
    if (!diagnostic && !user) {
      return <Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground no-underline">Sign in to try free <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>;
    }
    return <Link href={billingHref} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground no-underline"><LockKeyhole className="h-4 w-4" aria-hidden="true" /> Unlock all mocks · {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}</Link>;
  };

  const actionLabel = activeAttempt
    ? "Finish the mock you started"
    : resumableDiagnostic
      ? "Your diagnostic is still running"
      : !primarySet
        ? "This question bank is being reviewed"
        : catalog.access.active
          ? mockAttempts > 0 ? "Build on your last attempt" : "Take your first full mock"
          : !diagnostic
            ? "Check your level for free"
            : "Unlock the complete practice bank";
  const actionDetail = activeAttempt
    ? "Your timer continues while you are away. Return to your saved answers now."
    : resumableDiagnostic
      ? "Finish your free check before its timer runs out. Your answers are already saved."
      : primarySet
        ? "You will get a fresh mix that prioritises questions you have not seen."
        : "We will open this course as soon as its reviewed questions are published.";
  const showMockDetails = Boolean(primarySet && !activeAttempt && !resumableDiagnostic);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <nav aria-label="Course navigation">
        <Link href="/exam#courses" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to courses
        </Link>
      </nav>

      <section className="relative isolate overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-card to-card">
        <div className="pointer-events-none absolute -right-16 -top-20 -z-10 h-52 w-52 rounded-full bg-primary/10 blur-2xl" />
        <div className="p-4 pb-4 sm:p-5 sm:pb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-extrabold text-primary">{course.code}</span>
              {activeAttempt ? <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300"><Clock3 className="h-3 w-3" aria-hidden="true" /> Mock in progress</span> : null}
            </div>
            {catalog.access.active ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Access active</span> : null}
          </div>
          <h1 className="mt-3 max-w-2xl text-[1.45rem] font-extrabold leading-[1.15] tracking-[-0.025em] sm:text-3xl">{course.title}</h1>
          <p className="mt-1.5 flex max-w-xl items-start gap-1.5 text-[11px] font-medium leading-5 text-muted-foreground sm:text-xs"><CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {examCourseDateLabel(course)}</p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-primary/10 border-t border-primary/10 bg-card/35">
          <div className="px-4 py-2.5 sm:py-3">
            <p className="text-sm font-extrabold tabular-nums sm:text-base">{progress ? `${progress.bestPercentage}%` : "New"}</p>
            <p className="mt-0.5 text-[9px] font-medium leading-3.5 text-muted-foreground">Best score</p>
          </div>
          <div className="px-4 py-2.5 sm:py-3">
            <p className="text-sm font-extrabold tabular-nums sm:text-base">{coverage.delivered}/{coverage.bankTotal || 0}</p>
            <p className="mt-0.5 text-[9px] font-medium leading-3.5 text-muted-foreground">Questions seen</p>
          </div>
          <div className="px-4 py-2.5 sm:py-3">
            <p className="text-sm font-extrabold tabular-nums sm:text-base">{progress?.attempts ?? 0}</p>
            <p className="mt-0.5 text-[9px] font-medium leading-3.5 text-muted-foreground">Attempts</p>
          </div>
        </div>
      </section>

      <section className={cn("rounded-2xl border bg-card p-4", (activeAttempt || resumableDiagnostic) ? "border-amber-300/60 dark:border-amber-900/60" : "border-border")} aria-labelledby="recommended-action-heading">
        <div className="flex items-start gap-3">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", (activeAttempt || resumableDiagnostic) ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "bg-primary/10 text-primary")}>
            {(activeAttempt || resumableDiagnostic) ? <Clock3 className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">{(activeAttempt || resumableDiagnostic) ? "Continue now" : "Up next"}</p>
            <h2 id="recommended-action-heading" className="mt-0.5 text-base font-extrabold leading-snug">{actionLabel}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{actionDetail}</p>
          </div>
        </div>

        {showMockDetails && primarySet ? (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-y border-border py-2.5 text-[11px] font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><FileQuestion className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {(catalog.access.active || diagnostic) ? primarySet.attemptQuestionCount : primarySet.diagnosticQuestionCount} questions</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {(catalog.access.active || diagnostic) ? primarySet.timeLimitMinutes : primarySet.diagnosticTimeLimitMinutes} minutes</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Auto-saved</span>
          </div>
        ) : null}

        {activeAttempt ? <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /><ExamRemainingTime deadlineAt={activeAttempt.deadlineAt} /></p> : null}
        <div className="mt-3">{primaryAction()}</div>
      </section>

      {recentAttempts.length > 0 ? (
        <section aria-labelledby="recent-attempts-heading">
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Your progress</p><h2 id="recent-attempts-heading" className="mt-0.5 text-lg font-extrabold">Recent attempts</h2></div>
            <p className="inline-flex items-center gap-1.5 pb-0.5 text-[11px] font-medium text-muted-foreground"><History className="h-3.5 w-3.5" aria-hidden="true" /> {recentAttempts.length} completed</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {latestAttempts.map((attempt, index) => <AttemptLink key={attempt.attemptId} attempt={attempt} bordered={index > 0} />)}
            {olderAttempts.length > 0 ? (
              <details className="group border-t border-border">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-1.5 bg-secondary/30 px-4 text-[11px] font-bold text-primary marker:hidden hover:bg-secondary/55">
                  Show {olderAttempts.length} older attempt{olderAttempts.length === 1 ? "" : "s"}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-border">
                  {olderAttempts.map((attempt, index) => <AttemptLink key={attempt.attemptId} attempt={attempt} bordered={index > 0} />)}
                </div>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      {sets.length > 0 ? (
        <section aria-labelledby="practice-bank-heading">
          <div className="mb-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Practice</p>
            <h2 id="practice-bank-heading" className="mt-0.5 text-lg font-extrabold">Question bank</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Each mock prioritises unseen questions, then revisits missed and older ones.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {sets.map((set, index) => {
              const selectedNext = set.id === primarySet?.id;
              return (
                <article key={set.id} className={cn("p-4", index > 0 && "border-t border-border")}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileQuestion className="h-4 w-4" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[13px] font-bold">{set.title}</h3>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{set.coverage.bankTotal} reviewed questions</p>
                        </div>
                        {selectedNext ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-primary">Next bank</span> : null}
                      </div>
                      <CoverageMeter compact showDescription={false} className="mt-3" label="Questions practised" delivered={set.coverage.delivered} bankTotal={set.coverage.bankTotal} complete={set.coverage.complete} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 pl-12 text-[11px] font-medium text-muted-foreground">
                    <span>{set.attemptQuestionCount} questions per mock</span>
                    <span>{set.timeLimitMinutes} minutes</span>
                  </div>

                  {catalog.access.active && !activeAttempt && !resumableDiagnostic && !selectedNext ? (
                    <div className="mt-3"><StartExamButton setId={set.id} kind="mock" questionCount={set.attemptQuestionCount} timeLimitMinutes={set.timeLimitMinutes} className="min-h-10 rounded-xl bg-secondary py-2 text-xs text-foreground shadow-none hover:bg-primary/10 hover:text-primary">Use this bank</StartExamButton></div>
                  ) : !catalog.access.active ? (
                    <p className="mt-2.5 flex items-center gap-1.5 pl-12 text-[11px] font-semibold text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Included with full access</p>
                  ) : selectedNext ? (
                    <p className="mt-2.5 flex items-center gap-1.5 pl-12 text-[11px] font-semibold text-primary"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {activeAttempt ? "Used by your current mock" : "Selected for your next mock"}</p>
                  ) : null}
                </article>
              );
            })}
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border bg-secondary/30 px-4 py-2.5 text-[10px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Reviewed</span>
              <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Fresh mix every mock</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <FileQuestion className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-extrabold">Question bank coming soon</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">This course will open after its questions have been reviewed and published.</p>
          <Link href="/exam#courses" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-extrabold text-primary no-underline">See ready courses <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </section>
      )}

      {!diagnostic && catalog.access.active && diagnosticSet ? (
        <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="diagnostic-heading">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h2 id="diagnostic-heading" className="text-sm font-extrabold">Want a quicker check?</h2><p className="mt-0.5 text-xs text-muted-foreground">Try a shorter {diagnosticSet.diagnosticQuestionCount}-question diagnostic.</p></div>
          <StartExamButton setId={diagnosticSet.id} kind="diagnostic" questionCount={diagnosticSet.diagnosticQuestionCount} timeLimitMinutes={diagnosticSet.diagnosticTimeLimitMinutes} className="min-h-10 w-auto rounded-xl bg-secondary px-3 text-foreground shadow-none">
            Start
          </StartExamButton>
        </section>
      ) : diagnosticBelongsToCourse && diagnostic?.submitted && recentAttempts.length === 0 ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <Link href={`/exam/result/${diagnostic.attemptId}`} className="group flex min-h-[4.75rem] items-center gap-3 px-4 py-3 no-underline hover:bg-secondary/45">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">Free diagnostic result</span><span className="mt-0.5 block text-xs text-muted-foreground">Completed · {diagnostic.percentage}%</span></span>
            <span className="text-xs font-black text-primary">Review</span><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </section>
      ) : null}
    </div>
  );
}
