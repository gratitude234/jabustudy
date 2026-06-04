import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import type { StudyModeratorScope } from "@/lib/studyAdmin/requireStudyModerator";

const DAY_MS = 86_400_000;
const WAT_OFFSET_MS = 3_600_000;
const MAX_SCAN_ROWS = 20000;

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url?: string | null;
  created_at: string | null;
};

type PrefRow = {
  user_id: string;
  faculty: string | null;
  department: string | null;
  level: number | null;
  semester: string | null;
  faculty_id: string | null;
  department_id: string | null;
};

type ActivityRow = {
  user_id: string | null;
  activity_date: string | null;
  attempts_count: number | null;
  questions_answered: number | null;
};

type AttemptRow = {
  user_id: string | null;
  status: string | null;
  score: number | null;
  total_questions: number | null;
};

type UploadRow = {
  uploader_id: string | null;
};

type CommunityRow = {
  user_id: string;
  whatsapp_join_clicked_at: string | null;
  whatsapp_join_confirmed_at: string | null;
  whatsapp_dismissed_until: string | null;
};

type UserAggregate = {
  lastActiveDate: string | null;
  activeToday: boolean;
  activeThisWeek: boolean;
  streak: number;
  practiceSessions: number;
  avgScore: number | null;
  uploadedMaterials: number;
  communityStatus: "joined" | "clicked" | "dismissed" | "not_joined";
};

function watDateFromMs(ms: number) {
  return new Date(ms + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.trunc(parsed));
}

function addToSet(target: Set<string> | null, values: Iterable<string>) {
  const next = target ?? new Set<string>();
  for (const value of values) {
    if (value) next.add(value);
  }
  return next;
}

function intersectSet(target: Set<string> | null, values: Iterable<string>) {
  const valueSet = values instanceof Set ? values : new Set(values);
  if (target === null) return new Set(valueSet);
  for (const value of Array.from(target)) {
    if (!valueSet.has(value)) target.delete(value);
  }
  return target;
}

function scopeAllowsPrefs(scope: StudyModeratorScope, pref: PrefRow) {
  if (scope.role === "super") return true;
  if (!scope.departmentId || pref.department_id !== scope.departmentId) return false;
  if (scope.facultyId && pref.faculty_id !== scope.facultyId) return false;
  if (scope.role === "dept_librarian") return true;
  if (!scope.levels?.length || typeof pref.level !== "number") return false;
  return scope.levels.includes(pref.level);
}

function calculateStreak(activeDates: Set<string>) {
  const todayKey = watDateFromMs(Date.now());
  const didToday = activeDates.has(todayKey);
  let cursorMs = didToday ? Date.now() : Date.now() - DAY_MS;
  let streak = 0;

  for (let i = 0; i < 400; i++) {
    const key = watDateFromMs(cursorMs);
    if (!activeDates.has(key)) break;
    streak += 1;
    cursorMs -= DAY_MS;
  }

  return streak;
}

function communityStatus(row: CommunityRow | undefined): UserAggregate["communityStatus"] {
  if (!row) return "not_joined";
  if (row.whatsapp_join_confirmed_at) return "joined";
  if (row.whatsapp_join_clicked_at) return "clicked";
  if (row.whatsapp_dismissed_until) return "dismissed";
  return "not_joined";
}

function blankAggregate(): UserAggregate {
  return {
    lastActiveDate: null,
    activeToday: false,
    activeThisWeek: false,
    streak: 0,
    practiceSessions: 0,
    avgScore: null,
    uploadedMaterials: 0,
    communityStatus: "not_joined",
  };
}

