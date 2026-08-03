import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Flag, RotateCcw, Target, Timer, XCircle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findExamCourse } from "@/lib/examSprint/config";
import { getExamResult } from "@/lib/examSprint/server";
import { cn, formatDuration } from "@/lib/utils";
import ExamCorrections from "../../_components/ExamCorrections";
import CoverageMeter from "../../_components/CoverageMeter";

export const dynamic = "force-dynamic";

function readiness(percentage: number) {
  if (percentage >= 85) return { label: "Strong", note: "Keep your accuracy steady under time pressure.", tone: "border-emerald-300/50 bg-emerald-100/40 text-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-300", bar: "bg-emerald-500" };
  if (percentage >= 65) return { label: "Building", note: "Review your misses, then take another randomized mock.", tone: "border-amber-300/50 bg-amber-100/40 text-amber-900 dark:bg-amber-950/25 dark:text-amber-300", bar: "bg-amber-500" };
  return { label: "Needs more practice", note: "Work through the weak topics before your next attempt.", tone: "border-rose-300/50 bg-rose-100/40 text-rose-900 dark:bg-rose-950/25 dark:text-rose-300", bar: "bg-rose-500" };
}

function paceLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function Stat({ icon: Icon, value, label, hint, tone }: { icon: typeof CheckCircle2; value: string; label: string; hint?: string; tone: string }) {
  return <div className="border-border bg-card p-4 first:rounded-l-2xl last:rounded-r-2xl"><span className={cn("grid h-9 w-9 place-items-center rounded-xl", tone)}><Icon className="h-[18px] w-[18px]" /></span><p className="mt-3 text-2xl font-black tabular-nums">{value}</p><p className="text-xs font-bold text-muted-foreground">{label}</p>{hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}</div>;
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
  const flagged = result.items.filter((item) => item.flagged).length;
  const avgSpent = result.total > 0 ? result.timeSpentSeconds / result.total : 0;
  const avgAllowed = result.total > 0 ? result.allowedSeconds / result.total : 0;
  const ranOutOfTime = result.submissionReason === "timeup";
  const showCoverage = result.kind === "mock" && result.coverageBefore !== null && result.coverageAfter !== null && result.newQuestionsThisAttempt !== null && result.bankTotal !== null;

  return (
    <div className="space-y-5 pb-12">
      <Link href="/exam" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline"><ArrowLeft className="h-4 w-4" /> Exam Sprint home</Link>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">{result.kind === "diagnostic" ? "Diagnostic complete" : "Mock exam complete"}</p><h1 className="mt-2 text-3xl font-black tracking-tight">{result.courseCode} result</h1><p className="mt-1.5 text-sm text-muted-foreground">{course ? `${course.title} · ` : ""}{result.setTitle}</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full", status.bar)} style={{ width: `${result.percentage}%` }} /></div></div>
          <div className="grid min-w-40 place-items-center rounded-2xl bg-primary p-5 text-primary-foreground"><p className="text-5xl font-black tabular-nums">{result.percentage}%</p><p className="mt-1 text-xs font-bold opacity-80">{result.score} of {result.total} correct</p></div>
        </div>
        <div className={cn("border-t px-5 py-3.5 sm:px-7", status.tone)}><p className="font-extrabold">Readiness: {status.label}</p><p className="mt-0.5 text-sm">{status.note}</p></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Next actions">
        <a href="#corrections" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground no-underline"><Target className="h-4 w-4" /> {wrong + skipped > 0 ? `Review ${wrong + skipped} mistake${wrong + skipped === 1 ? "" : "s"}` : "Review answers"}</a>
        {course ? <Link href={`/exam/${course.slug}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-black text-foreground no-underline hover:bg-secondary"><RotateCcw className="h-4 w-4" /> {result.kind === "mock" ? "Take another mock" : "Continue with this course"}</Link> : <Link href="/exam" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-black no-underline">Choose another course <ArrowRight className="h-4 w-4" /></Link>}
      </section>

      <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border shadow-sm lg:grid-cols-4 lg:divide-x lg:divide-border">
        <Stat icon={CheckCircle2} value={String(result.score)} label="Correct" tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" />
        <div className="border-l border-border lg:border-l-0"><Stat icon={XCircle} value={String(wrong)} label="Wrong" tone="bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" /></div>
        <div className="border-t border-border lg:border-t-0"><Stat icon={Flag} value={String(skipped)} label="Left blank" hint={skipped > 0 && ranOutOfTime ? "Time expired" : undefined} tone="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" /></div>
        <div className="border-l border-t border-border lg:border-l-0 lg:border-t-0"><Stat icon={Timer} value={paceLabel(avgSpent)} label="Average per question" hint={avgAllowed > 0 ? `${paceLabel(avgAllowed)} allowed` : undefined} tone="bg-primary/10 text-primary" /></div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-muted-foreground shadow-sm"><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> {formatDuration(result.timeSpentSeconds)} spent</span>{result.allowedSeconds > 0 ? <span className="inline-flex items-center gap-1.5"><Timer className="h-4 w-4" /> {formatDuration(result.allowedSeconds)} allowed</span> : null}{flagged > 0 ? <span className="inline-flex items-center gap-1.5"><Flag className="h-4 w-4" /> {flagged} flagged</span> : null}{ranOutOfTime ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Submitted automatically at time-up</span> : null}</div>

      {showCoverage ? (
        <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Questions seen</p><h2 className="mt-1 text-xl font-extrabold">{result.newQuestionsThisAttempt} new question{result.newQuestionsThisAttempt === 1 ? "" : "s"} in this mock</h2><p className="mt-2 text-sm text-muted-foreground">Before this attempt, you had seen {result.coverageBefore} of {result.bankTotal}.</p><CoverageMeter className="mt-4" label="Questions seen now" delivered={result.coverageAfter ?? 0} bankTotal={result.bankTotal ?? 0} complete={Boolean(result.coverageComplete)} /></section>
      ) : null}

      {result.weakTopics.length > 0 ? (
        <section className="rounded-2xl border border-amber-300/40 bg-amber-100/30 p-5 dark:bg-amber-950/20"><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">Weak topics</p><h2 className="mt-1 text-xl font-extrabold">Topics that cost you marks</h2><div className="mt-3 flex flex-wrap gap-2">{result.weakTopics.map(({ topic, missed }) => <span key={topic} className="rounded-full border border-amber-300/50 bg-background px-3 py-1.5 text-xs font-bold">{topic} · {missed}</span>)}</div></section>
      ) : null}

      <ExamCorrections items={result.items} />

      <Link href="/exam" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-extrabold text-foreground no-underline hover:bg-secondary">Choose another course</Link>
      <p className="text-center text-xs text-muted-foreground">This readiness score is based on JabuStudy practice performance and does not predict an official result.</p>
    </div>
  );
}
