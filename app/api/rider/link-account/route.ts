// app/api/rider/link-account/route.ts
// POST { phone } — links the authenticated user to their existing rider row.
// Called once after a rider signs up for the first time.

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

    const body = await req.json().catch(() => null) as { phone?: string } | null;
    const phone = (body?.phone ?? '').replace(/[^\d]/g, '');
    if (!phone || phone.length < 10) {
      return jsonError('Valid phone number required', 400, 'bad_phone');
    }

    const admin = createSupabaseAdminClient();

    // Check if this user already has a rider row linked
    const { data: existing } = await admin
      .from('riders')
      .select('id, name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, rider: existing, already_linked: true });
    }

    // Find rider row by phone number
    const { data: rider, error: findErr } = await admin
      .from('riders')
      .select('id, name, user_id')
      .or(`phone.eq.${phone},whatsapp.eq.${phone}`)
      .maybeSingle();

    if (findErr || !rider) {
      return jsonError(
        'No rider profile found for that phone number. Make sure you use the same number you registered with.',
        404,
        'rider_not_found'
      );
    }

    if (rider.user_id && rider.user_id !== user.id) {
      return jsonError(
        'This phone number is already linked to another account.',
        409,
        'already_claimed'
      );
    }

    // Link
    const { error: updateErr } = await admin
      .from('riders')
      .update({ user_id: user.id })
      .eq('id', rider.id);

    if (updateErr) return jsonError(updateErr.message, 500, 'link_failed');

    return NextResponse.json({ ok: true, rider: { id: rider.id, name: rider.name } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}
