// app/api/admin/vendors/menu/route.ts
// Admin-only CRUD for vendor_menu_items

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// GET  /api/admin/vendors/menu?vendor_id=xxx
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendor_id');

    const admin = createSupabaseAdminClient();
    let query = admin
      .from('vendor_menu_items')
      .select('*')
      .order('category')
      .order('sort_order');

    if (vendorId) query = query.eq('vendor_id', vendorId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: e?.status ?? 500 });
  }
}

// POST /api/admin/vendors/menu  { action: 'upsert' | 'delete', ...fields }
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: 'No body' }, { status: 400 });

    const admin = createSupabaseAdminClient();

    // ── Delete ──────────────────────────────────────────────
    if (body.action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
      const { error } = await admin.from('vendor_menu_items').delete().eq('id', id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── Upsert (create or update) ───────────────────────────
    if (body.action === 'upsert') {
      const {
        id,           // present = update, absent = create
        vendor_id,
        name,
        emoji,
        category,
        unit_name,
        price_per_unit,
        active,
        sort_order,
      } = body;

      if (!vendor_id || !name || !category || !unit_name || price_per_unit == null) {
        return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
      }

      const payload = {
        vendor_id,
        name: name.trim(),
        emoji: emoji || '🍽',
        category,
        unit_name: unit_name.trim(),
        price_per_unit: Number(price_per_unit),
        active: active !== false,
        sort_order: Number(sort_order ?? 0),
        updated_at: new Date().toISOString(),
      };

      let result;
      if (id) {
        result = await admin
          .from('vendor_menu_items')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
      } else {
        result = await admin
          .from('vendor_menu_items')
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) {
        return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, item: result.data });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: e?.status ?? 500 });
  }
}