export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { resolveBillingRefund } from "@/lib/studyBilling";

function jsonError(error: unknown) {
  const e = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: e.code || "SERVER_ERROR", message: e.message || "Server error" },
    { status: e.status || 500 }
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, isSuper } = await requireStudyModeratorFromRequest(req);
    if (!isSuper) return NextResponse.json({ ok: false, code: "STUDY_ADMIN_REQUIRED", message: "Only main Study Admins can resolve refunds." }, { status: 403 });
    const { id } = await params;
    const body = await req.json().catch(() => null) as { note?: unknown } | null;
    const order = await resolveBillingRefund(id, userId, body?.note);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return jsonError(error);
  }
}
