import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_NOTIFICATIONS = 200;

type MaterialNotificationCourse = {
  course_code: string | null;
  department_id: string | null;
  level: number | null;
  semester: string | null;
};

type MaterialNotificationRow = {
  id: string;
  title: string | null;
  semester: string | null;
  study_courses: MaterialNotificationCourse | MaterialNotificationCourse[] | null;
};

type StudyPreferenceUser = { user_id: string };

export async function POST(req: Request) {
  try {
    // This route is called server-to-server only — require CRON_SECRET as bearer
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token || token !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { material_id?: unknown };
    const material_id = typeof body.material_id === "string" ? body.material_id.trim() : "";

    if (!material_id) {
      return NextResponse.json({ ok: false, error: "material_id is required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Fetch the material
    const { data: material, error: matErr } = await admin
      .from("study_materials")
      .select("id, title, course_id, semester, study_courses:course_id(course_code, department_id, level, semester)")
      .eq("id", material_id)
      .maybeSingle();

    if (matErr || !material?.id) {
      return NextResponse.json({ ok: false, error: "Material not found" }, { status: 404 });
    }

    const materialRow = material as MaterialNotificationRow;
    const course = Array.isArray(materialRow.study_courses)
      ? materialRow.study_courses[0] ?? null
      : materialRow.study_courses;
    const department_id = course?.department_id ?? null;
    const level = course?.level ?? null;
    const course_code = course?.course_code ?? null;
    const semester = String(materialRow.semester ?? course?.semester ?? "").trim().toLowerCase();
    const title = String(materialRow.title ?? "Untitled material");

    if (!department_id) {
      return NextResponse.json({ ok: true, notified: 0, skipped: "no department_id" });
    }

    async function fetchUsers(includeNullSemester: boolean) {
      let usersQuery = admin
        .from("study_preferences")
        .select("user_id")
        .eq("department_id", department_id)
        .limit(MAX_NOTIFICATIONS);

      if (level) usersQuery = usersQuery.or(`level.eq.${level},level.is.null`);
      if (semester) {
        usersQuery = includeNullSemester
          ? usersQuery.or(`semester.eq.${semester},semester.is.null`)
          : usersQuery.eq("semester", semester);
      }

      return usersQuery;
    }

    let { data: users, error: usersErr } = (await fetchUsers(false)) as {
      data: StudyPreferenceUser[] | null;
      error: { message?: string } | null;
    };
    if (!usersErr && semester && (!users || users.length === 0)) {
      const fallback = await fetchUsers(true);
      users = fallback.data as StudyPreferenceUser[] | null;
      usersErr = fallback.error;
    }

    if (usersErr || !users?.length) {
      return NextResponse.json({ ok: true, notified: 0 });
    }

    // Build notification rows — skip duplicates by not re-inserting same type+href
    const href = `/study/materials/${material_id}`;
    const body_text = `${title}${course_code ? ` — ${course_code}` : ""}`;

    const rows = users.map((u: { user_id: string }) => ({
      user_id: u.user_id,
      type: "study_new_material",
      title: "New material in your department",
      body: body_text,
      href,
    }));

    // Insert in batches of 50 to avoid payload limits
    let totalInserted = 0;
    try {
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error: insErr } = await admin.from("notifications").insert(batch);
        if (!insErr) totalInserted += batch.length;
      }
    } catch {
      // Notification failure must never block material approval
    }

    // H-5: Push notification fan-out
    try {
      const { sendUserPush } = await import('@/lib/webPush');
      const pushPayload = {
        title: `New material: ${title}`,
        body:  course_code
          ? `${course_code} — tap to download`
          : 'New study material for your department',
        href:  '/study/materials',
        tag:   `new-material-${material_id}`,
      };
      await Promise.allSettled(
        (users ?? []).map((u: StudyPreferenceUser) => sendUserPush(u.user_id, pushPayload))
      );
    } catch { /* push failures must never crash the notification route */ }

    return NextResponse.json({ ok: true, notified: totalInserted });
  } catch (e: unknown) {
    // Notification failures are non-fatal — always return ok
    return NextResponse.json({ ok: true, notified: 0, error: e instanceof Error ? e.message : "Notification failed" });
  }
}
