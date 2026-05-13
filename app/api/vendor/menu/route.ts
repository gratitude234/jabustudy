// app/api/vendor/menu/route.ts
// Authenticated endpoint — vendor manages their menu items

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

async function getAuthenticatedVendor() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, vendor: null };

  const admin = createSupabaseAdminClient();
  const { data: vendor } = await admin
    .from('vendors')
    .select('id, user_id, vendor_type, verification_status')
    .eq('user_id', user.id)
    .eq('vendor_type', 'food')
    .maybeSingle();

  return { user, vendor };
}

export async function GET() {
  try {
    const { user, vendor } = await getAuthenticatedVendor();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');
    if (!vendor) return jsonError('Not a food vendor', 403, 'not_vendor');

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('vendor_menu_items')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) return jsonError(error.message, 500, 'fetch_failed');

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, vendor } = await getAuthenticatedVendor();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');
    if (!vendor) return jsonError('Not a food vendor', 403, 'not_vendor');

    const body = (await req.json().catch(() => null)) as {
      name?: string;
      emoji?: string;
      category?: string;
      price_per_unit?: number;
      unit_name?: string;
      active?: boolean;
      sort_order?: number;
      stock_count?: number | null;
    } | null;

    if (!body?.name?.trim()) return jsonError('name is required', 400, 'missing_name');
    if (!body?.emoji?.trim()) return jsonError('emoji is required', 400, 'missing_emoji');
    if (!body?.category?.trim()) return jsonError('category is required', 400, 'missing_category');
    if (typeof body.price_per_unit !== 'number' || body.price_per_unit <= 0)
      return jsonError('price_per_unit must be a positive number', 400, 'invalid_price');
    if (!body?.unit_name?.trim()) return jsonError('unit_name is required', 400, 'missing_unit');

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('vendor_menu_items')
      .insert({
        vendor_id: vendor.id,
        name: body.name.trim(),
        emoji: body.emoji.trim(),
        category: body.category.trim(),
        price_per_unit: body.price_per_unit,
        unit_name: body.unit_name.trim(),
        active: body.active ?? true,
        sort_order: body.sort_order ?? 0,
        stock_count: (typeof body.stock_count === 'number' && body.stock_count >= 0)
          ? body.stock_count
          : null,
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 500, 'insert_failed');

    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}