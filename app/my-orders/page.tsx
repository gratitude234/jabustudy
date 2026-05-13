'use client';
// app/my-orders/page.tsx
// Buyer order history — Realtime status updates, ETA countdown, ready banner
//
// REQUIRED DB MIGRATION (run once in Supabase SQL editor):
//   ALTER TABLE public.orders REPLICA IDENTITY FULL;
//
// Without REPLICA IDENTITY FULL, Supabase Realtime UPDATE events do not
// include buyer_id in the WAL payload, so the filter buyer_id=eq.{userId}
// never matches — updates are silently dropped on the client.
//
// Also ensure this RLS SELECT policy exists:
//   CREATE POLICY "buyers can view own orders" ON public.orders
//   FOR SELECT USING (auth.uid() = buyer_id);

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { summarizeOrderLines } from '@/types/meal-builder';
import type { OrderPayload, OrderLine, VendorMenuItem } from '@/types/meal-builder';
import MealBuilder from '@/components/chat/MealBuilder';
import {
  Loader2, MessageCircle, UtensilsCrossed, ArrowLeft, Bell, X, RefreshCw, RotateCcw, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderEntry = {
  id: string;
  conversation_id: string | null;
  vendor_id: string;
  items: OrderPayload;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  order_type: string;
  delivery_address: string | null;
  pickup_note: string | null;
  created_at: string;
  updated_at: string;
  eta_ready_at: string | null;
  paid_at: string | null;
  receipt_url: string | null;
  vendor: {
    name: string; avatar_url: string | null;
    bank_name: string | null; bank_account_number: string | null; bank_account_name: string | null;
    vendor_type: string | null;
    payment_note: string | null;
  };
};

// Realtime payload shape — no vendor join
type OrderRow = Omit<OrderEntry, 'vendor'>;

const STATUS_STYLES: Record<string, {
  label: string; dotClass: string; textClass: string; ringClass: string;
}> = {
  pending:   { label: 'Pending',   dotClass: 'bg-amber-400',   textClass: 'text-amber-700',   ringClass: 'ring-amber-200' },
  confirmed: { label: 'Confirmed', dotClass: 'bg-blue-500',    textClass: 'text-blue-700',    ringClass: 'ring-blue-100' },
  preparing: { label: 'Preparing', dotClass: 'bg-purple-500',  textClass: 'text-purple-700',  ringClass: 'ring-purple-100' },
  ready:     { label: 'Ready!',    dotClass: 'bg-emerald-500', textClass: 'text-emerald-700', ringClass: 'ring-emerald-200' },
  delivered: { label: 'Delivered', dotClass: 'bg-emerald-600', textClass: 'text-emerald-800', ringClass: '' },
  cancelled: { label: 'Cancelled', dotClass: 'bg-zinc-400',    textClass: 'text-zinc-500',    ringClass: '' },
};

function getStatusLabel(status: string, vendorType: string | null): string {
  if (status === 'preparing' && vendorType !== 'food') return 'Confirmed';
  if (status === 'ready' && vendorType !== 'food') return 'Ready for collection';
  return STATUS_STYLES[status]?.label ?? status;
}

const ACTIVE = ['pending', 'confirmed', 'preparing', 'ready'];

const TABS = [
  { key: 'all',    label: 'All orders' },
  { key: 'active', label: 'Active' },
  { key: 'done',   label: 'Completed' },
] as const;
type Tab = (typeof TABS)[number]['key'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

function etaLabel(etaReadyAt: string | null | undefined): string | null {
  if (!etaReadyAt) return null;
  const mins = Math.round((new Date(etaReadyAt).getTime() - Date.now()) / 60000);
  if (mins <= 0) return null;
  return `~${mins} min`;
}

// ── Component ─────────────────────────────────────────────────────────────────

// ── Inline review card ────────────────────────────────────────────────────────

function ReviewCard({
  vendorId,
  userId,
  onReviewed,
}: {
  vendorId: string;
  userId: string;
  onReviewed: () => void;
}) {
  const [rating, setRating]     = useState(0);
  const [comment, setComment]   = useState('');
  const [submitting, setSubmit] = useState(false);
  const [done, setDone]         = useState(false);

  async function submit() {
    if (rating === 0) return;
    setSubmit(true);
    try {
      await supabase.from('vendor_reviews').insert({
        vendor_id: vendorId,
        reviewer_id: userId,
        rating,
        comment: comment.trim() || null,
      });
      setDone(true);
      onReviewed();
    } catch {
      // silently ignore — non-critical
    } finally {
      setSubmit(false);
    }
  }

  if (done) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
        Thanks for your review ✓
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-zinc-700">Rate this order</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className={cn(
              'text-xl leading-none transition-transform hover:scale-110',
              star <= rating ? 'text-amber-400' : 'text-zinc-300'
            )}
            aria-label={`${star} star`}
          >
            ★
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Add a comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={200}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
      />
      <button
        type="button"
        onClick={submit}
        disabled={rating === 0 || submitting}
        className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Submit review
      </button>
    </div>
  );
}

