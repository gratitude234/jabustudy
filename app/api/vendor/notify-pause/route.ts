// app/api/vendor/notify-pause/route.ts
// Called by the vendor dashboard when going offline with active orders.
// Notifies each affected buyer so they know their order is still being handled.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status });
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const body = await req.json().catch(() => null) as { vendor_id?: string } | null;
    if (!body?.vendor_id) return jsonError('vendor_id required', 400, 'missing_vendor_id');

    const admin = createSupabaseAdminClient();

    // Verify the calling user owns this vendor
    const { data: vendor } = await admin
      .from('vendors')
      .select('id, name, user_id')
      .eq('id', body.vendor_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!vendor) return jsonError('Forbidden', 403, 'forbidden');

    // Find all active orders for this vendor
    const { data: activeOrders } = await admin
      .from('orders')
      .select('id, buyer_id, conversation_id, status')
      .eq('vendor_id', vendor.id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready']);

    if (!activeOrders || activeOrders.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 });
    }

    // Notify each unique buyer
    const buyerIds = [...new Set(activeOrders.map((o) => o.buyer_id))];

    await admin.from('notifications').insert(
      buyerIds.map((buyer_id) => ({
        user_id: buyer_id,
        type: 'vendor_paused',
        title: `${vendor.name} has paused new orders`,
        body: 'Your existing order is not affected — they are still preparing it.',
        href: '/my-orders',
      }))
    );
    // swallow — notification failure must not break the pause response

    // Also post a message in each active conversation so it appears in chat
    const convMessages = activeOrders
      .filter((o) => o.conversation_id && ['pending', 'preparing'].includes(o.status))
      .map((o) => ({
        conversation_id: o.conversation_id!,
        sender_id: user.id,
        body: `ℹ️ ${vendor.name} has paused new orders. Your order is still being handled — we appreciate your patience.`,
        type: 'text' as const,
      }));

    if (convMessages.length > 0) {
      try {
        await admin.from('messages').insert(convMessages);
      } catch (_) {}
    }

    return NextResponse.json({ ok: true, notified: buyerIds.length });

  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}