import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { approvePaystackBillingOrder, flagPaystackRefund, recordPaystackFailure } from "@/lib/studyBilling";

export async function POST(req: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ received: false }, { status: 500 });

  const rawBody = await req.text();
  const incoming = req.headers.get("x-paystack-signature") ?? "";

  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  let sigValid = false;
  try {
    sigValid = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(incoming, "hex"));
  } catch {
    sigValid = false;
  }
  if (!sigValid) return NextResponse.json({ received: false }, { status: 400 });

  type PaystackEvent = {
    event: string;
    data: {
      id?: string | number;
      reference?: string;
      status?: string;
      amount?: number;
      currency?: string;
      paid_at?: string | null;
      refunded_at?: string | null;
      transaction_reference?: string | null;
      transaction?: { id?: string | number; reference?: string } | null;
    };
  };

  let payload: PaystackEvent;
  try {
    payload = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }
  if (!payload || typeof payload.event !== "string" || !payload.data || typeof payload.data !== "object") {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  if (payload.event === "charge.failed") {
    if (payload.data.reference) {
      try {
        await recordPaystackFailure(payload.data.reference, payload.data.status || "failed");
      } catch (error) {
        console.error("[paystack-webhook] failure status update failed", error);
        return NextResponse.json({ received: false }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (payload.event === "refund.processed" || payload.event === "charge.refunded") {
    const reference = payload.data.reference || payload.data.transaction?.reference || null;
    const transactionId = payload.data.transaction_reference || (payload.data.transaction?.id != null ? String(payload.data.transaction.id) : null);
    if (typeof payload.data.amount !== "number" || !payload.data.currency) {
      console.error("[paystack-webhook] incomplete refund payload", { event: payload.event });
      return NextResponse.json({ received: false }, { status: 400 });
    }
    try {
      await flagPaystackRefund({
        reference,
        transactionId,
        amountKobo: payload.data.amount,
        currency: payload.data.currency,
        refundedAt: payload.data.refunded_at,
        note: `Verified Paystack event: ${payload.event}`,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "ORDER_NOT_FOUND") return NextResponse.json({ received: true });
      console.error("[paystack-webhook] refund flag failed", error);
      return NextResponse.json({ received: false }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (payload.event !== "charge.success") return NextResponse.json({ received: true });

  const { reference, status, amount, currency, paid_at: paidAt, id } = payload.data;
  if (status !== "success") return NextResponse.json({ received: true });
  if (!reference || typeof amount !== "number" || !currency || id == null) {
    return NextResponse.json({ received: false }, { status: 400 });
  }
  try {
    await approvePaystackBillingOrder({
      reference,
      transactionId: String(id),
      amountKobo: amount,
      currency,
      paidAt,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ORDER_NOT_FOUND" || code === "REFUND_REVIEW_ACTIVE") {
      return NextResponse.json({ received: true });
    }
    console.error("[paystack-webhook] fulfilment failed", { reference, code: code || "UNKNOWN" });
    return NextResponse.json({ received: false }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
