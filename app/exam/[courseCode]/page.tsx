import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileQuestion,
  History,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EXAM_SPRINT_PRICE_NAIRA, examCourseDateLabel, findExamCourse } from "@/lib/examSprint/config";
import { getExamCatalog } from "@/lib/examSprint/server";
import { cn, formatNaira } from "@/lib/utils";
import StartExamButton from "../_components/StartExamButton";
import CoverageMeter from "../_components/CoverageMeter";
import ExamRemainingTime from "../_components/ExamRemainingTime";

export const dynamic = "force-dynamic";

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
  const primarySet = sets.find((set) => !set.coverage.complete) ?? sets[0] ?? null;
  const diagnosticSet = sets[0] ?? null;
  const returnPath = `/exam/${course.slug}`;
  const billingHref = `/study/billing?offer=exam-sprint&returnTo=${encodeURIComponent(returnPath)}`;
  const coverage = sets.reduce(
    (value, set) => ({ delivered: value.delivered + set.coverage.delivered, bankTotal: value.bankTotal + set.coverage.bankTotal }),
    { delivered: 0, bankTotal: 0 },
  );

  const primaryAction = () => {
    if (activeAttempt) {
      return (
        <Link href={`/exam/attempt/${activeAttempt.attemptId}`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground no-underline shadow-sm hover:brightness-105">
          <PlayCircle className="h-4 w-4" aria-hidden="true" /> Resume mock
        </Link>
      );
    }
    if (!primarySet) {
      return <span className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary px-5 text-sm font-black text-muted-foreground"><FileQuestion className="h-4 w-4" aria-hidden="true" /> Course coming soon</span>;
    }
    if (catalog.access.active) {
      return (
        <StartExamButton setId={primarySet.id} kind="mock" questionCount={primarySet.attemptQuestionCount} timeLimitMinutes={primarySet.timeLimitMinutes} className="min-h-12 rounded-xl">
          Start {primarySet.attemptQuestionCount}-question mock
        </StartExamButton>
      );
    }
    if (!diagnostic && user && diagnosticSet) {
      return (
        <StartExamButton setId={diagnosticSet.id} kind="diagnostic" questionCount={diagnosticSet.diagnosticQuestionCount} timeLimitMinutes={diagnosticSet.diagnosticTimeLimitMinutes} className="min-h-12 rounded-xl">
          Try {diagnosticSet.diagnosticQuestionCount} questions free
        </StartExamButton>
      );
    }
    if (!diagnostic && !user) {
      return <Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground no-underline">Sign in to try free <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>;
    }
    return <Link href={billingHref} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground no-underline"><LockKeyhole className="h-4 w-4" aria-hidden="true" /> Unlock all mocks · {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}</Link>;
  };

  const actionLabel = activeAttempt
    ? "Continue before the timer runs out"
    : !primarySet
      ? "This question bank is being reviewed"
      : catalog.access.active
        ? "Your next full mock is ready"
        : !diagnostic
          ? "Start with your free diagnostic"
          : "Unlock the complete practice bank";
  const actionDetail = activeAttempt
    ? "The timer continues even while you are away. Your saved answers are waiting."
    : primarySet
      ? `${primarySet.attemptQuestionCount} questions · ${primarySet.timeLimitMinutes} minutes · automatic saving`
      : "We will open this course as soon as its reviewed questions are published.";

  return (
    <div className="space-y-5 pb-28 md:pb-12">
      <Link href="/exam#courses" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All courses
      </Link>

      <section className="relative isolate overflow-hidden rounded-[1.5rem] bg-[#21164f] px-5 pb-0 pt-5 text-white shadow-[0_18px_50px_rgba(33,22,79,0.16)] sm:px-7 sm:pt-7">
        <div className="pointer-events-none absolute -right-20 -top-20 -z-10 h-60 w-60 rounded-full bg-[#725cff]/35 blur-2xl" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-white/12 px-2.5 py-1.5 text-xs font-black">{course.code}</span>
          {activeAttempt ? <span className="rounded-full bg-amber-300/15 px-2.5 py-1 text-[10px] font-black uppercase text-amber-200">In progress</span> : null}
          {catalog.access.active ? <span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-200">Full access</span> : null}
        </div>
        <h1 className="mt-4 max-w-2xl text-[1.9rem] font-black leading-[1.12] tracking-[-0.035em] sm:text-4xl">{course.title}</h1>
        <p className="mt-3 flex max-w-xl items-start gap-2 text-sm font-semibold leading-5 text-violet-100/75"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {examCourseDateLabel(course)}</p>

        <div className="mt-6 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
          <div className="py-3.5 pr-3 sm:py-4">
            <p className="text-xl font-black tabular-nums">{progress ? `${progress.bestPercentage}%` : "—"}</p>
            <p className="mt-0.5 text-[10px] font-bold text-violet-200/65">Best score</p>
          </div>
          <div className="px-3 py-3.5 sm:px-5 sm:py-4">
            <p className="text-xl font-black tabular-nums">{coverage.delivered}/{coverage.bankTotal || 0}</p>
            <p className="mt-0.5 text-[10px] font-bold text-violet-200/65">Questions seen</p>
          </div>
          <div className="py-3.5 pl-3 sm:py-4 sm:pl-5">
            <p className="text-xl font-black tabular-nums">{sets.length}</p>
            <p className="mt-0.5 text-[10px] font-bold text-violet-200/65">Mocks ready</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-card p-4 shadow-[0_10px_30px_rgba(33,22,79,0.06)] sm:p-5" aria-labelledby="recommended-action-heading">
        <div className="flex items-start gap-3">
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", activeAttempt ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "bg-primary/10 text-primary")}>
            {activeAttempt ? <Clock3 className="h-5 w-5" aria-hidden="true" /> : <Sparkles className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Recommended next</p>
            <h2 id="recommended-action-heading" className="mt-1 text-lg font-black">{actionLabel}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{actionDetail}</p>
            {activeAttempt ? <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /><ExamRemainingTime deadlineAt={activeAttempt.deadlineAt} /></p> : null}
          </div>
        </div>
        <div className="mt-4">{primaryAction()}</div>
      </section>

      {recentAttempts.length > 0 ? (
        <section aria-labelledby="recent-attempts-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Your activity</p><h2 id="recent-attempts-heading" className="mt-0.5 text-xl font-black">Recent attempts</h2></div>
            <History className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {recentAttempts.map((attempt, index) => (
              <Link key={attempt.attemptId} href={`/exam/result/${attempt.attemptId}`} className={cn("group flex min-h-[4.5rem] items-center gap-3 px-4 py-3 no-underline transition hover:bg-secondary/45", index > 0 && "border-t border-border")}>
                <span className={cn("grid h-10 w-12 shrink-0 place-items-center rounded-xl text-sm font-black", scoreTone(attempt.percentage))}>{attempt.percentage}%</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{attempt.kind === "mock" ? "Full mock" : "Free diagnostic"}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{attempt.score}/{attempt.total} correct · {attemptDate(attempt.submittedAt)}</span></span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {sets.length > 0 ? (
        <section aria-labelledby="mock-papers-heading">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Practice bank</p>
            <h2 id="mock-papers-heading" className="mt-0.5 text-xl font-black">Available mock papers</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each attempt prioritises questions you have not seen.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {sets.map((set, index) => (
              <article key={set.id} className={cn("p-4 sm:p-5", index > 0 && "border-t border-border")}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileQuestion className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-extrabold">{set.title}</h3>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{set.attemptQuestionCount} questions · {set.timeLimitMinutes} minutes · {set.coverage.bankTotal} reviewed</p>
                    <CoverageMeter className="mt-3" label="Questions seen" delivered={set.coverage.delivered} bankTotal={set.coverage.bankTotal} complete={set.coverage.complete} />
                  </div>
                </div>
                {catalog.access.active && !activeAttempt ? (
                  <div className="mt-4"><StartExamButton setId={set.id} kind="mock" questionCount={set.attemptQuestionCount} timeLimitMinutes={set.timeLimitMinutes} className="min-h-11 rounded-xl bg-secondary text-foreground shadow-none hover:bg-primary/10 hover:text-primary">Start this paper</StartExamButton></div>
                ) : !catalog.access.active ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Included with full Exam Sprint access</p>
                ) : null}
              </article>
            ))}
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border bg-secondary/35 px-4 py-3 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Reviewed questions</span>
              <span className="inline-flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> New mix each time</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Corrections after</span>
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

      {diagnostic ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <Link href={diagnostic.resumable ? `/exam/attempt/${diagnostic.attemptId}` : `/exam/result/${diagnostic.attemptId}`} className="group flex min-h-[4.75rem] items-center gap-3 px-4 py-3 no-underline hover:bg-secondary/45">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">Free diagnostic</span><span className="mt-0.5 block text-xs text-muted-foreground">{diagnostic.resumable ? "Still in progress" : `Completed${diagnostic.submitted ? ` · ${diagnostic.percentage}%` : ""}`}</span></span>
            <span className="text-xs font-black text-primary">{diagnostic.resumable ? "Resume" : "View"}</span><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </section>
      ) : catalog.access.active && diagnosticSet ? (
        <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold">Quick diagnostic still available</h2><p className="mt-0.5 text-xs text-muted-foreground">A shorter {diagnosticSet.diagnosticQuestionCount}-question check.</p></div>
          <StartExamButton setId={diagnosticSet.id} kind="diagnostic" questionCount={diagnosticSet.diagnosticQuestionCount} timeLimitMinutes={diagnosticSet.diagnosticTimeLimitMinutes} className="min-h-10 w-auto rounded-xl bg-secondary px-3 text-foreground shadow-none">
            Start
          </StartExamButton>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto max-w-lg">{primaryAction()}</div>
      </div>
    </div>
  );
}
