import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Flag,
  RotateCcw,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findExamCourse } from "@/lib/examSprint/config";
import { getExamResult } from "@/lib/examSprint/server";
import { cn, formatDuration } from "@/lib/utils";
import ExamCorrections from "../../_components/ExamCorrections";
import CoverageMeter from "../../_components/CoverageMeter";

export const dynamic = "force-dynamic";

function readiness(percentage: number) {
  if (percentage >= 85) return { label: "Strong", note: "Your accuracy is in a good place. Keep it steady under time pressure.", color: "#34d399", chip: "bg-emerald-300/15 text-emerald-200" };
  if (percentage >= 65) return { label: "Building", note: "You are close. Review the missed questions before taking another mock.", color: "#fbbf24", chip: "bg-amber-300/15 text-amber-200" };
  return { label: "Needs practice", note: "Slow down, fix the weak topics below, then try a fresh question mix.", color: "#fb7185", chip: "bg-rose-300/15 text-rose-200" };
}

function paceLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function ScoreRing({ percentage, score, total, color }: { percentage: number; score: number; total: number; color: string }) {
  return (
    <div
      className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full p-2 sm:h-40 sm:w-40"
      style={{ background: `conic-gradient(${color} ${percentage}%, rgba(255,255,255,0.12) ${percentage}% 100%)` }}
      role="img"
      aria-label={`${percentage} percent, ${score} of ${total} correct`}
    >
      <div className="grid h-full w-full place-items-center rounded-full bg-[#21164f] text-center">
        <div><p className="text-4xl font-black tracking-tight tabular-nums sm:text-5xl">{percentage}%</p><p className="mt-1 text-[11px] font-bold text-violet-200/70">{score} of {total} correct</p></div>
      </div>
    </div>
  );
}

