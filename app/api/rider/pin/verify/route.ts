// app/api/rider/pin/verify/route.ts
// POST { rider_id, pin_hash } — verifies PIN by comparing hashes

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { rider_id?: string; pin_hash?: string } | null;
    if (!body?.rider_id || !body?.pin_hash) {
      return NextResponse.json({ ok: false, message: 'Missing rider_id or pin_hash' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: rider } = await admin
      .from('riders')
      .select('pin_hash')
      .eq('id', body.rider_id)
      .single();

    if (!rider) return NextResponse.json({ ok: false, message: 'Rider not found' }, { status: 404 });

    const match = rider.pin_hash === body.pin_hash;
    return NextResponse.json({ ok: match });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}
