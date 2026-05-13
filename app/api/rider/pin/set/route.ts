// app/api/rider/pin/set/route.ts
// POST { rider_id, pin_hash } — sets a PIN hash for the rider (no auth required — phone-based identity)

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { rider_id?: string; pin_hash?: string } | null;
    if (!body?.rider_id || !body?.pin_hash) {
      return NextResponse.json({ ok: false, message: 'Missing rider_id or pin_hash' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Ensure rider exists
    const { data: rider } = await admin
      .from('riders')
      .select('id')
      .eq('id', body.rider_id)
      .single();

    if (!rider) return NextResponse.json({ ok: false, message: 'Rider not found' }, { status: 404 });

    const { error } = await admin
      .from('riders')
      .update({ pin_hash: body.pin_hash })
      .eq('id', body.rider_id);

    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}
