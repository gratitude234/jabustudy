import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { createPaystackBillingOrder } from "@/lib/studyBilling";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorized.", 401, "UNAUTHORIZED");

  const body = await req.json().catch(() => null) as { planKey?: unknown } | null;
  const planKey = body?.planKey;

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return jsonError("Payment gateway not configured.", 503, "PAYSTACK_NOT_CONFIGURED");

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");

  let order: Awaited<ReturnType<typeof createPaystackBillingOrder>>;
  try {
    order = await createPaystackBillingOrder(user.id, planKey);
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string };
    return jsonError(e.message || "Could not create order.", e.status || 500, e.code || "ORDER_CREATE_FAILED");
  }

  // NEXT_PUBLIC_SITE_URL points at production even in dev, which would bounce a
  // local tester to the live site after paying. Send them back where they started.
  const requestOrigin = req.nextUrl.origin;
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin);
  const baseUrl = isLocalOrigin ? requestOrigin : siteUrl;

  const callbackUrl = `${baseUrl}/study/billing?ref=${order.reference}`;
  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: order.amountNaira * 100,
      reference: order.reference,
      callback_url: callbackUrl,
      metadata: { order_id: order.id, plan_key: order.planKey, user_id: user.id },
    }),
  });

  const paystackData = await paystackRes.json().catch(() => null) as { status?: boolean; data?: { authorization_url?: string } } | null;

  if (!paystackRes.ok || !paystackData?.status || !paystackData.data?.authorization_url) {
    await adminSupabase
      .from("study_billing_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
      .eq("id", order.id);
    return jsonError("Could not initialize Paystack payment. Please try again.", 502, "PAYSTACK_INIT_FAILED");
  }

  return NextResponse.json({ ok: true, authorizationUrl: paystackData.data.authorization_url, order });
}
