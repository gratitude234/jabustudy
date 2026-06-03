import { NextResponse } from "next/server";
import { requireStudyModeratorFromRequest } from "../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import type { StudyModeratorScope } from "@/lib/studyAdmin/requireStudyModerator";

const SETUP_LEVELS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const SETUP_SEMESTERS = ["first", "second", "summer"] as const;
const DAY_MS = 86_400_000;
const WAT_OFFSET_MS = 3_600_000;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type CourseScopeRow = {
  id: string;
  course_code: string | null;
  level: number | null;
};

type DailyActivityRow = {
  user_id: string | null;
  activity_date: string | null;
};

type ActionQueueItem = {
  key: string;
  label: string;
  value: number;
  href: string;
  tone: "default" | "warning" | "danger";
};

function watDateFromMs(ms: number) {
  return new Date(ms + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

function watDayStartUtcIso(dateKey = watDateFromMs(Date.now())) {
  return new Date(`${dateKey}T00:00:00+01:00`).toISOString();
}

function countFrom(res: { count: number | null; error: unknown }) {
  if (res.error) return 0;
  return res.count ?? 0;
}

function applyScopeToCourseQuery(query: any, scope: StudyModeratorScope) {
  if (scope.role === "super") return query;
  if (scope.departmentId) query = query.eq("department_id", scope.departmentId);
  if (scope.facultyId) query = query.eq("faculty_id", scope.facultyId);
  if (scope.role === "course_rep" && scope.levels?.length) query = query.in("level", scope.levels);
  return query;
}

function applyScopeToMaterialQuery(query: any, scope: StudyModeratorScope) {
  if (scope.role === "super") return query;
  if (scope.departmentId) query = query.eq("study_courses.department_id", scope.departmentId);
  if (scope.facultyId) query = query.eq("study_courses.faculty_id", scope.facultyId);
  if (scope.role === "course_rep" && scope.levels?.length) query = query.in("study_courses.level", scope.levels);
  return query;
}

async function getScopedUsers(admin: AdminClient, scope: StudyModeratorScope) {
  if (scope.role === "super") return null;

  let query = admin
    .from("study_preferences")
    .select("user_id")
    .not("user_id", "is", null);

  if (scope.departmentId) query = query.eq("department_id", scope.departmentId);
  if (scope.facultyId) query = query.eq("faculty_id", scope.facultyId);
  if (scope.role === "course_rep" && scope.levels?.length) query = query.in("level", scope.levels);

  const { data, error } = await query.limit(5000);
  if (error || !Array.isArray(data)) return [];

  return Array.from(
    new Set(
      data
        .map((row) => String((row as { user_id?: string | null }).user_id ?? ""))
        .filter(Boolean)
    )
  );
}

async function getScopedCourses(admin: AdminClient, scope: StudyModeratorScope) {
  let query = admin
    .from("study_courses")
    .select("id,course_code,level")
    .eq("status", "approved");

  query = applyScopeToCourseQuery(query, scope);

  const { data, error } = await query.limit(5000);
  if (error || !Array.isArray(data)) return [];
  return data as CourseScopeRow[];
}

function applyUserScope(query: any, scopedUserIds: string[] | null) {
  if (scopedUserIds === null) return query;
  if (scopedUserIds.length === 0) return null;
  return query.in("user_id", scopedUserIds);
}

async function countRows(query: any) {
  if (!query) return 0;
  return countFrom(await query);
}

async function countActiveUsers(admin: AdminClient, scopedUserIds: string[] | null) {
  const today = watDateFromMs(Date.now());
  const weekStart = watDateFromMs(Date.now() - 6 * DAY_MS);

  let query: any = admin
    .from("study_daily_activity")
    .select("user_id,activity_date")
    .gte("activity_date", weekStart)
    .order("activity_date", { ascending: false })
    .limit(10000);

  query = applyUserScope(query, scopedUserIds);
  if (!query) return { today: 0, week: 0 };

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return { today: 0, week: 0 };

  const todayUsers = new Set<string>();
  const weekUsers = new Set<string>();

  for (const row of data as DailyActivityRow[]) {
    const userId = row.user_id ? String(row.user_id) : "";
    if (!userId) continue;
    weekUsers.add(userId);
    if (String(row.activity_date ?? "").slice(0, 10) === today) todayUsers.add(userId);
  }

  return { today: todayUsers.size, week: weekUsers.size };
}

async function getPendingMaterialsCount(admin: AdminClient, scope: StudyModeratorScope) {
  let query = admin
    .from("study_materials")
    .select("id, study_courses!inner(id, faculty_id, department_id, level)", { count: "exact", head: true })
    .eq("approved", false);

  query = applyScopeToMaterialQuery(query, scope);
  return countRows(query);
}

async function getMaterialsCount(admin: AdminClient, scope: StudyModeratorScope, extra?: (query: any) => any) {
  let query = admin
    .from("study_materials")
    .select("id, study_courses!inner(id, faculty_id, department_id, level)", { count: "exact", head: true });

  query = applyScopeToMaterialQuery(query, scope);
  if (extra) query = extra(query);
  return countRows(query);
}

async function getPendingRequestsCount(admin: AdminClient, scope: StudyModeratorScope) {
  let query = admin
    .from("study_course_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (scope.role !== "super") {
    if (scope.departmentId) query = query.eq("department_id", scope.departmentId);
    if (scope.facultyId) query = query.eq("faculty_id", scope.facultyId);
    if (scope.role === "course_rep" && scope.levels?.length) query = query.in("level", scope.levels);
  }

  return countRows(query);
}

async function getQuizSetCount(admin: AdminClient, scope: StudyModeratorScope, scopedCourses: CourseScopeRow[]) {
  let query = admin
    .from("study_quiz_sets")
    .select("id", { count: "exact", head: true });

  if (scope.role !== "super") {
    const codes = Array.from(new Set(scopedCourses.map((row) => row.course_code).filter(Boolean))) as string[];
    if (codes.length === 0) return 0;
    query = query.in("course_code", codes);
    if (scope.role === "course_rep" && scope.levels?.length) {
      query = query.in("level", scope.levels.map((level) => String(level)));
    }
  }

  return countRows(query);
}

async function getAiGenerationCountToday(admin: AdminClient, scope: StudyModeratorScope, scopedCourses: CourseScopeRow[]) {
  const todayStart = watDayStartUtcIso();

  let draftsQuery = admin
    .from("study_quiz_sets")
    .select("id", { count: "exact", head: true })
    .not("generation_config", "is", null)
    .gte("created_at", todayStart);

  let bankQuery = admin
    .from("study_question_bank_runs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStart);

  if (scope.role !== "super") {
    const courseIds = scopedCourses.map((row) => row.id).filter(Boolean);
    const codes = Array.from(new Set(scopedCourses.map((row) => row.course_code).filter(Boolean))) as string[];
    if (codes.length === 0 && courseIds.length === 0) return 0;
    if (codes.length) draftsQuery = draftsQuery.in("course_code", codes);
    if (courseIds.length) bankQuery = bankQuery.in("course_id", courseIds);
  }

  const [drafts, bankRuns] = await Promise.all([countRows(draftsQuery), countRows(bankQuery)]);
  return drafts + bankRuns;
}

async function getCourseSetup(admin: AdminClient, scope: StudyModeratorScope) {
  if (scope.role === "super" || !scope.departmentId) return [];

  const levels = scope.role === "course_rep" ? scope.levels ?? [] : SETUP_LEVELS;
  if (levels.length === 0) return [];

  const [{ data: courses, error: courseErr }, { data: setupRows, error: setupErr }] =
    await Promise.all([
      admin
        .from("study_courses")
        .select("id, faculty_id, department_id, level, semester")
        .eq("department_id", scope.departmentId)
        .in("level", levels)
        .eq("status", "approved"),
      admin
        .from("study_course_setup_status")
        .select("faculty_id, department_id, level, semester, status, completed_at")
        .eq("department_id", scope.departmentId)
        .in("level", levels),
    ]);

  if (courseErr || setupErr) return [];

  const countByKey = new Map<string, number>();
  const facultyByKey = new Map<string, string | null>();
  for (const course of (courses ?? []) as any[]) {
    const key = `${course.level}:${course.semester}`;
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    if (!facultyByKey.has(key)) facultyByKey.set(key, course.faculty_id ?? scope.facultyId ?? null);
  }

  const setupByKey = new Map<string, any>();
  for (const row of (setupRows ?? []) as any[]) {
    setupByKey.set(`${row.level}:${row.semester}`, row);
  }

  return levels.flatMap((level) =>
    SETUP_SEMESTERS.map((semester) => {
      const key = `${level}:${semester}`;
      const setup = setupByKey.get(key);
      return {
        facultyId: setup?.faculty_id ?? facultyByKey.get(key) ?? scope.facultyId ?? null,
        departmentId: scope.departmentId,
        level,
        semester,
        courseCount: countByKey.get(key) ?? 0,
        status: setup?.status === "complete" ? "complete" as const : "in_progress" as const,
        completedAt: setup?.completed_at ?? null,
      };
    })
  );
}

async function getRecent(admin: AdminClient, scope: StudyModeratorScope, scopedUserIds: string[] | null) {
  let uploadsQuery = admin
    .from("study_materials")
    .select("id,title,created_at,approved,index_status,study_courses!inner(course_code,course_title,level,faculty_id,department_id)")
    .order("created_at", { ascending: false })
    .limit(5);
  uploadsQuery = applyScopeToMaterialQuery(uploadsQuery, scope);

  let requestsQuery = admin
    .from("study_course_requests")
    .select("id,course_code,course_title,status,level,semester,created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (scope.role !== "super") {
    if (scope.departmentId) requestsQuery = requestsQuery.eq("department_id", scope.departmentId);
    if (scope.facultyId) requestsQuery = requestsQuery.eq("faculty_id", scope.facultyId);
    if (scope.role === "course_rep" && scope.levels?.length) requestsQuery = requestsQuery.in("level", scope.levels);
  }

  let attemptsQuery: any = admin
    .from("study_practice_attempts")
    .select("id,user_id,status,score,total_questions,started_at,submitted_at,study_quiz_sets(title,course_code)")
    .order("started_at", { ascending: false })
    .limit(5);
  attemptsQuery = applyUserScope(attemptsQuery, scopedUserIds);

  const [uploadsRes, requestsRes, attemptsRes] = await Promise.all([
    uploadsQuery,
    requestsQuery,
    attemptsQuery ?? Promise.resolve({ data: [], error: null }),
  ]);

  const recent: Record<string, unknown> = {
    uploads: uploadsRes.error ? [] : uploadsRes.data ?? [],
    requests: requestsRes.error ? [] : requestsRes.data ?? [],
    practice: attemptsRes.error ? [] : attemptsRes.data ?? [],
    billing: [],
    repApplications: [],
  };

  if (scope.role === "super") {
    const [billingRes, repsRes] = await Promise.all([
      admin
        .from("study_billing_orders")
        .select("id,status,plan_key,amount_naira,created_at,submitted_at")
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("study_rep_applications")
        .select("id,status,role,levels,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    recent.billing = billingRes.error ? [] : billingRes.data ?? [];
    recent.repApplications = repsRes.error ? [] : repsRes.data ?? [];
  }

  return recent;
}

export async function GET(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const admin = createSupabaseAdminClient();
    const todayStart = watDayStartUtcIso();

    const [scopedUserIds, scopedCourses] = await Promise.all([
      getScopedUsers(admin, scope),
      getScopedCourses(admin, scope),
    ]);

    const [
      pendingRequests,
      pendingMaterials,
      totalMaterials,
      failedIndexes,
      totalQuizSets,
      activeUsers,
      practiceSessionsToday,
      aiGenerationsToday,
      totalStudents,
      pendingRepApplications,
      pendingBillingOrders,
      failedAiRuns,
      courseSetup,
      recent,
    ] = await Promise.all([
      getPendingRequestsCount(admin, scope),
      getPendingMaterialsCount(admin, scope),
      getMaterialsCount(admin, scope),
      getMaterialsCount(admin, scope, (query) => query.eq("index_status", "failed")),
      getQuizSetCount(admin, scope, scopedCourses),
      countActiveUsers(admin, scopedUserIds),
      countRows(
        applyUserScope(
          admin
            .from("study_practice_attempts")
            .select("id", { count: "exact", head: true })
            .gte("started_at", todayStart),
          scopedUserIds
        )
      ),
      getAiGenerationCountToday(admin, scope, scopedCourses),
      scope.role === "super"
        ? countRows(admin.from("profiles").select("id", { count: "exact", head: true }))
        : countRows(
            applyUserScope(
              admin.from("study_preferences").select("user_id", { count: "exact", head: true }),
              scopedUserIds
            )
          ),
      scope.role === "super"
        ? countRows(
            admin
              .from("study_rep_applications")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
          )
        : Promise.resolve(0),
      scope.role === "super"
        ? countRows(
            admin
              .from("study_billing_orders")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending_review")
          )
        : Promise.resolve(0),
      countRows(
        admin
          .from("study_question_bank_runs")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
      ),
      getCourseSetup(admin, scope),
      getRecent(admin, scope, scopedUserIds),
    ]);

    const incompleteSetup = courseSetup.filter((item) => item.status !== "complete").length;
    const actionQueue: ActionQueueItem[] = [
      { key: "materials", label: "Pending materials", value: pendingMaterials, href: "/study-admin/materials", tone: "warning" },
      { key: "requests", label: "Course requests", value: pendingRequests, href: "/study-admin/requests", tone: "warning" },
      { key: "failed-indexes", label: "Failed material indexes", value: failedIndexes, href: "/study-admin/materials", tone: "danger" },
      { key: "failed-ai", label: "Failed AI bank runs", value: failedAiRuns, href: "/study-admin/question-quality", tone: "danger" },
    ];

    if (incompleteSetup > 0) {
      actionQueue.push({
        key: "course-setup",
        label: "Course setup groups",
        value: incompleteSetup,
        href: "/study-admin/courses",
        tone: "default",
      });
    }

    if (scope.role === "super") {
      actionQueue.splice(2, 0, {
        key: "rep-apps",
        label: "Rep applications",
        value: pendingRepApplications,
        href: "/study-admin/rep-applications",
        tone: "warning",
      });
      actionQueue.splice(3, 0, {
        key: "billing",
        label: "Billing reviews",
        value: pendingBillingOrders,
        href: "/study-admin/billing",
        tone: "warning",
      });
    }

    return NextResponse.json({
      scope,
      pendingMaterials,
      pendingRequests,
      pendingRepApplications,
      courseSetup,
      metrics: {
        totalStudents,
        activeToday: activeUsers.today,
        activeWeek: activeUsers.week,
        totalMaterials,
        totalQuizSets,
        practiceSessionsToday,
        aiGenerationsToday,
        pendingBillingOrders,
        failedIndexes,
      },
      actionQueue,
      recent,
    });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
