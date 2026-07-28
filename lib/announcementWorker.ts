import "server-only";

import pLimit from "p-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterPushAllowed, sendUserPush } from "@/lib/webPush";
import {
  announcementNotificationType,
  announcementPushTag,
  type AnnouncementRow,
} from "@/lib/announcements";

/** Profiles pulled per batch. Bounded so one batch stays well inside the budget. */
const BATCH_SIZE = 500;

/** Rows per notifications insert. Matches the chunking used elsewhere in the app. */
const INSERT_CHUNK = 250;

/** Concurrent web-push sends. */
const PUSH_CONCURRENCY = 10;

/**
 * How long one invocation keeps processing batches before returning. Kept short
 * so the route works on any Vercel plan — the caller polls until `done`.
 */
const BUDGET_MS = 45_000;

export type WorkerResult = {
  done: boolean;
  announcementId: string | null;
  targeted: number;
  pushed: number;
  failed: number;
  batches: number;
};

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/** PostgREST returns at most 1000 rows per request unless a range is given. */
const PAGE = 1000;

/**
 * Pages a `user_id` column to exhaustion and returns the distinct values.
 *
 * Necessary because a single batch of 500 users can own several thousand push
 * subscription rows (the push route keeps up to 10 per user), and an unpaged
 * select would silently stop at 1000 — dropping pushes for the tail of a batch.
 */
async function collectUserIds(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { user_id: string }[];
    for (const r of rows) out.add(r.user_id);
    if (rows.length < PAGE) return out;
  }
}

/** Oldest campaign still in flight, or a specific one when `id` is given. */
async function claimAnnouncement(admin: AdminClient, id?: string) {
  let q = admin.from("announcements").select("*").eq("status", "sending");
  if (id) q = q.eq("id", id);
  const { data, error } = await q.order("created_at", { ascending: true }).limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] ?? null) as AnnouncementRow | null;
}

/**
 * Processes one page of users: writes in-app notifications for everyone in the
 * page, then pushes to the subset that has a subscription and has not opted out
 * of the announcements category.
 *
 * Returns null once the page comes back empty, meaning the campaign is finished.
 */
async function processBatch(
  admin: AdminClient,
  announcement: AnnouncementRow,
  cursor: string | null
): Promise<{ nextCursor: string; targeted: number; pushed: number; failed: number } | null> {
  let q = admin.from("profiles").select("id").order("id", { ascending: true }).limit(BATCH_SIZE);
  if (cursor) q = q.gt("id", cursor);

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  if (!rows?.length) return null;

  const userIds = (rows as { id: string }[]).map((r) => r.id);
  const nextCursor = userIds[userIds.length - 1];
  const notifType = announcementNotificationType(announcement.id);

  // Skip anyone already notified. A batch can be replayed after a crash or a
  // timeout, and this is what stops the campaign double-sending to them.
  const { data: existing } = await admin
    .from("notifications")
    .select("user_id")
    .eq("type", notifType)
    .in("user_id", userIds);

  const already = new Set((existing ?? []).map((r: { user_id: string }) => r.user_id));
  const targets = userIds.filter((id) => !already.has(id));

  if (!targets.length) return { nextCursor, targeted: 0, pushed: 0, failed: 0 };

  let failed = 0;

  for (let i = 0; i < targets.length; i += INSERT_CHUNK) {
    const chunk = targets.slice(i, i + INSERT_CHUNK).map((userId) => ({
      user_id: userId,
      type: notifType,
      title: announcement.title,
      body: announcement.body,
      href: announcement.href,
      is_read: false,
    }));
    const { error: insErr } = await admin.from("notifications").insert(chunk);
    if (insErr) failed += chunk.length;
  }

  // Push only to those who have a subscription and have not opted out.
  const withSubs = [
    ...(await collectUserIds((from, to) =>
      admin.from("user_push_subscriptions").select("user_id").in("user_id", targets).range(from, to)
    )),
  ];
  const allowed = await filterPushAllowed(withSubs, "announcements");

  const limit = pLimit(PUSH_CONCURRENCY);
  await Promise.all(
    allowed.map((userId) =>
      limit(() =>
        sendUserPush(userId, {
          title: announcement.title,
          body: announcement.body,
          href: announcement.href,
          tag: announcementPushTag(announcement.id),
        })
      )
    )
  );

  return {
    nextCursor,
    targeted: targets.length - failed,
    // sendUserPush is fire-and-forget and swallows per-endpoint errors, so this
    // counts users dispatched to, not deliveries confirmed by the push service.
    pushed: allowed.length,
    failed,
  };
}

