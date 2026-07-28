// app/api/study-admin/announcements/[id]/test/route.ts
//
// Sends a draft announcement to the calling admin only, and stamps `tested_at`.
// The send route (added with the worker) refuses to broadcast a campaign that
// has never been tested — a push cannot be unsent, so seeing the real thing on
// a real phone is the last checkpoint before it reaches everyone.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { sendUserPush } from "@/lib/webPush";
import {
  announcementNotificationType,
  announcementPushTag,
  errorInfo,
  type AnnouncementRow,
} from "@/lib/announcements";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, isSuper } = await requireStudyModeratorFromRequest(req);
    if (!isSuper) {
      return jsonError("Only main Study Admins can manage announcements.", 403, "STUDY_ADMIN_REQUIRED");
    }

    const { id } = await params;
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("announcements")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return jsonError(error.message, 500, "DB_ERROR");
    const announcement = data as AnnouncementRow | null;
    if (!announcement) return jsonError("Announcement not found.", 404, "NOT_FOUND");

    const notifType = announcementNotificationType(announcement.id);

    // Clear any previous test so repeated tests always reflect the latest copy
    // instead of stacking up in the admin's notification list.
    await admin.from("notifications").delete().eq("user_id", userId).eq("type", notifType);

    const { error: notifErr } = await admin.from("notifications").insert({
      user_id: userId,
      type: notifType,
      title: announcement.title,
      body: announcement.body,
      href: announcement.href,
      is_read: false,
    });
    if (notifErr) return jsonError(notifErr.message, 500, "DB_ERROR");

    // Count subscriptions first: "test sent" is meaningless if the admin has no
    // push subscription, and we want to say so rather than report a false pass.
    const { count: subCount } = await admin
      .from("user_push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const subscriptions = subCount ?? 0;

    // Deliberately not sendUserPushIfAllowed: a test must not be silently
    // swallowed because the admin opted out of the announcements category.
    if (subscriptions > 0) {
      await sendUserPush(userId, {
        title: announcement.title,
        body: announcement.body,
        href: announcement.href,
        tag: announcementPushTag(announcement.id),
      });
    }

    const { error: stampErr } = await admin
      .from("announcements")
      .update({ tested_at: new Date().toISOString() })
      .eq("id", announcement.id);
    if (stampErr) return jsonError(stampErr.message, 500, "DB_ERROR");

    return NextResponse.json({
      ok: true,
      subscriptions,
      pushSent: subscriptions > 0,
      message:
        subscriptions > 0
          ? "Test sent. Check your notification tray and your in-app notifications."
          : "In-app notification written, but you have no push subscription on this account — enable push in your profile to test the real notification.",
    });
  } catch (e: unknown) {
    const { message, status, code } = errorInfo(e);
    return jsonError(message, status, code);
  }
}