export default async function ExamResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exam/result/${attemptId}`)}`);
  const result = await getExamResult(user.id, attemptId);
  const course = findExamCourse(result.courseCode);
  const status = readiness(result.percentage);
  const skipped = result.total - result.answered;
  const wrong = Math.max(0, result.answered - result.score);
  const mistakes = wrong + skipped;
  const flagged = result.items.filter((item) => item.flagged).length;
  const avgSpent = result.total > 0 ? result.timeSpentSeconds / result.total : 0;
  const avgAllowed = result.total > 0 ? result.allowedSeconds / result.total : 0;
  const ranOutOfTime = result.submissionReason === "timeup";
  const showCoverage = result.kind === "mock" && result.coverageBefore !== null && result.coverageAfter !== null && result.newQuestionsThisAttempt !== null && result.bankTotal !== null;
  const correctWidth = result.total > 0 ? (result.score / result.total) * 100 : 0;
  const wrongWidth = result.total > 0 ? (wrong / result.total) * 100 : 0;
  const skippedWidth = Math.max(0, 100 - correctWidth - wrongWidth);

  return (
    <div className="space-y-5 pb-12">
      <Link href={course ? `/exam/${course.slug}` : "/exam"} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> {course ? course.code : "Exam Sprint"}</Link>

      <section className="relative isolate overflow-hidden rounded-[1.5rem] bg-[#21164f] p-5 text-white shadow-[0_18px_50px_rgba(33,22,79,0.18)] sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 -z-10 h-64 w-64 rounded-full bg-[#725cff]/30 blur-3xl" />
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <ScoreRing percentage={result.percentage} score={result.score} total={result.total} color={status.color} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">{result.kind === "diagnostic" ? "Diagnostic complete" : "Mock complete"}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{result.courseCode} result</h1>
            <p className="mt-1.5 text-sm font-semibold text-violet-100/65">{course?.title ?? result.setTitle}</p>
            <span className={cn("mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-black", status.chip)}>Readiness · {status.label}</span>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-violet-100/75 sm:mx-0">{status.note}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Recommended next actions">
        <a href="#corrections" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground no-underline shadow-sm"><Target className="h-4 w-4" aria-hidden="true" /> {mistakes > 0 ? `Review ${mistakes} mistake${mistakes === 1 ? "" : "s"}` : "Review your answers"}</a>
        {course ? (
          <Link href={`/exam/${course.slug}`} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-black text-foreground no-underline hover:bg-secondary"><RotateCcw className="h-4 w-4" aria-hidden="true" /> {result.kind === "mock" ? "Take another mock" : "Continue this course"}</Link>
        ) : (
          <Link href="/exam" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-black no-underline">Choose a course <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="performance-heading">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Performance</p>
          <h2 id="performance-heading" className="mt-0.5 text-xl font-black">Where your marks went</h2>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            <span className="bg-emerald-500" style={{ width: `${correctWidth}%` }} />
            <span className="bg-rose-500" style={{ width: `${wrongWidth}%` }} />
            <span className="bg-amber-400" style={{ width: `${skippedWidth}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-border">
            <div className="pr-3"><p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{result.score}</p><p className="text-[11px] font-bold text-muted-foreground">Correct</p></div>
            <div className="px-3"><p className="text-2xl font-black text-rose-600 dark:text-rose-300">{wrong}</p><p className="text-[11px] font-bold text-muted-foreground">Wrong</p></div>
            <div className="pl-3"><p className="text-2xl font-black text-amber-700 dark:text-amber-300">{skipped}</p><p className="text-[11px] font-bold text-muted-foreground">Unanswered</p></div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-border bg-secondary/30 px-4 py-3 text-xs font-bold text-muted-foreground sm:grid-cols-2 sm:px-5">
          <span className="inline-flex items-center gap-2"><Timer className="h-4 w-4 text-primary" aria-hidden="true" /> Average pace: <strong className="text-foreground">{paceLabel(avgSpent)} / question</strong></span>
          <span className="inline-flex items-center gap-2 sm:justify-end"><Clock3 className="h-4 w-4 text-primary" aria-hidden="true" /> {formatDuration(result.timeSpentSeconds)} used{result.allowedSeconds > 0 ? ` of ${formatDuration(result.allowedSeconds)}` : ""}</span>
          {avgAllowed > 0 ? <span className="sr-only">Average allowed time was {paceLabel(avgAllowed)} per question.</span> : null}
          {flagged > 0 ? <span className="inline-flex items-center gap-2"><Flag className="h-4 w-4 text-amber-600" aria-hidden="true" /> {flagged} question{flagged === 1 ? "" : "s"} flagged</span> : null}
          {ranOutOfTime ? <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300 sm:justify-end"><Clock3 className="h-4 w-4" aria-hidden="true" /> Submitted automatically at time-up</span> : null}
        </div>
      </section>

      {result.weakTopics.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-amber-300/40 bg-card" aria-labelledby="weak-topics-heading">
          <div className="flex gap-3 p-4 sm:p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><TrendingUp className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Revise next</p><h2 id="weak-topics-heading" className="mt-0.5 text-lg font-black">Topics that cost you marks</h2><p className="mt-1 text-sm text-muted-foreground">Start here before attempting another randomised paper.</p></div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-amber-300/30 bg-amber-50/50 px-4 py-3 dark:bg-amber-950/15 sm:px-5">{result.weakTopics.map(({ topic, missed }) => <span key={topic} className="rounded-full border border-amber-300/50 bg-card px-3 py-1.5 text-xs font-bold">{topic} · {missed} missed</span>)}</div>
        </section>
      ) : null}

      {showCoverage ? (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Question rotation</p><h2 className="mt-0.5 text-lg font-black">{result.newQuestionsThisAttempt} new question{result.newQuestionsThisAttempt === 1 ? "" : "s"} added to your coverage</h2></div><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /></div>
          <CoverageMeter className="mt-4" label="Questions seen overall" delivered={result.coverageAfter ?? 0} bankTotal={result.bankTotal ?? 0} complete={Boolean(result.coverageComplete)} />
        </section>
      ) : null}

      <ExamCorrections items={result.items} />

      <Link href="/exam" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-extrabold text-foreground no-underline hover:bg-secondary">Choose another course</Link>
      <p className="text-center text-[11px] leading-5 text-muted-foreground">This readiness score reflects JabuStudy practice performance and does not predict an official result.</p>
    </div>
  );
}
