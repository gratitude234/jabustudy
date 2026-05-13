// app/food/page.tsx
// Server component — verified food vendors with ratings, menu preview, open-now filter

export const revalidate = 60;

import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Clock, UtensilsCrossed, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import FoodPageShell from './FoodPageShell';
import type { FoodVendorData } from './FoodVendorGrid';
import { isOpenNow } from '@/lib/vendorSchedule';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const minute = m ?? '00';
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return minute === '00' ? `${display}${suffix}` : `${display}:${minute}${suffix}`;
}

function minutesUntilWATTime(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(':');
  const openMinutes = parseInt(h, 10) * 60 + parseInt(m ?? '0', 10);
  const now = new Date();
  const watMinutes = ((now.getUTCHours() + 1) * 60 + now.getUTCMinutes()) % (24 * 60);
  let diff = openMinutes - watMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function getVendorStatusMeta(open: boolean | null, opensAt: string | null) {
  if (open === true) {
    return { label: 'Open', tone: 'open' as const };
  }
  if (open === false && opensAt) {
    const minutesUntilOpen = minutesUntilWATTime(opensAt);
    if (minutesUntilOpen !== null && minutesUntilOpen <= 120) {
      return { label: `Opens at ${formatHour(opensAt)}`, tone: 'soon' as const };
    }
    return { label: 'Closed', tone: 'closed' as const };
  }
  if (open === false) {
    return { label: 'Closed', tone: 'closed' as const };
  }
  return { label: null, tone: null };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function FoodPage({
  searchParams,
}: {
  searchParams?: Promise<{ open?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const onlyOpen = sp.open === '1';

  const supabase = await createSupabaseServerClient();

  // Check if the current user is already a food vendor (to hide the "sell here" CTA)
  const { data: { user } } = await supabase.auth.getUser();
  let isAlreadyVendor = false;
  if (user) {
    const { data: existingVendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .eq('vendor_type', 'food')
      .maybeSingle();
    isAlreadyVendor = !!existingVendor;
  }

  // Only show VERIFIED vendors that accept orders.
  // Bug fix: previous version was missing the verification check.
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, user_id, name, description, avatar_url, opens_at, closes_at, accepts_orders, accepts_delivery, day_schedule')
    .eq('vendor_type', 'food')
    .eq('accepts_orders', true)
    .or('verified.eq.true,verification_status.eq.verified')
    .is('suspended_at', null)
    .order('name', { ascending: true });

  const list = vendors ?? [];

  if (list.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Order Food</h1>
          <p className="mt-1 text-sm text-zinc-500">Pick a vendor and build your meal</p>
        </div>
        <div className="rounded-3xl border bg-white p-8 text-center">
          <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <p className="font-semibold text-zinc-900">No food vendors available right now</p>
          <p className="mt-1 text-sm text-zinc-500">Check back later!</p>
        </div>
      </div>
    );
  }

  const vendorIds = list.map((v) => v.id);

  // Parallel: ratings + menu item previews
  const [reviewsRes, menuRes] = await Promise.all([
    supabase
      .from('vendor_reviews')
      .select('vendor_id, rating')
      .in('vendor_id', vendorIds),
    supabase
      .from('vendor_menu_items')
      .select('vendor_id, name, emoji, stock_count')
      .in('vendor_id', vendorIds)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(60),
  ]);

  // vendor_id → { avg, count }
  const ratingsMap: Record<string, { avg: number; count: number }> = {};
  for (const r of reviewsRes.data ?? []) {
    const e = ratingsMap[r.vendor_id];
    ratingsMap[r.vendor_id] = e
      ? { avg: (e.avg * e.count + r.rating) / (e.count + 1), count: e.count + 1 }
      : { avg: r.rating, count: 1 };
  }

  // vendor_id → first 4 menu items
  const menuMap: Record<string, Array<{ name: string; emoji: string; stock_count: number | null }>> = {};
  for (const item of menuRes.data ?? []) {
    if (!menuMap[item.vendor_id]) menuMap[item.vendor_id] = [];
    if (menuMap[item.vendor_id].length < 4)
      menuMap[item.vendor_id].push({
        name: item.name,
        emoji: item.emoji ?? '🍽',
        stock_count: (item as any).stock_count ?? null,
      });
  }

  const openCount = list.filter((v) => isOpenNow(v) === true).length;
  const filteredList = onlyOpen
    ? list.filter((v) => isOpenNow(v) === true)
    : list;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Order Food</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {openCount > 0
              ? `${openCount} vendor${openCount !== 1 ? 's' : ''} open now`
              : 'Pick a vendor and build your meal'}
          </p>
        </div>

        {/* My Orders pill (logged-in users only) */}
        {user && (
          <Link
            href="/my-orders"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground no-underline hover:bg-secondary/50"
          >
            My Orders
          </Link>
        )}

        {/* Open-now toggle */}
        <Link
          href={onlyOpen ? '/food' : '/food?open=1'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition',
            onlyOpen
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          Open now
          {openCount > 0 && !onlyOpen && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
              {openCount}
            </span>
          )}
        </Link>
      </div>

      {/* Search + vendor grid (shell owns search-active state) */}
      <FoodPageShell
        currentUserId={user?.id ?? null}
        vendors={filteredList.map((v) => {
          const rating    = ratingsMap[v.id];
          const menuItems = menuMap[v.id] ?? [];
          const open      = isOpenNow(v);
          const status    = getVendorStatusMeta(open, v.opens_at);
          const hours     =
            v.opens_at && v.closes_at
              ? `${formatHour(v.opens_at)} – ${formatHour(v.closes_at)}`
              : null;
          return {
            id: v.id, user_id: (v as any).user_id ?? null, name: v.name, description: v.description,
            avatar_url: v.avatar_url, opens_at: v.opens_at, closes_at: v.closes_at,
            open, hours, rating: rating ?? null, menuItems,
            statusLabel: status.label,
            statusTone: status.tone,
            day_schedule: (v as any).day_schedule ?? null,
            accepts_delivery: (v as any).accepts_delivery ?? null,
          } satisfies FoodVendorData;
        })}
        emptyNode={
          filteredList.length === 0 ? (
            <div className="rounded-3xl border bg-white p-8 text-center">
              <Circle className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
              <p className="font-semibold text-zinc-900">No vendors open right now</p>
              <p className="mt-1 text-sm text-zinc-500">Check back during meal times.</p>
              <Link
                href="/food"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
              >
                View all vendors
              </Link>
            </div>
          ) : null
        }
      />

      {/* Vendor discovery CTA — shown to logged-in non-vendors only */}
      {user && !isAlreadyVendor && (
        <div className="mt-2 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-xl">
              🍽
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-900">Run a canteen or food stall?</p>
              <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">
                Students order through the app. You see a live queue, set your own hours, and get push alerts — no WhatsApp chaos.
              </p>
            </div>
          </div>
          <Link
            href="/vendor/register"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-2.5 text-sm font-semibold text-white no-underline hover:bg-zinc-700"
          >
            Sell food on Jabumarket
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      )}
    </div>
  );
}
