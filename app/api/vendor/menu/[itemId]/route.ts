// app/api/vendor/menu/[itemId]/route.ts
// Authenticated endpoint — vendor updates or deletes a menu item

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

async function resolveVendorItem(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: jsonError('Unauthenticated', 401, 'unauthenticated'), user: null, item: null };

  const admin = createSupabaseAdminClient();

  // Fetch the item with vendor ownership info
  const { data: item } = await admin
    .from('vendor_menu_items')
    .select('id, vendor_id, vendors!inner(user_id, vendor_type)')
    .eq('id', itemId)
    .maybeSingle();

  if (!item) return { error: jsonError('Item not found', 404, 'not_found'), user, item: null };

  const vendor = (item as any).vendors;
  if (vendor?.user_id !== user.id || vendor?.vendor_type !== 'food') {
    return { error: jsonError('Forbidden', 403, 'forbidden'), user, item: null };
  }

  return { error: null, user, item };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const { error, item } = await resolveVendorItem(itemId);
    if (error) return error;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonError('No body', 400, 'bad_request');

    // Build partial update — only include defined fields
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.emoji !== undefined) patch.emoji = String(body.emoji).trim();
    if (body.category !== undefined) patch.category = String(body.category).trim();
    if (body.price_per_unit !== undefined) patch.price_per_unit = Number(body.price_per_unit);
    if (body.unit_name !== undefined) patch.unit_name = String(body.unit_name).trim();
    if (body.active !== undefined) patch.active = Boolean(body.active);
    if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order);
    // stock_count: null clears it (unlimited), a number sets it
    if ('stock_count' in body) {
      patch.stock_count = body.stock_count === null ? null
        : (typeof body.stock_count === 'number' && body.stock_count >= 0) ? body.stock_count
        : undefined;
      if (patch.stock_count === undefined) delete patch.stock_count;
    }

    if (Object.keys(patch).length === 0) return jsonError('No fields to update', 400, 'empty_patch');

    const admin = createSupabaseAdminClient();
    const { data, error: updateErr } = await admin
      .from('vendor_menu_items')
      .update(patch)
      .eq('id', item!.id)
      .select()
      .single();

    if (updateErr) return jsonError(updateErr.message, 500, 'update_failed');

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const { error, item } = await resolveVendorItem(itemId);
    if (error) return error;

    const admin = createSupabaseAdminClient();
    const { error: deleteErr } = await admin
      .from('vendor_menu_items')
      .delete()
      .eq('id', item!.id);

    if (deleteErr) return jsonError(deleteErr.message, 500, 'delete_failed');

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}