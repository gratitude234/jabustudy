// app/api/study-admin/announcements/route.ts
//
// GET  — list recent announcement campaigns
// POST — create a draft campaign
//
// Super study admins only: a scoped course rep or dept librarian must never be
// able to message the entire user base.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import {
  errorInfo,
  parseAnnouncementInput,
  type AnnouncementRow,
} from "@/lib/announcements";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET(req: Request) {
  try {
    const { isSuper } = await requireStudyModeratorFromRequest(req);
    if (!isSuper) {
      return jsonError("Only main Study Admins can manage announcements.", 403, "STUDY_ADMIN_REQUIRED");
    }

    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(5, Number(url.searchParams.get("limit") || 20)));

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return jsonError(error.message, 500, "DB_ERROR");

    return NextResponse.json({ ok: true, announcements: (data ?? []) as AnnouncementRow[] });
  } catch (e: unknown) {
    const { message, status, code } = errorInfo(e);
    return jsonError(message, status, code);
  }
}

export async function POST(req: Request) {
  try {
    const { userId, isSuper } = await requireStudyModeratorFromRequest(req);
    if (!isSuper) {
      return jsonError("Only main Study Admins can manage announcements.", 403, "STUDY_ADMIN_REQUIRED");
    }

    const raw = await req.json().catch(() => null);
    const input = parseAnnouncementInput(raw);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("announcements")
      .insert({
        title: input.title,
        body: input.body,
        href: input.href,
        status: "draft",
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) return jsonError(error.message, 500, "DB_ERROR");

    return NextResponse.json({ ok: true, announcement: data as AnnouncementRow });
  } catch (e: unknown) {
    const { message, status, code } = errorInfo(e);
    return jsonError(message, status, code);
  }
}
