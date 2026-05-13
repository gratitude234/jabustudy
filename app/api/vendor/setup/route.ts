// app/api/vendor/setup/route.ts
// Authenticated endpoint — vendor reads/updates their profile

import { NextResponse } from 'next/server';


import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

async function getVendor() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, vendor: null };

  const admin = createSupabaseAdminClient();
  const { data: vendor } = await admin
    .from('vendors')
    .select('id, user_id, name, description, location, whatsapp, phone, opens_at, closes_at, accepts_orders, accepts_delivery, delivery_fee, verification_status, vendor_type, avatar_url, day_schedule, bank_name, bank_account_number, bank_account_name, payment_note')
    .eq('user_id', user.id)
    .maybeSingle();

  return { user, vendor };
}

export async function GET() {
  try {
    const { user, vendor } = await getVendor();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');
    if (!vendor) return jsonError('Not a vendor', 403, 'not_vendor');

    return NextResponse.json({ ok: true, vendor });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, vendor } = await getVendor();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');
    if (!vendor) return jsonError('Not a vendor', 403, 'not_vendor');

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonError('No body', 400, 'bad_request');

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.description !== undefined) patch.description = String(body.description).trim();
    if (body.location !== undefined) patch.location = String(body.location).trim();
    if (body.whatsapp !== undefined) patch.whatsapp = String(body.whatsapp).trim();
    if (body.opens_at !== undefined) patch.opens_at = body.opens_at ? String(body.opens_at).trim() : null;
    if (body.closes_at !== undefined) patch.closes_at = body.closes_at ? String(body.closes_at).trim() : null;
    if (body.accepts_orders !== undefined) patch.accepts_orders = Boolean(body.accepts_orders);
    if (body.accepts_delivery !== undefined) patch.accepts_delivery = Boolean(body.accepts_delivery);
    if (body.delivery_fee !== undefined) patch.delivery_fee = Math.max(0, Math.round(Number(body.delivery_fee) || 0));
    if (body.avatar_url !== undefined) patch.avatar_url = body.avatar_url ? String(body.avatar_url).trim() : null;
    if (body.bank_name !== undefined) patch.bank_name = body.bank_name ? String(body.bank_name).trim() : null;
    if (body.bank_account_number !== undefined) patch.bank_account_number = body.bank_account_number ? String(body.bank_account_number).trim() : null;
    if (body.bank_account_name !== undefined) patch.bank_account_name = body.bank_account_name ? String(body.bank_account_name).trim() : null;
    if (body.payment_note !== undefined) patch.payment_note = body.payment_note ? String(body.payment_note).trim().slice(0, 120) : null;
    if (body.day_schedule !== undefined) {
      // null clears it; array is stored as-is (Supabase handles JSONB)
      patch.day_schedule = body.day_schedule === null ? null : body.day_schedule;
    }
    if (body.pause_until !== undefined) patch.pause_until = body.pause_until ?? null;
    if (body.pause_reason !== undefined) patch.pause_reason = body.pause_reason ? String(body.pause_reason).trim() : null;

    if (Object.keys(patch).length === 0) return jsonError('No fields to update', 400, 'empty_patch');

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('vendors')
      .update(patch)
      .eq('id', vendor.id)
      .select()
      .single();

    if (error) return jsonError(error.message, 500, 'update_failed');

    return NextResponse.json({ ok: true, vendor: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}