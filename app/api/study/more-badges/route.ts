import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StudyHomeMoreBadgeTone } from "@/lib/studyAnalytics.types";

type StudyPrefsRow = {
  department: string | null;
  department_id: string | null;
  level: number | null;
  last_study_plan: string | null;
  last_study_plan_at: string | null;
};

type Badge = {
  label: string;
  tone: StudyHomeMoreBadgeTone;
};

type BadgeRow = {
  subtitle: string;
  badge: Badge | null;
};

type ApplyRepBadgeRow = BadgeRow & {
  hidden: boolean;
};

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function sevenDaysAgoIso() {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

function lastWeekWatIso() {
  return new Date(Date.now() + 3_600_000 - 7 * 86_400_000).toISOString();
}

function truncatePlanHint(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (normalized.startsWith("{") || normalized.startsWith("[")) return null;

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (parsed && typeof parsed === "object") return null;
  } catch {
    // plain text is fine
  }

  if (normalized.length <= 30) return normalized;
  return `${normalized.slice(0, 30).trimEnd()}...`;
}

async function lastSeenFor(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  area: string
) {
  const { data } = await supabase
    .from("study_user_badge_state")
    .select("last_seen_at")
    .eq("user_id", userId)
    .eq("area", area)
    .maybeSingle();

  if (data?.last_seen_at) return data.last_seen_at;
  return sevenDaysAgoIso();
}

async function resolveAiPlan(prefs: StudyPrefsRow | null): Promise<BadgeRow> {
  const lastPlanAt = prefs?.last_study_plan_at;
  if (!lastPlanAt) {
    return { subtitle: "Build a week-by-week schedule", badge: null };
  }

  const isRecent = Date.now() - new Date(lastPlanAt).getTime() <= 14 * 86_400_000;
  if (!isRecent) {
    return { subtitle: "Build a week-by-week schedule", badge: null };
  }

  const hint = prefs?.last_study_plan ? truncatePlanHint(prefs.last_study_plan) : null;
  return {
    subtitle: hint ? `Plan active - ${hint}` : "Plan active",
    badge: null,
  };
}

async function resolveQaForum(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  prefs: StudyPrefsRow | null
): Promise<BadgeRow> {
  const since = await lastSeenFor(supabase, userId, "qa_forum");
  let query = supabase
    .from("study_questions")
    .select("id", { count: "exact", head: true })
    .gt("created_at", since);

  if (prefs?.department) query = query.eq("department", prefs.department);
  if (prefs?.level != null) query = query.eq("level", String(prefs.level));

  const { count, error } = await query;
  if (error) throw error;

  const nextCount = Math.min(count ?? 0, 99);
  return {
    subtitle: "Ask your coursemates",
    badge:
      nextCount > 0
        ? {
            label: nextCount >= 99 ? "99+ new" : `${nextCount} new`,
            tone: "count",
          }
        : null,
  };
}

async function resolveLeaderboard(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<BadgeRow> {
  const [{ data: leaderboardRow, error: leaderboardError }, { count: weekSessions, error: weekError }] =
    await Promise.all([
      supabase
        .from("study_leaderboard_v")
        .select("points")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("study_practice_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "submitted")
        .gt("created_at", lastWeekWatIso()),
    ]);

  if (leaderboardError) throw leaderboardError;
  if (weekError) throw weekError;

  let rank: number | null = null;
  if (leaderboardRow) {
    const points = typeof leaderboardRow.points === "number" ? leaderboardRow.points : 0;
    const { count, error: rankError } = await supabase
      .from("study_leaderboard_v")
      .select("user_id", { count: "exact", head: true })
      .gt("points", points);

    if (rankError) throw rankError;
    rank = (count ?? 0) + 1;
    if (points === 0 && rank > 100) rank = null;
  }

  return {
    subtitle: rank ? `You're #${rank}` : "Climb the ranks",
    badge:
      (weekSessions ?? 0) > 0
        ? {
            label: `${weekSessions} this week`,
            tone: "count",
          }
        : null,
  };
}

async function resolveTutors(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  prefs: StudyPrefsRow | null
): Promise<BadgeRow> {
  if (!prefs?.department) {
    return { subtitle: "Book 1:1 help", badge: null };
  }

  const { count, error } = await supabase
    .from("study_tutors")
    .select("id", { count: "exact", head: true })
    .ilike("department", prefs.department)
    .or("verified.eq.true,is_verified.eq.true,approved.eq.true");

  if (error) throw error;

  return {
    subtitle: (count ?? 0) > 0 ? `${count} verified in your dept` : "Book 1:1 help",
    badge: null,
  };
}

async function resolveApplyRep(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<ApplyRepBadgeRow> {
  const { data: repRow, error: repError } = await supabase
    .from("study_reps")
    .select("user_id,active")
    .eq("user_id", userId)
    .maybeSingle();

  if (repError) throw repError;
  if (repRow?.user_id && repRow.active !== false) {
    return { subtitle: "Upload for your department", badge: null, hidden: true };
  }

  const { data: appRow, error: appError } = await supabase
    .from("study_rep_applications")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (appError) throw appError;
  if (!appRow?.status) {
    return { subtitle: "Upload for your department", badge: null, hidden: false };
  }

  if (appRow.status === "pending") {
    return {
      subtitle: "Awaiting review",
      badge: { label: "Pending", tone: "status" },
      hidden: false,
    };
  }

  if (appRow.status === "rejected") {
    return {
      subtitle: "Try again with stronger evidence",
      badge: { label: "Reapply", tone: "status" },
      hidden: false,
    };
  }

  return { subtitle: "Upload for your department", badge: null, hidden: false };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (!userId) {
    return jsonError("Sign in first", 401, "unauthorized");
  }

  const { data: prefsData } = await supabase
    .from("study_preferences")
    .select("department, department_id, level, last_study_plan, last_study_plan_at")
    .eq("user_id", userId)
    .maybeSingle();

  const prefs = (prefsData as StudyPrefsRow | null) ?? null;

  const [aiPlan, qaForum, leaderboard, tutors, applyRep] = await Promise.all([
    resolveAiPlan(prefs).catch(() => ({
      subtitle: "Build a week-by-week schedule",
      badge: null,
    })),
    resolveQaForum(supabase, userId, prefs).catch(() => ({
      subtitle: "Ask your coursemates",
      badge: null,
    })),
    resolveLeaderboard(supabase, userId).catch(() => ({
      subtitle: "Climb the ranks",
      badge: null,
    })),
    resolveTutors(supabase, prefs).catch(() => ({
      subtitle: "Book 1:1 help",
      badge: null,
    })),
    resolveApplyRep(supabase, userId).catch(() => ({
      subtitle: "Upload for your department",
      badge: null,
      hidden: false,
    })),
  ]);

  const response = NextResponse.json({
    ok: true,
    badges: {
      ai_plan: aiPlan,
      qa_forum: qaForum,
      gpa: { subtitle: "Track grades across semesters", badge: null },
      leaderboard,
      tutors,
      apply_rep: applyRep,
    },
  });

  response.headers.set(
    "Cache-Control",
    "private, max-age=60, stale-while-revalidate=300"
  );

  return response;
}
