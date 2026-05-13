// app/api/food/search/route.ts
// Cross-vendor dish search — "who sells Jollof Rice right now?"
// Returns items grouped by normalised dish name, each with all vendors selling it.

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isOpenNow } from '@/lib/vendorSchedule';

export const dynamic = 'force-dynamic';

function jsonError(msg: string, status = 400) {
  return NextResponse.json({ ok: false, message: msg }, { status });
}

export type DishResult = {
  // Normalised dish name used as the group key
  dish: string;
  emoji: string;
  // Sorted: open vendors first, then by rating desc
  vendors: DishVendor[];
};

export type DishVendor = {
  item_id: string;
  vendor_id: string;
  vendor_name: string;
  avatar_url: string | null;
  price: number;
  unit_name: string;
  is_open: boolean | null;
  accepts_orders: boolean;
  rating_avg: number | null;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (q.length < 2) return jsonError('Query too short', 400);
  if (q.length > 80) return jsonError('Query too long', 400);

  const admin = createSupabaseAdminClient();

  // ── 1. Find matching active items from verified, order-accepting vendors ──────
  const { data: items, error } = await admin
    .from('vendor_menu_items')
    .select(`
      id,
      vendor_id,
      name,
      emoji,
      price_per_unit,
      unit_name,
      vendors!inner (
        id,
        name,
        avatar_url,
        accepts_orders,
        opens_at,
        closes_at,
        day_schedule,
        verified,
        verification_status
      )
    `)
    .eq('active', true)
    .ilike('name', `%${q}%`)
    .limit(120);

  if (error) {
    console.error('[food/search]', error.message);
    return NextResponse.json({ ok: false, message: 'Search failed' }, { status: 500 });
  }

  // ── 2. Filter to verified vendors that accept orders ─────────────────────────
  const verified = (items ?? []).filter((item: any) => {
    const v = item.vendors;
    if (!v?.accepts_orders) return false;
    return v.verified === true || v.verification_status === 'verified' || v.verification_status === 'approved';
  });

  if (verified.length === 0) {
    return NextResponse.json({ ok: true, results: [] });
  }

  // ── 3. Fetch ratings for matched vendors ─────────────────────────────────────
  const vendorIds = [...new Set(verified.map((i: any) => i.vendor_id))];
  const { data: reviews } = await admin
    .from('vendor_reviews')
    .select('vendor_id, rating')
    .in('vendor_id', vendorIds);

  const ratingMap: Record<string, { sum: number; count: number }> = {};
  for (const r of reviews ?? []) {
    const e = ratingMap[r.vendor_id];
    ratingMap[r.vendor_id] = e
      ? { sum: e.sum + r.rating, count: e.count + 1 }
      : { sum: r.rating, count: 1 };
  }

  // ── 4. Group by normalised dish name (lowercase trim) ─────────────────────────
  // Keep the original casing of the first item encountered as the display label.
  const groups = new Map<string, { display: string; emoji: string; vendors: DishVendor[] }>();

  for (const item of verified as any[]) {
    const key = item.name.trim().toLowerCase();
    const v   = item.vendors;
    const rat = ratingMap[item.vendor_id];

    const dv: DishVendor = {
      item_id:       item.id,
      vendor_id:     item.vendor_id,
      vendor_name:   v.name ?? 'Vendor',
      avatar_url:    v.avatar_url,
      price:         item.price_per_unit,
      unit_name:     item.unit_name,
      is_open:       isOpenNow({ opens_at: v.opens_at, closes_at: v.closes_at, day_schedule: v.day_schedule }),
      accepts_orders: v.accepts_orders,
      rating_avg:    rat ? rat.sum / rat.count : null,
    };

    if (!groups.has(key)) {
      groups.set(key, { display: item.name.trim(), emoji: item.emoji ?? '🍽', vendors: [] });
    }
    groups.get(key)!.vendors.push(dv);
  }

  // ── 5. Sort vendors within each group: open first, then rating desc ───────────
  const results: DishResult[] = Array.from(groups.values()).map(({ display, emoji, vendors }) => {
    vendors.sort((a, b) => {
      const aOpen = a.is_open === true ? 0 : 1;
      const bOpen = b.is_open === true ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return (b.rating_avg ?? 0) - (a.rating_avg ?? 0);
    });
    return { dish: display, emoji, vendors };
  });

  // Sort groups: those with open vendors first, then alphabetically
  results.sort((a, b) => {
    const aHasOpen = a.vendors.some((v) => v.is_open === true) ? 0 : 1;
    const bHasOpen = b.vendors.some((v) => v.is_open === true) ? 0 : 1;
    if (aHasOpen !== bHasOpen) return aHasOpen - bHasOpen;
    return a.dish.localeCompare(b.dish);
  });

  return NextResponse.json({ ok: true, results });
}