// app/study/leaderboard/page.tsx
//
// Ledger-backed leaderboard with separate period and academic-scope filters.

import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PointsBreakdown } from "./PointsBreakdown";
import { HowPointsWork } from "./HowPointsWork";

// 5-min revalidation — swap for MATERIALIZED VIEW + pg_cron when user base grows.
export const revalidate = 300;

// ─── Types ────────────────────────────────────────────────────────────────────

type LeaderRow = {
  user_id: string;
  email: string;
  questions: number;
  question_upvotes: number;
  answers: number;
  accepted: number;
  practice_points: number;
  practice_days: number;
  points: number;
  rank?: number | null;
};

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

type StudyPreferenceScopeRow = {
  faculty_id: string | null;
  department_id: string | null;
  level: number | null;
  semester: string | null;
  session: string | null;
};

type RepMetaRow = {
  user_id: string;
  role: string | null;
};

type LeaderboardRpcRow = LeaderRow & {
  active_days?: number | null;
  last_activity_at?: string | null;
};

type CourseOption = {
  id: string;
  course_code: string;
  course_title: string | null;
};

async function getLeaderboardEntryState() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData?.user?.id ?? null;
  if (!currentUserId) return { currentUserId, profileComplete: false };

  const { data } = await supabase
    .from("study_preferences")
    .select("faculty_id,department_id,level,semester,session")
    .eq("user_id", currentUserId)
    .maybeSingle();

  const row = data as StudyPreferenceScopeRow | null;
  const profileComplete = Boolean(
    row?.faculty_id &&
      row?.department_id &&
      typeof row?.level === "number" &&
      row?.semester &&
      row?.session
  );

  return { currentUserId, profileComplete };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** user_id → display name (full_name from profiles, fallback to email prefix) */
type ProfileMap = Record<string, string>;

