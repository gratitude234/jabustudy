// app/api/rider/delivery/[deliveryId]/status/route.ts
// PATCH { status } - authenticated rider updates delivery status.
// Notifies buyer at each step.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';
import { sendUserPush } from '@/lib/webPush';

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status });
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  accepted: ['picked_up', 'cancelled'],
  picked_up: ['delivered'],
};

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  picked_up: {
    title: 'Your order has been picked up',
    body: 'Your rider has collected the item and is on the way.',
  },
  delivered: {
    title: 'Order delivered!',
    body: 'Your item has been delivered. Enjoy!',
  },
  cancelled: {
    title: 'Delivery cancelled',
    body: 'Your rider had to cancel. Contact support if needed.',
  },
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ deliveryId: string }> }
) {
  try {
    const { deliveryId } = await params;

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const body = (await req.json().catch(() => null)) as { status?: string } | null;
    const newStatus = body?.status;

    if (!newStatus || !['picked_up', 'delivered', 'cancelled'].includes(newStatus)) {
      return jsonError('Invalid status', 400, 'invalid_status');
    }

    const admin = createSupabaseAdminClient();

    const { data: rider } = await admin
      .from('riders')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!rider) return jsonError('Not a rider', 403, 'not_rider');

    const { data: delivery, error: fetchErr } = await admin
      .from('delivery_requests')
      .select('id, rider_id, buyer_id, status, order_id, dropoff')
      .eq('id', deliveryId)
      .single();

    if (fetchErr || !delivery) return jsonError('Delivery not found', 404, 'not_found');
    if (delivery.rider_id !== rider.id) return jsonError('Forbidden', 403, 'forbidden');

    const allowed = VALID_TRANSITIONS[delivery.status];
    if (!allowed || !allowed.includes(newStatus)) {
      return jsonError(
        `Cannot move from ${delivery.status} to ${newStatus}`,
        400,
        'invalid_transition'
      );
    }

    const { error: updateErr } = await admin
      .from('delivery_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', deliveryId);

    if (updateErr) return jsonError(updateErr.message, 500, 'update_failed');

    const msg = STATUS_MESSAGES[newStatus];
    if (msg && delivery.buyer_id) {
      await insertNotificationBestEffort(
        admin,
        {
          user_id: delivery.buyer_id,
          type: 'delivery_status',
          title: msg.title,
          body: msg.body,
          href: '/delivery/requests',
        },
        {
          route: '/api/rider/delivery/[deliveryId]/status',
          userId: delivery.buyer_id,
          type: 'delivery_status',
        }
      );

      try {
        await sendUserPush(delivery.buyer_id, {
          title: msg.title,
          body: msg.body,
          href: '/delivery/requests',
          tag: `delivery-${deliveryId}`,
        });
      } catch {
        // Push failure must never crash the request.
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
