'use client';

// components/vendor/FoodOrderCTA.tsx
// Client component for the "Order Food" CTA on vendor pages

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UtensilsCrossed, Clock } from 'lucide-react';
import MealBuilder from '@/components/chat/MealBuilder';
import { isOpenNow, type DayEntry } from '@/lib/vendorSchedule';
import { supabase } from '@/lib/supabase';

type Props = {
  vendorId: string;
  vendorName: string;
  description?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  acceptsOrders: boolean;
  daySchedule?: DayEntry[] | null;
};

function formatHour(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const minute = m ?? '00';
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return minute === '00' ? `${display}${suffix}` : `${display}:${minute}${suffix}`;
}

export default function FoodOrderCTA({
  vendorId,
  vendorName,
  description,
  opensAt,
  closesAt,
  acceptsOrders,
  daySchedule,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showMealBuilder, setShowMealBuilder] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const [showAuthWall, setShowAuthWall] = useState(false);

  // Auto-open meal builder if ?order=true (only after auth check)
  useEffect(() => {
    if (searchParams.get('order') === 'true' && acceptsOrders) {
      handleOrderClick();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hours =
    opensAt && closesAt
      ? `${formatHour(opensAt)} – ${formatHour(closesAt)}`
      : null;

  // Fix 6: use strict === true — isOpenNow can return null for unknown schedule
  const open = acceptsOrders
    ? isOpenNow({ opens_at: opensAt, closes_at: closesAt, day_schedule: daySchedule }) === true
    : false;

  // Fix 5: check auth before opening the builder
  async function handleOrderClick() {
    setAuthChecking(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setShowAuthWall(true);
        return;
      }
      setShowMealBuilder(true);
    } finally {
      setAuthChecking(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Food vendor info */}
      <div className="rounded-2xl border bg-zinc-50 p-3 space-y-2">
        {description && (
          <p className="text-sm text-zinc-600">{description}</p>
        )}
        {hours && (
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="h-3.5 w-3.5" />
            {hours}
          </p>
        )}
      </div>

      {/* Auth wall */}
      {showAuthWall && (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-900">Sign in to place an order</p>
          <p className="text-xs text-zinc-500">Create a free account in under a minute. No spam.</p>
          <div className="flex gap-2">
            <a href={`/signup?next=/vendors/${vendorId}?order=true`}
              className="flex-1 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white text-center hover:bg-zinc-700">
              Sign up free
            </a>
            <a href={`/login?next=/vendors/${vendorId}?order=true`}
              className="flex-1 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 text-center hover:bg-zinc-50">
              Log in
            </a>
          </div>
        </div>
      )}

      {/* CTA */}
      {!showAuthWall && (
        open ? (
          <button
            type="button"
            onClick={handleOrderClick}
            disabled={authChecking}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            <UtensilsCrossed className="h-4 w-4" />
            {authChecking ? 'Checking…' : `Order Food from ${vendorName}`}
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-400">
            <UtensilsCrossed className="h-4 w-4" />
            {!acceptsOrders ? 'Currently not accepting orders' : 'Closed right now'}
          </div>
        )
      )}

      {/* Meal Builder */}
      {showMealBuilder && (
        <MealBuilder
          vendorId={vendorId}
          vendorName={vendorName}
          onClose={() => setShowMealBuilder(false)}
          onOrderSent={({ order_id }) => {
            // Fix 7: deep-link to the specific order, not just the list
            router.push(`/my-orders?highlight=${order_id}`);
          }}
        />
      )}
    </div>
  );
}