// lib/studyNotify.ts
//
// Fire-and-forget notification helpers for Study Hub Q&A events.
// Mirrors the pattern in lib/studyAdmin/notifyUploader.ts:
//   — all functions are async but callers never need to await them
//   — errors are swallowed so a notification failure never breaks the action
//   — all writes use the admin/service-role client (bypasses RLS)
//
// UPVOTE MILESTONES
//   We only notify at specific thresholds so a high-traffic question doesn't
//   spam the author. Thresholds: 1, 5, 10, 25, 50.
//   The caller passes the NEW count; we fire only when it hits a threshold.

import { createSupabaseAdminClient } from "./supabase/admin";
import { sendUserPushIfAllowed } from "./webPush";
import { sendAnswerPostedEmail, sendAnswerAcceptedEmail } from "./email";

const UPVOTE_MILESTONES = new Set([1, 5, 10, 25, 50]);

// ─── Answer posted ─────────────────────────────────────────────────────────────

/**
 * Notify the question author that a new answer has been posted.
 * Skipped when the answerer IS the question author (no self-ping).
 */
export async function notifyAnswerPosted({
  questionId,
  questionTitle,
  questionAuthorId,
  answererEmail,
  answerId,
}: {
  questionId: string;
  questionTitle: string;
  questionAuthorId: string;
  answererEmail: string | null;
  answerId: string;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    // Resolve the notifying user's id so we can skip self-notifications
    // (answererEmail is used as a display hint; the real guard is userId comparison)
    const { data: auth } = await admin.auth.admin.listUsers();
    const answerer = auth?.users?.find((u) => u.email === answererEmail);
    if (answerer?.id && answerer.id === questionAuthorId) return; // self-answer, no ping

    const short =
      questionTitle.length > 60
        ? questionTitle.slice(0, 57).trimEnd() + "…"
        : questionTitle;

    const title = "Your question was answered";
    const body = `Someone answered: "${short}"`;
    const href = `/study/questions/${questionId}#answer-${answerId}`;

    await admin.from("notifications").insert({
      user_id: questionAuthorId,
      type: "study_answer_posted",
      title,
      body,
      href,
      is_read: false,
    });

    void sendUserPushIfAllowed(questionAuthorId, { title, body, href, tag: `study-answer-${answerId}` }, 'answers');
    void sendAnswerPostedEmail({ questionAuthorId, questionTitle, questionId, answerId });
  } catch {
    // notification failure must never break the post-answer flow
  }
}

// ─── Answer accepted ───────────────────────────────────────────────────────────

/**
 * Notify an answer author that the question owner accepted their answer.
 * Skipped when the acceptor IS the answer author.
 */
export async function notifyAnswerAccepted({
  questionId,
  questionTitle,
  answerAuthorId,
  acceptorId,
  answerId,
}: {
  questionId: string;
  questionTitle: string;
  answerAuthorId: string;
  acceptorId: string;
  answerId: string;
}): Promise<void> {
  try {
    if (answerAuthorId === acceptorId) return; // no self-ping

    const admin = createSupabaseAdminClient();

    const short =
      questionTitle.length > 60
        ? questionTitle.slice(0, 57).trimEnd() + "…"
        : questionTitle;

    const title = "Your answer was accepted ✅";
    const body = `Your answer to "${short}" was marked as the best answer.`;
    const href = `/study/questions/${questionId}#answer-${answerId}`;

    await admin.from("notifications").insert({
      user_id: answerAuthorId,
      type: "study_answer_accepted",
      title,
      body,
      href,
      is_read: false,
    });

    void sendUserPushIfAllowed(answerAuthorId, { title, body, href, tag: `study-accepted-${answerId}` }, 'answers');
    void sendAnswerAcceptedEmail({ answerAuthorId, questionTitle, questionId, answerId });
  } catch {
    // notification failure must never break the accept flow
  }
}

// ─── Upvote milestone ─────────────────────────────────────────────────────────

/**
 * Notify the question author when their upvote count hits a milestone.
 * Calling this with a count that is NOT in UPVOTE_MILESTONES is a no-op.
 */
