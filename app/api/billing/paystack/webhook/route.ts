import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/admin";
import { approvePaystackBillingOrder, type BillingOrderRow } from "@/lib/studyBilling";

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
      id: string;
      reference: string;
      status: string;
      amount: number;
    };
  };

  let payload: PaystackEvent;
  try {
    payload = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  if (payload.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const { reference, status, amount, id: paystackTxnId } = payload.data;
  if (status !== "success") return NextResponse.json({ received: true });

  const { data: order } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (!order?.id) return NextResponse.json({ received: true });

  const row = order as BillingOrderRow;
  if (row.payment_method !== "paystack") return NextResponse.json({ received: true });
  if (row.status === "approved") return NextResponse.json({ received: true });

  if (row.amount_naira * 100 !== amount) {
    console.error(`[paystack-webhook] amount mismatch for ${reference}: expected ${row.amount_naira * 100}, got ${amount}`);
    return NextResponse.json({ received: false }, { status: 400 });
  }

  try {
    await approvePaystackBillingOrder(row.id, paystackTxnId);
  } catch (err) {
    console.error("[paystack-webhook] approval failed:", err);
    return NextResponse.json({ received: false }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
