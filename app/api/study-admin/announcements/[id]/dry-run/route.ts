// app/api/study-admin/announcements/[id]/dry-run/route.ts
//
// Read-only audience report: what a real broadcast would do, without writing
// anything. Exists because Broadcast is live in every environment — local dev
// points at the production database — so there is otherwise no safe rehearsal.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { dryRunAnnouncement } from "@/lib/announcementWorker";
import { errorInfo } from "@/lib/announcements";

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
      return jsonError("Only main Study Admins can run a dry run.", 403, "STUDY_ADMIN_REQUIRED");
    }

    const { id } = await params;
    const report = await dryRunAnnouncement(id);

    return NextResponse.json({ ok: true, report });
  } catch (e: unknown) {
    const { message, status, code } = errorInfo(e);
    return jsonError(message, status, code);
  }
}
