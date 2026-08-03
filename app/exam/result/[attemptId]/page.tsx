import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, RotateCcw, Target, XCircle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findExamCourse } from "@/lib/examSprint/config";
import { getExamResult } from "@/lib/examSprint/server";
import { cn, formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

function readiness(percentage: number) {
  if (percentage >= 85) return { label: "Strong", note: "Keep your accuracy steady under time pressure.", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (percentage >= 65) return { label: "Building", note: "Review your misses, then take another randomized mock.", tone: "text-amber-800 bg-amber-50 border-amber-200" };
  return { label: "Needs more practice", note: "Focus on the weak topics below before your next attempt.", tone: "text-rose-700 bg-rose-50 border-rose-200" };
}

export default async function ExamResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exam/result/${attemptId}`)}`);
  const result = await getExamResult(user.id, attemptId);
  const course = findExamCourse(result.courseCode);
  const status = readiness(result.percentage);
  const coverageBefore = result.coverageBefore ?? 0;
  const coverageAfter = result.coverageAfter ?? 0;
  const newQuestionsThisAttempt = result.newQuestionsThisAttempt ?? 0;
  const bankTotal = result.bankTotal ?? 0;
  const showCoverage = result.kind === "mock"
    && result.coverageBefore !== null
    && result.coverageAfter !== null
    && result.newQuestionsThisAttempt !== null
    && result.bankTotal !== null;
  const coveragePercent = showCoverage && bankTotal > 0
    ? Math.round((coverageAfter / bankTotal) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-12">
      <Link href="/exam" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline"><ArrowLeft className="h-4 w-4" /> Exam Sprint home</Link>

      <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">{result.kind === "diagnostic" ? "Diagnostic complete" : "Mock exam complete"}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{result.courseCode} result</h1>
            <p className="mt-2 text-sm text-muted-foreground">{result.setTitle}</p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2"><Clock3 className="h-4 w-4" /> {formatDuration(result.timeSpentSeconds)}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2"><Target className="h-4 w-4" /> {result.answered}/{result.total} answered</span>
            </div>
          </div>
          <div className="grid min-w-40 place-items-center rounded-3xl bg-zinc-950 p-6 text-white dark:bg-white dark:text-zinc-950">
            <p className="text-5xl font-black tabular-nums">{result.percentage}%</p>
            <p className="mt-2 text-xs font-bold opacity-70">{result.score} of {result.total} correct</p>
          </div>
        </div>
        <div className={cn("border-t px-6 py-4 md:px-8", status.tone)}>
          <p className="font-extrabold">Readiness: {status.label}</p>
          <p className="mt-1 text-sm">{status.note}</p>
        </div>
      </section>

      {showCoverage ? (
        <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Question-bank coverage</p>
              <h2 className="mt-1 text-xl font-extrabold">{coverageAfter} of {bankTotal} covered</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This mock added {newQuestionsThisAttempt} new bank question{newQuestionsThisAttempt === 1 ? "" : "s"}. Your coverage was {coverageBefore} before this attempt.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-3 py-2 text-xs font-black text-primary">{coveragePercent}% covered</span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-background" aria-label={`${coveragePercent}% of this question bank covered`}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${coveragePercent}%` }} />
          </div>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">
            {result.coverageComplete
              ? "Full bank covered. Your next mock will focus on unanswered, missed, flagged and older questions."
              : `${Math.max(0, bankTotal - coverageAfter)} unseen question${bankTotal - coverageAfter === 1 ? "" : "s"} remaining.`}
          </p>
        </section>
      ) : null}

      {result.weakTopics.length > 0 ? (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">Topics to revisit</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {result.weakTopics.map((topic) => <span key={topic.topic} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">{topic.topic} · {topic.missed} missed</span>)}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Corrections</p><h2 className="mt-1 text-2xl font-black">Review every question</h2></div></div>
        <div className="mt-5 space-y-4">
          {result.items.map((item) => (
            <article key={item.id} className={cn("rounded-3xl border bg-card p-5 shadow-sm", item.correct ? "border-emerald-200" : "border-rose-200")}>
              <div className="flex items-start gap-3">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-2xl", item.correct ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>{item.correct ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}</span>
                <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Question {item.position}</p><h3 className="mt-1 font-bold leading-7">{item.prompt}</h3></div>
              </div>
              <div className="mt-4 space-y-2">
                {item.options.map((option, index) => {
                  const correct = option.id === item.correctOptionId;
                  const selected = option.id === item.selectedOptionId;
                  return <div key={option.id} className={cn("flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm", correct ? "border-emerald-300 bg-emerald-50 text-emerald-950" : selected ? "border-rose-300 bg-rose-50 text-rose-950" : "border-border bg-background text-muted-foreground")}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border bg-background text-xs font-black">{String.fromCharCode(65 + index)}</span>
                    <span className="pt-0.5 font-semibold">{option.text}</span>
                    {correct ? <CheckCircle2 className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : selected ? <XCircle className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-rose-600" /> : null}
                  </div>;
                })}
              </div>
              {!item.selectedOptionId ? <p className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700"><AlertCircle className="h-4 w-4" /> You did not answer this question.</p> : null}
              <div className="mt-4 rounded-2xl bg-secondary p-4"><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Explanation</p><p className="mt-2 text-sm leading-6">{item.explanation || "Review this answer with your course material."}</p></div>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        {course ? <Link href={`/exam/${course.slug}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground no-underline"><RotateCcw className="h-4 w-4" /> {result.kind === "mock" ? "Take another mock" : "Continue with this course"}</Link> : null}
        <Link href="/exam" className="inline-flex flex-1 items-center justify-center rounded-2xl border border-border bg-card px-5 py-3 text-sm font-extrabold text-foreground no-underline">Choose another course</Link>
      </div>

      <p className="text-center text-xs text-muted-foreground">This readiness score is based on JabuStudy practice performance and does not predict an official result.</p>
    </div>
  );
}
