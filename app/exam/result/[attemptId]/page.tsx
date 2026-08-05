import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Flag,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EXAM_SPRINT_PRICE_NAIRA, findExamCourse } from "@/lib/examSprint/config";
import { buildExamSprintBillingHref } from "@/lib/examSprint/offer";
import { getExamResult, getMonthlyExamAccess } from "@/lib/examSprint/server";
import { cn, formatDuration, formatNaira } from "@/lib/utils";
import ExamCorrections from "../../_components/ExamCorrections";
import CoverageMeter from "../../_components/CoverageMeter";

export const dynamic = "force-dynamic";

function readiness(percentage: number) {
  if (percentage >= 85) {
    return {
      label: "Strong",
      note: "Your accuracy is in a good place. Keep it steady under time pressure.",
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200",
      score: "text-emerald-700 dark:text-emerald-300",
      bar: "bg-emerald-500",
    };
  }
  if (percentage >= 65) {
    return {
      label: "Building",
      note: "You are close. Review the missed questions before taking another mock.",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200",
      score: "text-amber-700 dark:text-amber-300",
      bar: "bg-amber-500",
    };
  }
  return {
    label: "Needs practice",
    note: "Fix the weak topics below, then try a fresh question mix.",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-200",
    score: "text-rose-600 dark:text-rose-300",
    bar: "bg-rose-500",
  };
}

function paceLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function WeakTopicRow({ topic, missed, rank, bordered = false }: { topic: string; missed: number; rank: number; bordered?: boolean }) {
  return (
    <li className={cn("flex min-h-11 items-center gap-2.5 px-3 py-2.5", bordered && "border-t border-amber-200/70 dark:border-amber-900/45")}>
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-amber-100 text-[10px] font-extrabold text-amber-800 dark:bg-amber-900/45 dark:text-amber-200">{rank}</span>
      <span className="min-w-0 flex-1 text-xs font-semibold leading-4">{topic}</span>
      <span className="shrink-0 rounded-md bg-amber-100/80 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-900/35 dark:text-amber-200">{missed} missed</span>
    </li>
  );
}

