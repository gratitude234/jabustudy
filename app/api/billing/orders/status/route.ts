import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyPaystackOrder } from "@/lib/studyBilling";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorized.", 401, "UNAUTHORIZED");

  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  if (!ref) return jsonError("ref is required.", 400, "MISSING_REF");

  try {
    const order = await verifyPaystackOrder(ref, user.id);
    if (!order) return jsonError("Order not found.", 404, "ORDER_NOT_FOUND");
    const terminal = ["approved", "failed", "abandoned", "expired", "rejected", "cancelled"].includes(order.status);
    const retryable = ["failed", "abandoned", "expired", "rejected"].includes(order.status);
    return NextResponse.json({
      ok: true,
      order,
      providerStatus: order.providerStatus,
      terminal,
      retryable,
      returnPath: order.returnPath,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string; retryable?: boolean };
    return NextResponse.json(
      {
        ok: false,
        code: e.code || "DB_ERROR",
        message: e.message || "Could not fetch order.",
        retryable: e.retryable ?? true,
      },
      { status: e.status || 500 }
    );
  }
}
