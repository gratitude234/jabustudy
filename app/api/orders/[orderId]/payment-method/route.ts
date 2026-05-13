// app/api/orders/[orderId]/payment-method/route.ts
// PATCH - buyer sets payment method to cash

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';
import { sendVendorPush } from '@/lib/webPush';

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const body = (await req.json().catch(() => null)) as { payment_method?: string } | null;
    if (body?.payment_method !== 'cash') {
      return jsonError('payment_method must be "cash"', 400, 'bad_payment_method');
    }

    const admin = createSupabaseAdminClient();

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, buyer_id, vendor_id, conversation_id, total')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return jsonError('Order not found', 404, 'order_not_found');
    if (order.buyer_id !== user.id) return jsonError('Forbidden', 403, 'forbidden');

    const { data: vendor } = await admin
      .from('vendors')
      .select('id, user_id, vendor_type')
      .eq('id', order.vendor_id)
      .single();

    if (vendor?.vendor_type === 'food') {
      return jsonError(
        `Cash payment is not available for food orders. Please transfer to the vendor's bank account and tap "I've paid".`,
        400,
        'cash_not_allowed_for_food'
      );
    }

    await admin.from('orders').update({ payment_method: 'cash' }).eq('id', orderId);

    const notifTitle = 'Cash payment';
    const notifBody = 'Buyer will pay cash on pickup/delivery.';

    if (vendor?.user_id) {
      await insertNotificationBestEffort(
        admin,
        {
          user_id: vendor.user_id,
          type: 'payment_cash',
          title: notifTitle,
          body: notifBody,
          href: '/vendor/orders',
        },
        {
          route: '/api/orders/[orderId]/payment-method',
          userId: vendor.user_id,
          type: 'payment_cash',
        }
      );

      try {
        await sendVendorPush(order.vendor_id, {
          title: notifTitle,
          body: notifBody,
          href: '/vendor/orders',
          tag: `cash-${orderId}`,
        });
      } catch {
        // Push failure must never crash the request.
      }
    }

    if (order.conversation_id) {
      try {
        const msgBody = `🤝 I'll pay cash on pickup.`;
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