function displayName(userId: string, email: string, profileMap: ProfileMap): string {
  const fallback = email?.trim() ? email.split("@")[0] : "";
  return (profileMap[userId] ?? fallback) || "Anonymous";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

function periodLabel(period: Period) {
  if (period === "week") return "This week";
  if (period === "month") return "This month";
  if (period === "semester") return "Current semester";
  if (period === "session") return "Current session";
  return "All-time";
}

function normalizeCourseCode(code: string | null | undefined) {
  return (code ?? "").replace(/\s+/g, "").toUpperCase();
}

async function fetchLeaderboard(scope: Scope, period: Period, requestedCourseCode: string | null): Promise<{
  rows: LeaderRow[];
  viewMissing: boolean;
  currentUserId: string | null;
  userPrefs: UserPrefs | null;
  courseOptions: CourseOption[];
  selectedCourseCode: string | null;
  scopeLabel: string;
  periodLabel: string;
  outsideTopNRow: { row: LeaderRow; rank: number } | null;
  profileMap: ProfileMap;
  repUserIds: Set<string>;
  repRoleMap: Map<string, string>;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData?.user?.id ?? null;

  // Fetch user prefs (needed for academic scope labels and filtering)
  let userPrefs: UserPrefs | null = null;
  if (currentUserId) {
    const { data } = await supabase
      .from("study_preferences")
      .select("department_id, faculty_id, level, semester, department, faculty")
      .eq("user_id", currentUserId)
      .maybeSingle();
    if (data) userPrefs = data as UserPrefs;
  }

  let courseOptions: CourseOption[] = [];
  if (userPrefs?.department_id && userPrefs.level && userPrefs.semester) {
    const { data } = await supabase
      .from("study_courses")
      .select("id,course_code,course_title")
      .eq("department_id", userPrefs.department_id)
      .eq("level", userPrefs.level)
      .eq("semester", userPrefs.semester)
      .order("course_code", { ascending: true });

    courseOptions = ((data ?? []) as CourseOption[])
      .filter((course) => course.course_code?.trim())
      .map((course) => ({
        id: String(course.id),
        course_code: course.course_code.trim().toUpperCase(),
        course_title: course.course_title ?? null,
      }));
  }

  const loadRepMeta = async () => {
    const { data: repRows, error } = await supabase
      .from("study_reps")
      .select("user_id, role")
      .eq("active", true);

    if (error) {
      return {
        repUserIds: new Set<string>(),
        repRoleMap: new Map<string, string>(),
      };
    }

    return {
      repUserIds: new Set<string>(
        ((repRows ?? []) as RepMetaRow[]).map((r) => String(r.user_id))
      ),
      repRoleMap: new Map<string, string>(
        ((repRows ?? []) as RepMetaRow[]).map((r) => [
          String(r.user_id),
          r.role === "dept_librarian" ? "Dept Librarian" : "Course Rep",
        ])
      ),
    };
  };

  let scopeLabel = "All of JABU";
  let selectedCourseCode: string | null = null;

  if (scope === "faculty" && userPrefs?.faculty_id) {
    scopeLabel = userPrefs.faculty ? `${userPrefs.faculty} Faculty` : "My Faculty";
  } else if (scope === "dept" && userPrefs?.department_id) {
    scopeLabel = userPrefs.department
      ? `${userPrefs.department} Dept.`
      : "My Department";
  } else if (scope === "level" && userPrefs?.level) {
    scopeLabel = `${userPrefs.level}L Students`;
  } else if (scope === "course") {
    const requestedNorm = normalizeCourseCode(requestedCourseCode);
    const matchedCourse = requestedNorm
      ? courseOptions.find((course) => normalizeCourseCode(course.course_code) === requestedNorm)
      : null;
    selectedCourseCode = matchedCourse?.course_code ?? courseOptions[0]?.course_code ?? requestedCourseCode?.trim().toUpperCase() ?? null;
    scopeLabel = selectedCourseCode ? `${selectedCourseCode} Course` : "Course";
  }

  const leaderboardResult = await supabase.rpc("get_study_leaderboard", {
    p_scope: scope,
    p_user_id: currentUserId,
    p_period: period,
    p_limit: 500,
    p_offset: 0,
    p_course_code: selectedCourseCode,
  });

  if (leaderboardResult.error) {
    const viewMissing =
      leaderboardResult.error.code === "42P01" ||
      leaderboardResult.error.code === "PGRST202" ||
      leaderboardResult.error.message.toLowerCase().includes("get_study_leaderboard") ||
      leaderboardResult.error.message.toLowerCase().includes("study_point_events") ||
      leaderboardResult.error.message.toLowerCase().includes("study_period_bounds");
    if (viewMissing) {
      return {
        rows: [],
        viewMissing: true,
        currentUserId,
        userPrefs,
        courseOptions,
        selectedCourseCode,
        scopeLabel,
        periodLabel: periodLabel(period),
        outsideTopNRow: null,
        profileMap: {},
        repUserIds: new Set<string>(),
        repRoleMap: new Map<string, string>(),
      };
    }
    throw new Error(leaderboardResult.error.message);
  }

  const allRows = ((leaderboardResult.data ?? []) as LeaderboardRpcRow[]).map((row) => ({
    user_id: row.user_id,
    email: row.email ?? "",
    questions: Number(row.questions ?? 0),
    question_upvotes: Number(row.question_upvotes ?? 0),
    answers: Number(row.answers ?? 0),
    accepted: Number(row.accepted ?? 0),
    practice_points: Number(row.practice_points ?? 0),
    practice_days: Number(row.practice_days ?? 0),
    points: Number(row.points ?? 0),
    rank: row.rank ?? null,
  }));
  const rows = allRows.slice(0, 50);

  let outsideTopNRow: { row: LeaderRow; rank: number } | null = null;
  if (currentUserId && !rows.some((r) => r.user_id === currentUserId)) {
    const myRow = allRows.find((row) => row.user_id === currentUserId);
    if (myRow) {
      outsideTopNRow = { row: myRow, rank: myRow.rank ?? allRows.findIndex((row) => row.user_id === currentUserId) + 1 };
    }
  }

  // Bulk-fetch real names from profiles for all visible user_ids
  const allIds = [
    ...rows.map((r) => r.user_id),
    ...(outsideTopNRow ? [outsideTopNRow.row.user_id] : []),
  ];
  const profileMap: ProfileMap = {};
  if (allIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,full_name,email")
      .in("id", allIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      const label =
        p.full_name?.trim() ||
        (p.email?.trim() ? p.email.split("@")[0] : "");
      if (label) profileMap[p.id] = label;
    }
  }

  const { repUserIds, repRoleMap } = await loadRepMeta();

  return {
    rows,
    viewMissing: false,
    currentUserId,
    userPrefs,
    courseOptions,
    selectedCourseCode,
    scopeLabel,
    periodLabel: periodLabel(period),
    outsideTopNRow,
    profileMap,
    repUserIds,
    repRoleMap,
  };
}

// ─── Leaderboard Filters ──────────────────────────────────────────────────────

function leaderboardHref(period: Period, scope: Scope, courseCode?: string | null) {
  const params = new URLSearchParams({ period, scope });
  if (scope === "course" && courseCode) params.set("course", courseCode);
  return `/study/leaderboard?${params.toString()}`;
}

function PeriodTabs({
  period,
  scope,
  courseCode,
}: {
  period: Period;
  scope: Scope;
  courseCode: string | null;
}) {
  const tabs: Array<{ key: Period; label: string }> = [
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "semester", label: "Semester" },
    { key: "session", label: "Session" },
    { key: "all", label: "All-time" },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = period === t.key;
        return (
          <Link
            key={t.key}
            href={leaderboardHref(t.key, scope, courseCode)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              "focus-visible:outline-none",
              active
                ? "border-white bg-white text-primary-text"
                : "border-white/25 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

function ScopeTabs({
  scope,
  period,
  userPrefs,
  courseCode,
  hasCourses,
}: {
  scope: Scope;
  period: Period;
  userPrefs: UserPrefs | null;
  courseCode: string | null;
  hasCourses: boolean;
}) {
  const tabs: Array<{ key: Scope; label: string; disabled?: boolean }> = [
    { key: "all", label: "All JABU" },
    {
      key: "faculty",
      label: userPrefs?.faculty ?? "My faculty",
      disabled: !userPrefs?.faculty_id,
    },
    {
      key: "dept",
      label: userPrefs?.department ?? "My dept",
      disabled: !userPrefs?.department_id,
    },
    {
      key: "level",
      label: userPrefs?.level ? `${userPrefs.level}L` : "My level",
      disabled: !userPrefs?.level,
    },
    {
      key: "course",
      label: courseCode ?? "Course",
      disabled: !hasCourses && !courseCode,
    },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = scope === t.key;
        const href = leaderboardHref(period, t.key, t.key === "course" ? courseCode : null);
        return (
          <Link
            key={t.key}
            href={t.disabled ? "#" : href}
            aria-disabled={t.disabled}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              "focus-visible:outline-none",
              active
                ? "border-white bg-white text-primary-text"
                : "border-white/25 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white",
              t.disabled && "pointer-events-none opacity-40"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

function CourseTabs({
  period,
  activeCourseCode,
  courses,
}: {
  period: Period;
  activeCourseCode: string | null;
  courses: CourseOption[];
}) {
  if (courses.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
      {courses.map((course) => {
        const active = normalizeCourseCode(activeCourseCode) === normalizeCourseCode(course.course_code);
        return (
          <Link
            key={course.id}
            href={leaderboardHref(period, "course", course.course_code)}
            title={course.course_title ?? course.course_code}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              "focus-visible:outline-none",
              active
                ? "border-white bg-white text-primary-text"
                : "border-white/25 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            )}
          >
            {course.course_code}
          </Link>
        );
      })}
    </div>
  );
}

// ─── My Rank Strip ────────────────────────────────────────────────────────────

function MyRankStrip({
  rank,
  points,
  name,
  pointsToNext,
}: {
  rank: number;
  points: number;
  name: string;
  pointsToNext: number | null;
}) {
  const inits = initials(name);
  return (
    <div className="flex items-center justify-between border-t border-white/15 px-5 py-3">
      <div className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/20 text-[11px] font-semibold text-white">
          {inits}
        </div>
        <span className="text-sm font-semibold text-white">{name}</span>
      </div>
      <div className="text-right">
        <span className="font-[family-name:var(--font-bricolage)] text-sm font-extrabold text-white">#{rank}</span>
        <span className="ml-2 text-xs text-white/60">{points.toLocaleString("en-NG")} pts</span>
        {pointsToNext != null && pointsToNext > 0 && (
          <p className="mt-0.5 text-[10px] font-semibold text-white/55">
            {pointsToNext.toLocaleString("en-NG")} to next rank
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function Podium({
  top3,
  currentUserId,
  profileMap,
}: {
  top3: LeaderRow[];
  currentUserId: string | null;
  profileMap: ProfileMap;
}) {
  if (top3.length === 0) return null;

  // Podium order: 2nd left, 1st center, 3rd right
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const ranks  = [2, 1, 3];
  const baseHeights = { 1: "h-14", 2: "h-10", 3: "h-7" };
  const baseColors  = { 1: "bg-primary", 2: "bg-[#888780]", 3: "bg-[#D85A30]" };
  const avatarSizes = { 1: "h-14 w-14 text-base", 2: "h-11 w-11 text-sm", 3: "h-10 w-10 text-xs" };
  const medals      = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <div className="flex items-end justify-center gap-2 px-4 pt-5 pb-0 bg-primary-light">
      {order.map((row, i) => {
        const rank = ranks[i] as 1 | 2 | 3;
        const isMe = row.user_id === currentUserId;
        const name = displayName(row.user_id, row.email, profileMap);
        const inits = initials(name);
        const firstName = name.split(" ")[0];

        return (
          <div
            key={row.user_id}
            id={isMe ? "my-rank" : undefined}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            {/* Avatar */}
            <div className="relative">
              <div
                className={cn(
                  "grid place-items-center rounded-full font-semibold text-white",
                  avatarSizes[rank],
                  isMe ? "bg-primary" : rank === 1 ? "bg-primary" : rank === 2 ? "bg-[#888780]" : "bg-[#D85A30]"
                )}
              >
                {inits}
              </div>
              {/* Flame badge for practice streak */}
              {row.practice_days >= 3 && (
                <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-primary-light bg-[#EF9F27] px-1 py-px text-[8px] font-bold text-[#412402]">
                  🔥{row.practice_days}d
                </span>
              )}
              {isMe && (
                <span className="absolute -top-1 -right-1 rounded-full border-2 border-primary-light bg-primary px-1 py-px text-[8px] font-bold text-white">
                  you
                </span>
              )}
            </div>

            {/* Name + pts */}
            <p className="max-w-[80px] truncate text-center text-xs font-semibold text-foreground">
              {firstName}
            </p>
            <p className={cn(
              "text-center text-[11px]",
              rank === 1 ? "font-extrabold text-primary-text" : "text-muted-brand"
            )}>
              {row.points.toLocaleString("en-NG")} pts
            </p>

            {/* Podium base */}
            <div
              className={cn(
                "flex w-full items-center justify-center rounded-t-lg text-base",
                baseHeights[rank],
                baseColors[rank]
              )}
            >
              {medals[rank]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Rank Row ─────────────────────────────────────────────────────────────────

function RankRow({
  row,
  rank,
  isCurrentUser,
  name,
  repUserIds,
  repRoleMap,
}: {
  row: LeaderRow;
  rank: number;
  isCurrentUser: boolean;
  name: string;
  repUserIds: Set<string>;
  repRoleMap: Map<string, string>;
}) {
  const inits = initials(name);
  const streakLabel = row.practice_days >= 3 ? `🔥 ${row.practice_days}d` : null;

  return (
    <div
      id={isCurrentUser ? "my-rank" : undefined}
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors",
        isCurrentUser
          ? "border-primary/30 bg-primary-light"
          : "border-border bg-background hover:bg-secondary/30"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className={cn(
          "w-6 shrink-0 text-center text-xs font-semibold",
          isCurrentUser ? "text-primary" : "text-muted-brand"
        )}>
          {rank}
        </span>

        <div
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white",
            isCurrentUser ? "bg-primary" : "bg-secondary"
          )}
          style={isCurrentUser ? {} : { background: "var(--color-background-tertiary)", color: "var(--color-text-secondary)" }}
        >
          {inits}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={cn(
              "truncate text-sm font-semibold",
              isCurrentUser ? "text-primary-text" : "text-foreground"
            )}>
              {name}
            </p>
            {repUserIds.has(row.user_id) && (
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                "border border-primary/30 bg-primary-light",
                "text-[10px] font-semibold text-primary-text",
                "dark:border-primary/40 dark:bg-primary/10",
                "dark:text-indigo-200"
              )}>
                <ShieldCheck
                  style={{ width: 10, height: 10 }}
                  className="text-primary dark:text-indigo-300"
                />
                {repRoleMap.get(row.user_id) ?? "Course Rep"}
              </span>
            )}
            {isCurrentUser && (
              <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9px] font-bold text-white">
                you
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-brand">
            {row.accepted > 0 ? `${row.accepted} accepted · ` : ""}
            {row.answers} answers
            {streakLabel ? ` · ${streakLabel}` : ""}
          </p>
          <div className="mt-1.5">
            <PointsBreakdown row={row} />
          </div>
        </div>

        <p className={cn(
          "shrink-0 text-sm font-extrabold",
          isCurrentUser ? "text-primary-text" : "text-foreground"
        )}>
          {row.points.toLocaleString("en-NG")} pts
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: { scope?: string; period?: string; course?: string };
}) {
  const entryState = await getLeaderboardEntryState();
  const rawScope = (searchParams?.scope ?? "").toLowerCase();
  const rawPeriod = (searchParams?.period ?? "").toLowerCase();
  const rawCourse = (searchParams?.course ?? "").trim();
  const period: Period =
    rawScope === "week"
      ? "week"
      : rawPeriod === "month" || rawPeriod === "semester" || rawPeriod === "session" || rawPeriod === "all"
        ? rawPeriod
        : "week";
  const scope: Scope =
    rawScope === "week"
      ? "all"
      : rawScope === "faculty" || rawScope === "dept" || rawScope === "level" || rawScope === "course" || rawScope === "all"
        ? rawScope
        : entryState.profileComplete
          ? "dept"
          : "all";

  let rows: LeaderRow[] = [];
  let fetchError: string | null = null;
  let viewMissing = false;
  let currentUserId: string | null = null;
  let userPrefs: UserPrefs | null = null;
  let courseOptions: CourseOption[] = [];
  let selectedCourseCode: string | null = null;
  let scopeLabel = "All of JABU";
  let activePeriodLabel = periodLabel(period);
  let outsideTopNRow: { row: LeaderRow; rank: number } | null = null;
  let profileMap: ProfileMap = {};
  let repUserIds = new Set<string>();
  let repRoleMap = new Map<string, string>();

  try {
    const result = await fetchLeaderboard(scope, period, rawCourse || null);
    rows = result.rows;
    viewMissing = result.viewMissing;
    currentUserId = result.currentUserId;
    userPrefs = result.userPrefs;
    courseOptions = result.courseOptions;
    selectedCourseCode = result.selectedCourseCode;
    scopeLabel = result.scopeLabel;
    activePeriodLabel = result.periodLabel;
    outsideTopNRow = result.outsideTopNRow;
    profileMap = result.profileMap;
    repUserIds = result.repUserIds;
    repRoleMap = result.repRoleMap;
  } catch (e: unknown) {
    fetchError = e instanceof Error ? e.message : "Failed to load leaderboard";
  }

  const top3 = rows.slice(0, 3) as Array<LeaderRow & { rank: 1 | 2 | 3 }>;
  const rest = rows.slice(3);

  const myRankIndex = currentUserId
    ? rows.findIndex((r) => r.user_id === currentUserId)
    : -1;
  const myRow = myRankIndex >= 0 ? rows[myRankIndex] : null;
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

  const activeUserRow = myRow ?? outsideTopNRow?.row ?? null;
  const activeUserRank = myRank ?? outsideTopNRow?.rank ?? null;
  const myName = activeUserRow
    ? displayName(activeUserRow.user_id, activeUserRow.email, profileMap)
    : null;
  const showStickyBar = !!currentUserId && !!activeUserRow && !!activeUserRank && !fetchError && !viewMissing;
  const pointsToNext =
    myRank && myRank > 1 && myRow && rows[myRank - 2]?.points > myRow.points
      ? rows[myRank - 2].points - myRow.points + 1
      : null;

  // Show a hint when dept/level scope finds no one (user is alone or prefs missing)
  const scopeEmpty = !fetchError && rows.length === 0 && scope !== "all";
  const noPrefsForScope =
    (scope === "faculty" && !userPrefs?.faculty_id) ||
    (scope === "dept" && !userPrefs?.department_id) ||
    (scope === "level" && !userPrefs?.level) ||
    (scope === "course" && courseOptions.length === 0 && !selectedCourseCode);

  return (
    <div className="space-y-3 pb-28 md:pb-6">

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-border bg-primary shadow-sm">
        <div className="px-5 pt-5 pb-4">
          {/* Nav row */}
          <div className="mb-4 flex items-center justify-between">
            <Link
              href="/study"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white no-underline hover:bg-white/25"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
            <HowPointsWork />
          </div>

          {/* Title */}
          <h1 className="font-[family-name:var(--font-bricolage)] text-2xl font-extrabold tracking-tight text-white">Leaderboard</h1>
          <p className="mt-1 text-xs text-white/60">
            Top contributors · {activePeriodLabel} · {scopeLabel}
          </p>

          {/* Filter chips */}
          <div className="mt-4 space-y-2">
            <PeriodTabs period={period} scope={scope} courseCode={selectedCourseCode} />
            <ScopeTabs
              scope={scope}
              period={period}
              userPrefs={userPrefs}
              courseCode={selectedCourseCode}
              hasCourses={courseOptions.length > 0}
            />
            {scope === "course" && (
              <CourseTabs
                period={period}
                activeCourseCode={selectedCourseCode}
                courses={courseOptions}
              />
            )}
          </div>
        </div>

        {/* Error / viewMissing banners */}
        {fetchError && (
          <div className="mx-4 mb-4 rounded-2xl border border-rose-300/40 bg-rose-100/20 p-3 text-sm text-white">
            {fetchError}
          </div>
        )}
        {viewMissing && (
          <div className="mx-4 mb-4 rounded-2xl border border-amber-300/40 bg-amber-100/20 p-3 text-xs text-white/80">
            <p className="font-semibold text-white">Leaderboard view not set up yet.</p>
            <p className="mt-0.5">
              Run migration{" "}
              <code className="rounded bg-white/20 px-1">20260529_leaderboard_faculty_course_scopes.sql</code>{" "}
              in your Supabase SQL editor.
            </p>
          </div>
        )}

        {/* My rank strip — shown only when user has a rank */}
        {showStickyBar && myName && activeUserRank && activeUserRow && (
          <MyRankStrip
            rank={activeUserRank}
            points={activeUserRow.points}
            name={myName}
            pointsToNext={pointsToNext}
          />
        )}
        {currentUserId && !fetchError && !viewMissing && !activeUserRow && (
          <div className="border-t border-white/15 px-5 py-3 text-xs text-white/60">
            Answer a question to earn your first points and appear here.
          </div>
        )}
      </div>

      {/* No prefs hint */}
      {noPrefsForScope && (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-sm dark:border-amber-800/40 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {scope === "faculty"
              ? "Faculty not set"
              : scope === "dept"
                ? "Department not set"
                : scope === "course"
                  ? "Courses unavailable"
                  : "Level not set"}
          </p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            Set your {scope === "faculty" ? "faculty" : scope === "dept" ? "department" : scope === "course" ? "department, level, and semester" : "level"} in{" "}
            <Link href="/study/onboarding" className="underline underline-offset-2">
              Study Preferences
            </Link>{" "}
            to see a scoped leaderboard.
          </p>
        </div>
      )}

      {/* Top 3 in top badge for current user */}
      {myRow && myRank && myRank <= 3 && (
        <div className="rounded-2xl border border-primary/20 bg-primary-light px-4 py-3 text-sm font-semibold text-primary-text">
          You are in the top 3 — your entry is highlighted in the podium below.
        </div>
      )}

      {/* Empty state */}
      {!fetchError && rows.length === 0 && !viewMissing && (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            {scopeEmpty ? "No activity in this scope yet" : "No activity yet"}
          </p>
          <p className="mt-1 text-sm text-muted-brand">
            {scopeEmpty
              ? "Be the first to earn points here — ask questions, answer peers, and practice."
              : "Once people start asking and answering questions, top helpers will appear here."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/study/questions/ask"
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white no-underline hover:opacity-90"
            >
              Ask a question
            </Link>
            {scopeEmpty && (
              <Link
                href={leaderboardHref(period, "all")}
                className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground no-underline hover:bg-secondary/50"
              >
                View all of JABU
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Podium ─────────────────────────────────────────────────────── */}
      {top3.length > 0 && (
        <Podium top3={top3} currentUserId={currentUserId} profileMap={profileMap} />
      )}

      {/* ── Rank list ──────────────────────────────────────────────────── */}
      {(rest.length > 0 || outsideTopNRow) && (
        <div className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-brand">
            Rankings 4 – {rows.length}
          </p>

          {rest.map((r, i) => (
            <RankRow
              key={r.user_id}
              row={r}
              rank={i + 4}
              isCurrentUser={r.user_id === currentUserId}
              name={displayName(r.user_id, r.email, profileMap)}
              repUserIds={repUserIds}
              repRoleMap={repRoleMap}
            />
          ))}

          {/* Pinned user row — shown when user is outside the visible list */}
          {outsideTopNRow && (
            <>
              <div className="border-t-2 border-dashed border-border pt-1" />
              <RankRow
                row={outsideTopNRow.row}
                rank={outsideTopNRow.rank}
                isCurrentUser
                name={displayName(outsideTopNRow.row.user_id, outsideTopNRow.row.email, profileMap)}
                repUserIds={repUserIds}
                repRoleMap={repRoleMap}
              />
            </>
          )}
        </div>
      )}

    </div>
  );
}
