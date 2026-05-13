// app/api/vendor/orders/[orderId]/assign-rider/route.ts
// POST { rider_id } - vendor assigns a rider to the delivery_request for this order

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendRiderPush } from '@/lib/webPush';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
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

    const body = (await req.json().catch(() => null)) as { rider_id?: string } | null;
    if (!body?.rider_id) return jsonError('Missing rider_id', 400, 'bad_request');

    const admin = createSupabaseAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select('id, vendor_id, delivery_fee')
      .eq('id', orderId)
      .single();

    if (!order) return jsonError('Order not found', 404, 'order_not_found');

    const { data: vendor } = await admin
      .from('vendors')
      .select('id, delivery_fee')
      .eq('id', order.vendor_id)
      .eq('user_id', user.id)
      .single();

    if (!vendor) return jsonError('Forbidden', 403, 'forbidden');

    const { data: updatedRequests, error } = await admin
      .from('delivery_requests')
      .update({ rider_id: body.rider_id, status: 'accepted' })
      .eq('order_id', orderId)
      .select('id');

    if (error) return jsonError(error.message, 500, 'update_failed');
    if (!updatedRequests || updatedRequests.length === 0) {
      return NextResponse.json(
        { error: 'No delivery request found for this order.' },
        { status: 404 }
      );
    }

    try {
      const { data: delivery } = await admin
        .from('delivery_requests')
        .select('id, dropoff, note')
        .eq('order_id', orderId)
        .maybeSingle();

      const { data: rider } = await admin
        .from('riders')
        .select('id, name, user_id')
        .eq('id', body.rider_id)
        .maybeSingle();

      const riderFeeValue =
        typeof order.delivery_fee === 'number'
          ? order.delivery_fee
          : typeof vendor.delivery_fee === 'number'
            ? vendor.delivery_fee
            : 0;
      const riderFeeLabel =
        riderFeeValue > 0 ? `\u20A6${Number(riderFeeValue).toLocaleString()}` : 'TBD';
      const dropoff = delivery?.dropoff ?? 'See delivery details';
      const notifTitle = 'New delivery job assigned to you';
      const notifBody = `Drop-off: ${dropoff} - Fee: ${riderFeeLabel}`;
      const href = '/rider/dashboard';

      if (rider?.user_id) {
        await admin.from('notifications').insert({
          user_id: rider.user_id,
          type: 'delivery_assigned',
          title: notifTitle,
          body: notifBody,
          href,
        });

        void sendRiderPush(rider.id, {
          title: notifTitle,
          body: notifBody,
          href,
          tag: `delivery-${orderId}`,
        });
      }
    } catch {
      // Non-critical: assignment already succeeded.
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Server error',
      },
      { status: 500 }
    );
  }
}
