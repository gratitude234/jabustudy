import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendUserPushIfAllowed } from "@/lib/webPush";

const STUDENTS_HELPED_MILESTONES = new Set([5, 10, 25, 50, 100, 250, 500]);
const PRACTICE_QUESTIONS_MILESTONES = new Set([10, 25, 50, 100, 250]);

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type MaterialForContribution = {
  id: string;
  title: string | null;
  uploader_id: string | null;
  course_id: string | null;
  course_code?: string | null;
  downloads?: number | null;
  study_courses?: { course_code?: string | null } | { course_code?: string | null }[] | null;
};

type MaterialLike = {
  id?: string | null;
  course_id?: string | null;
};

function getAdmin(admin?: AdminClient) {
  return admin ?? createSupabaseAdminClient();
}

function courseCodeFor(row: MaterialForContribution) {
  const joined = Array.isArray(row.study_courses) ? row.study_courses[0] : row.study_courses;
  return (row.course_code ?? joined?.course_code ?? "this course").toString().trim() || "this course";
}

async function sendDedupedContributionNotification(args: {
  admin?: AdminClient;
  userId: string | null | undefined;
  type: string;
  title: string;
  body: string;
  href: string;
  tag: string;
}) {
  const userId = args.userId ? String(args.userId) : "";
  if (!userId) return;

  try {
    const admin = getAdmin(args.admin);
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", args.type)
      .eq("href", args.href)
      .limit(1);

    if (existing?.length) return;

    await admin.from("notifications").insert({
      user_id: userId,
      type: args.type,
      title: args.title,
      body: args.body,
      href: args.href,
      is_read: false,
    });

    void sendUserPushIfAllowed(
      userId,
      { title: args.title, body: args.body, href: args.href, tag: args.tag },
      "materials"
    );
  } catch {
    // Contribution notifications are best-effort and must never block core flows.
  }
}

export async function getFirstCourseMaterialIdSet(
  courseIds: Array<string | null | undefined>,
  admin?: AdminClient
) {
  const ids = [...new Set(courseIds.map((id) => (id ?? "").trim()).filter(Boolean))];
  const firstIds = new Set<string>();
  if (!ids.length) return firstIds;

  const client = getAdmin(admin);
  const { data, error } = await client
    .from("study_materials")
    .select("id,course_id,created_at")
    .in("course_id", ids)
    .eq("approved", true)
    .eq("upload_status", "live")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error || !data?.length) return firstIds;

  const firstByCourse = new Map<string, string>();
  for (const row of data as Array<{ id: string; course_id: string | null }>) {
    const courseId = row.course_id ?? "";
    if (!courseId || firstByCourse.has(courseId)) continue;
    firstByCourse.set(courseId, row.id);
    firstIds.add(row.id);
  }

  return firstIds;
}

export async function attachFirstCourseUploadFlags<T extends MaterialLike>(
  rows: T[],
  admin?: AdminClient
): Promise<Array<T & { is_first_course_upload: boolean }>> {
  if (!rows.length) return [];
  const firstIds = await getFirstCourseMaterialIdSet(rows.map((row) => row.course_id), admin);
  return rows.map((row) => ({
    ...row,
    is_first_course_upload: !!row.id && firstIds.has(String(row.id)),
  }));
}

export async function notifyFirstCourseUploadIfNeeded(materialId: string, admin?: AdminClient) {
  if (!materialId) return;
  try {
    const client = getAdmin(admin);
    const { data } = await client
      .from("study_materials")
      .select("id,title,uploader_id,course_id,course_code,study_courses:course_id(course_code)")
      .eq("id", materialId)
      .eq("approved", true)
      .eq("upload_status", "live")
      .maybeSingle();

    const material = data as MaterialForContribution | null;
    if (!material?.id || !material.course_id || !material.uploader_id) return;

    const firstIds = await getFirstCourseMaterialIdSet([material.course_id], client);
    if (!firstIds.has(material.id)) return;

    const courseCode = courseCodeFor(material);
    const title = `You started ${courseCode} materials`;
    const body = `"${material.title ?? "Your upload"}" is the first live material for ${courseCode}.`;
    const href = `/study/materials/${material.id}`;

    await sendDedupedContributionNotification({
      admin: client,
      userId: material.uploader_id,
      type: "material_first_helper",
      title,
      body,
      href,
      tag: `material-first-helper-${material.id}`,
    });
  } catch {
    // Best-effort only.
  }
}

export async function notifyMaterialDownloadImpactIfMilestone(args: {
  materialId: string;
  downloaderUserId?: string | null;
  admin?: AdminClient;
}) {
  if (!args.materialId) return;
  try {
    const admin = getAdmin(args.admin);
    const { data } = await admin
      .from("study_materials")
      .select("id,title,uploader_id,course_code,downloads,study_courses:course_id(course_code)")
      .eq("id", args.materialId)
      .maybeSingle();

    const material = data as MaterialForContribution | null;
    if (!material?.id || !material.uploader_id) return;
    if (args.downloaderUserId && args.downloaderUserId === material.uploader_id) return;

    const helped = material.downloads ?? 0;
    if (!STUDENTS_HELPED_MILESTONES.has(helped)) return;

    const courseCode = courseCodeFor(material);
    await sendDedupedContributionNotification({
      admin,
      userId: material.uploader_id,
      type: `material_helped_${helped}`,
      title: `Your ${courseCode} upload has helped ${helped} students`,
      body: `"${material.title ?? "Your upload"}" is being used by coursemates.`,
      href: `/study/materials/${material.id}`,
      tag: `material-helped-${material.id}-${helped}`,
    });
  } catch {
    // Best-effort only.
  }
}

export async function notifyPracticePoweredImpactIfMilestone(materialId: string, admin?: AdminClient) {
  if (!materialId) return;
  try {
    const client = getAdmin(admin);
    const { data } = await client
      .from("study_materials")
      .select("id,title,uploader_id,course_code,study_courses:course_id(course_code)")
      .eq("id", materialId)
      .maybeSingle();

    const material = data as MaterialForContribution | null;
    if (!material?.id || !material.uploader_id) return;

    const [setsRes, questionsRes] = await Promise.all([
      client
        .from("study_quiz_sets")
        .select("id", { count: "exact", head: true })
        .eq("source_material_id", materialId),
      client
        .from("study_quiz_questions")
        .select("id", { count: "exact", head: true })
        .eq("source_material_id", materialId),
    ]);

    const setsPowered = setsRes.count ?? 0;
    const questionsPowered = questionsRes.count ?? 0;
    const courseCode = courseCodeFor(material);
    const href = `/study/materials/${material.id}`;

    if (setsPowered === 1) {
      await sendDedupedContributionNotification({
        admin: client,
        userId: material.uploader_id,
        type: "material_first_practice_set",
        title: `Your upload powered a practice set`,
        body: `"${material.title ?? "Your upload"}" can now help ${courseCode} students practise.`,
        href,
        tag: `material-first-practice-set-${material.id}`,
      });
    }

    if (PRACTICE_QUESTIONS_MILESTONES.has(questionsPowered)) {
      await sendDedupedContributionNotification({
        admin: client,
        userId: material.uploader_id,
        type: `material_practice_powered_${questionsPowered}`,
        title: `Your upload powered ${questionsPowered} practice questions`,
        body: `${courseCode} students can now practise from "${material.title ?? "your upload"}".`,
        href,
        tag: `material-practice-powered-${material.id}-${questionsPowered}`,
      });
    }
  } catch {
    // Best-effort only.
  }
}
