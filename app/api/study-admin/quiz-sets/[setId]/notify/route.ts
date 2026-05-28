import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ setId: string }> }
) {
  try {
    await requireStudyModeratorFromRequest(req);
    const { setId } = await params;
    const admin = createSupabaseAdminClient();

    // Fetch the quiz set
    const { data: set, error: setErr } = await admin
      .from("study_quiz_sets")
      .select("id, title, questions_count, course_code, level, semester")
      .eq("id", setId)
      .maybeSingle();

    if (setErr || !set) {
      return NextResponse.json({ ok: false, message: "Quiz set not found." }, { status: 404 });
    }

    if (!set.course_code) {
      return NextResponse.json(
        { ok: false, message: "No course code on this quiz set. Cannot target students." },
        { status: 422 }
      );
    }

    // Look up department_id via the course code
    const { data: course } = await admin
      .from("study_courses")
      .select("department_id")
      .eq("course_code", set.course_code)
      .maybeSingle();

    if (!course?.department_id) {
      return NextResponse.json(
        { ok: false, message: "No department linked to this quiz set's course. Cannot target students." },
        { status: 422 }
      );
    }

    const level = set.level;
    const semester = String(set.semester ?? "").trim().toLowerCase();

    // Find students whose preferences match this course's dept/level/semester
    let usersQuery = admin
      .from("study_preferences")
      .select("user_id")
      .eq("department_id", course.department_id)
      .limit(500);

    if (level) usersQuery = (usersQuery as any).or(`level.eq.${level},level.is.null`);
    if (semester) usersQuery = (usersQuery as any).or(`semester.eq.${semester},semester.is.null`);

    const { data: users } = await usersQuery;
    if (!users?.length) {
      return NextResponse.json({ ok: true, notified: 0, message: "No matching students found." });
    }

    const count = set.questions_count ?? 0;
    const href = `/study/practice/${setId}`;
    const notifTitle = "New practice set available";
    const notifBody = `${set.course_code} — ${count} question${count === 1 ? "" : "s"} ready to practice`;

    const rows = (users as { user_id: string }[]).map((u) => ({
      user_id: u.user_id,
      type: "study_new_quiz_set",
      title: notifTitle,
      body: notifBody,
      href,
      is_read: false,
    }));

    for (let i = 0; i < rows.length; i += 50) {
      await admin.from("notifications").insert(rows.slice(i, i + 50));
    }

    const allIds = (users as { user_id: string }[]).map((u) => u.user_id);

    // Resolve emails for matched users (parallel, before response so serverless fn stays alive)
    const emailLookups = await Promise.allSettled(
      allIds.map((id) => admin.auth.admin.getUserById(id))
    );
    const recipientEmails = emailLookups
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof admin.auth.admin.getUserById>>> =>
        r.status === "fulfilled" && !!r.value.data.user?.email)
      .map((r) => r.value.data.user!.email as string);

    // Web push — fire-and-forget
    void (async () => {
      try {
        const { sendUserPush, filterPushAllowed } = await import("@/lib/webPush");
        const allowed = await filterPushAllowed(allIds, "quizzes");
        await Promise.allSettled(
          allowed.map((uid) =>
            sendUserPush(uid, { title: notifTitle, body: notifBody, href, tag: `new-quiz-${setId}` })
          )
        );
      } catch { /* never break */ }
    })();

    // Email — fire-and-forget
    void (async () => {
      try {
        const { sendNewQuizSetEmail } = await import("@/lib/email");
        await sendNewQuizSetEmail({
          emails: recipientEmails,
          setId,
          title: set.title,
          courseCode: set.course_code,
          questionsCount: count,
        });
      } catch (err) {
        console.error("[notify] email error:", err);
      }
    })();

    return NextResponse.json({ ok: true, notified: rows.length });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Failed to send notifications." },
      { status: e?.status || 500 }
    );
  }
}
