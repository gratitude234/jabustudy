// app/api/chat/send/route.ts
// Authenticated endpoint — buyer sends a message or a meal order

import { NextResponse } from 'next/server';
import { sendUserPush } from '@/lib/webPush';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { OrderPayload } from '@/types/meal-builder';
import { orderPayloadToText } from '@/types/meal-builder';

export async function POST(req: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    }

    // ── Body ──────────────────────────────────────────────────
    type Body =
      | { type: 'text'; conversation_id: string; body: string }
      | {
          type: 'order';
          conversation_id: string;
          order_payload: OrderPayload;
          note?: string;
        };

    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body?.conversation_id) {
      return NextResponse.json(
        { ok: false, error: 'Missing conversation_id' },
        { status: 400 }
      );
    }

    // ── Verify the user is the buyer of this conversation ─────
    const { data: convo, error: convoErr } = await supabase
      .from('conversations')
      .select('id, buyer_id, vendor_id')
      .eq('id', body.conversation_id)
      .single();

    if (convoErr || !convo) {
      return NextResponse.json(
        { ok: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (convo.buyer_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // ── Plain text message ────────────────────────────────────
    if (body.type === 'text') {
      if (!body.body?.trim()) {
        return NextResponse.json(
          { ok: false, error: 'Empty message body' },
          { status: 400 }
        );
      }

      const { data: msg, error: msgErr } = await admin
        .from('messages')
        .insert({
          conversation_id: body.conversation_id,
          sender_id: user.id,
          body: body.body.trim(),
          type: 'text',
        })
        .select()
        .single();

      if (msgErr) {
        return NextResponse.json({ ok: false, error: msgErr.message }, { status: 500 });
      }

      // Update conversation preview
      await admin
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: body.body.trim().slice(0, 100),
        })
        .eq('id', body.conversation_id);

      // Increment vendor_unread
      try {
        await admin.rpc('increment_vendor_unread' as any, {
          convo_id: body.conversation_id,
        });
      } catch {
        // If RPC doesn't exist yet, do it manually
        await admin
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', body.conversation_id);
      }

      // Notify vendor of new message
      try {
        const { data: vendor } = await admin
          .from('vendors')
          .select('user_id')
          .eq('id', convo.vendor_id)
          .single();

        if (vendor?.user_id && vendor.user_id !== user.id) {
          await admin.from('notifications').insert({
            user_id: vendor.user_id,
            type: 'new_message',
            title: 'New message from a buyer',
            body: body.body.trim().slice(0, 80),
            href: `/inbox/${body.conversation_id}`,
          });

          void sendUserPush(vendor.user_id, {
            title: 'New message',
            body: body.body.trim().slice(0, 80),
            href: `/inbox/${body.conversation_id}`,
            tag: `msg-${body.conversation_id}`,
          })
        }
      } catch { /* never block the message send */ }

      return NextResponse.json({ ok: true, message: msg });
    }

    // ── Order message ─────────────────────────────────────────
    if (body.type === 'order') {
      const payload = body.order_payload;
      if (!payload || typeof payload.total !== 'number') {
        return NextResponse.json(
          { ok: false, error: 'Invalid order_payload' },
          { status: 400 }
        );
      }

      // The readable text fallback (visible in notifications / preview)
      const textBody = orderPayloadToText(payload);

      // 1. Insert the message
      const { data: msg, error: msgErr } = await admin
        .from('messages')
        .insert({
          conversation_id: body.conversation_id,
          sender_id: user.id,
          body: textBody,
          type: 'order',
          order_payload: payload,
        })
        .select()
        .single();

      if (msgErr) {
        return NextResponse.json({ ok: false, error: msgErr.message }, { status: 500 });
      }

      // 2. Create the order record
      const { data: order, error: orderErr } = await admin
        .from('orders')
        .insert({
          conversation_id: body.conversation_id,
          message_id: msg.id,
          buyer_id: user.id,
          vendor_id: convo.vendor_id,
          items: payload,
          total: payload.total,
          note: body.note ?? null,
        })
        .select()
        .single();

      if (orderErr) {
        // Non-fatal — message was already sent, just log
        console.error('[orders/create]', orderErr.message);
      }

      // 3. Update conversation preview
      await admin
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: `🛒 Meal order — ₦${payload.total.toLocaleString()}`,
        })
        .eq('id', body.conversation_id);

      // Write order_id back to the conversation
      if (order?.id) {
        await admin
          .from('conversations')
          .update({ order_id: order.id })
          .eq('id', body.conversation_id);
      }

      // 4. Create a notification for the vendor
      const { data: vendor } = await admin
        .from('vendors')
        .select('user_id')
        .eq('id', convo.vendor_id)
        .single();

      if (vendor?.user_id) {
        await admin.from('notifications').insert({
          user_id: vendor.user_id,
          type: 'new_order',
          title: 'New meal order received',
          body: `₦${payload.total.toLocaleString()} order in your chat`,
          href: `/vendor/orders`,
        });
      }

      return NextResponse.json({ ok: true, message: msg, order: order ?? null });
    }

    return NextResponse.json({ ok: false, error: 'Unknown message type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}