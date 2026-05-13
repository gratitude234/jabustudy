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

    await admin.from("notifications").insert({
      user_id: questionAuthorId,
      type: "study_answer_posted",
      title: "Your question was answered",
      body: `Someone answered: "${short}"`,
      href: `/study/questions/${questionId}#answer-${answerId}`,
      is_read: false,
    });
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

    await admin.from("notifications").insert({
      user_id: answerAuthorId,
      type: "study_answer_accepted",
      title: "Your answer was accepted ✅",
      body: `Your answer to "${short}" was marked as the best answer.`,
      href: `/study/questions/${questionId}#answer-${answerId}`,
      is_read: false,
    });
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

    await admin.from("notifications").insert({
      user_id: questionAuthorId,
      type: "study_upvote_milestone",
      title: `Your question hit ${newCount} upvote${newCount === 1 ? "" : "s"} 👍`,
      body: `"${short}" is gaining traction in the Study Hub.`,
      href: `/study/questions/${questionId}`,
      is_read: false,
    });
  } catch {
    // notification failure must never break the upvote flow
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

    const notifications = [...recipientIds].map((uid) => ({
      user_id: uid,
      type: "study_material_pending",
      title: `New material pending review`,
      body: `${courseCode ? `[${courseCode}] ` : ""}${shortTitle}${uploaderHint} — needs your approval.`,
      href: `/study-admin/materials`,
      is_read: false,
    }));

    // Insert in one batch
    await admin.from("notifications").insert(notifications);
  } catch {
    // notification failure must never block uploads
  }
}