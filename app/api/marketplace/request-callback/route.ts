// app/api/marketplace/request-callback/route.ts
// Sends a callback-request notification to the seller and ensures a conversation
// exists so the seller can reach the buyer through the inbox.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendVendorPush } from '@/lib/webPush';

const CALLBACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type RequestCallbackBody = { vendor_id?: string; listing_id?: string };
type RateLimitRow = { last_called_at: string };

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message, error: message }, { status });
}

async function enforceCallbackRateLimit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  endpoint: string
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const { data, error } = await admin
    .from('ai_rate_limits')
    .select('last_called_at')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (error) {
    return { allowed: false, message: error.message };
  }

  const row = data as RateLimitRow | null;
  if (row?.last_called_at) {
    const nextAllowedAt = new Date(row.last_called_at).getTime() + CALLBACK_COOLDOWN_MS;
    if (Number.isFinite(nextAllowedAt) && nextAllowedAt > Date.now()) {
      return {
        allowed: false,
        message: 'You already requested a callback from this seller recently. Try again in 24 hours.',
      };
    }
  }

  const { error: upsertErr } = await admin.from('ai_rate_limits').upsert(
    {
      user_id: userId,
      endpoint,
      last_called_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' }
  );

  if (upsertErr) {
    return { allowed: false, message: upsertErr.message };
  }

  return { allowed: true };
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return jsonError('Unauthenticated', 401);
    }

    let body: RequestCallbackBody;
    try {
      body = (await req.json()) as RequestCallbackBody;
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    const vendor_id = body.vendor_id?.trim();
    const listing_id = body.listing_id?.trim();

    if (!vendor_id || !listing_id) {
      return jsonError('Missing fields', 400);
    }

    const admin = createSupabaseAdminClient();
    const rateLimit = await enforceCallbackRateLimit(admin, user.id, `callback:${vendor_id}`);
    if (!rateLimit.allowed) {
      const status = rateLimit.message.startsWith('You already requested') ? 429 : 500;
      return jsonError(rateLimit.message, status);
    }

    const [listingRes, vendorRes, profileRes] = await Promise.all([
      admin.from('listings').select('title, vendor_id').eq('id', listing_id).maybeSingle(),
      admin.from('vendors').select('user_id, name').eq('id', vendor_id).single(),
      admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
    ]);

    if (listingRes.error) return jsonError(listingRes.error.message, 500);
    if (!listingRes.data) return jsonError('Listing not found', 404);
    if (listingRes.data.vendor_id !== vendor_id) {
      return jsonError('Listing vendor mismatch', 400);
    }
    if (vendorRes.error) return jsonError(vendorRes.error.message, 500);
    if (!vendorRes.data) return jsonError('Vendor not found', 404);
    if (profileRes.error) return jsonError(profileRes.error.message, 500);

    const listingTitle = (listingRes.data?.title ?? 'a listing').trim();
    const vendorUserId = vendorRes.data?.user_id;
    const profile = profileRes.data as { full_name: string | null; email: string | null } | null;
    const buyerName =
      profile?.full_name ||
      (profile?.email ? profile.email.split('@')[0] : null) ||
      'A buyer';

    const { data: inserted, error: upsertErr } = await admin
      .from('conversations')
      .upsert(
        { listing_id, buyer_id: user.id, vendor_id },
        { onConflict: 'buyer_id,vendor_id,listing_id', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle();
    if (upsertErr) return jsonError(upsertErr.message, 500);

    let conversationId: string | null = null;
    if (inserted?.id) {
      conversationId = inserted.id;
    } else {
      const { data: existing, error: existingErr } = await admin
        .from('conversations')
        .select('id')
        .eq('listing_id', listing_id)
        .eq('buyer_id', user.id)
        .eq('vendor_id', vendor_id)
        .maybeSingle();
      if (existingErr) return jsonError(existingErr.message, 500);
      conversationId = existing?.id ?? null;
    }
    if (!conversationId) return jsonError('Failed to open conversation', 500);

    if (vendorUserId && vendorUserId !== user.id) {
      try {
        const notificationBody = `${buyerName} requested a callback on ${listingTitle}`;
        const { error: notifyErr } = await admin.from('notifications').insert({
          user_id: vendorUserId,
          type: 'callback_request',
          title: 'A buyer wants you to call them',
          body: `${buyerName} is interested in "${listingTitle}" and requested a callback. Open their chat to get their contact.`,
          href: `/inbox/${conversationId}`,
        });
        if (notifyErr) {
          console.error('[request-callback] notification insert:', notifyErr.message);
        } else {
          await sendVendorPush(vendor_id, {
            title: 'Callback request',
            body: notificationBody,
            href: `/inbox/${conversationId}`,
            tag: `callback-${conversationId}`,
          });
        }
      } catch (notifyError) {
        console.error('[request-callback] notify vendor:', notifyError);
      }
    }

    return NextResponse.json({ ok: true, conversation_id: conversationId });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return jsonError(err?.message ?? 'Error', 500);
  }
}