// ── Self-cancellation button ──────────────────────────────────────────────────
// Visible only on pending orders. Asks for a single confirmation tap before
// calling the cancel endpoint. Handles the vendor-already-accepted race.

function CancelButton({
  orderId,
  onCancelled,
}: {
  orderId: string;
  onCancelled: () => void;
}) {
  const [step, setStep]     = useState<'idle' | 'confirm' | 'cancelling'>('idle');
  const [error, setError]   = useState<string | null>(null);

  async function confirm() {
    setStep('cancelling');
    setError(null);
    try {
      const res  = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        onCancelled();
      } else {
        // 409 = vendor already accepted — surface the helpful message
        setError(json.message ?? 'Could not cancel order.');
        setStep('idle');
      }
    } catch {
      setError('Something went wrong. Try again.');
      setStep('idle');
    }
  }

  if (step === 'confirm') {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5">
        <p className="flex-1 text-xs font-medium text-red-800">Cancel this order?</p>
        <button
          type="button"
          onClick={() => setStep('idle')}
          className="rounded-xl border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={confirm}
          className="rounded-xl bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          Yes, cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      <button
        type="button"
        onClick={() => setStep('confirm')}
        disabled={step === 'cancelling'}
        className="inline-flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors"
      >
        {step === 'cancelling'
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <XCircle className="h-3.5 w-3.5" />}
        Cancel order
      </button>
      {error && (
        <p className="text-[11px] text-red-600 leading-snug max-w-xs">{error}</p>
      )}
    </div>
  );
}

// ── Reorder flow ──────────────────────────────────────────────────────────────
// Validates items are still active, then opens MealBuilder pre-filled.

type ReorderState = 'idle' | 'validating' | 'ready' | 'unavailable';

