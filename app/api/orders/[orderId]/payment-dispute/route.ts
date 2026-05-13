// app/api/orders/[orderId]/payment-dispute/route.ts
// POST - vendor marks the buyer's claimed payment as unconfirmed, resetting to unpaid

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';
import { sendUserPush } from '@/lib/webPush';

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
      .select('id, buyer_id, vendor_id, conversation_id')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return jsonError('Order not found', 404, 'order_not_found');

    const { data: vendor } = await admin
      .from('vendors')
      .select('id, user_id')
      .eq('id', order.vendor_id)
      .eq('user_id', user.id)
      .single();

    if (!vendor) return jsonError('Forbidden', 403, 'forbidden');

    await admin.from('orders').update({ payment_status: 'unpaid' }).eq('id', orderId);

    const notifTitle = 'Payment not confirmed';
    const notifBody =
      'Vendor could not confirm your transfer. Please check and resend, or contact them in chat.';

    await insertNotificationBestEffort(
      admin,
      {
        user_id: order.buyer_id,
        type: 'payment_dispute',
        title: notifTitle,
        body: notifBody,
        href: '/my-orders',
      },
      {
        route: '/api/orders/[orderId]/payment-dispute',
        userId: order.buyer_id,
        type: 'payment_dispute',
      }
    );

    try {
      await sendUserPush(order.buyer_id, {
        title: notifTitle,
        body: notifBody,
        href: '/my-orders',
        tag: `payment-dispute-${orderId}`,
      });
    } catch {
      // Push failure must never crash the request.
    }

    if (order.conversation_id) {
      try {
        const msgBody =
          '⚠️ I could not confirm your transfer. Please check and resend, or message me if you need help.';
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
