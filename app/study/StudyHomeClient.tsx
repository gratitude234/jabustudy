"use client";

import { useEffect, useState } from "react";
import { BookOpen, ArrowRight, Calculator, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { trackHomeView, type StudyHomeHeroState } from "@/lib/studyAnalytics";
import { currentAcademicSessionFallback } from "@/lib/utils";
import { StudyPrefsProvider, useStudyPrefs } from "./_components/StudyPrefsContext";
import { ForYouSection, type Chips } from "./_components/ForYouSection";
import CourseSearch from "./_components/CourseSearch";
import { HeroCard } from "./_components/HeroCard";
import { QuickActions } from "./_components/QuickActions";
import BannerSlot from "./_components/BannerSlot";
import StatsStrip from "./_components/StatsStrip";
import QuickStartChecklist from "./_components/QuickStartChecklist";

export default function StudyHomeClient() {
  return (
    <StudyPrefsProvider>
      <StudyHomeInner />
    </StudyPrefsProvider>
  );
}

function StudyHomeInner() {
  const { loading, displayName, prefs, hasPrefs, isProfileComplete, scopeLabel, rep, userId, updateSemester } =
    useStudyPrefs();

  const [chips, setChips] = useState<Chips>({});
  const [browseWithoutSetup, setBrowseWithoutSetup] = useState(false);
  const [semesterPrompt, setSemesterPrompt] = useState<{
    show: boolean;
    suggested: string | null;
    current: string | null;
    session: string | null;
  }>({ show: false, suggested: null, current: null, session: null });
  const [switchingSemester, setSwitchingSemester] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [nudgeResolved, setNudgeResolved] = useState(false);
  const [heroMetrics, setHeroMetrics] = useState<{
    heroState: StudyHomeHeroState;
    dueCount: number;
    streak: number;
  } | null>(null);
  const [examCountdown, setExamCountdown] = useState<{
    daysLeft: number;
    semester: string;
  } | null>(null);
  const [totalAttempts, setTotalAttempts] = useState<number | null>(null);

  function markSessionFlag(flag: string) {
    if (typeof window === "undefined") return false;
    window.__studyAnalyticsFlags ??= {};
    if (window.__studyAnalyticsFlags[flag]) return false;
    window.__studyAnalyticsFlags[flag] = true;
    return true;
  }

  useEffect(() => {
    async function checkExamSeason() {
      try {
        const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
        const { data } = await supabase
          .from("study_academic_calendar")
          .select("session, semester, ends_on")
          .gte("ends_on", today)
          .order("ends_on", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!data?.ends_on) return;
        const daysLeft = Math.ceil(
          (new Date(data.ends_on).getTime() - (Date.now() + 3_600_000)) / 86_400_000
        );
        if (daysLeft <= 21) {
          setExamCountdown({ daysLeft, semester: data.semester });
        }
      } catch {
        // non-critical
      }
    }

    checkExamSeason();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (localStorage.getItem("jabu:setupNudgeDismissed") === "1") {
          setNudgeDismissed(true);
        }
        if (localStorage.getItem("jabuStudy_browseWithoutSetup") === "1") {
          setBrowseWithoutSetup(true);
        }
      } catch {
        // non-critical
      }
      setNudgeResolved(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !heroMetrics || !markSessionFlag("study_home_viewed")) return;
    trackHomeView(heroMetrics.heroState, {
      has_prefs: hasPrefs,
      due_count: heroMetrics.dueCount,
      streak: heroMetrics.streak,
    });
  }, [hasPrefs, heroMetrics, loading]);

  useEffect(() => {
    if (loading || !prefs) return;
    let cancelled = false;
    const resolvedPrefs = prefs;

    async function resolveSemester(
      fn: "get_current_semester" | "get_current_semester_fallback",
      session: string
    ) {
      const { data, error } = await supabase.rpc(fn, { p_session: session });
      if (error || !Array.isArray(data)) return null;
      const firstRow = data[0] as { semester?: string | null } | undefined;
      return firstRow?.semester ?? null;
    }

    async function checkSemesterPrompt() {
      try {
        const session = (resolvedPrefs.session ?? currentAcademicSessionFallback()) as string;
        const saved = resolvedPrefs.semester ?? null;
        const current = await resolveSemester("get_current_semester", session);
        const suggested =
          current ?? (await resolveSemester("get_current_semester_fallback", session));

        if (!suggested || saved === suggested) return;

        let dismissed = false;
        try {
          dismissed =
            localStorage.getItem(
              `jabu_semester_prompt_dismissed:${session}:${suggested}`
            ) === "1";
        } catch {
          // non-critical
        }

        if (!cancelled && !dismissed) {
          setSemesterPrompt({ show: true, suggested, current: saved, session });
        }
      } catch {
        // non-critical
      }
    }

    checkSemesterPrompt();
    return () => {
      cancelled = true;
    };
  }, [loading, prefs]);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!userId) {
        setTotalAttempts(null);
        return;
      }

      async function fetchTotalAttempts() {
        try {
          const { count, error } = await supabase
            .from("study_practice_attempts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "submitted");

          if (cancelled) return;
          setTotalAttempts(!error ? count ?? 0 : 0);
        } catch {
          if (!cancelled) setTotalAttempts(0);
        }
      }

      setTotalAttempts(null);
      void fetchTotalAttempts();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, userId]);

  function clearFilters() {
    setChips({});
  }

  function dismissSemesterPrompt(session: string, suggested: string) {
    try {
      localStorage.setItem(`jabu_semester_prompt_dismissed:${session}:${suggested}`, "1");
    } catch {
      // non-critical
    }
    setSemesterPrompt({ show: false, suggested: null, current: null, session: null });
  }

  async function applySuggestedSemester() {
    if (!userId || !semesterPrompt.session || !semesterPrompt.suggested) return;

    setSwitchingSemester(true);
    const { session, suggested } = semesterPrompt;

    await supabase
      .from("study_preferences")
      .upsert(
        {
          user_id: userId,
          semester: suggested,
          session,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    updateSemester(suggested, session);
    dismissSemesterPrompt(session, suggested);
    setSwitchingSemester(false);
  }

  const isNewUser = totalAttempts === 0;

  return (
    <div className="pb-28 md:pb-6 lg:flex lg:items-start lg:gap-6">
      <div className="min-w-0 flex-1 space-y-4">

      {!loading && !isProfileComplete && !browseWithoutSetup ? (
        <SetupFirstPanel
          onBrowse={() => {
            try {
              localStorage.setItem("jabuStudy_browseWithoutSetup", "1");
            } catch {
              // non-critical
            }
            setBrowseWithoutSetup(true);
          }}
        />
      ) : null}

      {!loading && !isProfileComplete && !browseWithoutSetup ? null : (
        <>
          {!loading && !isProfileComplete ? (
            <div className="rounded-3xl border border-[#5B35D5]/20 bg-[#EEEDFE] p-4 text-sm text-[#3B24A8] dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10 dark:text-indigo-200">
              <p className="font-extrabold">Complete your academic profile</p>
              <p className="mt-1 text-xs">
                Browsing is open, but Study Hub works best after you save your official faculty, department, level and semester.
              </p>
              <Link
                href="/study/onboarding?next=/study"
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#5B35D5] px-4 py-2 text-xs font-bold text-white no-underline"
              >
                Finish setup <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}

      <BannerSlot
        examCountdown={examCountdown}
        hasPrefs={isProfileComplete}
        nudgeDismissed={nudgeResolved && !loading ? nudgeDismissed : true}
        semesterPrompt={semesterPrompt}
        switchingSemester={switchingSemester}
        onDismissSemester={dismissSemesterPrompt}
        onApplySemester={applySuggestedSemester}
        onDismissSetupNudge={() => setNudgeDismissed(true)}
      />

      <div className="hidden md:block">
        <CourseSearch />
      </div>

      <HeroCard
        displayName={displayName}
        userId={userId}
        loading={loading}
        onHeroStateResolved={setHeroMetrics}
      />

      <QuickActions repStatus={rep.status} />

      {userId && totalAttempts === null ? (
        <div className="h-20 animate-pulse rounded-3xl bg-muted" />
      ) : null}

      {userId && totalAttempts !== null
          ? isNewUser
          ? <QuickStartChecklist userId={userId} hasPrefs={isProfileComplete} />
          : <StatsStrip userId={userId} />
        : null}

      <ForYouSection chips={chips} setChips={setChips} onClearFilters={clearFilters} />

      <MyCourses scopeLabel={scopeLabel} />
        </>
      )}
      </div>

      {/* Right panel — visible only at lg+ */}
      <aside className="hidden lg:flex lg:w-[270px] lg:shrink-0 lg:flex-col lg:gap-3 sticky top-8">
        {heroMetrics && (
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-brand">Today</p>
            </div>
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-brand">Due cards</span>
                <span className="font-bold tabular-nums text-foreground">{heroMetrics.dueCount}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-brand">Streak</span>
                <span className="font-bold text-foreground">🔥 {heroMetrics.streak}d</span>
              </div>
            </div>
            <div className="px-4 pb-4 pt-3">
              <Link
                href="/study/practice"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white no-underline transition hover:opacity-90"
              >
                <Zap className="h-4 w-4" />
                Practice now
              </Link>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <p className="border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-brand">
            Quick links
          </p>
          <div className="divide-y divide-border">
            {[
              { href: "/study/library",     label: "Library",     Icon: BookOpen    },
              { href: "/study/gpa",         label: "GPA Tools",   Icon: Calculator  },
              { href: "/study/leaderboard", label: "Leaderboard", Icon: Trophy      },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-brand no-underline transition hover:bg-secondary/30 hover:text-foreground"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SetupFirstPanel({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="rounded-3xl border border-[#5B35D5]/20 bg-card p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-lg font-extrabold text-foreground">Set up your academic profile</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Save your official faculty, department, level and semester so Study Hub can show your courses, materials, practice sets and Q&A first.
          </p>
        </div>
        <Link
          href="/study/onboarding?next=/study"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B35D5] px-4 py-3 text-sm font-bold text-white no-underline hover:bg-[#4a2bb0]"
        >
          Start setup <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <button
          type="button"
          onClick={onBrowse}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Browse without setup
        </button>
      </div>
    </div>
  );
}

// ─── My Courses ───────────────────────────────────────────────────────────────

type CourseRow = {
  id: string;
  course_code: string;
  course_title: string;
  materialCount: number;
};

function MyCourses({ scopeLabel }: { scopeLabel: string | null }) {
  const { prefs, loading: prefsLoading, isProfileComplete, courses: scopedCourses } = useStudyPrefs();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  useEffect(() => {
    if (prefsLoading) return;
    if (!isProfileComplete) return;
    if (scopedCourses.length > 0) {
      setCoursesLoading(false);
      setCourses(scopedCourses.map((course) => ({
        id: course.id,
        course_code: course.course_code,
        course_title: course.course_title ?? "",
        materialCount: 0,
      })));
      return;
    }
    if (!prefs?.department_id && !prefs?.level) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCoursesLoading(true);

      (async () => {
        try {
          let q = supabase
            .from("study_courses")
            .select("id,course_code,course_title")
            .eq("status", "approved")
            .order("course_code", { ascending: true })
            .limit(8);

          if (prefs?.department_id) q = q.eq("department_id", prefs.department_id);
          if (prefs?.level) q = q.eq("level", prefs.level);

          const { data, error } = await q;
          if (cancelled || error || !data?.length) {
            if (!cancelled) { setCourses([]); setCoursesLoading(false); }
            return;
          }

          const withCounts = await Promise.all(
            (data as Pick<CourseRow, "id" | "course_code" | "course_title">[]).map(
              async (course) => {
                const { count } = await supabase
                  .from("study_materials")
                  .select("id", { count: "exact", head: true })
                  .eq("course_id", course.id)
                  .eq("approved", true);
                return { ...course, materialCount: count ?? 0 };
              }
            )
          );

          if (!cancelled) { setCourses(withCounts); setCoursesLoading(false); }
        } catch {
          if (!cancelled) { setCourses([]); setCoursesLoading(false); }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isProfileComplete, prefsLoading, prefs?.department_id, prefs?.level, scopedCourses]);

  if (prefsLoading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!isProfileComplete) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center">
        <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-semibold text-foreground">Your courses will appear here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your official profile to see courses for your department, level and semester.
        </p>
        <Link
          href="/study/onboarding"
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#5B35D5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4a2bb0]"
        >
          Set up profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">My Courses</h2>
          <p className="text-xs text-muted-foreground">{scopeLabel ?? "Your course hubs"}</p>
        </div>
        <Link
          href="/study/library"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B35D5] hover:underline"
        >
          All materials <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {coursesLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : courses.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/study/courses/${encodeURIComponent(course.course_code)}`}
              className="group flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 no-underline transition hover:border-[#5B35D5]/40 hover:bg-[#EEEDFE]/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-xl bg-[#5B35D5]/10 px-2.5 py-1 text-xs font-bold text-[#5B35D5]">
                  {course.course_code}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-[#5B35D5]" />
              </div>
              <p className="line-clamp-2 text-sm font-semibold text-foreground">
                {course.course_title}
              </p>
              {course.materialCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {course.materialCount} material{course.materialCount !== 1 ? "s" : ""}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm font-semibold text-foreground">No courses found yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Materials for your courses will appear here as students upload them.
          </p>
          <Link
            href="/study/library"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B35D5] hover:underline"
          >
            Browse all materials <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
