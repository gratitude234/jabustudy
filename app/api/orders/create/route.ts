// app/api/orders/create/route.ts
// Authenticated endpoint — buyer creates a meal order with server-side price validation

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { OrderPayload, OrderLine } from '@/types/meal-builder';
import { sendVendorPush } from '@/lib/webPush';
import { isOpenNow } from '@/lib/vendorSchedule';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(req: Request) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────────
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    // ── Parse body ─────────────────────────────────────────────────────────────
    const body = (await req.json().catch(() => null)) as {
      vendor_id?: string;
      order_payload?: OrderPayload;
      pickup_note?: string;
      order_type?: 'pickup' | 'delivery';
      delivery_address?: string | null;
    } | null;

    if (!body?.vendor_id || !body?.order_payload) {
      return jsonError('Missing vendor_id or order_payload', 400, 'bad_request');
    }

    const { vendor_id, order_payload, pickup_note, order_type, delivery_address } = body;
    const lines: OrderLine[] = order_payload.lines ?? [];

    if (lines.length === 0) {
      return jsonError('Order has no items', 400, 'no_items');
    }

    const admin = createSupabaseAdminClient();

    // ── Validate vendor ─────────────────────────────────────────────────────────
    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('id, user_id, vendor_type, accepts_orders, accepts_delivery, delivery_fee, opens_at, closes_at, day_schedule, bank_account_number, bank_account_name, bank_name')
      .eq('id', vendor_id)
      .single();

    if (vendorErr || !vendor) return jsonError('Vendor not found', 404, 'vendor_not_found');
    if (vendor.vendor_type !== 'food') return jsonError('Not a food vendor', 400, 'not_food_vendor');
    if (!vendor.accepts_orders) return jsonError('Vendor is not accepting orders right now', 400, 'not_accepting');

    // Always read from DB — never trust client-supplied delivery_fee
    const serverDeliveryFee = order_type === 'delivery'
      ? Math.max(0, (vendor as any).delivery_fee ?? 0)
      : 0;

    if (order_type === 'delivery' && !(vendor as any).accepts_delivery) {
      return jsonError('This vendor does not accept delivery orders', 400, 'delivery_not_accepted');
    }

    if (order_type === 'delivery' && !delivery_address?.trim()) {
      return jsonError('Delivery address is required', 400, 'missing_address');
    }

    // Reject orders when the stall is outside its operating hours.
    // isOpenNow returns true | false | null (null = no schedule set = allow).
    const stallOpen = isOpenNow({
      opens_at: (vendor as any).opens_at ?? null,
      closes_at: (vendor as any).closes_at ?? null,
      day_schedule: (vendor as any).day_schedule ?? null,
    });
    if (stallOpen === false) {
      return jsonError(
        'This stall is currently closed. Check their hours and try again.',
        400,
        'stall_closed',
      );
    }

    // ── Bank details guard ──────────────────────────────────────────────────────
    // Food vendors must have bank transfer details set up before they can receive
    // orders. Without them, the buyer has no way to pay in-app and would be
    // silently pushed to "Pay cash" — which bypasses payment confirmation entirely.
    const hasBank = !!(
      (vendor as any).bank_account_number &&
      (vendor as any).bank_account_name &&
      (vendor as any).bank_name
    );
    if (!hasBank) {
      return jsonError(
        'This vendor has not set up their payment details yet and cannot accept orders. Ask them to complete their bank details in their vendor profile.',
        400,
        'vendor_no_bank_details'
      );
    }

    // ── Server-side price validation (critical security check) ─────────────────
    const itemIds = [...new Set(lines.map((l) => l.item_id))];

    const { data: dbItems, error: itemsErr } = await admin
      .from('vendor_menu_items')
      .select('id, price_per_unit, active, vendor_id, stock_count')
      .in('id', itemIds);

    if (itemsErr) return jsonError('Failed to validate items', 500, 'items_fetch_failed');

    const dbItemMap: Record<string, {
      price_per_unit: number;
      active: boolean;
      vendor_id: string;
      stock_count: number | null;
    }> = {};
    for (const item of dbItems ?? []) dbItemMap[item.id] = item;

    // Recompute total using DB prices — never trust the client
    let serverTotal = 0;
    const verifiedLines: OrderLine[] = [];

    for (const line of lines) {
      const dbItem = dbItemMap[line.item_id];
      if (!dbItem) return jsonError(`Menu item not found`, 400, 'item_not_found');
      if (!dbItem.active) return jsonError(`"${line.name}" is currently unavailable`, 400, 'item_unavailable');
      if (dbItem.vendor_id !== vendor_id) return jsonError('Item does not belong to this vendor', 400, 'item_wrong_vendor');
      if (line.qty < 1 || line.qty > 20) return jsonError(`Invalid quantity for "${line.name}"`, 400, 'bad_qty');

      // Stock check — only enforced when stock_count is set
      if (dbItem.stock_count !== null && dbItem.stock_count < line.qty) {
        const left = dbItem.stock_count;
        return jsonError(
          left === 0
            ? `"${line.name}" is sold out`
            : `Only ${left} portion${left === 1 ? '' : 's'} of "${line.name}" left`,
          400,
          'insufficient_stock'
        );
      }

      const lineTotal = dbItem.price_per_unit * line.qty;
      serverTotal += lineTotal;
      verifiedLines.push({ ...line, price_per_unit: dbItem.price_per_unit, line_total: lineTotal });
    }

    if (serverTotal <= 0) return jsonError('Order total must be greater than ₦0', 400, 'zero_total');

    // ── Insert order with verified prices ──────────────────────────────────────
    const verifiedPayload: OrderPayload = {
      ...order_payload,
      lines: verifiedLines,
      total: serverTotal,
    };

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        conversation_id: null,
        buyer_id: user.id,
        vendor_id,
        items: verifiedPayload,
        total: serverTotal,
        status: 'pending',
        pickup_note: pickup_note ?? null,
        order_type: order_type ?? 'pickup',
        delivery_address: delivery_address ?? null,
        delivery_fee: serverDeliveryFee,
      })
      .select()
      .single();

    if (orderErr || !order) {
      return jsonError(orderErr?.message ?? 'Failed to create order', 500, 'insert_failed');
    }

    // ── Decrement stock_count for tracked items (atomic Postgres function) ───────
    // Uses decrement_item_stock RPC to avoid read-modify-write race conditions.
    await Promise.allSettled(
      verifiedLines
        .filter((line) => dbItemMap[line.item_id]?.stock_count !== null)
        .map((line) =>
          admin.rpc('decrement_item_stock', { p_item_id: line.item_id, p_qty: line.qty })
        )
    );

    // ── Auto-create delivery_request for food delivery orders ──────────────────
    if (order_type === 'delivery') {
      try {
        await admin.from('delivery_requests').insert({
          order_id: order.id,
          listing_id: null,
          buyer_id: user.id,
          vendor_id,
          dropoff: delivery_address,
          status: 'open',
        });
      } catch (e: any) {
        console.error('[orders/create] delivery_request insert:', e.message);
        // non-critical — never crash the order response
      }
    }

    // ── Create order conversation via RPC ──────────────────────────────────────
    const { data: rpcResult, error: rpcErr } = await admin.rpc(
      'create_order_conversation' as any,
      { p_order_id: order.id, p_buyer_id: user.id, p_vendor_id: vendor_id }
    );

    if (rpcErr) {
      console.error('[orders/create] RPC error:', rpcErr.message);
      return jsonError('Failed to create conversation', 500, 'rpc_failed');
    }

    const conversation_id = rpcResult as string;

    // ── Insert order bubble message ────────────────────────────────────────────
    const preview = `🛒 Meal order — ₦${serverTotal.toLocaleString()}`;
    try {
      await admin.from('messages').insert({
        conversation_id,
        sender_id: user.id,
        body: preview,
        type: 'order',
        order_payload: verifiedPayload,
      });
    } catch (e) {
      console.error('[orders/create] order message insert:', e);
    }

    try {
      await admin.from('conversations')
        .update({ last_message_preview: preview, last_message_at: new Date().toISOString() })
        .eq('id', conversation_id);
    } catch { /* non-critical */ }

    try {
      await admin.rpc('increment_vendor_unread' as any, { convo_id: conversation_id });
    } catch { /* non-critical */ }

    if (vendor.user_id) {
      try {
        await admin.from('notifications').insert({
          user_id: vendor.user_id,
          type: 'new_order',
          title: 'New meal order 🛒',
          body: `₦${serverTotal.toLocaleString()} order received`,
          href: '/vendor/orders',
        });
      } catch { /* non-critical */ }
    }

    // ── Push notifications to vendor devices ───────────────────────────────────
    try {
      await sendVendorPush(vendor_id, {
        title: 'New order 🛒',
        body: `₦${serverTotal.toLocaleString()} order just came in`,
        href: '/vendor/orders',
        tag: `new-order-${order.id}`,
      });
    } catch { /* push failure must never crash order creation */ }

    return NextResponse.json({ ok: true, order_id: order.id, conversation_id });

  } catch (e: any) {
    console.error('[orders/create] unexpected error:', e);
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}