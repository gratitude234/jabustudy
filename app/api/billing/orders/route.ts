export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBillingOrder, getBankDetails, getBillingHistory, isPaystackEnabled } from "@/lib/studyBilling";

function errorResponse(error: unknown) {
  const e = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: e.code || "SERVER_ERROR", message: e.message || "Server error" },
    { status: Number(e.status) || 500 }
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, code: "NO_SESSION", message: "Sign in first." }, { status: 401 });
    const cursor = req.nextUrl.searchParams.get("cursor");
    const limit = Number(req.nextUrl.searchParams.get("limit") || 20);
    const history = await getBillingHistory(user.id, { cursor, limit });
    return NextResponse.json({ ok: true, ...history });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, code: "NO_SESSION", message: "Sign in first." }, { status: 401 });

    // Manual bank transfer is retired while Paystack is live. Existing manual orders
    // still submit receipts through the routes below; this only blocks new ones.
    if (isPaystackEnabled()) {
      return NextResponse.json(
        { ok: false, code: "MANUAL_PAYMENT_DISABLED", message: "Bank transfer is no longer available. Please pay with Paystack." },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => null) as { planKey?: unknown } | null;
    const order = await createBillingOrder(user.id, body?.planKey);
    return NextResponse.json({ ok: true, order, bank: getBankDetails() });
  } catch (error) {
    return errorResponse(error);
  }
}
