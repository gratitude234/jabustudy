// app/api/vendor/push/route.ts
// Saves or removes a Web Push subscription for the authenticated food vendor.
//
// POST  { endpoint, p256dh, auth }  → upserts subscription row
// DELETE { endpoint }              → removes that device

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status });
}

async function resolveVendor() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, vendor: null };

  const admin = createSupabaseAdminClient();
  const { data: vendor } = await admin
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .eq('vendor_type', 'food')
    .maybeSingle();

  return { user, vendor };
}

// ── POST — register a push subscription ──────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { user, vendor } = await resolveVendor();
    if (!user)   return jsonError('Unauthenticated', 401, 'unauthenticated');
    if (!vendor) return jsonError('Not a food vendor', 403, 'not_vendor');

    const body = await req.json().catch(() => null) as {
      endpoint?: string;
      p256dh?: string;
      auth?: string;
    } | null;

    if (!body?.endpoint) return jsonError('endpoint required', 400, 'missing_endpoint');
    if (!body?.p256dh)   return jsonError('p256dh required', 400, 'missing_p256dh');
    if (!body?.auth)     return jsonError('auth required', 400, 'missing_auth');

    const admin = createSupabaseAdminClient();

    // Upsert on endpoint — same device re-subscribing just updates the keys
    await admin
      .from('vendor_push_subscriptions')
      .upsert({
        vendor_id: vendor.id,
        endpoint:  body.endpoint,
        p256dh:    body.p256dh,
        auth:      body.auth,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });

    // Trim to the 10 most-recent subscriptions for this vendor
    const { data: allSubs } = await admin
      .from('vendor_push_subscriptions')
      .select('id, updated_at')
      .eq('vendor_id', vendor.id)
      .order('updated_at', { ascending: false })

    const toDelete = (allSubs ?? []).slice(10).map((s: { id: string }) => s.id)
    if (toDelete.length) {
      await admin.from('vendor_push_subscriptions').delete().in('id', toDelete)
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}

// ── DELETE — remove a subscription (vendor unsubscribed or browser revoked) ──
export async function DELETE(req: Request) {
  try {
    const { user, vendor } = await resolveVendor();
    if (!user)   return jsonError('Unauthenticated', 401, 'unauthenticated');
    if (!vendor) return jsonError('Not a food vendor', 403, 'not_vendor');

    const body = await req.json().catch(() => null) as { endpoint?: string } | null;
    if (!body?.endpoint) return jsonError('endpoint required', 400, 'missing_endpoint');

    const admin = createSupabaseAdminClient();
    await admin
      .from('vendor_push_subscriptions')
      .delete()
      .eq('vendor_id', vendor.id)
      .eq('endpoint', body.endpoint);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}