export async function notifyUpvoteMilestone({
  questionId,
  questionTitle,
  questionAuthorId,
  newCount,
  voterId,
}: {
  questionId: string;
  questionTitle: string;
  questionAuthorId: string;
  newCount: number;
  voterId: string;
}): Promise<void> {
  try {
    if (!UPVOTE_MILESTONES.has(newCount)) return; // not a milestone, skip
    if (voterId === questionAuthorId) return;      // no self-ping

    const admin = createSupabaseAdminClient();

    const short =
      questionTitle.length > 55
        ? questionTitle.slice(0, 52).trimEnd() + "…"
        : questionTitle;

    const title = `Your question hit ${newCount} upvote${newCount === 1 ? "" : "s"} 👍`;
    const body = `"${short}" is gaining traction in the Study Hub.`;
    const href = `/study/questions/${questionId}`;

    await admin.from("notifications").insert({
      user_id: questionAuthorId,
      type: "study_upvote_milestone",
      title,
      body,
      href,
      is_read: false,
    });

    void sendUserPushIfAllowed(questionAuthorId, { title, body, href, tag: `study-upvote-${questionId}-${newCount}` }, 'upvotes');
  } catch {
    // notification failure must never break the upvote flow
  }
}
// ─── Answer upvote milestone ──────────────────────────────────────────────────

/**
 * Notify the answer author when their upvote count hits a milestone.
 * Same thresholds as question upvotes: 1, 5, 10, 25, 50.
 */
export async function notifyAnswerUpvoteMilestone({
  answerId,
  questionId,
  answerAuthorId,
  newCount,
  voterId,
}: {
  answerId: string;
  questionId: string;
  answerAuthorId: string;
  newCount: number;
  voterId: string;
}): Promise<void> {
  try {
    if (!UPVOTE_MILESTONES.has(newCount)) return;
    if (voterId === answerAuthorId) return;

    const admin = createSupabaseAdminClient();

    const title = `Your answer hit ${newCount} upvote${newCount === 1 ? "" : "s"} 👍`;
    const body = "Your answer is gaining traction in the Study Hub.";
    const href = `/study/questions/${questionId}#answer-${answerId}`;

    await admin.from("notifications").insert({
      user_id: answerAuthorId,
      type: "study_answer_upvote",
      title,
      body,
      href,
      is_read: false,
    });

    void sendUserPushIfAllowed(answerAuthorId, { title, body, href, tag: `study-ans-upvote-${answerId}-${newCount}` }, 'upvotes');
  } catch {
    // notification failure must never break the upvote flow
  }
}

// ─── Streak milestone ─────────────────────────────────────────────────────────

const STREAK_LOOKBACK_DAYS = 400;
const STREAK_MILESTONES = new Set([7, 14, 30]);

const STREAK_LABELS: Record<number, { title: string; body: string }> = {
  7:  { title: "7-day streak! 🎉", body: "One week straight! Keep the fire burning." },
  14: { title: "14-day streak! 🔥", body: "Two weeks straight! You're unstoppable." },
  30: { title: "30-day streak! 🏆", body: "Legendary dedication. Keep it going!" },
};

/**
 * Notify a student when their consecutive-day streak hits 7, 14, or 30.
 * Calculates the streak server-side using the admin client.
 * Call only on the FIRST activity of a given day to avoid duplicate milestone pings.
 */
export async function notifyStreakMilestone({ userId }: { userId: string }): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    const since = new Date(Date.now() + 3_600_000 - STREAK_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("study_daily_activity")
      .select("activity_date, attempts_count")
      .eq("user_id", userId)
      .gte("activity_date", since)
      .order("activity_date", { ascending: false });

    if (error || !Array.isArray(data)) return;

    const map = new Map<string, boolean>();
    for (const r of data as any[]) {
      if (r?.activity_date) map.set(String(r.activity_date), Number(r.attempts_count ?? 0) > 0);
    }

    const todayWAT = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
    let streak = 0;
    let cursorMs = Date.now() + 3_600_000; // WAT now
    for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
      const k = new Date(cursorMs).toISOString().slice(0, 10);
      if (map.get(k) === true) { streak += 1; cursorMs -= 86_400_000; }
      else break;
    }

    if (!STREAK_MILESTONES.has(streak)) return;

    const { title, body } = STREAK_LABELS[streak];
    const href = "/study/me";

    await admin.from("notifications").insert({
      user_id: userId,
      type: "streak_milestone",
      title,
      body,
      href,
      is_read: false,
    });

    void sendUserPushIfAllowed(userId, { title, body, href, tag: `streak-${streak}` }, 'milestones');
    void todayWAT; // used implicitly via cursorMs
  } catch {
    // notification failure must never break the submit flow
  }
}

