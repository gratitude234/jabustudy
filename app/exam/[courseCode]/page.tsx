import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileQuestion,
  History,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EXAM_SPRINT_PRICE_NAIRA, examCourseDateLabel, findExamCourse } from "@/lib/examSprint/config";
import { getExamCatalog } from "@/lib/examSprint/server";
import { formatNaira } from "@/lib/utils";
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
  const returnPath = `/exam/${course.slug}`;
  const billingHref = `/study/billing?offer=exam-sprint&returnTo=${encodeURIComponent(returnPath)}`;
  const diagnosticSet = sets[0] ?? null;
  const coverage = sets.reduce(
    (value, set) => ({ delivered: value.delivered + set.coverage.delivered, bankTotal: value.bankTotal + set.coverage.bankTotal }),
    { delivered: 0, bankTotal: 0 },
  );

  const primaryAction = (mobile = false) => {
    const className = mobile ? "min-h-12 rounded-xl" : "min-h-12 rounded-xl";
    if (activeAttempt) {
      return (
        <Link href={`/exam/attempt/${activeAttempt.attemptId}`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground no-underline hover:brightness-105">
          <PlayCircle className="h-4 w-4" aria-hidden="true" /> Resume mock
        </Link>
      );
    }
    if (!primarySet) {
      return <span className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary px-5 text-sm font-black text-muted-foreground"><FileQuestion className="h-4 w-4" aria-hidden="true" /> Coming soon</span>;
    }
    if (catalog.access.active) {
      return (
        <StartExamButton setId={primarySet.id} kind="mock" questionCount={primarySet.attemptQuestionCount} timeLimitMinutes={primarySet.timeLimitMinutes} className={className}>
          Start {primarySet.attemptQuestionCount}-question mock
        </StartExamButton>
      );
    }
    if (!diagnostic && user) {
      return (
        <StartExamButton setId={diagnosticSet!.id} kind="diagnostic" questionCount={diagnosticSet!.diagnosticQuestionCount} timeLimitMinutes={diagnosticSet!.diagnosticTimeLimitMinutes} className={className}>
          Try {diagnosticSet!.diagnosticQuestionCount} questions free
        </StartExamButton>
      );
    }
    if (!diagnostic && !user) {
      return <Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground no-underline">Sign in to try free</Link>;
    }
    return <Link href={billingHref} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground no-underline"><LockKeyhole className="h-4 w-4" aria-hidden="true" /> Unlock all mocks · {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}</Link>;
  };

  const actionLabel = activeAttempt
    ? "Continue where you stopped"
    : !primarySet
      ? "This bank is still being reviewed"
      : catalog.access.active
        ? "Your full access is active"
        : !diagnostic
          ? "Your free diagnostic is available"
          : "Continue with full Exam Sprint access";

  return (
    <div className="space-y-5 pb-28 md:pb-12">
      <Link href="/exam#courses" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All courses
      </Link>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_280px] md:items-center md:p-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-black text-primary">{course.code}</span>
              {catalog.access.active ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Plus active</span> : null}
              {activeAttempt ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Mock in progress</span> : null}
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight">{course.title}</h1>
            <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-muted-foreground"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {examCourseDateLabel(course)}</p>

            <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-background">
              <div className="p-3">
                <p className="text-lg font-black tabular-nums">{progress ? `${progress.bestPercentage}%` : "—"}</p>
                <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">Best score</p>
              </div>
              <div className="border-l border-border p-3">
                <p className="text-lg font-black tabular-nums">{coverage.delivered}/{coverage.bankTotal || 0}</p>
                <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">Questions seen</p>
              </div>
              <div className="border-l border-border p-3">
                <p className="text-lg font-black tabular-nums">{sets.length}</p>
                <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">Mock{sets.length === 1 ? "" : "s"} ready</p>
              </div>
            </div>
          </div>

          <div className="hidden rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 md:block">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Next step</p>
            <p className="mt-1 text-sm font-bold">{actionLabel}</p>
            {activeAttempt ? <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /><ExamRemainingTime deadlineAt={activeAttempt.deadlineAt} /></p> : null}
            <div className="mt-4">{primaryAction()}</div>
          </div>
        </div>
      </section>

      {recentAttempts.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3.5"><History className="h-4 w-4 text-primary" aria-hidden="true" /><h2 className="font-extrabold">Recent attempts</h2></div>
          {recentAttempts.map((attempt, index) => (
            <Link key={attempt.attemptId} href={`/exam/result/${attempt.attemptId}`} className={`flex min-h-16 items-center gap-3 px-4 py-3 no-underline hover:bg-secondary/60 ${index > 0 ? "border-t border-border" : ""}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">{attempt.percentage}%</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{attempt.kind === "mock" ? "Full mock" : "Free diagnostic"}</span><span className="mt-0.5 block text-xs text-muted-foreground">{attempt.score}/{attempt.total} correct · {attemptDate(attempt.submittedAt)}</span></span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}
        </section>
      ) : null}

      {diagnostic ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><BarChart3 className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold">Free diagnostic used</h2><p className="mt-0.5 text-xs text-muted-foreground">Your single campaign diagnostic has already been started.</p></div>
          <Link href={diagnostic.resumable ? `/exam/attempt/${diagnostic.attemptId}` : `/exam/result/${diagnostic.attemptId}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-extrabold text-primary no-underline hover:bg-secondary">
            {diagnostic.resumable ? "Resume diagnostic" : `View result${diagnostic.submitted ? ` · ${diagnostic.percentage}%` : ""}`} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      ) : catalog.access.active && diagnosticSet ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold">Free diagnostic still available</h2><p className="mt-0.5 text-xs text-muted-foreground">Use it whenever you want a quick {diagnosticSet.diagnosticQuestionCount}-question check.</p></div>
          <StartExamButton setId={diagnosticSet.id} kind="diagnostic" questionCount={diagnosticSet.diagnosticQuestionCount} timeLimitMinutes={diagnosticSet.diagnosticTimeLimitMinutes} className="min-h-11 rounded-xl bg-secondary text-foreground shadow-none">
            Start diagnostic
          </StartExamButton>
        </section>
      ) : null}

      {sets.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Full mock exams</p>
            <h2 className="mt-1 text-xl font-black">Reviewed CBT papers</h2>
            <p className="mt-1 text-sm text-muted-foreground">Unseen questions appear first, followed by smart revision.</p>
          </div>
          {sets.map((set, index) => (
            <article key={set.id} className={`p-4 sm:p-5 ${index > 0 ? "border-t border-border" : ""}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold">{set.title}</h3>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{set.attemptQuestionCount} questions · {set.timeLimitMinutes} minutes · {set.coverage.bankTotal} reviewed questions</p>
                  <CoverageMeter className="mt-3" label="Questions seen" delivered={set.coverage.delivered} bankTotal={set.coverage.bankTotal} complete={set.coverage.complete} />
                </div>
                {catalog.access.active && !activeAttempt ? (
                  <div className="w-full sm:w-48"><StartExamButton setId={set.id} kind="mock" questionCount={set.attemptQuestionCount} timeLimitMinutes={set.timeLimitMinutes} className="min-h-11 rounded-xl">Start this mock</StartExamButton></div>
                ) : !catalog.access.active && diagnostic ? (
                  <Link href={billingHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 text-sm font-extrabold text-primary no-underline"><LockKeyhole className="h-4 w-4" aria-hidden="true" /> Unlock</Link>
                ) : null}
              </div>
            </article>
          ))}
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border bg-secondary/40 px-4 py-3 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Reviewed questions</span>
            <span className="inline-flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> New mix each attempt</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Corrections after submission</span>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <FileQuestion className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-extrabold">Question bank coming soon</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">This course will open after its questions have been reviewed and published.</p>
          <Link href="/exam#courses" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-extrabold text-primary no-underline">See ready courses <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto max-w-lg">
          <p className="mb-2 truncate text-center text-[11px] font-bold text-muted-foreground">{actionLabel}{activeAttempt ? " · " : ""}{activeAttempt ? <ExamRemainingTime deadlineAt={activeAttempt.deadlineAt} suffix="" /> : null}</p>
          {primaryAction(true)}
        </div>
      </div>
    </div>
  );
}
