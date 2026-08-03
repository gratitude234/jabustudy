import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, ShieldCheck, Sparkles, Target } from "lucide-react";
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
    <div className="space-y-7 pb-12">
      {user ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Exam Sprint</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Your CBT preparation</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Resume an active paper or choose a ready course below.</p>
          </div>
          {catalog.access.active ? (
            <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-100 px-3.5 text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Plus active
            </span>
          ) : (
            <Link href="/study/billing?offer=exam-sprint&returnTo=/exam" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground no-underline">
              Unlock all mocks · {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}
            </Link>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,#17112d_0%,#261b52_52%,#3b24a8_100%)] px-5 py-8 text-white shadow-lg md:px-9 md:py-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-violet-100">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Supplementary CBT preparation
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Walk into your CBT prepared.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-violet-100/80">Timed mocks built from reviewed questions, with one free diagnostic to check your starting point.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="#courses" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 no-underline">
                Choose a course <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link href="/login?next=%2Fexam" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-black text-white no-underline">
                Sign in
              </Link>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-violet-100/75">
            <span>{available} course{available === 1 ? "" : "s"} ready</span>
            <span>{mockQuestions} questions per mock</span>
            <span>1 free {diagnosticQuestions}-question diagnostic</span>
          </div>
        </section>
      )}

      <ExamCatalogClient courses={courses} activeAttempts={catalog.activeAttempts} />

      <section className="grid overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-3">
        {[
          { icon: Clock3, title: "Real exam rhythm", body: "A fixed timer, question navigation and automatic submission." },
          { icon: Target, title: "New questions first", body: `Each mock draws ${mockQuestions} questions and grows your coverage of the reviewed ${bankSize}+ question pool.` },
          { icon: ShieldCheck, title: "Corrections after", body: "Answers stay hidden until submission, then you get explanations and weak topics." },
        ].map(({ icon: Icon, title, body }, index) => (
          <article key={title} className={`p-5 ${index > 0 ? "border-t border-border md:border-l md:border-t-0" : ""}`}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
            <h2 className="mt-3 font-extrabold">{title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{body}</p>
          </article>
        ))}
      </section>

      <p className="rounded-xl border border-amber-300/50 bg-amber-100/40 px-4 py-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/25 dark:text-amber-300">
        Exam Sprint is an independent revision tool. It does not provide leaked questions, official predictions or guaranteed examination results.
      </p>
    </div>
  );
}
