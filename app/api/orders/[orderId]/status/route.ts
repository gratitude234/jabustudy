// app/api/orders/[orderId]/status/route.ts
// Authenticated endpoint — vendor updates order status, optionally with ETA.
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
import { sendUserPush } from '@/lib/webPush';
import type { OrderPayload } from '@/types/meal-builder';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['preparing', 'cancelled'],
  confirmed: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready'],
  ready: ['delivered'],
};

type OrderStatusRow = {
  id: string;
  vendor_id: string;
  buyer_id: string;
  conversation_id: string | null;
  status: string;
  order_type: string | null;
  payment_status: string | null;
  payment_method: string | null;
  total: number;
  items: OrderPayload | null;
};

function buildStatusMessage(newStatus: string, orderType: string, isFood: boolean, eta?: number): string {
  switch (newStatus) {
    case 'confirmed':
      return eta
        ? `✅ Order confirmed! Ready in about ${eta} minute${eta === 1 ? '' : 's'}`
        : "✅ Order confirmed — we're on it!";
    case 'preparing':
      if (!isFood) {
        return eta
          ? `✅ Order confirmed — item ready in ~${eta} mins`
          : '✅ Order confirmed — your item is being arranged';
      }
      return eta
        ? `👨‍🍳 Order accepted — ready in ~${eta} mins`
        : '👨‍🍳 Order accepted and being prepared';
    case 'ready':
      if (!isFood) {
        return orderType === 'delivery'
          ? '🛵 Your item is ready — rider is on the way!'
          : '🔔 Your item is ready for collection!';
      }
      return orderType === 'delivery'
        ? '🛵 Your order is ready — rider is on the way!'
        : '🔔 Your order is ready for pickup!';
    case 'delivered':
      return isFood ? '✅ Order delivered. Enjoy your meal!' : '✅ Item delivered. Enjoy!';
    default:
      return `Order status updated: ${newStatus}`;
  }
}

function buildCancelledMessage(reason: string | null) {
  return reason ? `❌ Order cancelled — ${reason}` : '❌ Order cancelled';
}

