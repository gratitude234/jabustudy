// app/api/orders/create-marketplace/route.ts
// Buyer finalizes a marketplace deal: creates a lightweight order record
// tied to a conversation. No menu validation - price is user-agreed.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';
import { sendVendorPush } from '@/lib/webPush';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const body = (await req.json()) as {
      conversation_id: string;
      listing_id: string;
      vendor_id: string;
      agreed_price: number;
      payment_method: 'transfer' | 'cash';
      note?: string;
    };

    const { conversation_id, listing_id, vendor_id, agreed_price, payment_method, note } = body;

    if (!conversation_id || !listing_id || !vendor_id || !agreed_price) {
      return jsonError('Missing required fields', 400, 'bad_request');
    }
    if (!Number.isFinite(agreed_price) || agreed_price <= 0) {
      return jsonError('Invalid price', 400, 'invalid_price');
    }

    const admin = createSupabaseAdminClient();

    const { data: conv } = await admin
      .from('conversations')
      .select('buyer_id, vendor_id, order_id')
      .eq('id', conversation_id)
      .single();

    if (!conv) return jsonError('Conversation not found', 404, 'not_found');
    if (conv.buyer_id !== user.id) return jsonError('Forbidden', 403, 'forbidden');
    if (conv.vendor_id !== vendor_id) return jsonError('Vendor mismatch', 400, 'vendor_mismatch');
    if (conv.order_id) return jsonError('This conversation already has an order', 400, 'order_exists');

    const { data: listing } = await admin
      .from('listings')
      .select('title, price, category')
      .eq('id', listing_id)
      .single();

    if (!listing) return jsonError('Listing not found', 404, 'listing_not_found');

    const { data: vendor } = await admin
      .from('vendors')
      .select('user_id, name, bank_name, bank_account_number, bank_account_name')
      .eq('id', vendor_id)
      .single();

    if (!vendor) return jsonError('Vendor not found', 404, 'vendor_not_found');

    if (payment_method === 'transfer') {
      const hasBank = !!(
        vendor.bank_account_number &&
        vendor.bank_account_name &&
        vendor.bank_name
      );
      if (!hasBank) {
        return jsonError(
          'This seller has not set up bank transfer details yet. Ask them to add their bank details in their profile, or use cash payment.',
          400,
          'vendor_no_bank_details'
        );
      }
    }

    const orderPayload = {
      lines: [
        {
          item_id: listing_id,
          name: listing.title ?? 'Item',
          emoji: '🏷️',
          category: listing.category ?? 'Item',
          qty: 1,
          unit_name: 'piece',
          price_per_unit: agreed_price,
          line_total: agreed_price,
        },
      ],
      total: agreed_price,
      order_type: 'pickup' as const,
    };

    const textBody = `🏷️ Marketplace order — ${listing.title ?? 'Item'} — ₦${agreed_price.toLocaleString()}`;

    const { data: msg, error: msgErr } = await admin
      .from('messages')
      .insert({
        conversation_id,
        sender_id: user.id,
        body: textBody,
        type: 'order',
        order_payload: orderPayload,
      })
      .select()
      .single();

    if (msgErr) return jsonError(msgErr.message, 500, 'msg_insert_failed');

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        conversation_id,
        message_id: msg.id,
        buyer_id: user.id,
        vendor_id,
        items: orderPayload,
        total: agreed_price,
        note: note ?? null,
        payment_method,
        order_type: 'pickup',
      })
      .select()
      .single();

    if (orderErr) return jsonError(orderErr.message, 500, 'order_insert_failed');

    await admin
      .from('conversations')
      .update({
        order_id: order.id,
        last_message_at: new Date().toISOString(),
        last_message_preview: textBody,
      })
      .eq('id', conversation_id);

    if (vendor.user_id) {
      await insertNotificationBestEffort(
        admin,
        {
          user_id: vendor.user_id,
          type: 'new_order',
          title: 'New marketplace order',
          body: `₦${agreed_price.toLocaleString()} — ${listing.title ?? 'Item'}`,
          href: `/inbox/${conversation_id}`,
        },
        {
          route: '/api/orders/create-marketplace',
          userId: vendor.user_id,
          type: 'new_order',
        }
      );

      try {
        void sendVendorPush(vendor_id, {
          title: 'New order from buyer',
          body: `₦${agreed_price.toLocaleString()} — ${listing.title ?? 'Item'}`,
          href: `/inbox/${conversation_id}`,
          tag: `order-${order.id}`,
        });
      } catch {
        // Push failure must never crash order creation.
      }
    }

    return NextResponse.json({ ok: true, message: msg, order });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