export async function GET(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const admin = createSupabaseAdminClient();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const departmentId = (url.searchParams.get("departmentId") ?? "").trim();
    const levelFilter = url.searchParams.get("level");
    const activity = url.searchParams.get("activity") ?? "all";
    const hasUploads = url.searchParams.get("hasUploads") === "1";
    const community = url.searchParams.get("community") ?? "all";
    const page = parsePositiveInt(url.searchParams.get("page"), 1, 10000);
    const limit = parsePositiveInt(url.searchParams.get("limit"), 25, 100);
    const todayKey = watDateFromMs(Date.now());
    const weekStartKey = watDateFromMs(Date.now() - 6 * DAY_MS);

    const [{ data: profileRows, error: profileError }, { data: prefRows, error: prefError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id,email,full_name,avatar_url,created_at")
          .order("created_at", { ascending: false })
          .limit(MAX_SCAN_ROWS),
        admin
          .from("study_preferences")
          .select("user_id,faculty,department,level,semester,faculty_id,department_id")
          .limit(MAX_SCAN_ROWS),
      ]);

    if (profileError) throw profileError;
    if (prefError) throw prefError;

    const profiles = ((profileRows ?? []) as ProfileRow[]).filter((row) => row.id);
    const prefs = ((prefRows ?? []) as PrefRow[]).filter((row) => row.user_id);
    const prefByUser = new Map(prefs.map((row) => [row.user_id, row]));
    let candidateIds: Set<string> | null = null;

    if (scope.role !== "super" || departmentId || levelFilter) {
      const scopedPrefIds = prefs
        .filter((pref) => scopeAllowsPrefs(scope, pref))
        .filter((pref) => !departmentId || pref.department_id === departmentId)
        .filter((pref) => !levelFilter || String(pref.level ?? "") === levelFilter)
        .map((pref) => pref.user_id);
      candidateIds = intersectSet(candidateIds, scopedPrefIds);
    }

    if (q) {
      const matchingProfileIds = profiles
        .filter((profile) => {
          const haystack = `${profile.full_name ?? ""} ${profile.email ?? ""}`.toLowerCase();
          return haystack.includes(q);
        })
        .map((profile) => profile.id);
      candidateIds = intersectSet(candidateIds, matchingProfileIds);
    }

    const profileIds = profiles.map((profile) => profile.id);
    const userIdsForQueries = candidateIds ? Array.from(candidateIds) : profileIds;

    const [
      activityRes,
      attemptRes,
      uploadRes,
      communityRes,
    ] = await Promise.all([
      userIdsForQueries.length
        ? admin
            .from("study_daily_activity")
            .select("user_id,activity_date,attempts_count,questions_answered")
            .in("user_id", userIdsForQueries)
            .order("activity_date", { ascending: false })
            .limit(MAX_SCAN_ROWS)
        : Promise.resolve({ data: [], error: null }),
      userIdsForQueries.length
        ? admin
            .from("study_practice_attempts")
            .select("user_id,status,score,total_questions")
            .in("user_id", userIdsForQueries)
            .eq("status", "submitted")
            .limit(MAX_SCAN_ROWS)
        : Promise.resolve({ data: [], error: null }),
      userIdsForQueries.length
        ? admin
            .from("study_materials")
            .select("uploader_id")
            .in("uploader_id", userIdsForQueries)
            .limit(MAX_SCAN_ROWS)
        : Promise.resolve({ data: [], error: null }),
      userIdsForQueries.length
        ? admin
            .from("user_community_status")
            .select("user_id,whatsapp_join_clicked_at,whatsapp_join_confirmed_at,whatsapp_dismissed_until")
            .in("user_id", userIdsForQueries)
            .limit(MAX_SCAN_ROWS)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const activityRows = activityRes.error ? [] : (activityRes.data ?? []) as ActivityRow[];
    const attemptRows = attemptRes.error ? [] : (attemptRes.data ?? []) as AttemptRow[];
    const uploadRows = uploadRes.error ? [] : (uploadRes.data ?? []) as UploadRow[];
    const communityRows = communityRes.error ? [] : (communityRes.data ?? []) as CommunityRow[];

    const datesByUser = new Map<string, Set<string>>();
    const lastActiveByUser = new Map<string, string>();
    for (const row of activityRows) {
      const userId = row.user_id ? String(row.user_id) : "";
      const date = row.activity_date ? String(row.activity_date).slice(0, 10) : "";
      const hasActivity = Number(row.attempts_count ?? 0) > 0 || Number(row.questions_answered ?? 0) > 0;
      if (!userId || !date || !hasActivity) continue;
      if (!datesByUser.has(userId)) datesByUser.set(userId, new Set());
      datesByUser.get(userId)?.add(date);
      const currentLast = lastActiveByUser.get(userId);
      if (!currentLast || date > currentLast) lastActiveByUser.set(userId, date);
    }

    const attemptStats = new Map<string, { sessions: number; scorePctSum: number; scored: number }>();
    for (const row of attemptRows) {
      const userId = row.user_id ? String(row.user_id) : "";
      if (!userId) continue;
      const current = attemptStats.get(userId) ?? { sessions: 0, scorePctSum: 0, scored: 0 };
      current.sessions += 1;
      const total = Number(row.total_questions ?? 0);
      const score = Number(row.score ?? 0);
      if (total > 0) {
        current.scorePctSum += (score / total) * 100;
        current.scored += 1;
      }
      attemptStats.set(userId, current);
    }

    const uploadCount = new Map<string, number>();
    for (const row of uploadRows) {
      const userId = row.uploader_id ? String(row.uploader_id) : "";
      if (!userId) continue;
      uploadCount.set(userId, (uploadCount.get(userId) ?? 0) + 1);
    }

    const communityByUser = new Map(communityRows.map((row) => [row.user_id, row]));
    const aggregates = new Map<string, UserAggregate>();
    for (const userId of userIdsForQueries) {
      const activeDates = datesByUser.get(userId) ?? new Set<string>();
      const stats = attemptStats.get(userId);
      aggregates.set(userId, {
        ...blankAggregate(),
        lastActiveDate: lastActiveByUser.get(userId) ?? null,
        activeToday: activeDates.has(todayKey),
        activeThisWeek: Array.from(activeDates).some((date) => date >= weekStartKey),
        streak: calculateStreak(activeDates),
        practiceSessions: stats?.sessions ?? 0,
        avgScore: stats && stats.scored > 0 ? Math.round(stats.scorePctSum / stats.scored) : null,
        uploadedMaterials: uploadCount.get(userId) ?? 0,
        communityStatus: communityStatus(communityByUser.get(userId)),
      });
    }

    let filteredProfiles = profiles.filter((profile) => {
      if (candidateIds && !candidateIds.has(profile.id)) return false;
      const agg = aggregates.get(profile.id) ?? blankAggregate();
      if (activity === "today" && !agg.activeToday) return false;
      if (activity === "week" && !agg.activeThisWeek) return false;
      if (activity === "inactive" && agg.activeThisWeek) return false;
      if (hasUploads && agg.uploadedMaterials <= 0) return false;
      if (community !== "all" && agg.communityStatus !== community) return false;
      return true;
    });

    filteredProfiles = filteredProfiles.sort((a, b) => {
      const aAgg = aggregates.get(a.id);
      const bAgg = aggregates.get(b.id);
      const aDate = aAgg?.lastActiveDate ?? a.created_at ?? "";
      const bDate = bAgg?.lastActiveDate ?? b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });

    const total = filteredProfiles.length;
    const start = (page - 1) * limit;
    const pageProfiles = filteredProfiles.slice(start, start + limit);

    return NextResponse.json({
      ok: true,
      users: pageProfiles.map((profile) => {
        const pref = prefByUser.get(profile.id);
        const agg = aggregates.get(profile.id) ?? blankAggregate();
        return {
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url ?? null,
          createdAt: profile.created_at,
          faculty: pref?.faculty ?? null,
          department: pref?.department ?? null,
          level: pref?.level ?? null,
          semester: pref?.semester ?? null,
          facultyId: pref?.faculty_id ?? null,
          departmentId: pref?.department_id ?? null,
          ...agg,
        };
      }),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      { ok: false, code: error?.code, message: error?.message ?? "Could not load users." },
      { status }
    );
  }
}
