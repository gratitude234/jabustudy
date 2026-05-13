// app/api/orders/[orderId]/vendor-confirm-payment/route.ts
// POST - vendor confirms they received the buyer's transfer

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
      .select('id, buyer_id, vendor_id, conversation_id, payment_status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return jsonError('Order not found', 404, 'order_not_found');
    if (order.payment_status !== 'buyer_confirmed') {
      return jsonError('No pending payment to confirm', 400, 'payment_not_pending');
    }

    const { data: vendorData } = await admin
      .from('vendors')
      .select('id, user_id, vendor_type')
      .eq('id', order.vendor_id)
      .eq('user_id', user.id)
      .single();

    if (!vendorData) return jsonError('Forbidden', 403, 'forbidden');

    const isFood = vendorData.vendor_type === 'food';
    const nextStatus = isFood ? 'preparing' : 'ready';

    await admin
      .from('orders')
      .update({
        payment_status: 'vendor_confirmed',
        status: nextStatus,
      })
      .eq('id', orderId);

    const notifTitle = '✅ Payment confirmed!';
    const notifBody = isFood
      ? 'Vendor confirmed your transfer. Your order is now being prepared.'
      : 'Vendor confirmed your transfer. Your item is ready for pickup.';

    await insertNotificationBestEffort(
      admin,
      {
        user_id: order.buyer_id,
        type: 'payment_confirmed',
        title: notifTitle,
        body: notifBody,
        href: '/my-orders',
      },
      {
        route: '/api/orders/[orderId]/vendor-confirm-payment',
        userId: order.buyer_id,
        type: 'payment_confirmed',
      }
    );

    try {
      await sendUserPush(order.buyer_id, {
        title: notifTitle,
        body: notifBody,
        href: '/my-orders',
        tag: `payment-confirmed-${orderId}`,
      });
    } catch {
      // Push failure must never crash the request.
    }

    if (order.conversation_id) {
      try {
        const msgBody = isFood
          ? '✅ Payment received! Your order is being prepared.'
          : '✅ Payment received! Your item is ready for collection.';
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