const STATUS_TITLES: Record<string, string> = {
  confirmed: 'Order confirmed',
  preparing: 'Order in progress',
  ready: 'Ready!',
  delivered: 'Order delivered',
  cancelled: 'Order cancelled',
};

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

    const body = (await req.json().catch(() => null)) as {
      status?: string;
      eta_minutes?: number;
      reason?: string;
    } | null;

    const newStatus = body?.status;
    const eta = typeof body?.eta_minutes === 'number' && body.eta_minutes > 0 ? body.eta_minutes : undefined;
    const cancellationReason =
      typeof body?.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 120)
        : null;

    if (!newStatus || !['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'].includes(newStatus)) {
      return jsonError('Invalid status', 400, 'invalid_status');
    }

    const admin = createSupabaseAdminClient();

    const { data: orderData, error: orderErr } = await admin
      .from('orders')
      .select('id, vendor_id, buyer_id, conversation_id, status, order_type, payment_status, payment_method, total, items')
      .eq('id', orderId)
      .single();

    const order = (orderData as OrderStatusRow | null) ?? null;
    if (orderErr || !order) return jsonError('Order not found', 404, 'order_not_found');

    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('id, user_id, vendor_type')
      .eq('id', order.vendor_id)
      .eq('user_id', user.id)
      .single();

    if (vendorErr || !vendor) return jsonError('You are not the vendor for this order', 403, 'forbidden');

    const isFood = vendor.vendor_type === 'food';

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(newStatus)) {
      return jsonError(`Cannot transition from ${order.status} to ${newStatus}`, 400, 'invalid_transition');
    }

    if (newStatus === 'preparing') {
      const isCashOrder = order.payment_method === 'cash';
      if (!isCashOrder && order.payment_status !== 'vendor_confirmed') {
        return jsonError(
          'Payment must be confirmed before the order can be prepared. Use "Confirm payment" to verify the transfer first.',
          400,
          'payment_not_confirmed'
        );
      }
    }

    const { data: updatedOrder, error: updateErr } = await admin
      .from('orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        cancellation_reason: newStatus === 'cancelled' ? cancellationReason : null,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateErr) return jsonError(updateErr.message, 500, 'update_failed');

    if (newStatus === 'cancelled') {
      try {
        await restoreTrackedStock(admin, order.items);
      } catch (stockErr) {
        const message = stockErr instanceof Error ? stockErr.message : 'Failed to restore item stock';
        return jsonError(message, 500, 'stock_restore_failed');
      }
    }

    if (eta && newStatus === 'preparing') {
      const { error: etaErr } = await admin
        .from('orders')
        .update({ eta_ready_at: new Date(Date.now() + eta * 60 * 1000).toISOString() })
        .eq('id', orderId);
      if (etaErr) {
        console.error('[orders/status] eta update failed:', etaErr.message);
      }
    }

    const msgBody =
      newStatus === 'cancelled'
        ? buildCancelledMessage(cancellationReason)
        : buildStatusMessage(newStatus, order.order_type ?? 'pickup', isFood, eta);

    if (order.conversation_id) {
      const { error: messageErr } = await admin.from('messages').insert({
        conversation_id: order.conversation_id,
        sender_id: user.id,
        body: msgBody,
        type: 'text',
      });
      if (messageErr) {
        console.error('[orders/status] message insert failed:', messageErr.message);
      }

      const { error: convoErr } = await admin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString(), last_message_preview: msgBody })
        .eq('id', order.conversation_id);
      if (convoErr) {
        console.error('[orders/status] conversation update failed:', convoErr.message);
      }

      const { error: unreadErr } = await admin.rpc('increment_buyer_unread', {
        convo_id: order.conversation_id,
      });
      if (unreadErr) {
        console.error('[orders/status] unread increment failed:', unreadErr.message);
      }
    }

    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: order.buyer_id,
      type: 'order_status',
      title: STATUS_TITLES[newStatus] ?? `Order ${newStatus}`,
      body: msgBody,
      href: '/my-orders',
    });
    if (notifErr) {
      console.error('[orders/status] buyer notification failed:', notifErr.message);
    }

    try {
      await sendUserPush(order.buyer_id, {
        title: STATUS_TITLES[newStatus] ?? `Order ${newStatus}`,
        body: msgBody,
        href: '/my-orders',
        tag: `order-${orderId}`,
      });
    } catch (pushErr) {
      console.error('[orders/status] buyer push failed:', pushErr);
    }

    if (newStatus === 'delivered') {
      let vendorName = 'the vendor';
      const { data: vendorRow, error: vendorNameErr } = await admin
        .from('vendors')
        .select('name')
        .eq('id', order.vendor_id)
        .maybeSingle();
      if (vendorNameErr) {
        console.error('[orders/status] vendor name lookup failed:', vendorNameErr.message);
      }
      if (vendorRow?.name) {
        vendorName = vendorRow.name;
      }

      const { error: reviewNotifErr } = await admin.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'review_prompt',
        title: 'How was your order?',
        body: `Leave a quick rating for ${vendorName} — it helps other students.`,
        href: `/vendors/${order.vendor_id}?review=1`,
      });
      if (reviewNotifErr) {
        console.error('[orders/status] review notification failed:', reviewNotifErr.message);
      }

      try {
        await sendUserPush(order.buyer_id, {
          title: 'How was your order?',
          body: `Leave a quick rating for ${vendorName} — it helps other students.`,
          href: `/vendors/${order.vendor_id}?review=1`,
          tag: `review-${orderId}`,
        });
      } catch (pushErr) {
        console.error('[orders/status] review push failed:', pushErr);
      }
    }

    return NextResponse.json({ ok: true, order: updatedOrder });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
