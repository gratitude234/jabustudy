// app/api/internal/push-user/route.ts
// Internal-only: send a push notification to a user by user_id.
// The caller MUST be a verified participant in the conversation.
// Requires: href is always /inbox/[conversationId] and caller owns one side.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendUserPush } from '@/lib/webPush';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await req.json() as {
      user_id: string;
      title: string;
      body: string;
      href: string;
      tag?: string;
    };

    if (!body.user_id || !body.title || !body.href) {
      return NextResponse.json(
        { ok: false, message: 'user_id, title, and href are required' },
        { status: 400 },
      );
    }

    // ── Authorization: href MUST be /inbox/[conversationId] ───────────────────
    // Extract conversationId — if href doesn't match this format, reject.
    const conversationId = body.href.split('/inbox/')?.[1]?.split('?')?.[0];
    if (!conversationId) {
      return NextResponse.json(
        { ok: false, message: 'href must be /inbox/[conversationId]' },
        { status: 403 },
      );
    }

    const { data: conv } = await supabase
      .from('conversations')
      .select('buyer_id, vendor_id')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conv) return NextResponse.json({ ok: false }, { status: 403 });

    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const callerVendorId = vendor?.id ?? null;

    const isBuyer  = conv.buyer_id === user.id;
    const isVendor = callerVendorId && conv.vendor_id === callerVendorId;
    if (!isBuyer && !isVendor) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
    // ── End authorization ─────────────────────────────────────────────────────

    await sendUserPush(body.user_id, {
      title: body.title,
      body:  body.body,
      href:  body.href,
      tag:   body.tag ?? `msg-${Date.now()}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
