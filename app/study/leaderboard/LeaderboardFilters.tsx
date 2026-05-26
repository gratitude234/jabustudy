"use client";

import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useTransition } from "react";

type Scope = "all" | "faculty" | "dept" | "level" | "course";
type Period = "week" | "month" | "semester" | "session" | "all";

type UserPrefs = {
  department_id: string | null;
  faculty_id: string | null;
  level: number | null;
  department: string | null;
  faculty: string | null;
  semester: string | null;
};

type CourseOption = {
  id: string;
  course_code: string;
  course_title: string | null;
};

type Props = {
  period: Period;
  scope: Scope;
  userPrefs: UserPrefs | null;
  courseCode: string | null;
  hasCourses: boolean;
  courses: CourseOption[];
};

function leaderboardHref(period: Period, scope: Scope, courseCode?: string | null) {
  const params = new URLSearchParams({ period, scope });
  if (scope === "course" && courseCode) params.set("course", courseCode);
  return `/study/leaderboard?${params.toString()}`;
}

function departmentLabel(department: string | null | undefined, fallback = "My Department") {
  const label = department?.trim();
  if (!label) return fallback;
  return /\b(department|dept\.?)\b/i.test(label) ? label : `${label} Dept.`;
}

function normalizeCourseCode(code: string | null | undefined) {
  return (code ?? "").replace(/\s+/g, "").toUpperCase();
}

export function LeaderboardFilters({
  period,
  scope,
  userPrefs,
  courseCode,
  hasCourses,
  courses,
}: Props) {
  const router = useRouter();
  const [isTransitionPending, startTransition] = useTransition();
  const [active, setActive] = useOptimistic(
    { period, scope, courseCode },
    (_, next: { period: Period; scope: Scope; courseCode: string | null }) => next
  );
  const isPending =
    isTransitionPending ||
    active.period !== period ||
    active.scope !== scope ||
    active.courseCode !== courseCode;

  const scopeTabs = useMemo<Array<{ key: Scope; label: string; disabled?: boolean }>>(
    () => [
      { key: "all", label: "All JABU" },
      {
        key: "faculty",
        label: userPrefs?.faculty ?? "My faculty",
        disabled: !userPrefs?.faculty_id,
      },
      {
        key: "dept",
        label: departmentLabel(userPrefs?.department, "My dept"),
        disabled: !userPrefs?.department_id,
      },
      {
        key: "level",
        label: userPrefs?.level ? `${userPrefs.level}L` : "My level",
        disabled: !userPrefs?.level,
      },
      {
        key: "course",
        label: active.courseCode ?? "Course",
        disabled: !hasCourses && !active.courseCode,
      },
    ],
    [active.courseCode, hasCourses, userPrefs]
  );

  function navigate(nextPeriod: Period, nextScope: Scope, nextCourseCode: string | null) {
    startTransition(() => {
      setActive({ period: nextPeriod, scope: nextScope, courseCode: nextCourseCode });
      router.push(leaderboardHref(nextPeriod, nextScope, nextCourseCode), { scroll: false });
    });
  }

  return (
    <div className="mt-4 space-y-2">
      <nav
        className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Leaderboard period"
      >
        {[
          { key: "week", label: "Week" },
          { key: "month", label: "Month" },
          { key: "semester", label: "Semester" },
          { key: "session", label: "Session" },
          { key: "all", label: "All-time" },
        ].map((tab) => {
          const tabPeriod = tab.key as Period;
          const selected = active.period === tabPeriod;

          return (
            <button
              key={tabPeriod}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => navigate(tabPeriod, active.scope, active.courseCode)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
                selected
                  ? "border-white bg-white text-primary-text"
                  : "border-white/25 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <nav className="flex flex-wrap items-center gap-2" aria-label="Leaderboard scope">
        {scopeTabs.map((tab) => {
          const selected = active.scope === tab.key;
          const nextCourseCode = tab.key === "course" ? active.courseCode : null;
          if (tab.disabled) {
            return (
              <span
                key={tab.key}
                aria-disabled="true"
                className="max-w-[11rem] truncate rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/35 sm:max-w-none"
              >
                {tab.label}
              </span>
            );
          }

          return (
            <button
              key={tab.key}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => navigate(active.period, tab.key, nextCourseCode)}
              className={cn(
                "max-w-[11rem] truncate rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:max-w-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
                selected
                  ? "border-white bg-white text-primary-text"
                  : "border-white/25 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {active.scope === "course" && courses.length > 0 && (
        <nav
          className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Course leaderboard"
        >
          {courses.map((course) => {
            const selected =
              normalizeCourseCode(active.courseCode) === normalizeCourseCode(course.course_code);

            return (
              <button
                key={course.id}
                type="button"
                title={course.course_title ?? course.course_code}
                aria-current={selected ? "page" : undefined}
                onClick={() => navigate(active.period, "course", course.course_code)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
                  selected
                    ? "border-white bg-white text-primary-text"
                    : "border-white/25 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                )}
              >
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                {course.course_code}
              </button>
            );
          })}
        </nav>
      )}

      {isPending && (
        <p className="px-1 text-[11px] font-semibold text-white/65" role="status">
          Updating leaderboard...
        </p>
      )}
    </div>
  );
}
