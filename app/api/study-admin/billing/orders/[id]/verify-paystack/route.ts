export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { verifyPaystackOrderForAdmin } from "@/lib/studyBilling";

function jsonError(error: unknown) {
  const e = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: e.code || "SERVER_ERROR", message: e.message || "Server error" },
    { status: e.status || 500 }
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { isSuper } = await requireStudyModeratorFromRequest(req);
    if (!isSuper) return NextResponse.json({ ok: false, code: "STUDY_ADMIN_REQUIRED", message: "Only main Study Admins can verify payments." }, { status: 403 });
    const { id } = await params;
    const order = await verifyPaystackOrderForAdmin(id);
    if (!order) return NextResponse.json({ ok: false, code: "ORDER_NOT_FOUND", message: "Order not found." }, { status: 404 });
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return jsonError(error);
  }
}
