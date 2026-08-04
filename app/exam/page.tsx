import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, ShieldCheck, Target } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXAM_BANK_MINIMUM,
  EXAM_DIAGNOSTIC_QUESTION_COUNT,
  EXAM_MOCK_QUESTION_COUNT,
  EXAM_SPRINT_PRICE_NAIRA,
  examCourseDateLabel,
} from "@/lib/examSprint/config";
import { getExamCatalog } from "@/lib/examSprint/server";
import { formatNaira } from "@/lib/utils";
import ExamCatalogClient from "./_components/ExamCatalogClient";

export const dynamic = "force-dynamic";

export default async function ExamSprintPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const catalog = await getExamCatalog(user?.id);
  const readySets = catalog.courses.flatMap((course) => course.sets);
  const available = catalog.courses.filter((course) => course.sets.length > 0).length;
  const sample = readySets[0] ?? null;
  const mockQuestions = sample?.attemptQuestionCount ?? EXAM_MOCK_QUESTION_COUNT;
  const diagnosticQuestions = sample?.diagnosticQuestionCount ?? EXAM_DIAGNOSTIC_QUESTION_COUNT;
  const bankSize = sample?.coverage.bankTotal || EXAM_BANK_MINIMUM;
  const courses = catalog.courses.map((course) => ({
    ...course,
    dateLabel: examCourseDateLabel(course),
  }));

  return (
    <div className="space-y-6 pb-12">
      <section className="relative isolate overflow-hidden rounded-[1.5rem] bg-[#21164f] px-5 pb-0 pt-5 text-white shadow-[0_18px_50px_rgba(33,22,79,0.18)] sm:px-7 sm:pt-7">
        <div className="pointer-events-none absolute -right-16 -top-20 -z-10 h-56 w-56 rounded-full bg-[#725cff]/35 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 h-44 w-44 rounded-full bg-cyan-400/10 blur-2xl" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-200">Supplementary CBT · 2026</p>
          {user ? (
            catalog.access.active ? (
              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 text-[11px] font-black text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Full access
              </span>
            ) : (
              <Link href="/study/billing?offer=exam-sprint&returnTo=/exam" className="inline-flex min-h-8 items-center rounded-full border border-white/15 bg-white/10 px-3 text-[11px] font-black text-white no-underline">
                Unlock · {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}
              </Link>
            )
          ) : (
            <Link href="/login?next=%2Fexam" className="inline-flex min-h-8 items-center rounded-full border border-white/15 bg-white/10 px-3 text-[11px] font-black text-white no-underline">
              Sign in
            </Link>
          )}
        </div>

        <div className="max-w-2xl pb-6 pt-5 sm:pb-7">
          <h1 className="max-w-xl text-[2rem] font-black leading-[1.08] tracking-[-0.035em] sm:text-5xl">
            {catalog.activeAttempts.length > 0
              ? "Your mock is waiting."
              : user
                ? "Your exam prep, organised."
                : "Practise like the real CBT."}
          </h1>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-violet-100/75 sm:text-base">
            Choose a ready course, answer under a real timer, then review exactly where you lost marks.
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
          <div className="py-3.5 pr-3 sm:py-4">
            <p className="text-lg font-black tabular-nums">{available}</p>
            <p className="mt-0.5 text-[10px] font-bold leading-4 text-violet-200/70">Courses ready</p>
          </div>
          <div className="px-3 py-3.5 sm:px-5 sm:py-4">
            <p className="text-lg font-black tabular-nums">{mockQuestions}</p>
            <p className="mt-0.5 text-[10px] font-bold leading-4 text-violet-200/70">Questions / mock</p>
          </div>
          <div className="py-3.5 pl-3 sm:py-4 sm:pl-5">
            <p className="text-lg font-black tabular-nums">{diagnosticQuestions}</p>
            <p className="mt-0.5 text-[10px] font-bold leading-4 text-violet-200/70">Free diagnostic</p>
          </div>
        </div>
      </section>

      <ExamCatalogClient courses={courses} activeAttempts={catalog.activeAttempts} />

      <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="inside-exam-heading">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Inside every mock</p>
          <h2 id="inside-exam-heading" className="mt-1 text-lg font-black">Built for the way you will sit the exam</h2>
        </div>
        {[
          { icon: Clock3, title: "Real exam rhythm", body: "One question at a time, a fixed timer and automatic submission." },
          { icon: Target, title: "Smarter question rotation", body: `Unseen questions are prioritised across the reviewed ${bankSize}+ question pool.` },
          { icon: ShieldCheck, title: "Clear corrections", body: "See your mistakes, explanations and weak topics immediately after submitting." },
        ].map(({ icon: Icon, title, body }, index) => (
          <article key={title} className={`flex gap-3 px-4 py-4 sm:px-5 ${index > 0 ? "border-t border-border" : ""}`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold">{title}</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{body}</p>
            </div>
            <ArrowRight className="mt-3 hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
          </article>
        ))}
      </section>

      <p className="border-t border-border px-1 pt-4 text-[11px] leading-5 text-muted-foreground">
        Exam Sprint is an independent revision tool. It does not provide leaked questions, official predictions or guaranteed examination results.
      </p>
    </div>
  );
}
