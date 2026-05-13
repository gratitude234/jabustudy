// app/api/orders/[orderId]/buyer-confirm/route.ts
// POST - buyer confirms they have transferred payment

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';
import { sendVendorPush } from '@/lib/webPush';

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const admin = createSupabaseAdminClient();

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, buyer_id, vendor_id, conversation_id, total, payment_status, status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return jsonError('Order not found', 404, 'order_not_found');
    if (order.buyer_id !== user.id) return jsonError('Forbidden', 403, 'forbidden');
    if (order.payment_status !== 'unpaid') {
      return jsonError('Payment already submitted', 400, 'already_submitted');
    }
    if (['cancelled', 'delivered'].includes(order.status)) {
      return jsonError('Order is not active', 400, 'order_inactive');
    }

    await admin
      .from('orders')
      .update({
        payment_status: 'buyer_confirmed',
        payment_method: 'transfer',
        paid_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    const { data: vendor } = await admin
      .from('vendors')
      .select('id, user_id')
      .eq('id', order.vendor_id)
      .single();

    const notifHref = order.conversation_id
      ? `/inbox/${order.conversation_id}`
      : '/vendor/orders';

    if (vendor?.user_id) {
      await insertNotificationBestEffort(
        admin,
        {
          user_id: vendor.user_id,
          type: 'payment_received',
          title: 'Buyer says payment sent',
          body: `₦${Number(order.total).toLocaleString()} — check your account and confirm receipt.`,
          href: notifHref,
        },
        {
          route: '/api/orders/[orderId]/buyer-confirm',
          userId: vendor.user_id,
          type: 'payment_received',
        }
      );

      try {
        await sendVendorPush(order.vendor_id, {
          title: 'Payment transfer received',
          body: `Buyer confirmed ₦${Number(order.total).toLocaleString()} sent. Check and confirm.`,
          href: notifHref,
          tag: `payment-${orderId}`,
        });
      } catch {
        // Push failure must never crash the request.
      }
    }

    if (order.conversation_id) {
      try {
        const msgBody = `💸 I have transferred ₦${Number(order.total).toLocaleString()}. Please confirm once you receive it.`;
        await admin.from('messages').insert({
          conversation_id: order.conversation_id,
          sender_id: user.id,
          body: msgBody,
          type: 'text',
        });
        await admin
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: msgBody,
          })
          .eq('id', order.conversation_id);
      } catch {
        // Non-critical.
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