export type DryRunResult = {
  announcementId: string;
  totalUsers: number;
  alreadyNotified: number;
  wouldNotify: number;
  withPushSubscription: number;
  optedOut: number;
  wouldPush: number;
};

/**
 * Reports exactly what a real send would do, without writing anything.
 *
 * Reads only. Safe to run against production, and the only way to check the
 * audience before committing to something that cannot be recalled.
 */
export async function dryRunAnnouncement(id: string): Promise<DryRunResult> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const announcement = data as AnnouncementRow | null;
  if (!announcement) throw Object.assign(new Error("Announcement not found."), { status: 404 });

  const { count: totalUsers, error: countErr } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (countErr) throw new Error(countErr.message);

  // Users this campaign has already reached (non-zero only on a resumed send).
  const notified = await collectUserIds((from, to) =>
    admin
      .from("notifications")
      .select("user_id")
      .eq("type", announcementNotificationType(announcement.id))
      .range(from, to)
  );

  const withSubs = await collectUserIds((from, to) =>
    admin.from("user_push_subscriptions").select("user_id").range(from, to)
  );

  const optedOut = await collectUserIds((from, to) =>
    admin
      .from("user_notification_preferences")
      .select("user_id")
      .eq("push_categories->>announcements", "false")
      .range(from, to)
  );

  const wouldPush = [...withSubs].filter(
    (uid) => !optedOut.has(uid) && !notified.has(uid)
  ).length;

  return {
    announcementId: announcement.id,
    totalUsers: totalUsers ?? 0,
    alreadyNotified: notified.size,
    wouldNotify: Math.max(0, (totalUsers ?? 0) - notified.size),
    withPushSubscription: withSubs.size,
    optedOut: optedOut.size,
    wouldPush,
  };
}

/**
 * Runs batches until the campaign completes or the time budget runs out.
 * Safe to call repeatedly — progress is persisted on the announcement row after
 * every batch, so the next call resumes from `cursor_id`.
 */
export async function runAnnouncementWorker(id?: string): Promise<WorkerResult> {
  const admin = createSupabaseAdminClient();
  const announcement = await claimAnnouncement(admin, id);

  if (!announcement) {
    return { done: true, announcementId: null, targeted: 0, pushed: 0, failed: 0, batches: 0 };
  }

  const startedAt = Date.now();
  let cursor = announcement.cursor_id;
  let targeted = announcement.targeted;
  let pushed = announcement.pushed;
  let failed = announcement.failed;
  let batches = 0;

  while (Date.now() - startedAt < BUDGET_MS) {
    const result = await processBatch(admin, announcement, cursor);

    if (!result) {
      await admin
        .from("announcements")
        .update({ status: "sent", finished_at: new Date().toISOString(), targeted, pushed, failed })
        .eq("id", announcement.id);
      return { done: true, announcementId: announcement.id, targeted, pushed, failed, batches };
    }

    cursor = result.nextCursor;
    targeted += result.targeted;
    pushed += result.pushed;
    failed += result.failed;
    batches += 1;

    // Persist after every batch: this is the resume point if the invocation dies.
    await admin
      .from("announcements")
      .update({ cursor_id: cursor, targeted, pushed, failed })
      .eq("id", announcement.id);
  }

  return { done: false, announcementId: announcement.id, targeted, pushed, failed, batches };
}
