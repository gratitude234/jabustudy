'use client';
// app/food/FoodSearch.tsx
// Cross-vendor dish search with inline MealBuilder
// Replaces the vendor grid while a query is active; shows it again on clear.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import MealBuilder from '@/components/chat/MealBuilder';
import type { DishResult, DishVendor } from '@/app/api/food/search/route';

type Props = { onSearchActive: (active: boolean) => void };

// ── Dish result card ───────────────────────────────────────────────────────────

function VendorRow({
  vendor,
  dishName,
  onOrder,
  ordering,
}: {
  vendor: DishVendor;
  dishName: string;
  onOrder: () => void;
  ordering: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 transition-colors',
      vendor.is_open === false && 'opacity-50',
    )}>
      {vendor.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vendor.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-100 text-sm">🍽</div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-zinc-900 truncate">{vendor.vendor_name}</p>
          {vendor.is_open === true && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 leading-none">
              Open
            </span>
          )}
          {vendor.is_open === false && (
            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 rounded-full px-1.5 py-0.5 leading-none">
              Closed
            </span>
          )}
          {vendor.rating_avg !== null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              {vendor.rating_avg.toFixed(1)}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          ₦{vendor.price.toLocaleString()} / {vendor.unit_name}
        </p>
      </div>

      {vendor.is_open !== false && (
        <button
          type="button"
          onClick={onOrder}
          disabled={ordering}
          className={cn(
            'shrink-0 rounded-2xl px-3 py-2 text-xs font-semibold transition-all',
            ordering
              ? 'bg-zinc-100 text-zinc-400'
              : 'bg-zinc-900 text-white hover:bg-zinc-700'
          )}
        >
          {ordering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Order'}
        </button>
      )}
    </div>
  );
}

function DishCard({ result }: { result: DishResult }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);

  const primary   = result.vendors[0];
  const rest      = result.vendors.slice(1);
  const hasMore   = rest.length > 0;
  const openCount = result.vendors.filter((v) => v.is_open === true).length;

  const minPrice  = Math.min(...result.vendors.map((v) => v.price));
  const maxPrice  = Math.max(...result.vendors.map((v) => v.price));
  const priceStr  = minPrice === maxPrice
    ? `₦${minPrice.toLocaleString()}`
    : `₦${minPrice.toLocaleString()}–₦${maxPrice.toLocaleString()}`;

  function handleOrderSent() {
    setActiveVendorId(null);
    router.push('/my-orders');
  }

  const vendorsToShow = expanded ? result.vendors : [primary];

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Dish header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span className="text-2xl leading-none">{result.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">{result.dish}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{priceStr}</span>
            <span>·</span>
            <span>
              {result.vendors.length === 1
                ? '1 vendor'
                : `${result.vendors.length} vendors`}
              {openCount > 0 && (
                <span className="ml-1 font-medium text-emerald-600">
                  · {openCount} open
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Vendor rows */}
      <div className="divide-y divide-zinc-100 border-t border-zinc-100">
        {vendorsToShow.map((vendor) => (
          <div key={vendor.vendor_id}>
            <VendorRow
              vendor={vendor}
              dishName={result.dish}
              onOrder={() => setActiveVendorId(
                activeVendorId === vendor.vendor_id ? null : vendor.vendor_id
              )}
              ordering={activeVendorId === vendor.vendor_id}
            />

            {/* Inline MealBuilder per vendor */}
            {activeVendorId === vendor.vendor_id && (
              <div className="border-t border-zinc-100 bg-zinc-50">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 bg-white">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900">
                      Order from {vendor.vendor_name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">You will track status in My Orders.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveVendorId(null)}
                    className="grid h-6 w-6 place-items-center rounded-lg hover:bg-zinc-100"
                  >
                    <X className="h-3.5 w-3.5 text-zinc-500" />
                  </button>
                </div>
                <div className="p-2">
                  <MealBuilder
                    vendorId={vendor.vendor_id}
                    vendorName={vendor.vendor_name}
                    onClose={() => setActiveVendorId(null)}
                    onOrderSent={handleOrderSent}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-zinc-100 py-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
          ) : (
            <><ChevronDown className="h-3.5 w-3.5" /> {rest.length} more vendor{rest.length > 1 ? 's' : ''}</>
          )}
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FoodSearch({ onSearchActive }: Props) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<DishResult[]>([]);
  const [status, setStatus]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setStatus('idle');
      onSearchActive(false);
      return;
    }

    // Cancel in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStatus('loading');
    onSearchActive(true);

    try {
      const res  = await fetch(`/api/food/search?q=${encodeURIComponent(q)}`, {
        signal: abortRef.current.signal,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Search failed');
      setResults(json.results);
      setStatus('done');
    } catch (e: any) {
      if (e.name === 'AbortError') return; // superseded by next keystroke
      setErrorMsg(e.message ?? 'Search failed');
      setStatus('error');
    }
  }, [onSearchActive]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query.trim()), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  function clear() {
    setQuery('');
    setResults([]);
    setStatus('idle');
    onSearchActive(false);
  }

  const isActive = query.trim().length >= 2;

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className={cn(
        'flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 transition-all',
        'focus-within:ring-2 focus-within:ring-zinc-900/10',
        isActive ? 'border-zinc-300' : 'border-zinc-200'
      )}>
        {status === 'loading' ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dishes — Jollof Rice, Eba, Chicken..."
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg hover:bg-zinc-100"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Results */}
      {status === 'error' && (
        <p className="text-sm text-red-600 px-1">{errorMsg}</p>
      )}

      {status === 'done' && results.length === 0 && (
        <div className="rounded-3xl border bg-white p-8 text-center">
          <p className="text-sm font-semibold text-zinc-900">
            No vendors sell "{query.trim()}" right now
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Try a different name, or browse all vendors below.
          </p>
          <button
            type="button"
            onClick={clear}
            className="mt-3 text-xs font-medium text-zinc-700 underline underline-offset-2"
          >
            Clear search
          </button>
        </div>
      )}

      {status === 'done' && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 px-1">
            {results.length} dish{results.length > 1 ? 'es' : ''} found
          </p>
          {results.map((r) => (
            <DishCard key={r.dish.toLowerCase()} result={r} />
          ))}
          <button
            type="button"
            onClick={clear}
            className="w-full rounded-2xl border border-dashed py-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            Clear search — show all vendors
          </button>
        </div>
      )}
    </div>
  );
}
