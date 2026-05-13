// app/api/orders/[orderId]/cancel/route.ts
// Authenticated buyer endpoint — self-cancel a pending order.
// Only allowed while status === 'pending' (vendor hasn't acted yet).
// Once the vendor accepts (status moves to 'preparing'), this returns 409
// and the student must request cancellation via chat.
//
// Required SQL migrations:
// CREATE OR REPLACE FUNCTION increment_item_stock(p_item_id uuid, p_qty int)
// RETURNS void LANGUAGE plpgsql AS $$
// BEGIN
//   UPDATE vendor_menu_items
//   SET stock_count = stock_count + p_qty
//   WHERE id = p_item_id AND stock_count IS NOT NULL;
// END;
// $$;
//
// ALTER TABLE public.orders
// ADD COLUMN IF NOT EXISTS cancellation_reason text;

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendVendorPush } from '@/lib/webPush';
import type { OrderPayload } from '@/types/meal-builder';

function jsonError(msg: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status });
}

type CancelOrderRow = {
  id: string;
  buyer_id: string;
  vendor_id: string;
  status: string;
  conversation_id: string | null;
  total: number;
  items: OrderPayload | null;
};

function buildCancellationMessage(reason: string | null) {
  return reason
    ? `❌ Order cancelled by customer — ${reason}`
    : '❌ Order cancelled by customer';
}

async function restoreTrackedStock(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  items: OrderPayload | null,
) {
  const lines = items?.lines ?? [];
  for (const line of lines) {
    const { error } = await admin.rpc('increment_item_stock', {
      p_item_id: line.item_id,
      p_qty: line.qty,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function POST(
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

    const body = (await req.json().catch(() => null)) as { reason?: string } | null;
    const cancellationReason =
      typeof body?.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 120)
        : null;

    const admin = createSupabaseAdminClient();

    const { data: fetchedOrder, error: fetchErr } = await admin
      .from('orders')
      .select('id, buyer_id, vendor_id, status, conversation_id, total, items')
      .eq('id', orderId)
      .single();

    const order = (fetchedOrder as CancelOrderRow | null) ?? null;
    if (fetchErr || !order) return jsonError('Order not found', 404, 'not_found');

    if (order.buyer_id !== user.id) {
      return jsonError('Forbidden', 403, 'forbidden');
    }

    if (order.status !== 'pending') {
      const msg =
        ['preparing', 'ready'].includes(order.status)
          ? 'The vendor has already started your order. Message them to request a cancellation.'
          : order.status === 'delivered'
            ? 'This order has already been delivered.'
            : order.status === 'cancelled'
              ? 'This order is already cancelled.'
              : `Cannot cancel an order with status: ${order.status}`;
      return jsonError(msg, 409, 'not_cancellable');
    }

    const { data: cancelledOrder, error: cancelErr } = await admin
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        cancellation_reason: cancellationReason,
      })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (cancelErr) return jsonError(cancelErr.message, 500, 'cancel_failed');
    if (!cancelledOrder) {
      return jsonError(
        'The vendor has already acted on this order. Message them to request a cancellation.',
        409,
        'not_cancellable',
      );
    }

    try {
      await restoreTrackedStock(admin, order.items);
    } catch (stockErr) {
      const message = stockErr instanceof Error ? stockErr.message : 'Failed to restore item stock';
      return jsonError(message, 500, 'stock_restore_failed');
    }

    if (order.conversation_id) {
      const messageBody = buildCancellationMessage(cancellationReason);

      const { error: messageErr } = await admin.from('messages').insert({
        conversation_id: order.conversation_id,
        sender_id: user.id,
        body: messageBody,
        type: 'text',
      });
      if (messageErr) {
        console.error('[orders/cancel] message insert failed:', messageErr.message);
      }

      const { error: convoErr } = await admin
        .from('conversations')
        .update({
          last_message_preview: messageBody,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', order.conversation_id);
      if (convoErr) {
        console.error('[orders/cancel] conversation update failed:', convoErr.message);
      }

      const { error: unreadErr } = await admin.rpc('increment_vendor_unread', {
        convo_id: order.conversation_id,
      });
      if (unreadErr) {
        console.error('[orders/cancel] unread increment failed:', unreadErr.message);
      }
    }

    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('id, user_id')
      .eq('id', order.vendor_id)
      .single();
    if (vendorErr) {
      console.error('[orders/cancel] vendor fetch failed:', vendorErr.message);
    }

    const notifTitle = 'Order cancelled';
    const notifBody = cancellationReason
      ? `A ₦${order.total.toLocaleString()} order was cancelled before you accepted it. Reason: ${cancellationReason}`
      : `A ₦${order.total.toLocaleString()} order was cancelled before you accepted it.`;

    if (vendor?.user_id) {
      const { error: notifErr } = await admin.from('notifications').insert({
        user_id: vendor.user_id,
        type: 'order_cancelled',
        title: notifTitle,
        body: notifBody,
        href: '/vendor/orders',
      });
      if (notifErr) {
        console.error('[orders/cancel] vendor notification failed:', notifErr.message);
      }

      try {
        await sendVendorPush(order.vendor_id, {
          title: notifTitle,
          body: notifBody,
          href: '/vendor/orders',
          tag: `cancelled-${orderId}`,
        });
      } catch (pushErr) {
        console.error('[orders/cancel] vendor push failed:', pushErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
