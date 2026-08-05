import Link from "next/link";
import { ArrowDown, CheckCircle2, ChevronDown, Clock3, LockKeyhole, ShieldCheck, Target } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXAM_BANK_MINIMUM,
  EXAM_DIAGNOSTIC_QUESTION_COUNT,
  EXAM_MOCK_QUESTION_COUNT,
  EXAM_SPRINT_PRICE_NAIRA,
  examCourseDateLabel,
} from "@/lib/examSprint/config";
import { dedupeExamCourses } from "@/lib/examSprint/catalog";
import { getExamCatalog } from "@/lib/examSprint/server";
import { formatNaira } from "@/lib/utils";
import { isExamSprintOnlyMode } from "@/lib/systemMode";
import ExamCatalogClient from "./_components/ExamCatalogClient";

export const dynamic = "force-dynamic";

export default async function ExamSprintPage() {
  const examOnlyMode = isExamSprintOnlyMode();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const catalog = await getExamCatalog(user?.id);
  const uniqueCourses = dedupeExamCourses(catalog.courses);
  const readySets = uniqueCourses.flatMap((course) => course.sets);
  const available = uniqueCourses.filter((course) => course.sets.length > 0).length;
  const sample = readySets[0] ?? null;
  const mockQuestions = sample?.attemptQuestionCount ?? EXAM_MOCK_QUESTION_COUNT;
  const diagnosticQuestions = sample?.diagnosticQuestionCount ?? EXAM_DIAGNOSTIC_QUESTION_COUNT;
  const bankSize = sample?.coverage.bankTotal || EXAM_BANK_MINIMUM;
  const courses = uniqueCourses.map((course) => ({
    code: course.code,
    slug: course.slug,
    title: course.title,
    priority: course.priority,
    sets: course.sets,
    progress: course.progress,
    activeAttempt: course.activeAttempt,
    dateLabel: examCourseDateLabel(course),
  }));
  const activeAttempt = catalog.activeAttempts[0] ?? null;
  const activeDiagnostic = catalog.diagnostic?.resumable ? catalog.diagnostic : null;
  const activeSession = activeAttempt ?? activeDiagnostic;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      {examOnlyMode ? (
        <aside className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.07] px-3.5 py-3 text-foreground" role="status">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold leading-4 text-foreground">Exam Sprint mode</p>
            <p className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
              Study Hub tools are paused during exams. Timed mocks, corrections and progress remain available here.
            </p>
          </div>
        </aside>
      ) : null}
      <section className="relative isolate overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-card to-card px-4 pb-0 pt-4 sm:px-6 sm:pt-5">
        <div className="pointer-events-none absolute -right-16 -top-20 -z-10 h-52 w-52 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Supplementary CBT · 2026</p>
          {user ? (
            catalog.access.active ? (
              <span className="inline-flex min-h-7 items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Access active
              </span>
            ) : (
              <Link href="/study/billing?offer=exam-sprint&returnTo=/exam" className="inline-flex min-h-8 items-center rounded-lg bg-primary/10 px-2.5 text-[10px] font-bold text-primary no-underline">
                30-day pass · {formatNaira(EXAM_SPRINT_PRICE_NAIRA)}
              </Link>
            )
          ) : (
            <Link href="/login?next=%2Fexam" className="inline-flex min-h-8 items-center rounded-lg bg-primary/10 px-2.5 text-[10px] font-bold text-primary no-underline">
              Sign in
            </Link>
          )}
        </div>

        <div className="max-w-2xl pb-4 pt-2.5 sm:pb-5 sm:pt-4">
          <h1 className="max-w-xl text-[1.45rem] font-extrabold leading-[1.15] tracking-[-0.025em] sm:text-4xl">
            {activeAttempt
              ? "Your mock is waiting."
              : activeDiagnostic
                ? "Your diagnostic is waiting."
              : user
                ? "Your exam prep, organised."
                : "Practise like the real CBT."}
          </h1>
          <p className="mt-1.5 max-w-xl text-[12px] leading-5 text-muted-foreground sm:mt-2 sm:text-sm">
            {activeAttempt
              ? "Your timer is still running. Finish the active mock below before starting another course."
              : activeDiagnostic
                ? "Your free check is still running. Continue it below before its timer ends."
              : "Choose a ready course, practise under a timer, then review where you lost marks."}
          </p>
          {!activeSession ? (
            <a href="#courses" className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground no-underline shadow-sm">
              Choose a course <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>

        <div className="grid grid-cols-3 divide-x divide-primary/10 border-t border-primary/10">
          <div className="py-2.5 pr-2.5 sm:py-3">
            <p className="text-sm font-extrabold tabular-nums sm:text-base">{available}</p>
            <p className="mt-0.5 text-[10px] font-medium leading-4 text-muted-foreground">Courses ready</p>
          </div>
          <div className="px-2.5 py-2.5 sm:px-4 sm:py-3">
            <p className="text-sm font-extrabold tabular-nums sm:text-base">{mockQuestions}</p>
            <p className="mt-0.5 text-[10px] font-medium leading-4 text-muted-foreground">Questions / mock</p>
          </div>
          <div className="py-2.5 pl-2.5 sm:py-3 sm:pl-4">
            <p className="text-sm font-extrabold tabular-nums sm:text-base">1</p>
            <p className="mt-0.5 text-[10px] font-medium leading-4 text-muted-foreground">Free diagnostic</p>
          </div>
        </div>
      </section>

      <ExamCatalogClient courses={courses} activeAttempts={catalog.activeAttempts} activeDiagnostic={activeDiagnostic} />

      <details className="group overflow-hidden rounded-2xl border border-border bg-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3.5 py-3 marker:hidden sm:px-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold">How Exam Sprint works</span><span className="mt-0.5 block text-[11px] text-muted-foreground">Three things to know before you begin</span></span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-border">
          {[
            { icon: Target, title: "Try it before paying", body: `Use one free ${diagnosticQuestions}-question diagnostic on the course you choose. It is one free attempt across this campaign.` },
            { icon: Clock3, title: "Real exam rhythm", body: "One question at a time, a fixed timer and automatic submission." },
            { icon: ShieldCheck, title: "Smarter review", body: `See corrections and weak topics, then practise from the reviewed ${bankSize}+ question pool.` },
          ].map(({ icon: Icon, title, body }, index) => (
            <article key={title} className={`flex gap-3 px-3.5 py-3.5 sm:px-4 ${index > 0 ? "border-t border-border" : ""}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><h3 className="text-[13px] font-bold">{title}</h3><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{body}</p></div>
            </article>
          ))}
        </div>
      </details>

      <p className="border-t border-border px-1 pt-3.5 text-[10px] leading-4.5 text-muted-foreground">
        Exam Sprint is an independent revision tool. It does not provide leaked questions, official predictions or guaranteed examination results.
      </p>
    </div>
  );
}
