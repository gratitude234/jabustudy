import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Clock3, LockKeyhole, Sparkles, Target } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EXAM_SPRINT_PRICE_NAIRA, examCourseDateLabel } from "@/lib/examSprint/config";
import { getExamCatalog } from "@/lib/examSprint/server";
import ExamCountdown from "./_components/ExamCountdown";

export const dynamic = "force-dynamic";

function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}

export default async function ExamSprintPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const catalog = await getExamCatalog(user?.id);
  const available = catalog.courses.filter((course) => course.sets.length > 0 && !course.closed).length;
  const nextCourse = catalog.courses.find((course) => !course.closed);

  return (
    <div className="space-y-8 pb-12">
      <section className="overflow-hidden rounded-[2rem] border border-primary/15 bg-zinc-950 px-5 py-8 text-white shadow-xl md:px-9 md:py-11">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-violet-100">
            <Sparkles className="h-3.5 w-3.5" /> Supplementary CBT preparation
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Walk into your CBT prepared.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Timed mock exams built from reviewed past questions and course notes. No hints during the attempt—just the pressure, navigation and scoring you need to practise.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#courses" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 no-underline hover:bg-violet-50">
              Choose a course <ArrowRight className="h-4 w-4" />
            </a>
            {!catalog.access.active ? (
              <Link href="/study/billing?offer=exam-sprint&returnTo=/exam" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white no-underline hover:bg-white/15">
                Unlock all mocks · {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}
              </Link>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> Full access active
              </span>
            )}
          </div>
          {nextCourse ? <ExamCountdown examAt={nextCourse.examAt} courseCode={nextCourse.code} /> : null}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-2xl font-black">{available}</p><p className="mt-1 text-xs font-semibold text-zinc-400">course{available === 1 ? "" : "s"} ready now</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-2xl font-black">40</p><p className="mt-1 text-xs font-semibold text-zinc-400">questions per paid mock</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-2xl font-black">1 free</p><p className="mt-1 text-xs font-semibold text-zinc-400">10-question diagnostic</p></div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Clock3, title: "Real exam rhythm", body: "One question at a time, a fixed timer and automatic submission when time runs out." },
          { icon: Target, title: "Fresh mix each time", body: "Every paid attempt draws 40 randomized questions from a reviewed 60-question bank." },
          { icon: CheckCircle2, title: "Learn after submitting", body: "See your score, corrections, explanations and the topics that need another look." },
        ].map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
            <h2 className="mt-4 font-extrabold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </article>
        ))}
      </section>

      <section id="courses" className="scroll-mt-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">2026 supplementary timetable</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Choose your course</h2>
          </div>
          <p className="text-sm text-muted-foreground">New attempts close at the official exam time.</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.courses.map((course) => {
            const ready = course.sets.length > 0;
            const progress = course.progress;
            return (
              <article key={course.code} className="flex min-h-64 flex-col rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-black text-primary">{course.code}</span>
                  {course.priority ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">Priority</span> : null}
                </div>
                <h3 className="mt-4 text-lg font-extrabold leading-snug">{course.title}</h3>
                <p className="mt-3 flex items-start gap-2 text-xs font-semibold leading-5 text-muted-foreground">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" /> {examCourseDateLabel(course)} WAT
                </p>
                {progress ? <p className="mt-3 text-xs font-bold text-emerald-700">Best readiness: {progress.bestPercentage}% · {progress.attempts} attempt{progress.attempts === 1 ? "" : "s"}</p> : null}
                <div className="mt-auto pt-5">
                  {course.closed ? (
                    <span className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-bold text-muted-foreground">Course closed</span>
                  ) : ready ? (
                    <Link href={`/exam/${course.slug}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground no-underline hover:brightness-105">
                      Open course <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-bold text-muted-foreground"><LockKeyhole className="h-4 w-4" /> Coming soon</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
        Exam Sprint is an independent revision tool. It does not provide leaked questions, official predictions or guaranteed examination results.
      </p>
    </div>
  );
}