// ─── Practice perfect score ───────────────────────────────────────────────────

/**
 * Notify a student when they score 100% on a practice set.
 * Only fires for sets with at least 5 scored questions to avoid trivial pings.
 */
export async function notifyPracticePerfectScore({
  userId,
  setId,
  score,
}: {
  userId: string;
  setId: string;
  score: number;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: set } = await admin
      .from("study_quiz_sets")
      .select("title, course_code")
      .eq("id", setId)
      .maybeSingle();
    const courseCode = (set as any)?.course_code as string | null;
    const setTitle = (set as any)?.title as string | null;
    const label = courseCode
      ? `${courseCode} — ${setTitle ?? "practice set"}`
      : (setTitle ?? "practice set");

    const title = `Perfect score! 🎯 ${score}/${score}`;
    const body = `You aced "${label}". Outstanding!`;
    const href = `/study/practice`;

    await admin.from("notifications").insert({
      user_id: userId,
      type: "practice_perfect_score",
      title,
      body,
      href,
      is_read: false,
    });

    void sendUserPushIfAllowed(userId, { title, body, href, tag: `perfect-${setId}` }, 'milestones');
  } catch {
    // notification failure must never break the submit flow
  }
}

// ─── Rep alert: new question ──────────────────────────────────────────────────

/**
 * Notify active reps in the question author's department when a new question is posted.
 * Course reps are only notified if the question's level matches their assigned levels.
 * Dept librarians are always notified.
 * Skips self-notification (rep posted their own question).
 */
export async function notifyRepsNewQuestion({
  questionId,
  title,
  courseCode,
  level,
  authorId,
}: {
  questionId: string;
  title: string;
  courseCode: string | null;
  level: string | null;
  authorId: string;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    // Resolve author's department from their study preferences
    const { data: prefs } = await admin
      .from("study_preferences")
      .select("department_id")
      .eq("user_id", authorId)
      .maybeSingle();

    const departmentId = (prefs as any)?.department_id as string | null;
    if (!departmentId) return;

    const { data: reps } = await admin
      .from("study_reps")
      .select("user_id, role, levels")
      .eq("department_id", departmentId)
      .eq("active", true);

    const levelNum = level ? parseInt(level, 10) : null;

    const recipientIds = new Set<string>();
    for (const rep of (reps ?? []) as { user_id: string; role: string; levels: number[] | null }[]) {
      if (rep.user_id === authorId) continue;
      if (rep.role === "dept_librarian") {
        recipientIds.add(rep.user_id);
      } else if (levelNum && Array.isArray(rep.levels) && rep.levels.includes(levelNum)) {
        recipientIds.add(rep.user_id);
      } else if (!levelNum) {
        recipientIds.add(rep.user_id); // no level on question → notify all reps
      }
    }

    if (recipientIds.size === 0) return;

    const short = title.length > 70 ? title.slice(0, 67).trimEnd() + "…" : title;
    const prefix = courseCode ? `[${courseCode}] ` : "";
    const notifTitle = "New question in your department";
    const body = `${prefix}${short}`;
    const href = `/study/questions/${questionId}`;

    await admin.from("notifications").insert(
      [...recipientIds].map((uid) => ({
        user_id: uid,
        type: "study_question_for_rep",
        title: notifTitle,
        body,
        href,
        is_read: false,
      }))
    );

    void Promise.allSettled(
      [...recipientIds].map((uid) =>
        sendUserPushIfAllowed(uid, { title: notifTitle, body, href, tag: `rep-q-${questionId}` }, 'rep_alerts')
      )
    );
  } catch {
    // notification failure must never break the question post flow
  }
}

// ─── New pending material (student upload) ────────────────────────────────────

/**
 * Notify all active reps and librarians in the material's department that a
 * student has submitted a material pending their review.
 *
 * Called only for non-rep uploads (reps are auto-approved and skip the queue).
 * Fire-and-forget — errors are swallowed so a notification failure never
 * blocks the upload response.
 */