export default async function ExamResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exam/result/${attemptId}`)}`);

  const [result, access] = await Promise.all([
    getExamResult(user.id, attemptId),
    getMonthlyExamAccess(user.id),
  ]);
  const course = findExamCourse(result.courseCode);
  const status = readiness(result.percentage);
  const skipped = result.total - result.answered;
  const wrong = Math.max(0, result.answered - result.score);
  const mistakes = wrong + skipped;
  const flagged = result.items.filter((item) => item.flagged).length;
  const avgSpent = result.total > 0 ? result.timeSpentSeconds / result.total : 0;
  const avgAllowed = result.total > 0 ? result.allowedSeconds / result.total : 0;
  const ranOutOfTime = result.submissionReason === "timeup";
  const showCoverage = result.kind === "mock"
    && result.coverageBefore !== null
    && result.coverageAfter !== null
    && result.newQuestionsThisAttempt !== null
    && result.bankTotal !== null;
  const priorityTopics = result.weakTopics.slice(0, 3);
  const additionalTopics = result.weakTopics.slice(3);
  const topWeakTopic = result.weakTopics[0]?.topic ?? null;
  const billingHref = buildExamSprintBillingHref({
    returnTo: course ? `/exam/${course.slug}` : "/exam",
    diagnosticScore: result.kind === "diagnostic" ? result.percentage : null,
    focusTopic: result.kind === "diagnostic" ? topWeakTopic : null,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      <Link
        href={course ? `/exam/${course.slug}` : "/exam"}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-muted-foreground no-underline transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {course ? course.code : "Exam Sprint"}
      </Link>

      <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="result-heading">
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                {result.kind === "diagnostic" ? "Diagnostic complete" : "Mock complete"} · {result.courseCode}
              </p>
              <h1 id="result-heading" className="mt-1 text-lg font-black leading-snug sm:text-xl">
                {course?.title ?? result.setTitle}
              </h1>
            </div>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold", status.badge)}>
              {status.label}
            </span>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <p className={cn("text-5xl font-black leading-none tracking-[-0.05em] tabular-nums", status.score)}>{result.percentage}%</p>
            <p className="pb-1 text-xs font-bold text-muted-foreground">overall score</p>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{status.note}</p>

          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"
            role="img"
            aria-label={`${result.percentage}% score`}
          >
            <div className={cn("h-full rounded-full", status.bar)} style={{ width: `${result.percentage}%` }} />
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-4 text-center">
            <div>
              <p className="text-xl font-black text-emerald-700 tabular-nums dark:text-emerald-300">{result.score}</p>
              <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">Correct</p>
            </div>
            <div>
              <p className="text-xl font-black text-rose-600 tabular-nums dark:text-rose-300">{wrong}</p>
              <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">Wrong</p>
            </div>
            <div>
              <p className="text-xl font-black text-amber-700 tabular-nums dark:text-amber-300">{skipped}</p>
              <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">Skipped</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-border bg-secondary/25 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <a
            href="#corrections"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground no-underline shadow-sm"
          >
            <Target className="h-4 w-4" aria-hidden="true" />
            {mistakes > 0 ? `Review ${mistakes} mistake${mistakes === 1 ? "" : "s"}` : "Review your answers"}
          </a>
          {course ? (
            <Link
              href={`/exam/${course.slug}`}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-extrabold text-primary no-underline hover:bg-primary/10"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {result.kind === "mock" ? "Take another mock" : "Continue course"}
            </Link>
          ) : null}
        </div>
      </section>

      {result.weakTopics.length > 0 ? (
        <section className="rounded-2xl border border-amber-200/70 bg-card p-4 text-amber-950 dark:border-amber-900/50 dark:text-amber-100" aria-labelledby="weak-topics-heading">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/45 dark:text-amber-200">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="weak-topics-heading" className="text-sm font-black">Revise before your next mock</h2>
              <p className="mt-0.5 text-[11px] leading-4 text-amber-900/70 dark:text-amber-100/65">Start with the topics costing you the most marks.</p>
            </div>
          </div>

          <ol className="mt-3 overflow-hidden rounded-xl border border-amber-200/70 bg-amber-50/55 dark:border-amber-900/45 dark:bg-amber-950/20">
            {priorityTopics.map(({ topic, missed }, index) => <WeakTopicRow key={topic} topic={topic} missed={missed} rank={index + 1} bordered={index > 0} />)}
          </ol>

          {additionalTopics.length > 0 ? (
            <details className="group mt-2 overflow-hidden rounded-xl border border-amber-200/70 dark:border-amber-900/45">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-1.5 px-3 text-[11px] font-bold text-amber-800 marker:hidden hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/20">
                Show {additionalTopics.length} more topic{additionalTopics.length === 1 ? "" : "s"}
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ol className="border-t border-amber-200/70 dark:border-amber-900/45" start={4}>
                {additionalTopics.map(({ topic, missed }, index) => <WeakTopicRow key={topic} topic={topic} missed={missed} rank={index + 4} bordered={index > 0} />)}
              </ol>
            </details>
          ) : null}
        </section>
      ) : null}

      {result.kind === "diagnostic" && !access.active ? (
        <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.09] via-card to-card p-4 sm:p-5" aria-labelledby="diagnostic-pass-heading">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-primary">Your free check is complete</p>
              <h2 id="diagnostic-pass-heading" className="mt-0.5 text-base font-black leading-snug">Build beyond your {result.percentage}% diagnostic</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {topWeakTopic
                  ? `Start with ${topWeakTopic}, then practise with fresh 40-question mocks across every ready course.`
                  : "Keep building with fresh 40-question mocks across every ready course."}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-y border-primary/10 py-2.5 text-[10px] font-bold text-foreground/75">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> Every ready course</span>
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> 30 days</span>
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> No subscription</span>
          </div>

          <Link href={billingHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground no-underline shadow-sm">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" /> Unlock all mocks · {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}
          </Link>
          <p className="mt-2 text-center text-[10px] font-medium text-muted-foreground">Your free corrections remain available below.</p>
        </section>
      ) : null}

      <ExamCorrections items={result.items} />

      <details className="group overflow-hidden rounded-2xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-sm font-black">Attempt details</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Time, pace, flags and question coverage</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-4 border-t border-border p-4 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Timer className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div><p className="font-bold">Average pace</p><p className="mt-0.5 text-xs text-muted-foreground">{paceLabel(avgSpent)} per question</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div><p className="font-bold">Time used</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDuration(result.timeSpentSeconds)}{result.allowedSeconds > 0 ? ` of ${formatDuration(result.allowedSeconds)}` : ""}</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div><p className="font-bold">Questions flagged</p><p className="mt-0.5 text-xs text-muted-foreground">{flagged || "None"}</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div><p className="font-bold">Submission</p><p className="mt-0.5 text-xs text-muted-foreground">{ranOutOfTime ? "Automatic at time-up" : "Submitted by you"}</p></div>
          </div>
          {avgAllowed > 0 ? <span className="sr-only">Average allowed time was {paceLabel(avgAllowed)} per question.</span> : null}
          {showCoverage ? (
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-bold text-muted-foreground">{result.newQuestionsThisAttempt} new question{result.newQuestionsThisAttempt === 1 ? "" : "s"} added to your coverage</p>
              <CoverageMeter label="Questions seen overall" delivered={result.coverageAfter ?? 0} bankTotal={result.bankTotal ?? 0} complete={Boolean(result.coverageComplete)} />
            </div>
          ) : null}
        </div>
      </details>

      <div className="flex flex-col items-center gap-3 pt-1 text-center">
        <Link href="/exam" className="inline-flex min-h-10 items-center gap-1.5 px-3 text-sm font-extrabold text-primary no-underline hover:underline">
          Choose another course <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="max-w-lg text-[11px] leading-5 text-muted-foreground">This readiness score reflects JabuStudy practice performance and does not predict an official result.</p>
      </div>
    </div>
  );
}
