// app/api/orders/[orderId]/nudge-vendor/route.ts
// POST - buyer re-pings the vendor when stuck in buyer_confirmed for too long.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status });
}

const NUDGE_COOLDOWN_MS = 15 * 60 * 1000;

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
      .select('id, buyer_id, vendor_id, conversation_id, total, payment_status, last_nudge_at')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return jsonError('Order not found', 404, 'order_not_found');
    if (order.buyer_id !== user.id) return jsonError('Forbidden', 403, 'forbidden');

    if (order.payment_status !== 'buyer_confirmed') {
      return jsonError(
        'Order is not awaiting vendor payment confirmation',
        400,
        'wrong_state'
      );
    }

    const lastNudgeAt = order.last_nudge_at as string | null;
    if (lastNudgeAt) {
      const elapsed = Date.now() - new Date(lastNudgeAt).getTime();
      if (!Number.isNaN(elapsed) && elapsed < NUDGE_COOLDOWN_MS) {
        const waitMins = Math.ceil((NUDGE_COOLDOWN_MS - elapsed) / 60000);
        return jsonError(
          `Please wait ${waitMins} more minute${waitMins === 1 ? '' : 's'} before nudging again.`,
          429,
          'nudge_cooldown'
        );
      }
    }

    await admin
      .from('orders')
      .update({ last_nudge_at: new Date().toISOString() })
      .eq('id', orderId);

    const { data: vendor } = await admin
      .from('vendors')
      .select('user_id')
      .eq('id', order.vendor_id)
      .single();

    if (vendor?.user_id) {
      await insertNotificationBestEffort(
        admin,
        {
          user_id: vendor.user_id,
          type: 'payment_nudge',
          title: '⏳ Buyer is waiting for payment confirmation',
          body: `A buyer transferred ₦${Number(order.total).toLocaleString()} and is still waiting. Please confirm or dispute the payment.`,
          href: '/vendor/orders',
        },
        {
          route: '/api/orders/[orderId]/nudge-vendor',
          userId: vendor.user_id,
          type: 'payment_nudge',
        }
      );

      try {
        const { sendPush } = await import('@/lib/webPush');
        const { data: subs } = await admin
          .from('vendor_push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('vendor_id', order.vendor_id);
        if (subs && subs.length > 0) {
          await Promise.allSettled(
            subs.map((sub) =>
              sendPush(sub, {
                title: '⏳ Payment confirmation needed',
                body: `Buyer is waiting — check ₦${Number(order.total).toLocaleString()} transfer`,
                data: { href: '/vendor/orders' },
              })
            )
          );
        }
      } catch {
        // Push failure must never crash the request.
      }
    }

    if (order.conversation_id) {
      try {
        const msgBody = `⏳ Hi, I transferred ₦${Number(order.total).toLocaleString()} and I'm still waiting for confirmation. Please check when you can.`;
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
        await admin.rpc('increment_vendor_unread' as any, {
          convo_id: order.conversation_id,
        });
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