function ReorderFlow({
  order,
  onDone,
}: {
  order: OrderEntry;
  onDone: () => void;
}) {
  const [state, setState]         = useState<ReorderState>('idle');
  const [validLines, setValid]    = useState<OrderLine[]>([]);
  const [showBuilder, setBuilder] = useState(false);
  const [notice, setNotice]       = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function normalizeName(value: string) {
    return value.trim().toLowerCase();
  }

  async function start() {
    setState('validating');
    setNotice(null);
    const lines: OrderLine[] = order.items?.lines ?? [];
    if (lines.length === 0) { setState('unavailable'); return; }

    try {
      // Ask the menu API for the vendor's current active items
      const res = await fetch(`/api/vendors/${order.vendor_id}/menu`);
      if (!res.ok) {
        setState('idle');
        return;
      }
      const json: { ok?: boolean; categories?: Array<{ items: VendorMenuItem[] }> } = await res.json();
      if (!json.ok) {
        setState('idle');
        return;
      }
      const activeItems = (json.categories ?? []).flatMap((category) => category.items);
      const itemsById = new Map(activeItems.map((item) => [item.id, item]));
      const itemsByName = new Map(activeItems.map((item) => [normalizeName(item.name), item]));

      const good: OrderLine[] = [];
      let missingCount = 0;
      for (const line of lines) {
        const activeItem = itemsById.get(line.item_id) ?? itemsByName.get(normalizeName(line.name));
        if (!activeItem) {
          missingCount += 1;
          continue;
        }
        good.push({
          ...line,
          item_id: activeItem.id,
          name: activeItem.name,
          emoji: activeItem.emoji,
          unit_name: activeItem.unit_name,
          price_per_unit: activeItem.price_per_unit,
          line_total: activeItem.price_per_unit * line.qty,
          category: activeItem.category,
        });
      }

      setValid(good);

      if (good.length === 0)   { setState('unavailable'); return; }
      if (missingCount > 0) {
        setNotice('Some items are no longer available.');
      }
      setState('ready');
      setBuilder(true);
    } catch {
      setState('idle');
    }
  }

  if (showBuilder) {
    return (
      <div className="mt-3 space-y-2">
        {notice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
            {notice}
          </div>
        ) : null}
        <div className="rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
          <p className="text-xs font-semibold text-zinc-700">Reorder from {order.vendor.name}</p>
          <button type="button" onClick={() => { setBuilder(false); setState('idle'); onDone(); }}
            className="grid h-6 w-6 place-items-center rounded-lg hover:bg-zinc-200">
            <X className="h-3.5 w-3.5 text-zinc-500" />
          </button>
        </div>
        <MealBuilder
          vendorId={order.vendor_id}
          vendorName={order.vendor.name}
          prefillLines={validLines}
          onClose={() => { setBuilder(false); setState('idle'); }}
          onOrderSent={onDone}
        />
        </div>
      </div>
    );
  }

  if (state === 'unavailable') {
    return (
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
        <p className="text-xs text-zinc-500">All items from this order are no longer available.</p>
        <button type="button" onClick={() => setState('idle')}
          className="ml-2 text-xs font-medium text-zinc-600 hover:text-zinc-900">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {notice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
          {notice}
        </div>
      ) : null}
      <button
        type="button"
        onClick={start}
        disabled={state === 'validating'}
        className="inline-flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {state === 'validating'
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RotateCcw className="h-3.5 w-3.5" />}
        Reorder
      </button>
    </div>
  );
}

