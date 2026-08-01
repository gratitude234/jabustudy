import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { initializePaystackTransaction } from "@/lib/paystack";
import {
  completePaystackInitialization,
  createPaystackBillingOrder,
  failPaystackInitialization,
  isPaystackEnabled,
} from "@/lib/studyBilling";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthorized.", 401, "UNAUTHORIZED");

  const body = await req.json().catch(() => null) as { planKey?: unknown; returnTo?: unknown } | null;
  const planKey = body?.planKey;

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !isPaystackEnabled()) {
    return jsonError("Payment gateway is temporarily unavailable.", 503, "PAYSTACK_NOT_CONFIGURED");
  }
  if (!user.email) return jsonError("Add an email address to your account before paying.", 400, "EMAIL_REQUIRED");

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");

  let checkout: Awaited<ReturnType<typeof createPaystackBillingOrder>>;
  try {
    checkout = await createPaystackBillingOrder(user.id, planKey, body?.returnTo);
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string };
    return jsonError(e.message || "Could not create order.", e.status || 500, e.code || "ORDER_CREATE_FAILED");
  }

  // NEXT_PUBLIC_SITE_URL points at production even in dev, which would bounce a
  // local tester to the live site after paying. Send them back where they started.
  const requestOrigin = req.nextUrl.origin;
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin);
  const baseUrl = isLocalOrigin ? requestOrigin : siteUrl;

  if (checkout.authorizationUrl) {
    return NextResponse.json({
      ok: true,
      authorizationUrl: checkout.authorizationUrl,
      order: checkout.order,
      reused: true,
    });
  }

  const callbackUrl = `${baseUrl}/study/billing?ref=${encodeURIComponent(checkout.order.reference)}`;
  let initialized: Awaited<ReturnType<typeof initializePaystackTransaction>>;
  try {
    initialized = await initializePaystackTransaction({
      secretKey,
      email: user.email,
      amountKobo: checkout.order.amountNaira * 100,
      reference: checkout.order.reference,
      callbackUrl,
      metadata: {
        order_id: checkout.order.id,
        plan_key: checkout.order.planKey,
        user_id: user.id,
      },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string };
    await failPaystackInitialization(checkout.order.id, e.message || "Paystack checkout could not be opened.", e.code);
    return jsonError(e.message || "Could not initialize Paystack payment.", e.status || 502, e.code || "PAYSTACK_INIT_FAILED");
  }

  try {
    const order = await completePaystackInitialization({
      orderId: checkout.order.id,
      userId: user.id,
      authorizationUrl: initialized.authorizationUrl,
    });
    return NextResponse.json({ ok: true, authorizationUrl: initialized.authorizationUrl, order, reused: false });
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string };
    return jsonError(
      e.message || "Checkout opened but its status could not be saved. Check your Billing page before trying again.",
      e.status || 500,
      e.code || "ORDER_INIT_UPDATE_FAILED"
    );
  }
}