export async function notifyRepsNewPendingMaterial({
  materialId,
  title,
  courseCode,
  departmentId,
  uploaderEmail,
}: {
  materialId: string;
  title: string;
  courseCode: string;
  departmentId: string | null;
  uploaderEmail: string | null;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    // Find active reps/librarians scoped to this department.
    // If no department_id is known, fall back to notifying super admins only.
    let repQuery = admin
      .from("study_reps")
      .select("user_id")
      .eq("active", true);

    if (departmentId) {
      repQuery = repQuery.eq("department_id", departmentId);
    }

    const { data: reps } = await repQuery;

    // Also get study_admins (super admins always see pending queue)
    const { data: superAdmins } = await admin
      .from("study_admins")
      .select("user_id");

    const recipientIds = new Set<string>();
    for (const r of (reps ?? []) as { user_id: string }[]) recipientIds.add(r.user_id);
    for (const a of (superAdmins ?? []) as { user_id: string }[]) recipientIds.add(a.user_id);

    if (recipientIds.size === 0) return;

    const shortTitle = title.length > 55 ? title.slice(0, 52).trimEnd() + "…" : title;
    const uploaderHint = uploaderEmail ? ` from ${uploaderEmail.split("@")[0]}` : "";
    const notifTitle = `New material pending review`;
    const body = `${courseCode ? `[${courseCode}] ` : ""}${shortTitle}${uploaderHint} — needs your approval.`;
    const href = `/study-admin/materials`;

    const notifications = [...recipientIds].map((uid) => ({
      user_id: uid,
      type: "study_material_pending",
      title: notifTitle,
      body,
      href,
      is_read: false,
    }));

    // Insert in one batch
    await admin.from("notifications").insert(notifications);

    void Promise.allSettled(
      [...recipientIds].map((uid) =>
        sendUserPushIfAllowed(uid, { title: notifTitle, body, href, tag: `rep-mat-${materialId}` }, 'rep_alerts')
      )
    );
  } catch {
    // notification failure must never block uploads
  }
}

// ─── Student-created course review ─────────────────────────────────────────

/**
 * Notify study admins after a material upload has been verified and made live.
 * Admins use this alert to open/download the material and create practice sets.
 */
export async function notifyStudyAdminsNewMaterialUploaded({
  materialId,
  title,
  courseCode,
  uploaderEmail,
}: {
  materialId: string;
  title: string;
  courseCode: string | null;
  uploaderEmail: string | null;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: admins } = await admin.from("study_admins").select("user_id");
    const recipientIds = ((admins ?? []) as { user_id: string }[]).map((row) => row.user_id);
    if (!recipientIds.length) return;

    const shortTitle = title.length > 55 ? title.slice(0, 52).trimEnd() + "..." : title;
    const prefix = courseCode ? `[${courseCode}] ` : "";
    const uploaderHint = uploaderEmail ? ` from ${uploaderEmail.split("@")[0]}` : "";
    const notifTitle = "New material uploaded";
    const body = `${prefix}${shortTitle}${uploaderHint} is live. Download it to create practice questions.`;
    const qParam = courseCode ? `&q=${encodeURIComponent(courseCode)}` : "";
    const href = `/study-admin/materials?status=all${qParam}`;

    await admin.from("notifications").insert(
      recipientIds.map((uid) => ({
        user_id: uid,
        type: "study_material_uploaded_admin",
        title: notifTitle,
        body,
        href,
        is_read: false,
      }))
    );

    void Promise.allSettled(
      recipientIds.map((uid) =>
        sendUserPushIfAllowed(uid, { title: notifTitle, body, href, tag: `admin-material-${materialId}` }, "materials")
      )
    );
  } catch {
    // notification failure must never block uploads
  }
}

export async function notifyStudentCreatedCourse({
  courseId,
  courseCode,
  courseTitle,
  departmentId,
  level,
  creatorEmail,
}: {
  courseId: string;
  courseCode: string;
  courseTitle: string | null;
  departmentId: string | null;
  level: number | null;
  creatorEmail: string | null;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    let repQuery = admin
      .from("study_reps")
      .select("user_id, role, levels")
      .eq("active", true);
    if (departmentId) repQuery = repQuery.eq("department_id", departmentId);

    const [{ data: reps }, { data: admins }] = await Promise.all([
      repQuery,
      admin.from("study_admins").select("user_id"),
    ]);

    const recipientIds = new Set<string>();
    for (const rep of (reps ?? []) as { user_id: string; role: string; levels: number[] | null }[]) {
      if (rep.role === "dept_librarian") {
        recipientIds.add(rep.user_id);
        continue;
      }
      if (!level || !Array.isArray(rep.levels) || rep.levels.includes(level)) {
        recipientIds.add(rep.user_id);
      }
    }
    for (const adminRow of (admins ?? []) as { user_id: string }[]) recipientIds.add(adminRow.user_id);
    if (recipientIds.size === 0) return;

    const label = `${courseCode}${courseTitle ? ` - ${courseTitle}` : ""}`;
    const creator = creatorEmail ? ` by ${creatorEmail.split("@")[0]}` : "";
    const title = "New course needs review";
    const body = `${label}${creator} was created during upload.`;
    const href = "/study-admin/courses?review=pending";

    await admin.from("notifications").insert(
      [...recipientIds].map((uid) => ({
        user_id: uid,
        type: "study_course_pending_review",
        title,
        body,
        href,
        is_read: false,
      }))
    );

    void Promise.allSettled(
      [...recipientIds].map((uid) =>
        sendUserPushIfAllowed(uid, { title, body, href, tag: `course-review-${courseId}` }, "rep_alerts")
      )
    );
  } catch {
    // notification failure must never block course creation
  }
}