export default function MyOrdersPage() {
  const router = useRouter();

  const [userId, setUserId]               = useState<string | null>(null);
  const [orders, setOrders]               = useState<OrderEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState<Tab>('all');
  const [error, setError]                 = useState<string | null>(null);
  const [realtimeOk, setRealtimeOk]       = useState<boolean | null>(null);
  const [readyAlert, setReadyAlert]       = useState<{ orderId: string; vendorName: string } | null>(null);
  const [reviewedVendors, setReviewed]    = useState<Set<string>>(new Set());
  // deliveryStatuses: order_id → delivery_request status
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, string>>({});
  // Tick every 30s so ETA chips re-compute without a full data refetch
  const [tick, setTick]             = useState(0);
  // Payment
  const [copied, setCopied]               = useState<string | null>(null);
  const [confirming, setConfirming]         = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [receiptUploadedOrders, setReceiptUploadedOrders] = useState<Set<string>>(new Set());
  const [nudging,          setNudging]          = useState<string | null>(null);
  const [nudgeError,       setNudgeError]       = useState<string | null>(null);
  const [nudgeSent,        setNudgeSent]        = useState<string | null>(null);
  const [revealedAccount,  setRevealedAccount]  = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Vendor data is not in realtime payloads — preserve it from REST responses
  const vendorCacheRef = useRef<Record<string, OrderEntry['vendor']>>({});
  // Keep tab accessible inside the realtime callback without re-subscribing
  const tabRef = useRef<Tab>('all');

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadOrders = useCallback(async (filterTab: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/orders/my?filter=${filterTab}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to load orders');
      const loadedOrders: OrderEntry[] = json.orders;
      for (const o of loadedOrders) {
        vendorCacheRef.current[o.vendor_id] = o.vendor;
      }
      setOrders(loadedOrders);
      setReceiptUploadedOrders(new Set(
        loadedOrders
          .filter((o: any) => !!o.receipt_url)
          .map((o: any) => o.id)
      ));

      // Fetch delivery_request status for delivery orders
      const deliveryOrderIds = loadedOrders
        .filter((o) => o.order_type === 'delivery')
        .map((o) => o.id);
      if (deliveryOrderIds.length > 0) {
        const { data: drs } = await supabase
          .from('delivery_requests')
          .select('order_id, status')
          .in('order_id', deliveryOrderIds);
        if (drs && drs.length > 0) {
          const map: Record<string, string> = {};
          for (const dr of drs) if (dr.order_id) map[dr.order_id] = dr.status;
          setDeliveryStatuses((prev) => ({ ...prev, ...map }));
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auth + initial load ─────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return; }
      setUserId(data.user.id);
      loadOrders('all');
      // Pre-load vendor IDs the user has already reviewed
      supabase
        .from('vendor_reviews')
        .select('vendor_id')
        .eq('reviewer_id', data.user.id)
        .then(({ data: rows }) => {
          if (rows && rows.length > 0) {
            setReviewed(new Set(rows.map((r) => r.vendor_id)));
          }
        });
    });
  }, [loadOrders, router]);

  // ── Realtime ────────────────────────────────────────────────────────────────
  //
  // Requires: ALTER TABLE public.orders REPLICA IDENTITY FULL;
  //
  // Postgres UPDATE WAL records only include changed columns + PK by default.
  // buyer_id never changes on a status update, so without FULL identity it is
  // absent from the WAL diff — Supabase's filter can't match it and drops the event.
  //
  // The subscribe() callback receives the channel status:
  //   'SUBSCRIBED'         → realtime is live, update the indicator to green
  //   'CHANNEL_ERROR'      → something went wrong (missing policy, bad filter)
  //   'TIMED_OUT'          → network issue
  //   'CLOSED'             → channel was explicitly closed

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`buyer-orders:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'orders',
          filter: `buyer_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as OrderRow;

          setOrders((prev) => {
            const exists = prev.some((o) => o.id === row.id);
            if (!exists) return prev; // not visible in this tab — skip

            return prev.map((o): OrderEntry => {
              if (o.id !== row.id) return o;
              return {
                ...o,
                status:         row.status,
                payment_status: row.payment_status,
                payment_method: row.payment_method,
                updated_at:     row.updated_at,
                eta_ready_at:   row.eta_ready_at,
                vendor:         vendorCacheRef.current[o.vendor_id] ?? o.vendor,
              };
            });
          });

          // Remove from active tab when order completes
          if (tabRef.current === 'active' && ['delivered', 'cancelled'].includes(row.status)) {
            setOrders((prev) => prev.filter((o) => o.id !== row.id));
          }

          // Ready banner
          if (row.status === 'ready') {
            const vendor = vendorCacheRef.current[row.vendor_id];
            setReadyAlert({
              orderId:    row.id,
              vendorName: vendor?.name ?? 'the vendor',
            });
          }
        }
      )
      .subscribe((status) => {
        setRealtimeOk(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Delivery request Realtime ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`buyer-delivery-requests:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'delivery_requests',
          filter: `buyer_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { order_id?: string; status?: string };
          if (row.order_id && row.status) {
            setDeliveryStatuses((prev) => ({ ...prev, [row.order_id!]: row.status! }));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Auto-dismiss ready alert after 8s
  useEffect(() => {
    if (!readyAlert) return;
    const t = setTimeout(() => setReadyAlert(null), 8000);
    return () => clearTimeout(t);
  }, [readyAlert]);

  // ── Payment actions ─────────────────────────────────────────────────────────

  async function handleBuyerConfirm(orderId: string) {
    setConfirming(orderId);
    try {
      const res  = await fetch(`/api/orders/${orderId}/buyer-confirm`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setOrders((prev) => prev.map((o) =>
          o.id === orderId ? { ...o, payment_status: 'buyer_confirmed', payment_method: 'transfer' } : o
        ));
      }
    } finally {
      setConfirming(null);
    }
  }

  async function handleMarkCash(orderId: string) {
    setConfirming(orderId);
    try {
      const res  = await fetch(`/api/orders/${orderId}/payment-method`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'cash' }),
      });
      const json = await res.json();
      if (json.ok) {
        setOrders((prev) => prev.map((o) =>
          o.id === orderId ? { ...o, payment_method: 'cash' } : o
        ));
      }
    } finally {
      setConfirming(null);
    }
  }

  // ── Tab switching ───────────────────────────────────────────────────────────

  function switchTab(t: Tab) {
    tabRef.current = t;
    setTab(t);
    loadOrders(t);
  }

  const activeCount = orders.filter((o) => ACTIVE.includes(o.status)).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-2xl border bg-white hover:bg-zinc-50">
          <ArrowLeft className="h-4 w-4 text-zinc-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-900">My Orders</h1>
          {activeCount > 0 && (
            <p className="text-xs font-semibold text-amber-600">
              {activeCount} order{activeCount > 1 ? 's' : ''} in progress
            </p>
          )}
        </div>

        {/* Live / offline indicator */}
        {realtimeOk !== null && (
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
            realtimeOk
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-zinc-200 bg-zinc-50 text-zinc-500'
          )}>
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              realtimeOk ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
            )} />
            {realtimeOk ? 'Live' : 'Offline'}
          </span>
        )}

        {/* Manual refresh fallback when realtime is down */}
        {realtimeOk === false && (
          <button type="button" onClick={() => loadOrders(tab)}
            title="Refresh orders"
            className="grid h-9 w-9 place-items-center rounded-2xl border bg-white hover:bg-zinc-50">
            <RefreshCw className="h-4 w-4 text-zinc-600" />
          </button>
        )}
      </div>

      {/* Ready banner */}
      {readyAlert && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Bell className="h-5 w-5 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">
              Your order from {readyAlert.vendorName} is ready!
            </p>
            <p className="text-xs text-emerald-700">Go pick it up now.</p>
          </div>
          <button type="button" onClick={() => setReadyAlert(null)}
            className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border bg-zinc-50 p-1">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => switchTab(t.key)}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all',
              tab === t.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Orders */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button type="button" onClick={() => loadOrders(tab)}
            className="inline-flex items-center gap-1.5 rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-zinc-50">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border bg-white p-10 text-center">
          <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-zinc-200" />
          <p className="font-semibold text-zinc-900">No orders yet</p>
          <p className="mt-1 text-sm text-zinc-500">Your food orders will appear here.</p>
          <Link href="/food"
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-zinc-700">
            <UtensilsCrossed className="h-4 w-4" />
            Order food
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const st       = STATUS_STYLES[order.status] ?? STATUS_STYLES.pending;
            const isActive = ACTIVE.includes(order.status);
            const isReady  = order.status === 'ready';
            // tick is a dependency so this recomputes every 30s
            // eslint-disable-next-line react-hooks/exhaustive-deps
            const eta      = order.status === 'preparing' ? etaLabel(order.eta_ready_at) : null;
            const deliveryStatus = order.order_type === 'delivery' ? (deliveryStatuses[order.id] ?? null) : null;

            return (
              <div key={order.id}
                className={cn(
                  'rounded-3xl border bg-white p-4 shadow-sm transition-all',
                  isActive && `ring-1 ${st.ringClass}`,
                  isReady  && 'border-emerald-300'
                )}>

                {/* Vendor row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {order.vendor.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={order.vendor.avatar_url} alt=""
                        className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-100 text-lg">🍽</div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{order.vendor.name}</p>
                      <p className="text-xs text-zinc-400">{timeAgo(order.created_at)}</p>
                    </div>
                  </div>
                  <span className={cn('flex shrink-0 items-center gap-1.5 text-xs font-semibold', st.textClass)}>
                    <span className={cn('h-2 w-2 rounded-full', st.dotClass, isActive && 'animate-pulse')} />
                    {getStatusLabel(order.status, order.vendor.vendor_type)}
                  </span>
                </div>

                {/* Items */}
                <p className="mt-3 text-sm text-zinc-700">{summarizeOrderLines(order.items)}</p>

                {/* ETA chip */}
                {eta && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                    Ready in {eta}
                  </div>
                )}

                {/* Ready prompt */}
                {isReady && (
                  <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    🔔 Your order is ready — go pick it up!
                  </div>
                )}

                {/* Fulfillment */}
                <p className="mt-2 text-xs text-zinc-500">
                  {order.order_type === 'delivery'
                    ? `🛵 Delivery${order.delivery_address ? ` → ${order.delivery_address}` : ''}`
                    : '🏃 Pickup'}
                </p>
                {order.pickup_note && (
                  <p className="mt-1 text-xs italic text-zinc-400">"{order.pickup_note}"</p>
                )}

                {/* FIX 15 — Coaching message when rider not yet assigned */}
                {deliveryStatus === 'open' && (
                  <div className="mt-2 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <p className="text-xs text-amber-800">
                      Your vendor is arranging a rider. You'll see updates here once one is assigned.
                    </p>
                  </div>
                )}

                {/* FIX 10 — Delivery status chain */}
                {deliveryStatus && deliveryStatus !== 'cancelled' && (
                  <div className="mt-2 space-y-1">
                    {(
                      [
                        { key: 'open',      label: 'Looking for a rider' },
                        { key: 'accepted',  label: 'Rider assigned' },
                        { key: 'picked_up', label: 'Rider picked up your order' },
                        { key: 'delivered', label: 'Delivered ✓' },
                      ] as const
                    ).map(({ key, label }) => {
                      const ORDER = ['open', 'accepted', 'picked_up', 'delivered'];
                      const reached = ORDER.indexOf(deliveryStatus) >= ORDER.indexOf(key);
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            reached ? 'bg-emerald-500' : 'bg-zinc-200'
                          )} />
                          <p className={cn(
                            'text-xs',
                            reached ? 'font-medium text-zinc-800' : 'text-zinc-400'
                          )}>
                            {label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Payment card — shown for non-cancelled, non-delivered active orders */}
                {!['cancelled', 'delivered'].includes(order.status) && (() => {
                  const { payment_status: ps, payment_method: pm, vendor: v, paid_at, receipt_url } = order;
                  const hasBank    = !!(v.bank_account_number && v.bank_account_name && v.bank_name);
                  const isFood     = v.vendor_type === 'food';

                  // ── Already confirmed ────────────────────────────────────────
                  if (ps === 'vendor_confirmed') {
                    return (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 space-y-0.5">
                        <p className="text-xs font-semibold text-emerald-700">✅ Payment confirmed by vendor</p>
                        {paid_at && (
                          <p className="text-[11px] text-emerald-600">
                            Confirmed at {new Date(paid_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    );
                  }

                  // ── Buyer already tapped "I've paid" ─────────────────────────
                  if (ps === 'buyer_confirmed') {
                    // Show nudge button after 10 minutes of paid_at with no confirmation
                    const canNudge = (() => {
                      if (!paid_at) return true; // no timestamp — always allow
                      return Date.now() - new Date(paid_at).getTime() > 10 * 60 * 1000;
                    })();

                    return (
                      <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 space-y-2">
                        <p className="text-xs font-semibold text-blue-800">💸 Transfer sent — waiting for vendor</p>
                        {paid_at && (
                          <p className="text-[11px] text-blue-600">
                            Sent at {new Date(paid_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {receipt_url && (
                          <a
                            href={receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 underline"
                          >
                            🧾 View uploaded receipt
                          </a>
                        )}
                        {nudgeSent === order.id ? (
                          <p className="text-[11px] font-semibold text-emerald-700">✅ Vendor notified — give them a moment.</p>
                        ) : canNudge ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              disabled={nudging === order.id}
                              onClick={async () => {
                                setNudging(order.id);
                                setNudgeError(null);
                                try {
                                  const res  = await fetch(`/api/orders/${order.id}/nudge-vendor`, { method: 'POST' });
                                  const json = await res.json();
                                  if (!json.ok) throw new Error(json.message ?? 'Failed to nudge');
                                  setNudgeSent(order.id);
                                  setTimeout(() => setNudgeSent(null), 60000); // reset after 1 min
                                } catch (err: any) {
                                  setNudgeError(err.message ?? 'Could not send reminder');
                                } finally {
                                  setNudging(null);
                                }
                              }}
                              className={cn(
                                'w-full rounded-xl border py-2 text-xs font-semibold transition-all',
                                nudging === order.id
                                  ? 'border-zinc-200 bg-zinc-100 text-zinc-400'
                                  : 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
                              )}
                            >
                              {nudging === order.id ? 'Sending reminder…' : '🔔 Remind vendor to confirm'}
                            </button>
                            {nudgeError && (
                              <p className="text-[11px] text-red-600">{nudgeError}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-blue-500">You'll be notified once the vendor confirms.</p>
                        )}
                      </div>
                    );
                  }

                  // ── Cash order (marketplace only) ────────────────────────────
                  if (pm === 'cash') {
                    return (
                      <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600">
                        🤝 Paying cash on pickup
                      </div>
                    );
                  }

                  // ── Unpaid — show transfer details ────────────────────────────
                  return (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">1</span>
                        <p className="text-xs font-semibold text-zinc-700">Transfer to this account</p>
                      </div>
                      {hasBank ? (
                        <>
                          <div className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              {/* Masked by default — tap to reveal then copy */}
                              <p className="text-sm font-bold text-zinc-900 tracking-wider">
                                {revealedAccount === order.id
                                  ? v.bank_account_number
                                  : `••••••${v.bank_account_number!.slice(-4)}`}
                              </p>
                              <div className="flex shrink-0 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setRevealedAccount(revealedAccount === order.id ? null : order.id)}
                                  className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                                >
                                  {revealedAccount === order.id ? 'Hide' : 'Reveal'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(v.bank_account_number!).catch(() => {});
                                    setCopied(order.id);
                                    setTimeout(() => setCopied(null), 2000);
                                  }}
                                  className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                                >
                                  {copied === order.id ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-zinc-600">{v.bank_account_name}</p>
                            <p className="text-xs text-zinc-400">{v.bank_name}</p>
                          </div>

                          {/* Receipt upload */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn(
                                'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                                receiptUploadedOrders.has(order.id) ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'
                              )}>
                                {receiptUploadedOrders.has(order.id) ? '✓' : '2'}
                              </span>
                              <label className="text-xs font-semibold text-zinc-700">Upload transfer receipt (required)</label>
                            </div>
                            <label className={cn(
                              'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-2 text-xs font-medium transition-all',
                              uploadingReceipt === order.id
                                ? 'border-zinc-300 bg-zinc-50 text-zinc-400'
                                : receiptUploadedOrders.has(order.id)
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50'
                            )}>
                              {uploadingReceipt === order.id
                                ? <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                                : receiptUploadedOrders.has(order.id)
                                ? <>✅ Receipt uploaded</>
                                : <>📎 Attach transfer receipt (required)</>}
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={uploadingReceipt === order.id}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setUploadingReceipt(order.id);
                                  try {
                                    const fd = new FormData();
                                    fd.append('receipt', file);
                                    const res = await fetch(`/api/orders/${order.id}/receipt`, { method: 'POST', body: fd });
                                    const json = await res.json();
                                    if (!json.ok) throw new Error(json.message ?? 'Upload failed');
                                    setReceiptUploadedOrders(prev => {
                                      const next = new Set(prev);
                                      next.add(order.id);
                                      return next;
                                    });
                                  } catch (err: any) {
                                    alert(err.message ?? 'Upload failed');
                                  } finally {
                                    setUploadingReceipt(null);
                                  }
                                }}
                              />
                            </label>
                          </div>

                          {v.payment_note && (
                            <p className="text-[11px] font-medium text-amber-800">
                              📝 {v.payment_note}
                            </p>
                          )}
                          <p className="text-[11px] text-amber-700">
                            Transfer ₦{order.total.toLocaleString()} to the account above, then tap &quot;I&apos;ve paid&quot;.
                          </p>

                          {/* Action buttons — "I've paid" only; no cash for food orders */}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleBuyerConfirm(order.id)}
                              disabled={confirming === order.id || !receiptUploadedOrders.has(order.id)}
                              className={cn(
                                'flex-1 rounded-xl py-2 text-xs font-semibold transition-all',
                                confirming === order.id
                                  ? 'bg-zinc-400 text-white cursor-wait'
                                  : !receiptUploadedOrders.has(order.id)
                                  ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                                  : 'bg-zinc-900 text-white hover:bg-zinc-700'
                              )}
                            >
                              {confirming === order.id
                                ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
                                : !receiptUploadedOrders.has(order.id)
                                ? 'Upload receipt to confirm'
                                : "I've paid"}
                            </button>
                            {/* Cash only available for non-food vendors */}
                            {!isFood && (
                              <button
                                type="button"
                                onClick={() => handleMarkCash(order.id)}
                                disabled={confirming === order.id}
                                className="flex-1 rounded-xl border border-amber-300 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                              >
                                Pay cash
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        // No bank details — this should be blocked at order creation now,
                        // but handle gracefully for any orders that slipped through before the fix.
                        <p className="text-[11px] text-amber-700">
                          This vendor hasn&apos;t set up bank transfer yet. Contact them via chat to arrange payment.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Footer */}
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-zinc-900">₦{order.total.toLocaleString()}</p>
                  {order.conversation_id && (
                    <Link href={`/inbox/${order.conversation_id}`}
                      className="inline-flex items-center gap-1.5 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-700 no-underline hover:bg-zinc-50">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {isActive ? 'Chat with vendor' : 'View chat'}
                    </Link>
                  )}
                </div>

                {/* Cancel — self-service while order is still pending */}
                {order.status === 'pending' && (
                  <CancelButton
                    orderId={order.id}
                    onCancelled={() => {
                      // Optimistic: flip status locally so the card updates instantly
                      // The Realtime subscription will also push the DB change
                      setOrders((prev) =>
                        prev.map((o) => o.id === order.id ? { ...o, status: 'cancelled' } : o)
                      );
                    }}
                  />
                )}

                {/* Reorder — shown on delivered orders only */}
                {order.status === 'delivered' && (
                  <ReorderFlow
                    order={order}
                    onDone={() => switchTab('active')}
                  />
                )}

                {/* Inline review prompt — delivered orders not yet reviewed */}
                {order.status === 'delivered' && userId && !reviewedVendors.has(order.vendor_id) && (
                  <ReviewCard
                    vendorId={order.vendor_id}
                    userId={userId}
                    onReviewed={() =>
                      setReviewed((prev) => new Set([...prev, order.vendor_id]))
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
