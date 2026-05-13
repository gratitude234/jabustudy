// app/api/orders/[orderId]/update-eta/route.ts
// Authenticated vendor endpoint — update an existing order ETA.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendUserPush } from '@/lib/webPush';

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

type EtaBody = {
  eta_ready_at?: string;
};

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
    if (!user) return jsonError('Unauthenticated', 401);

    const body = (await req.json().catch(() => null)) as EtaBody | null;
    if (!body?.eta_ready_at) {
      return jsonError('eta_ready_at is required', 400);
    }

    const etaDate = new Date(body.eta_ready_at);
    if (Number.isNaN(etaDate.getTime())) {
      return jsonError('Invalid eta_ready_at', 400);
    }

    const admin = createSupabaseAdminClient();

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, buyer_id, vendor_id, status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return jsonError(orderErr?.message ?? 'Order not found', orderErr ? 500 : 404);
    if (!['confirmed', 'preparing'].includes(order.status)) {
      return jsonError('ETA can only be updated for confirmed or preparing orders.', 400);
    }

    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('id')
      .eq('id', order.vendor_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (vendorErr) return jsonError(vendorErr.message, 500);
    if (!vendor) return jsonError('Forbidden', 403);

    const { error: updateErr } = await admin
      .from('orders')
      .update({
        eta_ready_at: etaDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateErr) return jsonError(updateErr.message, 500);

    const formattedTime = etaDate.toLocaleTimeString('en-NG', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const message = `Your order ETA has been updated to ${formattedTime}`;

    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: order.buyer_id,
      type: 'order_status',
      title: 'ETA updated',
      body: message,
      href: '/my-orders',
    });

    if (notifErr) {
      console.error('[orders/update-eta] notification insert failed:', notifErr.message);
    }

    try {
      await sendUserPush(order.buyer_id, {
        title: 'ETA updated',
        body: message,
        href: '/my-orders',
        tag: `eta-${orderId}`,
      });
    } catch (pushErr) {
      console.error('[orders/update-eta] push failed:', pushErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return jsonError(message, 500);
  }
}
