// app/api/vendors/[vendorId]/menu/route.ts
// Public endpoint — returns active menu items grouped by actual vendor categories

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { MenuCategoryInfo, VendorMenuItem } from '@/types/meal-builder';
import { classifyCategory } from '@/types/meal-builder';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await params;

  if (!vendorId) {
    return NextResponse.json({ ok: false, error: 'Missing vendorId' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('vendor_menu_items')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const items = (data ?? []) as VendorMenuItem[];

  if (items.length === 0) {
    return NextResponse.json({ ok: true, categories: [] });
  }

  // Group by actual category text, preserving insertion order
  const categoryMap = new Map<string, VendorMenuItem[]>();
  for (const item of items) {
    const cat = (item.category || 'Other').trim();
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(item);
  }

  const categories: MenuCategoryInfo[] = Array.from(categoryMap.entries()).map(([name, catItems]) => ({
    name,
    label: name.charAt(0).toUpperCase() + name.slice(1),
    items: catItems,
    stepType: classifyCategory(name),
  }));

  // Required steps before optional ones, preserving vendor's sort order within each tier
  categories.sort((a, b) => {
    const aOpt = a.stepType.startsWith('optional') ? 1 : 0;
    const bOpt = b.stepType.startsWith('optional') ? 1 : 0;
    return aOpt - bOpt;
  });

  return NextResponse.json({ ok: true, categories });
}