export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { approveBillingOrder } from "@/lib/studyBilling";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function errorInfo(error: unknown) {
  const e = error as { message?: unknown; status?: unknown; code?: unknown };
  return {
    message: typeof e.message === "string" ? e.message : "Server error",
    status: typeof e.status === "number" ? e.status : 500,
    code: typeof e.code === "string" ? e.code : "SERVER_ERROR",
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, isSuper } = await requireStudyModeratorFromRequest(req);
    if (!isSuper) return jsonError("Only main Study Admins can approve billing.", 403, "STUDY_ADMIN_REQUIRED");
    const body = await req.json().catch(() => null) as { note?: unknown } | null;
    const order = await approveBillingOrder(id, userId, body?.note);
    return NextResponse.json({ ok: true, order });
  } catch (error: unknown) {
    const info = errorInfo(error);
    return jsonError(info.message, info.status, info.code);
  }
}