export async function notifyStudyAdminsCourseReviewAction({
  courseId,
  courseCode,
  action,
  actorEmail,
  note,
}: {
  courseId: string;
  courseCode: string;
  action: "approved" | "removed";
  actorEmail: string | null;
  note: string | null;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: admins } = await admin.from("study_admins").select("user_id");
    const recipientIds = ((admins ?? []) as { user_id: string }[]).map((row) => row.user_id);
    if (!recipientIds.length) return;

    const verb = action === "approved" ? "approved" : "removed";
    const title = `Course ${verb} by course rep`;
    const actor = actorEmail ? ` by ${actorEmail.split("@")[0]}` : "";
    const body = `${courseCode} was ${verb}${actor}${note ? `: ${note}` : "."}`;
    const href = "/study-admin/courses?review=all";

    await admin.from("notifications").insert(
      recipientIds.map((uid) => ({
        user_id: uid,
        type: "study_course_review_action",
        title,
        body,
        href,
        is_read: false,
      }))
    );

    void Promise.allSettled(
      recipientIds.map((uid) =>
        sendUserPushIfAllowed(uid, { title, body, href, tag: `course-review-action-${courseId}-${action}` }, "rep_alerts")
      )
    );
  } catch {
    // notification failure must never block review actions
  }
}

export async function notifyAdminsNewBillingSubmission(args: {
  reference: string;
  planLabel: string;
  amountNaira: number;
}) {
  try {
    const admin = createSupabaseAdminClient();
    const { data: admins } = await admin.from("study_admins").select("user_id");
    if (!admins?.length) return;
    const adminIds = admins.map((a: { user_id: string }) => a.user_id).filter(Boolean) as string[];

    const title = "New payment submitted";
    const body = `${args.planLabel} — ₦${args.amountNaira.toLocaleString("en-NG")} — Ref: ${args.reference}`;
    const href = "/study-admin/billing";

    await admin.from("notifications").insert(
      adminIds.map((uid) => ({ user_id: uid, type: "billing", title, body, href })) as never[]
    );

    void Promise.allSettled(
      adminIds.map((uid) =>
        sendUserPushIfAllowed(uid, { title, body, href, tag: `billing-submission-${args.reference}` }, "rep_alerts")
      )
    );
  } catch {
    // fire-and-forget — billing state is already persisted
  }
}

// ─── New rep application submitted ────────────────────────────────────────────

export async function notifyAdminsNewRepApplication(opts: {
  applicantId: string;
  role: "course_rep" | "dept_librarian";
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: admins } = await admin.from("study_admins").select("user_id");
    const ids = ((admins ?? []) as { user_id: string }[]).map((r) => r.user_id);
    if (!ids.length) return;

    const roleLabel = opts.role === "dept_librarian" ? "Dept Librarian" : "Course Rep";
    const title = "New rep application";
    const body = `A ${roleLabel} application is awaiting review.`;
    const href = "/study-admin/rep-applications";

    await admin.from("notifications").insert(
      ids.map((uid) => ({
        user_id: uid,
        type: "study_rep_app_new",
        title,
        body,
        href,
        is_read: false,
      }))
    );

    void Promise.allSettled(
      ids.map((uid) =>
        sendUserPushIfAllowed(uid, { title, body, href, tag: `rep-app-${opts.applicantId}` }, "materials")
      )
    );
  } catch {
    // fire-and-forget — application is already persisted
  }
}
