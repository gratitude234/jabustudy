// app/api/rider/push/route.ts
// POST — subscribe rider device to push notifications
// DELETE — unsubscribe

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status });
}

async function getRiderForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('riders')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const body = await req.json().catch(() => null) as {
      endpoint?: string; p256dh?: string; auth?: string;
    } | null;

    if (!body?.endpoint || !body?.p256dh || !body?.auth) {
      return jsonError('Missing subscription fields', 400, 'bad_request');
    }

    const riderId = await getRiderForUser(user.id);
    if (!riderId) return jsonError('Not a rider', 403, 'not_rider');

    const admin = createSupabaseAdminClient();
    await admin
      .from('rider_push_subscriptions')
      .upsert(
        { rider_id: riderId, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth, updated_at: new Date().toISOString() },
        { onConflict: 'endpoint' }
      );

    // Trim to the 10 most-recent subscriptions for this rider
    const { data: allSubs } = await admin
      .from('rider_push_subscriptions')
      .select('id, updated_at')
      .eq('rider_id', riderId)
      .order('updated_at', { ascending: false })

    const toDelete = (allSubs ?? []).slice(10).map((s: { id: string }) => s.id)
    if (toDelete.length) {
      await admin.from('rider_push_subscriptions').delete().in('id', toDelete)
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const body = await req.json().catch(() => null) as { endpoint?: string } | null;
    if (!body?.endpoint) return jsonError('Missing endpoint', 400, 'bad_request');

    const riderId = await getRiderForUser(user.id);
    if (!riderId) return jsonError('Not a rider', 403, 'not_rider');

    const admin = createSupabaseAdminClient();
    await admin
      .from('rider_push_subscriptions')
      .delete()
      .eq('rider_id', riderId)
      .eq('endpoint', body.endpoint);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}
