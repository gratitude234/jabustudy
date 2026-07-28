// app/api/study-admin/announcements/[id]/send/route.ts
//
// Moves a tested draft into 'sending'. It does not deliver anything itself —
// the worker route does the fan-out, so this stays fast and the campaign has a
// durable in-flight state even if the caller disconnects immediately after.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { errorInfo, type AnnouncementRow } from "@/lib/announcements";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isSuper } = await requireStudyModeratorFromRequest(req);
    if (!isSuper) {
      return jsonError("Only main Study Admins can broadcast.", 403, "STUDY_ADMIN_REQUIRED");
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

    if (announcement.status !== "draft") {
      return jsonError(
        `This announcement is already ${announcement.status}.`,
        409,
        "NOT_A_DRAFT"
      );
    }

    // A push cannot be unsent. Seeing it on a real device is the last checkpoint.
    if (!announcement.tested_at) {
      return jsonError(
        "Send yourself a test first — a push cannot be recalled once broadcast.",
        422,
        "NOT_TESTED"
      );
    }

    const { data: updated, error: updErr } = await admin
      .from("announcements")
      .update({ status: "sending", started_at: new Date().toISOString() })
      .eq("id", announcement.id)
      // Guard against two admins pressing Broadcast at the same moment.
      .eq("status", "draft")
      .select("*")
      .maybeSingle();

    if (updErr) return jsonError(updErr.message, 500, "DB_ERROR");
    if (!updated) return jsonError("Announcement is no longer a draft.", 409, "NOT_A_DRAFT");

    return NextResponse.json({ ok: true, announcement: updated as AnnouncementRow });
  } catch (e: unknown) {
    const { message, status, code } = errorInfo(e);
    return jsonError(message, status, code);
  }
}
