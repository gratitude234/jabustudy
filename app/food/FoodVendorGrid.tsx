'use client';
// app/food/FoodVendorGrid.tsx
// Client component — renders vendor cards with inline MealBuilder (no vendor profile hop)

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle2, Circle, Star, ShoppingBag, X, Plus, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';
import MealBuilder from '@/components/chat/MealBuilder';

export type FoodVendorData = {
  id: string;
  user_id: string | null;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  opens_at: string | null;
  closes_at: string | null;
  open: boolean | null;
  hours: string | null;
  statusLabel: string | null;
  statusTone: 'open' | 'soon' | 'closed' | null;
  rating: { avg: number; count: number } | null;
  menuItems: { name: string; emoji: string; stock_count: number | null }[];
  day_schedule?: import('@/lib/vendorSchedule').DayEntry[] | null;
  accepts_delivery?: boolean | null;
};

export default function FoodVendorGrid({ vendors, currentUserId }: { vendors: FoodVendorData[]; currentUserId?: string | null }) {
  const router = useRouter();
  // Track which vendor's MealBuilder is open (only one at a time)
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);

  function openOrder(id: string) {
    setActiveVendorId(id);
  }

  function closeOrder() {
    setActiveVendorId(null);
  }

  function handleOrderSent() {
    setActiveVendorId(null);
    router.push('/my-orders');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
        <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-amber-900">Food orders stay trackable</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
            Build your meal here, then follow payment, ETA and delivery updates in My Orders.
          </p>
        </div>
        <Link href="/my-orders" className="shrink-0 rounded-xl bg-amber-900 px-3 py-1.5 text-xs font-semibold text-amber-50 no-underline hover:bg-amber-800">
          My Orders
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {vendors.map((v) => (
          <div
            key={v.id}
            className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm"
          >
            {/* Vendor header */}
            <div className="flex items-start gap-3">
              {v.avatar_url ? (
                <Image
                  src={v.avatar_url}
                  alt={v.name ?? 'Vendor'}
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-100">
                  🍽
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {v.name ?? 'Vendor'}
                  </p>
                  {v.statusLabel && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                        v.statusTone === 'open'
                          ? 'border-emerald-200 bg-emerald-50 font-semibold text-emerald-700'
                          : v.statusTone === 'soon'
                            ? 'border-amber-200 bg-amber-50 font-semibold text-amber-700'
                            : 'border-zinc-200 bg-zinc-100 font-medium text-zinc-500'
                      )}
                    >
                      {v.statusTone === 'open' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                      {v.statusLabel}
                    </span>
                  )}
                  {v.accepts_delivery === true && v.open === true && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                      Delivery available
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {v.rating && (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-semibold text-zinc-900">
                        {v.rating.avg.toFixed(1)}
                      </span>
                      <span className="text-xs text-zinc-400">({v.rating.count})</span>
                    </span>
                  )}
                  {v.hours && (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="h-3.5 w-3.5" />
                      {v.hours}
                    </span>
                  )}
                </div>

                {v.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{v.description}</p>
                )}
              </div>
            </div>

            {/* Menu preview chips */}
            {v.menuItems.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Menu preview</div>
                <div className="flex flex-wrap gap-1.5">
                  {v.menuItems.map((item, i) => {
                    const low  = item.stock_count !== null && item.stock_count <= 3;
                    const warn = item.stock_count !== null && item.stock_count > 3 && item.stock_count <= 5;
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full border bg-zinc-50 px-2 py-1 text-xs text-zinc-700"
                      >
                        <span>{item.emoji}</span>
                        {item.name}
                        {low && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 leading-none">
                            {item.stock_count === 1 ? '1 left' : `${item.stock_count} left`}
                          </span>
                        )}
                        {warn && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 leading-none">
                            {item.stock_count} left
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inline MealBuilder — opens in place when Order is tapped */}
            {activeVendorId === v.id && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 bg-white">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Order from {v.name}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">After checkout, track it in My Orders.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeOrder}
                    className="grid h-7 w-7 place-items-center rounded-xl hover:bg-zinc-100"
                  >
                    <X className="h-4 w-4 text-zinc-500" />
                  </button>
                </div>
                <MealBuilder
                  vendorId={v.id}
                  vendorName={v.name ?? undefined}
                  onClose={closeOrder}
                  onOrderSent={handleOrderSent}
                />
              </div>
            )}

            {/* Actions — hide when MealBuilder is open for this vendor */}
            {activeVendorId !== v.id && (
              <div className="mt-auto flex gap-2">
                <Link
                  href={`/vendors/${v.id}`}
                  className="flex-1 inline-flex items-center justify-center rounded-2xl border bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 no-underline hover:bg-zinc-50"
                >
                  View menu
                </Link>

                {v.open !== false && v.menuItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => openOrder(v.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Order now
                  </button>
                ) : v.menuItems.length === 0 ? (
                  v.user_id && currentUserId === v.user_id ? (
                    <Link
                      href="/vendor/menu"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] px-3 py-2.5 text-sm font-semibold text-[#3B24A8] no-underline hover:bg-[#5B35D5]/10"
                    >
                      <Plus className="h-4 w-4" /> Add your menu
                    </Link>
                  ) : (
                    <div className="flex-1 inline-flex items-center justify-center rounded-2xl border border-dashed px-3 py-2.5 text-sm text-zinc-400">
                      Menu coming soon
                    </div>
                  )
                ) : (
                  <div className="flex-1 inline-flex items-center justify-center rounded-2xl border border-dashed px-3 py-2.5 text-sm text-zinc-400">
                    Closed
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
