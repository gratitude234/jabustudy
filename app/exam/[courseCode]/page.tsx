import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, FileQuestion, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { examCourseDateLabel, findExamCourse } from "@/lib/examSprint/config";
import { getExamCatalog } from "@/lib/examSprint/server";
import StartExamButton from "../_components/StartExamButton";

export const dynamic = "force-dynamic";

export default async function ExamCoursePage({ params }: { params: Promise<{ courseCode: string }> }) {
  const { courseCode } = await params;
  const course = findExamCourse(courseCode);
  if (!course) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const catalog = await getExamCatalog(user?.id);
  const courseState = catalog.courses.find((item) => item.slug === course.slug);
  const sets = courseState?.sets ?? [];
  const loginNext = `/exam/${course.slug}`;

  return (
    <div className="space-y-6 pb-12">
      <Link href="/exam#courses" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline"><ArrowLeft className="h-4 w-4" /> All courses</Link>

      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-black text-primary">{course.code}</span>
            <h1 className="mt-4 text-3xl font-black tracking-tight">{course.title}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><CalendarClock className="h-4 w-4" /> {examCourseDateLabel(course)} WAT</p>
          </div>
          {catalog.access.active ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Full access</span>
          ) : (
            <Link href="/study/billing?offer=exam-sprint&returnTo=/exam" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-extrabold text-white no-underline dark:bg-white dark:text-zinc-950"><LockKeyhole className="h-4 w-4" /> Unlock for ₦1,300</Link>
          )}
        </div>
      </section>

      {sets.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-center"><FileQuestion className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 text-xl font-extrabold">Question bank coming soon</h2><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">This course stays locked until its questions have been reviewed and approved.</p></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[0.9fr,1.1fr]">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Free diagnostic</p>
            <h2 className="mt-2 text-xl font-extrabold">Check your starting point</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-secondary p-3"><FileQuestion className="h-4 w-4 text-primary" /><p className="mt-2 font-black">10 questions</p></div>
              <div className="rounded-2xl bg-secondary p-3"><Clock3 className="h-4 w-4 text-primary" /><p className="mt-2 font-black">10 minutes</p></div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Your free diagnostic can be used once across Exam Sprint, so choose the course you need most.</p>
            <div className="mt-5">
              {catalog.diagnosticUsed ? (
                <div className="rounded-2xl border border-border bg-secondary px-4 py-3 text-center text-sm font-bold text-muted-foreground">Free diagnostic already used</div>
              ) : user ? (
                <StartExamButton setId={sets[0].id} kind="diagnostic" questionCount={sets[0].diagnosticQuestionCount} timeLimitMinutes={sets[0].diagnosticTimeLimitMinutes}>Start free diagnostic</StartExamButton>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground no-underline">Sign in to start free</Link>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Full mock exams</p>
            <h2 className="mt-2 text-xl font-extrabold">Practise under CBT conditions</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {sets[0].attemptQuestionCount} questions per mock, selected from a bank of {sets[0].coverage.bankTotal}</li>
              <li className="flex gap-2"><RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Unseen questions first, then smart revision after full coverage</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Corrections and explanations after submission</li>
            </ul>
            <div className="mt-5 space-y-3">
              {sets.map((set, index) => {
                const coveragePercent = set.coverage.bankTotal > 0
                  ? Math.round((set.coverage.delivered / set.coverage.bankTotal) * 100)
                  : 0;
                return <div key={set.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{set.title}</p><p className="mt-1 text-xs text-muted-foreground">Mock {index + 1} · {set.attemptQuestionCount} questions · {set.timeLimitMinutes} minutes</p></div></div>
                  <div className="mt-4 rounded-2xl bg-secondary p-3">
                    <div className="flex items-center justify-between gap-3 text-xs font-bold">
                      <span>Bank coverage: {set.coverage.delivered} of {set.coverage.bankTotal}</span>
                      <span className="text-muted-foreground">{coveragePercent}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-background" aria-label={`${coveragePercent}% of this question bank covered`}>
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${coveragePercent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {set.coverage.complete
                        ? "Full bank covered. Future mocks focus on unanswered, missed, flagged and older questions."
                        : `${set.coverage.remaining} unseen question${set.coverage.remaining === 1 ? "" : "s"} remaining.`}
                    </p>
                  </div>
                  <div className="mt-4">
                    {catalog.access.active ? (
                      <StartExamButton setId={set.id} kind="mock" questionCount={set.attemptQuestionCount} timeLimitMinutes={set.timeLimitMinutes}>Start full mock</StartExamButton>
                    ) : (
                      <Link href="/study/billing?offer=exam-sprint&returnTo=/exam" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-extrabold text-white no-underline dark:bg-white dark:text-zinc-950"><LockKeyhole className="h-4 w-4" /> Get 30-day Plus</Link>
                    )}
                  </div>
                </div>;
              })}
            </div>
          </section>
        </div>
      )}

      {courseState?.progress ? <p className="text-center text-sm font-semibold text-muted-foreground">Your best readiness score for this course is <strong className="text-foreground">{courseState.progress.bestPercentage}%</strong>.</p> : null}
    </div>
  );
}
