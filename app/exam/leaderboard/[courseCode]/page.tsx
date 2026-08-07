import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  CircleUserRound,
  FileQuestion,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findExamCourse } from "@/lib/examSprint/config";
import { getExamWeeklyLeaderboard } from "@/lib/examSprint/leaderboardServer";
import { getPublishedExamSets } from "@/lib/examSprint/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LeaderboardPageProps = { params: Promise<{ courseCode: string }> };

export async function generateMetadata({ params }: LeaderboardPageProps): Promise<Metadata> {
  const { courseCode } = await params;
  const course = findExamCourse(courseCode);
  if (!course) return { title: "Leaderboard not found", robots: { index: false, follow: false } };
  return {
    title: `${course.code} Weekly Leaderboard | Exam Sprint`,
    description: `This week's private Exam Sprint standings for ${course.code}.`,
    robots: { index: false, follow: true },
  };
}

function participantLabel(count: number) {
  return `${count} ${count === 1 ? "student" : "students"} ranked`;
}

function rankTone(rank: number) {
  if (rank === 1) return "bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-300";
  if (rank === 2) return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  if (rank === 3) return "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300";
  return "bg-secondary text-muted-foreground";
}

export default async function ExamLeaderboardPage({ params }: LeaderboardPageProps) {
  const { courseCode } = await params;
  const course = findExamCourse(courseCode);
  if (!course) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: { user } }, sets] = await Promise.all([
    supabase.auth.getUser(),
    getPublishedExamSets(course),
  ]);
  const leaderboard = await getExamWeeklyLeaderboard({
    setIds: sets.map((set) => set.id),
    userId: user?.id,
  });
  const courseHref = `/exam/${course.slug}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <nav aria-label="Leaderboard navigation">
        <Link href={courseHref} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to {course.code}
        </Link>
      </nav>

      <section className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-card" aria-labelledby="leaderboard-heading">
        <div className="p-4 sm:p-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">This week · {leaderboard.weekLabel}</p>
          <h1 id="leaderboard-heading" className="mt-1 text-[1.4rem] font-extrabold tracking-[-0.025em] sm:text-3xl">{course.code} leaderboard</h1>
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted-foreground">Your best submitted score from your first 3 mock slots this week counts. No speed bonus.</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-primary/10 border-t border-primary/10 bg-card/30">
          <div className="px-4 py-2.5">
            <p className="text-sm font-extrabold tabular-nums">{leaderboard.available ? leaderboard.participantCount : "—"}</p>
            <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">Students ranked</p>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-sm font-extrabold tabular-nums">3</p>
            <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">Weekly mock slots</p>
          </div>
        </div>
      </section>

      {leaderboard.available && user && leaderboard.currentEntry ? (
        <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4" aria-labelledby="your-position-heading">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CircleUserRound className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Your position</p>
              <h2 id="your-position-heading" className="mt-0.5 text-lg font-extrabold">#{leaderboard.currentEntry.rank} this week</h2>
            </div>
            <p className="text-xl font-extrabold tabular-nums text-primary">{leaderboard.currentEntry.bestPercentage}%</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-primary/10 pt-2.5 text-[11px] font-medium text-muted-foreground">
            <span>{leaderboard.currentEntry.coverage} unique questions covered</span>
            <span>{leaderboard.currentEntry.qualifyingAttempts}/3 leaderboard slots used</span>
          </div>
        </section>
      ) : leaderboard.available && user ? (
        <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Trophy className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-extrabold">You are not ranked yet</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Complete a full 40-question mock to join this week&apos;s board. Your free diagnostic does not count.</p>
            <Link href={courseHref} className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-primary no-underline hover:underline">Go to {course.code} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </div>
        </section>
      ) : leaderboard.available ? (
        <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><CircleUserRound className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-extrabold">See where you place</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">You can view the standings now. Sign in before a full mock to save your position.</p>
            <Link href={`/login?next=${encodeURIComponent(`/exam/leaderboard/${course.slug}`)}`} className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-primary no-underline hover:underline">Sign in <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4 text-center">
          <Trophy className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="mt-2 text-sm font-extrabold">This week&apos;s board is getting ready</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">You can keep practising normally. Your Exam Sprint course and mocks are still available.</p>
          <Link href={courseHref} className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-primary no-underline hover:underline">Back to {course.code} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </section>
      )}

      {leaderboard.available ? (
        <section aria-labelledby="top-students-heading">
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Standings</p>
              <h2 id="top-students-heading" className="mt-0.5 text-lg font-extrabold">Top 10 this week</h2>
            </div>
            <p className="inline-flex items-center gap-1.5 pb-0.5 text-[11px] font-medium text-muted-foreground"><UsersRound className="h-3.5 w-3.5" aria-hidden="true" /> {participantLabel(leaderboard.participantCount)}</p>
          </div>

          {leaderboard.topEntries.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {leaderboard.topEntries.map((entry, index) => (
                <div key={`${entry.rank}-${entry.label}`} className={cn("flex min-h-[3.75rem] items-center gap-3 px-3.5 py-2.5", index > 0 && "border-t border-border", entry.isCurrentUser && "bg-primary/[0.06]")}>
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-extrabold tabular-nums", rankTone(entry.rank))}>#{entry.rank}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">{entry.label}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{entry.coverage} unique questions covered</span>
                  </span>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums">{entry.bestPercentage}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-7 text-center">
              <Trophy className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-extrabold">Be one of the first this week</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">The board starts filling as students submit full {course.code} mocks.</p>
            </div>
          )}
        </section>
      ) : null}

      <details className="group overflow-hidden rounded-2xl border border-border bg-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3.5 py-3 marker:hidden">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold">How the weekly board works</span><span className="mt-0.5 block text-[11px] text-muted-foreground">Fair, simple and focused on practice</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
        </summary>
        <div className="space-y-2 border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground">
          <p><strong className="font-bold text-foreground">First 3 slots only.</strong> Your best submitted score from your first three full-mock slots each week is used.</p>
          <p><strong className="font-bold text-foreground">Mistakes stay forgiving.</strong> An untouched mock cancelled inside the short mistake window uses no slot. Ending a mock later uses a slot, but never creates a 0% score.</p>
          <p><strong className="font-bold text-foreground">Coverage breaks ties.</strong> If scores match, the student who covered more unique questions ranks first.</p>
          <p><strong className="font-bold text-foreground">No rushing advantage.</strong> Completion time never improves your rank.</p>
          <p><strong className="font-bold text-foreground">Full mocks only.</strong> The free 10-question diagnostic is excluded. The board resets Monday at 00:00 WAT.</p>
          <p className="inline-flex items-start gap-1.5"><FileQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> Private aliases are used instead of student names.</p>
        </div>
      </details>

      <Link href={courseHref} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-primary no-underline transition hover:bg-secondary">
        Keep practising {course.code} <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
