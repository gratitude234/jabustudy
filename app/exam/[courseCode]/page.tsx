import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Clock3, FileQuestion, LockKeyhole, PlayCircle, RotateCcw, ShieldCheck, Trophy } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EXAM_SPRINT_PRICE_NAIRA, examCourseDateLabel, findExamCourse } from "@/lib/examSprint/config";
import { getExamCatalog } from "@/lib/examSprint/server";
import { formatNaira } from "@/lib/utils";
import StartExamButton from "../_components/StartExamButton";
import CoverageMeter from "../_components/CoverageMeter";

export const dynamic = "force-dynamic";

/**
 * Whole days between now and the exam, counted in WAT so it flips at Lagos
 * midnight. Null for courses whose date has not been announced yet.
 */
function daysUntil(examAt: string | null) {
  if (!examAt) return null;
  const target = new Date(examAt).getTime();
  if (!Number.isFinite(target)) return null;
  const day = 86_400_000;
  const toWatDay = (ms: number) => Math.floor((ms + 3_600_000) / day);
  return toWatDay(target) - toWatDay(Date.now());
}

function countdownLabel(days: number) {
  if (days > 1) return `${days} days away`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today";
  return "Already written";
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
  const loginNext = `/exam/${course.slug}`;
  const progress = courseState?.progress ?? null;

  const days = daysUntil(course.examAt);
  const upcoming = days !== null && days >= 0;
  const diagnostic = catalog.diagnostic;
  // The diagnostic is one-per-campaign, so it may belong to a different course.
  const diagnosticElsewhere = diagnostic?.courseCode
    && diagnostic.courseCode.replace(/\s/g, "") !== course.code.replace(/\s/g, "");
  const diagnosticSet = sets[0] ?? null;

  return (
    <div className="space-y-6 pb-12">
      <Link href="/exam#courses" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline">
        <ArrowLeft className="h-4 w-4" /> All courses
      </Link>

      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-black text-primary">{course.code}</span>
              {upcoming ? (
                <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-black text-muted-foreground">
                  {countdownLabel(days as number)}
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">{course.title}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CalendarClock className="h-4 w-4 shrink-0" /> {examCourseDateLabel(course)}
            </p>
            {progress ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100/60 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Trophy className="h-3.5 w-3.5" />
                Best {progress.basedOn === "mock" ? "mock" : "diagnostic"} score: {progress.bestPercentage}%
                <span className="font-semibold opacity-80">
                  · {progress.attempts} attempt{progress.attempts === 1 ? "" : "s"}
                </span>
              </p>
            ) : null}
          </div>
          {catalog.access.active ? (
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-100/60 px-3 py-2 text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Full access
            </span>
          ) : (
            <Link href="/study/billing?offer=exam-sprint&returnTo=/exam" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-extrabold text-white no-underline hover:brightness-125 dark:bg-white dark:text-zinc-950 dark:hover:brightness-90">
              <LockKeyhole className="h-4 w-4" /> Unlock for {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}
            </Link>
          )}
        </div>
      </section>

      {sets.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <FileQuestion className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-extrabold">Question bank coming soon</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            This course stays locked until its questions have been reviewed and approved.
          </p>
          <Link href="/exam#courses" className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-extrabold text-foreground no-underline hover:bg-secondary">
            See which courses are ready <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-24">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Free diagnostic</p>
            <h2 className="mt-2 text-xl font-extrabold">Check your starting point</h2>
            {diagnosticSet ? (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-secondary p-3">
                  <FileQuestion className="h-4 w-4 text-primary" />
                  <p className="mt-2 font-black">{diagnosticSet.diagnosticQuestionCount} questions</p>
                </div>
                <div className="rounded-2xl bg-secondary p-3">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <p className="mt-2 font-black">{diagnosticSet.diagnosticTimeLimitMinutes} minutes</p>
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              {diagnostic?.resumable ? (
                <>
                  <p className="mb-4 text-sm leading-6 text-muted-foreground">
                    You have a diagnostic still running{diagnosticElsewhere && diagnostic.courseCode ? ` on ${diagnostic.courseCode}` : ""}. Your timer is still going.
                  </p>
                  <Link href={`/exam/attempt/${diagnostic.attemptId}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground no-underline hover:brightness-105">
                    <PlayCircle className="h-4 w-4" /> Resume your diagnostic
                  </Link>
                </>
              ) : diagnostic ? (
                <>
                  <p className="mb-4 text-sm leading-6 text-muted-foreground">
                    You have used your one free diagnostic{diagnosticElsewhere && diagnostic.courseCode ? ` on ${diagnostic.courseCode}` : ""}.
                    {" "}Full mocks below are unlimited with Plus.
                  </p>
                  <Link href={`/exam/result/${diagnostic.attemptId}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-extrabold text-foreground no-underline hover:bg-background">
                    {diagnostic.submitted ? `View your result · ${diagnostic.percentage}%` : "View your result"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              ) : user ? (
                <>
                  <p className="mb-4 text-sm leading-6 text-muted-foreground">
                    One free diagnostic is included across the whole of Exam Sprint. Using it here spends it for every course.
                  </p>
                  <StartExamButton
                    setId={diagnosticSet!.id}
                    kind="diagnostic"
                    questionCount={diagnosticSet!.diagnosticQuestionCount}
                    timeLimitMinutes={diagnosticSet!.diagnosticTimeLimitMinutes}
                  >
                    Start free diagnostic
                  </StartExamButton>
                </>
              ) : (
                <>
                  <p className="mb-4 text-sm leading-6 text-muted-foreground">
                    One free diagnostic is included across the whole of Exam Sprint.
                  </p>
                  <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground no-underline hover:brightness-105">
                    Sign in to start free
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Full mock exams</p>
            <h2 className="mt-2 text-xl font-extrabold">Practise under CBT conditions</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                A randomized paper every attempt, drawn from a reviewed question bank
              </li>
              <li className="flex gap-2">
                <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Unseen questions first, then smart revision after full coverage
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Corrections and explanations after submission
              </li>
            </ul>
            <div className="mt-5 space-y-3">
              {sets.map((set, index) => (
                <div key={set.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-extrabold">{set.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mock {index + 1} · {set.attemptQuestionCount} questions from a bank of {set.coverage.bankTotal} · {set.timeLimitMinutes} minutes
                  </p>
                  <CoverageMeter
                    className="mt-4"
                    delivered={set.coverage.delivered}
                    bankTotal={set.coverage.bankTotal}
                    complete={set.coverage.complete}
                  />
                  <div className="mt-4">
                    {catalog.access.active ? (
                      <StartExamButton
                        setId={set.id}
                        kind="mock"
                        questionCount={set.attemptQuestionCount}
                        timeLimitMinutes={set.timeLimitMinutes}
                      >
                        Start full mock
                      </StartExamButton>
                    ) : (
                      <Link href="/study/billing?offer=exam-sprint&returnTo=/exam" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-extrabold text-white no-underline hover:brightness-125 dark:bg-white dark:text-zinc-950 dark:hover:brightness-90">
                        <LockKeyhole className="h-4 w-4" /> Unlock for {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!catalog.access.active ? (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                One payment unlocks every published mock across all Exam Sprint courses for 30 days.
              </p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
