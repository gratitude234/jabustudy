// app/api/study-admin/announcements/worker/route.ts
//
// Processes in-flight announcement campaigns in batches.
//
// Accepts either a super Study Admin bearer token (the admin page polls this
// while showing progress) or the CRON_SECRET (so a scheduled run can finish or
// resume a campaign whose admin closed their tab).
//
// Returns { done: false } while work remains — callers should call again.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { runAnnouncementWorker } from "@/lib/announcementWorker";
import { errorInfo } from "@/lib/announcements";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function hasCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && header.slice(7).trim() === secret;
}

async function handle(req: Request) {
  try {
    if (!hasCronSecret(req)) {
      const { isSuper } = await requireStudyModeratorFromRequest(req);
      if (!isSuper) {
        return jsonError("Only main Study Admins can run the worker.", 403, "STUDY_ADMIN_REQUIRED");
      }
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id") || undefined;

    const result = await runAnnouncementWorker(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const { message, status, code } = errorInfo(e);
    return jsonError(message, status, code);
  }
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
