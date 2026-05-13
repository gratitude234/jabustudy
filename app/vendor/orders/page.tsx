'use client';

// app/vendor/orders/page.tsx
// Vendor order management — 2 tabs (Live / Done), merged Accept+ETA, Realtime live updates

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { summarizeOrderLines } from '@/types/meal-builder';
import type { OrderPayload } from '@/types/meal-builder';
import {
  Loader2, MessageCircle, ShoppingBag, Bell, BellOff, XCircle,
  ChefHat, Package, CheckCircle2, Clock, X, Copy, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

type OrderCard = {
  id: string;
  conversation_id: string | null;
  buyer_id: string;
  items: OrderPayload;
  total: number;
  status: OrderStatus;
  payment_status: string;
  payment_method: string | null;
  receipt_url: string | null;
  pickup_note: string | null;
  order_type: 'pickup' | 'delivery' | null;
  delivery_address: string | null;
  created_at: string;
  eta_ready_at: string | null;
};

type Tab = 'live' | 'done';

const ETA_OPTIONS = [10, 15, 20, 30] as const;
const DECLINE_REASONS = ['Item sold out', 'Stall closing soon', 'Other'] as const;

function toTimeInputValue(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildEtaReadyAt(timeValue: string) {
  const [hours, minutes] = timeValue.split(':').map(Number);
  const etaDate = new Date();
  etaDate.setSeconds(0, 0);
  etaDate.setHours(hours, minutes, 0, 0);
  if (etaDate.getTime() < Date.now()) {
    etaDate.setDate(etaDate.getDate() + 1);
  }
  return etaDate.toISOString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
}

const STATUS_META: Record<OrderStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending:   { label: 'New order',  cls: 'border-amber-200 bg-amber-50 text-amber-800',       icon: Clock },
  confirmed: { label: 'Confirmed',  cls: 'border-blue-200 bg-blue-50 text-blue-800',           icon: CheckCircle2 },
  preparing: { label: 'Preparing',  cls: 'border-purple-200 bg-purple-50 text-purple-800',     icon: ChefHat },
  ready:     { label: 'Ready',      cls: 'border-emerald-200 bg-emerald-50 text-emerald-800',  icon: Bell },
  delivered: { label: 'Delivered',  cls: 'border-emerald-300 bg-emerald-100 text-emerald-900', icon: Package },
  cancelled: { label: 'Cancelled',  cls: 'border-red-200 bg-red-50 text-red-700',              icon: XCircle },
};

// ── ETA bottom sheet ────────────────────────────────────────────────────────────

function EtaSheet({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (eta: number | null) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<number>(15);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0">
      <div className="w-full max-w-lg rounded-t-3xl border border-zinc-200 bg-white p-6 pb-8 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-zinc-900">Accept order</p>
            <p className="mt-0.5 text-sm text-zinc-500">How long until it is ready?</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {ETA_OPTIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setSelected(mins)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-2xl border py-3.5 text-center transition-all',
                selected === mins
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
              )}
            >
              <span className="text-lg font-bold">{mins}</span>
              <span className={cn('text-[11px]', selected === mins ? 'text-zinc-400' : 'text-zinc-500')}>
                min
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onConfirm(null)}
          disabled={loading}
          className="mt-3 w-full rounded-2xl border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 disabled:opacity-50"
        >
          Accept without ETA
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => onConfirm(selected)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-3.5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Accepting…</>
          ) : (
            <><ChefHat className="h-4 w-4" /> Accept — ready in {selected} min</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Order card ──────────────────────────────────────────────────────────────────

type RiderOption = { id: string; name: string | null; zone: string | null; zones_covered: string[] };

function OrderItem({
  order,
  acting,
  onAccept,
  onDecline,
  onReady,
  onDelivered,
  onUpdateEta,
  updatingEta,
  onVendorConfirmPayment,
  onPaymentDispute,
  confirmingPayment,
}: {
  order: OrderCard;
  acting: boolean;
  onAccept: () => void;
  onDecline: (reason?: string) => void;
  onReady: () => void;
  onDelivered: () => void;
  onUpdateEta: (etaReadyAt: string) => void;
  updatingEta: boolean;
  onVendorConfirmPayment: () => void;
  onPaymentDispute: () => void;
  confirmingPayment: boolean;
}) {
  const meta = STATUS_META[order.status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  const isPending = order.status === 'pending';
  const [copied, setCopied] = useState(false);

  // Rider assignment state (for delivery orders that are ready)
  const [riderPanelOpen, setRiderPanelOpen] = useState(false);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [showDeclinePicker, setShowDeclinePicker] = useState(false);
  const [declineReason, setDeclineReason] = useState<(typeof DECLINE_REASONS)[number]>('Item sold out');
  const [showEtaEditor, setShowEtaEditor] = useState(false);
  const [etaTime, setEtaTime] = useState(toTimeInputValue(order.eta_ready_at));

  async function loadRiders() {
    setRidersLoading(true);
    const { data } = await supabase
      .from('riders')
      .select('id, name, zone, zones_covered')
      .eq('is_available', true)
      .eq('verified', true)
      .limit(5);
    setRiders((data as RiderOption[]) ?? []);
    setRidersLoading(false);
  }

  function openRiderPanel() {
    setRiderPanelOpen(true);
    loadRiders();
  }

  async function assignRider() {
    if (!selectedRiderId) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/vendor/orders/${order.id}/assign-rider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rider_id: selectedRiderId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to assign rider');
      setAssigned(true);
      setRiderPanelOpen(false);
    } catch (e: any) {
      setAssignError(e.message ?? 'Failed');
    } finally {
      setAssigning(false);
    }
  }

  function confirmDecline() {
    onDecline(declineReason);
    setShowDeclinePicker(false);
  }

  function submitEtaUpdate() {
    if (!etaTime) return;
    onUpdateEta(buildEtaReadyAt(etaTime));
    setShowEtaEditor(false);
  }

  return (
    <div
      className={cn(
        'rounded-3xl border bg-white p-4 shadow-sm',
        isPending && 'border-amber-300 ring-1 ring-amber-100'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', meta.cls)}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
          <span className="text-xs text-zinc-400">{timeAgo(order.created_at)}</span>
        </div>
        <span className="shrink-0 text-sm font-bold text-zinc-900">
          ₦{order.total.toLocaleString()}
        </span>
      </div>

      <p className="mt-2.5 text-sm font-medium leading-relaxed text-zinc-800">
        {summarizeOrderLines(order.items)}
      </p>

      <div className="mt-1.5 flex flex-wrap gap-3">
        {order.order_type === 'delivery' ? (
          <span className="text-xs text-zinc-500">
            🛵 Delivery
            {order.delivery_address && (
              <>
                {' → '}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(order.delivery_address ?? '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  {order.delivery_address}
                  {copied
                    ? <Check className="h-3 w-3 text-emerald-600" />
                    : <Copy className="h-3 w-3 text-zinc-400" />}
                </button>
              </>
            )}
          </span>
        ) : (
          <span className="text-xs text-zinc-500">🏃 Pickup</span>
        )}
        {order.pickup_note && (
          <span className="text-xs italic text-zinc-500">"{order.pickup_note}"</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {order.status === 'pending' && (() => {
          // An order can only move to 'preparing' once payment_status === 'vendor_confirmed'.
          // If payment hasn't been confirmed yet, hide the Accept button entirely and show
          // a locked state — the vendor must use "Confirm payment" first.
          const paymentReady = order.payment_status === 'vendor_confirmed';
          const isCash       = order.payment_method === 'cash';
          const canAccept    = paymentReady || isCash;

          return (
            <>
              <button
                type="button"
                disabled={acting}
                onClick={() => setShowDeclinePicker((value) => !value)}
                className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
              >
                Decline
              </button>
              {canAccept ? (
                <button
                  type="button"
                  disabled={acting}
                  onClick={onAccept}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {acting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Accepting…</>
                    : <><ChefHat className="h-4 w-4" /> Accept &amp; start</>}
                </button>
              ) : (
                <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
                  💸 Confirm payment first
                </div>
              )}
            </>
          );
        })()}

        {(order.status === 'confirmed' || order.status === 'preparing') && (
          <>
            <button
              type="button"
              disabled={updatingEta}
              onClick={() => setShowEtaEditor((value) => !value)}
              className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {updatingEta ? 'Updating ETA…' : 'Update ETA'}
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={onReady}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {acting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
                : <><Bell className="h-4 w-4" /> {order.order_type === 'delivery' ? 'Mark ready for delivery' : 'Mark ready for pickup'}</>}
            </button>
          </>
        )}

        {order.status === 'ready' && (
          <button
            type="button"
            disabled={acting}
            onClick={onDelivered}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {acting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
              : <><Package className="h-4 w-4" /> Mark delivered</>}
          </button>
        )}

        {order.conversation_id && (
          <Link
            href={`/inbox/${order.conversation_id}`}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-700 no-underline hover:bg-zinc-50"
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </Link>
        )}
      </div>

      {showDeclinePicker && order.status === 'pending' && (
        <div className="mt-3 space-y-2 rounded-2xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-800">Why are you declining this order?</p>
          <div className="space-y-2">
            {DECLINE_REASONS.map((reason) => (
              <label key={reason} className="flex items-center gap-2 text-sm text-red-900">
                <input
                  type="radio"
                  name={`decline-${order.id}`}
                  checked={declineReason === reason}
                  onChange={() => setDeclineReason(reason)}
                />
                {reason}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDeclinePicker(false)}
              className="flex-1 rounded-xl border border-red-200 bg-white py-2 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDecline}
              disabled={acting}
              className="flex-1 rounded-xl bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Confirm decline
            </button>
          </div>
        </div>
      )}

      {showEtaEditor && ['confirmed', 'preparing'].includes(order.status) && (
        <div className="mt-3 space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <label className="block text-xs font-semibold text-zinc-700">
            New ready time
          </label>
          <input
            type="time"
            value={etaTime}
            onChange={(e) => setEtaTime(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowEtaEditor(false)}
              className="flex-1 rounded-xl border border-zinc-200 bg-white py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitEtaUpdate}
              disabled={updatingEta || !etaTime}
              className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {updatingEta ? 'Saving…' : 'Save ETA'}
            </button>
          </div>
        </div>
      )}

      {/* Payment confirmation — shown when buyer claims they've transferred */}
      {order.payment_status === 'buyer_confirmed' && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-900">💸 Buyer says they&apos;ve transferred</p>
          <p className="text-[11px] text-amber-700">Check your account for ₦{order.total.toLocaleString()}, then confirm or dispute.</p>
          {order.receipt_url ? (
            <a
              href={order.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-amber-200"
            >
              <img
                src={order.receipt_url}
                alt="Transfer receipt"
                className="h-28 w-full object-cover"
              />
              <p className="bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                🧾 View full receipt ↗
              </p>
            </a>
          ) : (
            <p className="text-[11px] italic text-amber-600">No receipt uploaded by buyer.</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPaymentDispute}
              disabled={confirmingPayment}
              className="flex-1 rounded-xl border border-amber-300 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              Not received
            </button>
            <button
              type="button"
              onClick={onVendorConfirmPayment}
              disabled={confirmingPayment}
              className={cn(
                'flex-1 rounded-xl py-2 text-xs font-semibold text-white transition-all',
                confirmingPayment ? 'bg-zinc-400' : 'bg-emerald-600 hover:bg-emerald-700'
              )}
            >
              {confirmingPayment ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Confirm payment'}
            </button>
          </div>
        </div>
      )}

      {order.payment_status === 'vendor_confirmed' && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          ✅ Payment confirmed
        </div>
      )}

      {/* Rider assignment — for delivery orders that are preparing or ready */}
      {order.order_type === 'delivery' && ['preparing', 'ready'].includes(order.status) && !assigned && (
        <div className="mt-3">
          {!riderPanelOpen ? (
            <button
              type="button"
              onClick={openRiderPanel}
              className="w-full rounded-2xl border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-500 hover:border-zinc-500 hover:text-zinc-700"
            >
              🛵 Assign a rider
            </button>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 space-y-2.5">
              <p className="text-xs font-semibold text-zinc-700">Available riders nearby</p>
              {ridersLoading ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                </div>
              ) : riders.length === 0 ? (
                <p className="text-xs text-zinc-400">No available verified riders right now.</p>
              ) : (
                <>
                  {riders.map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2',
                        selectedRiderId === r.id ? 'border-zinc-900' : 'border-zinc-200'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedRiderId(r.id)}
                        className="flex-1 text-left"
                      >
                        <p className="text-xs font-semibold text-zinc-900">{r.name ?? 'Rider'}</p>
                        {r.zone && <p className="text-[11px] text-zinc-500">Zone: {r.zone}</p>}
                        {(r.zones_covered?.length > 0 || r.zone) && (
                          <p className="text-[11px] text-zinc-500">
                            Covers: {r.zones_covered?.length > 0 ? r.zones_covered.join(', ') : r.zone}
                          </p>
                        )}
                      </button>
                    </div>
                  ))}

                  {assignError && (
                    <p className="text-xs text-red-600">{assignError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setRiderPanelOpen(false)}
                      className="rounded-2xl border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedRiderId || assigning}
                      onClick={assignRider}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-zinc-900 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Confirm rider
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {assigned && order.order_type === 'delivery' && (
        <p className="mt-2 text-xs font-medium text-emerald-700">✓ Rider assigned</p>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

// ── Push notification opt-in ──────────────────────────────────────────────────

type PushState = 'idle' | 'requesting' | 'subscribed' | 'denied' | 'unsupported';

function usePushNotifications() {
  const [state, setState]   = useState<PushState>('idle');
  const [pushError, setPushError] = useState<string | null>(null);

  // Check current status on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setState('denied'); return; }

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription()
    ).then((sub) => {
      if (sub) setState('subscribed');
    }).catch(() => {});
  }, []);

  async function subscribe() {
    if (state === 'subscribed' || state === 'unsupported') return;
    setState('requesting');

    try {
      // Register service worker if needed
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState('denied'); return; }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setPushError('Push notifications are not configured. Contact support.');
        setState('idle');
        return;
      }

      // Convert VAPID key to Uint8Array
      const key = Uint8Array.from(
        atob(vapidKey.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0)
      );

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });

      const json = sub.toJSON();
      await fetch('/api/vendor/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh:   json.keys?.p256dh,
          auth:     json.keys?.auth,
        }),
      });

      setState('subscribed');
    } catch (e) {
      console.error('[push] subscribe error:', e);
      setState(Notification.permission === 'denied' ? 'denied' : 'idle');
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setState('idle'); return; }

      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch('/api/vendor/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      setState('idle');
    } catch (e) {
      console.error('[push] unsubscribe error:', e);
    }
  }

  return { state, subscribe, unsubscribe, pushError };
}

function PushOptIn() {
  const { state, subscribe, unsubscribe, pushError } = usePushNotifications();

  if (state === 'unsupported') return null;

  if (state === 'subscribed') {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-emerald-800">Push alerts on</p>
            <p className="text-[11px] text-emerald-700">You'll be notified even when the app is closed.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={unsubscribe}
          className="ml-3 shrink-0 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
        >
          Turn off
        </button>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <BellOff className="h-4 w-4 text-zinc-400 shrink-0" />
        <p className="text-xs text-zinc-500">
          Notifications blocked. Enable them in browser settings to get order alerts.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Bell className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-900">Get order alerts</p>
            <p className="text-[11px] text-amber-700 truncate">Notified even when the app is closed.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={subscribe}
          disabled={state === 'requesting'}
          className="ml-3 shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {state === 'requesting'
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Bell className="h-3 w-3" />}
          Enable
        </button>
      </div>
      {pushError && (
        <p className="mt-1.5 text-[11px] text-red-600 px-1">{pushError}</p>
      )}
    </>
  );
}

export default function VendorOrdersPage() {
  const [vendorId, setVendorId]         = useState<string | null>(null);
  const [orders, setOrders]             = useState<OrderCard[]>([]);
  const [loading, setLoading]           = useState(true);
  const [notVendor, setNotVendor]       = useState(false);
  const [tab, setTab]                   = useState<Tab>('live');
  const [acting, setActing]             = useState<string | null>(null);
  const [newAlert, setNewAlert]         = useState(false);
  const [etaTarget, setEtaTarget]       = useState<string | null>(null);
  const [etaLoading, setEtaLoading]     = useState(false);
  const vendorIdRef                     = useRef<string | null>(null);
  const [historyOrders, setHistory]     = useState<OrderCard[]>([]);
  const [historyPage, setHistoryPage]   = useState(0);
  const [historyMore, setHistoryMore]   = useState(false);
  const [historyLoading, setHistLoading]= useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null);
  const [updatingEtaOrderId, setUpdatingEtaOrderId] = useState<string | null>(null);
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playNewOrderAlert = useCallback(() => {
    if (!audioAlertsEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const windowWithWebkitAudio = window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        };
        const AudioCtor = window.AudioContext ?? windowWithWebkitAudio.webkitAudioContext;
        if (!AudioCtor) return;
        audioCtxRef.current = new AudioCtor();
      }
      const ctx = audioCtxRef.current;
      [0, 200].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, ctx.currentTime + delay / 1000);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + delay / 1000 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.18);
        osc.start(ctx.currentTime + delay / 1000);
        osc.stop(ctx.currentTime + delay / 1000 + 0.2);
      });
    } catch (error) {
      console.error('[vendor/orders] audio alert failed:', error);
    }
  }, [audioAlertsEnabled]);

  const loadOrders = useCallback(async (vid: string) => {
    const { data } = await supabase
      .from('orders')
      .select('id, conversation_id, buyer_id, items, total, status, payment_status, payment_method, receipt_url, pickup_note, order_type, delivery_address, created_at, eta_ready_at')
      .eq('vendor_id', vid)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: false });
    setOrders((data as OrderCard[]) ?? []);
  }, []);

  const loadHistory = useCallback(async (vid: string, page: number, append: boolean) => {
    setHistLoading(true);
    const PAGE = 20;
    const { data } = await supabase
      .from('orders')
      .select('id, conversation_id, buyer_id, items, total, status, payment_status, payment_method, receipt_url, pickup_note, order_type, delivery_address, created_at, eta_ready_at')
      .eq('vendor_id', vid)
      .in('status', ['delivered', 'cancelled'])
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    const rows = (data as OrderCard[]) ?? [];
    setHistory((prev) => append ? [...prev, ...rows] : rows);
    setHistoryMore(rows.length === PAGE);
    setHistLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) { setNotVendor(true); setLoading(false); return; }

      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', uid)
        .eq('vendor_type', 'food')
        .maybeSingle();

      if (!vendor) { setNotVendor(true); setLoading(false); return; }

      setVendorId(vendor.id);
      vendorIdRef.current = vendor.id;
      await loadOrders(vendor.id);
      setLoading(false);
    })();
  }, [loadOrders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setAudioAlertsEnabled(localStorage.getItem('vendor-audio-alerts') !== 'false');
  }, []);

  // Realtime — live order updates + new order alerts
  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-orders:${vendorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as OrderCard;
            setOrders((prev) => {
              if (prev.some((order) => order.id === newOrder.id)) return prev;
              return [newOrder, ...prev].filter((order) => !['delivered', 'cancelled'].includes(order.status));
            });
            if (!['delivered', 'cancelled'].includes(newOrder.status)) {
              setNewAlert(true);
              playNewOrderAlert();
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as OrderCard;
            setOrders((prev) =>
              prev
                .map((o) => (o.id === updated.id ? updated : o))
                .filter((o) => !['delivered', 'cancelled'].includes(o.status))
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [playNewOrderAlert, vendorId]);

  useEffect(() => {
    if (!newAlert) return;
    const t = setTimeout(() => setNewAlert(false), 4500);
    return () => clearTimeout(t);
  }, [newAlert]);

  useEffect(() => {
    return () => {
      const audioCtx = audioCtxRef.current;
      if (audioCtx) {
        void audioCtx.close().catch(() => undefined);
      }
    };
  }, []);

  async function updateStatus(orderId: string, status: string, etaMinutes?: number, reason?: string) {
    setActing(orderId);
    setOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, status: status as OrderStatus } : o)
    );
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...(etaMinutes ? { eta_minutes: etaMinutes } : {}),
          ...(reason ? { reason } : {}),
        }),
      });
      const json = await res.json();
      if (!json.ok && vendorIdRef.current) await loadOrders(vendorIdRef.current);
    } catch {
      if (vendorIdRef.current) await loadOrders(vendorIdRef.current);
    } finally {
      setActing(null);
    }
  }

  async function updateEta(orderId: string, etaReadyAt: string) {
    setUpdatingEtaOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/update-eta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eta_ready_at: etaReadyAt }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Failed to update ETA');
      }
      setOrders((prev) =>
        prev.map((order) => (
          order.id === orderId
            ? { ...order, eta_ready_at: etaReadyAt }
            : order
        ))
      );
    } catch (error) {
      console.error('[vendor/orders] update ETA failed:', error);
      if (vendorIdRef.current) await loadOrders(vendorIdRef.current);
    } finally {
      setUpdatingEtaOrderId(null);
    }
  }

  async function handleEtaConfirm(eta: number | null) {
    if (!etaTarget) return;
    setEtaLoading(true);
    await updateStatus(etaTarget, 'preparing', eta ?? undefined);
    setEtaLoading(false);
    setEtaTarget(null);
  }

  async function handleVendorConfirm(orderId: string) {
    setConfirmingPayment(orderId);
    try {
      const res  = await fetch(`/api/orders/${orderId}/vendor-confirm-payment`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setOrders((prev) => prev.map((o) =>
          o.id === orderId ? { ...o, payment_status: 'vendor_confirmed', status: 'preparing' as OrderStatus } : o
        ));
      }
    } finally {
      setConfirmingPayment(null);
    }
  }

  async function handlePaymentDispute(orderId: string) {
    setConfirmingPayment(orderId);
    try {
      const res  = await fetch(`/api/orders/${orderId}/payment-dispute`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setOrders((prev) => prev.map((o) =>
          o.id === orderId ? { ...o, payment_status: 'unpaid' } : o
        ));
      }
    } finally {
      setConfirmingPayment(null);
    }
  }

  const liveOrders   = orders.filter((o) => ['pending','confirmed','preparing','ready'].includes(o.status));
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  function switchTab(t: Tab) {
    setTab(t);
    if (t === 'done' && historyOrders.length === 0 && vendorId) {
      setHistoryPage(0);
      loadHistory(vendorId, 0, false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (notVendor) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <div className="rounded-3xl border bg-white p-8 text-center">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <p className="font-semibold text-zinc-900">Not a food vendor</p>
          <p className="mt-1 text-sm text-zinc-500">You need a food vendor account to view orders.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {etaTarget && (
        <EtaSheet
          onConfirm={handleEtaConfirm}
          onCancel={() => setEtaTarget(null)}
          loading={etaLoading}
        />
      )}

      <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Orders</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {pendingCount > 0
                ? `${pendingCount} order${pendingCount === 1 ? '' : 's'} waiting for you`
                : 'No pending orders right now'}
            </p>
          </div>
          <label className="flex items-center gap-2 pt-1 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={audioAlertsEnabled}
              onChange={(e) => {
                setAudioAlertsEnabled(e.target.checked);
                localStorage.setItem('vendor-audio-alerts', String(e.target.checked));
              }}
            />
            Audio alerts
          </label>
        </div>

        {/* Push notification opt-in */}
        <PushOptIn />

        {/* New order alert */}
        {newAlert && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Bell className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">New order just came in!</p>
              <p className="text-xs text-amber-700">It is at the top of your queue.</p>
            </div>
            <button type="button" onClick={() => setNewAlert(false)} className="rounded-lg p-1 text-amber-600 hover:bg-amber-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 2-tab switcher */}
        <div className="flex gap-1 rounded-2xl border bg-zinc-50 p-1">
          <button
            type="button"
            onClick={() => switchTab('live')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all',
              tab === 'live' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            Live queue
            {liveOrders.length > 0 && (
              <span className={cn(
                'min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold',
                pendingCount > 0 ? 'bg-amber-500 text-white' : 'bg-zinc-200 text-zinc-700'
              )}>
                {liveOrders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => switchTab('done')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all',
              tab === 'done' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            History
          </button>
        </div>

        {/* Orders */}
        {tab === 'live' ? (
          liveOrders.length === 0 ? (
            <div className="rounded-3xl border bg-white p-10 text-center">
              <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-zinc-200" />
              <p className="text-sm text-zinc-400">No active orders right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {liveOrders.map((order) => (
                <OrderItem
                  key={order.id}
                  order={order}
                  acting={acting === order.id}
                  onAccept={() => setEtaTarget(order.id)}
                  onDecline={(reason) => updateStatus(order.id, 'cancelled', undefined, reason)}
                  onReady={() => updateStatus(order.id, 'ready')}
                  onDelivered={() => updateStatus(order.id, 'delivered')}
                  onUpdateEta={(etaReadyAt) => updateEta(order.id, etaReadyAt)}
                  updatingEta={updatingEtaOrderId === order.id}
                  onVendorConfirmPayment={() => handleVendorConfirm(order.id)}
                  onPaymentDispute={() => handlePaymentDispute(order.id)}
                  confirmingPayment={confirmingPayment === order.id}
                />
              ))}
            </div>
          )
        ) : (
          historyLoading && historyOrders.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : historyOrders.length === 0 ? (
            <div className="rounded-3xl border bg-white p-10 text-center">
              <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-zinc-200" />
              <p className="text-sm text-zinc-400">No completed orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyOrders.map((order) => (
                <OrderItem
                  key={order.id}
                  order={order}
                  acting={acting === order.id}
                  onAccept={() => setEtaTarget(order.id)}
                  onDecline={(reason) => updateStatus(order.id, 'cancelled', undefined, reason)}
                  onReady={() => updateStatus(order.id, 'ready')}
                  onDelivered={() => updateStatus(order.id, 'delivered')}
                  onUpdateEta={(etaReadyAt) => updateEta(order.id, etaReadyAt)}
                  updatingEta={updatingEtaOrderId === order.id}
                  onVendorConfirmPayment={() => handleVendorConfirm(order.id)}
                  onPaymentDispute={() => handlePaymentDispute(order.id)}
                  confirmingPayment={confirmingPayment === order.id}
                />
              ))}
              {historyMore && (
                <button
                  type="button"
                  onClick={() => {
                    if (!vendorId) return;
                    const next = historyPage + 1;
                    setHistoryPage(next);
                    loadHistory(vendorId, next, true);
                  }}
                  disabled={historyLoading}
                  className="w-full rounded-2xl border bg-white py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {historyLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Load more'}
                </button>
              )}
            </div>
          )
        )}
      </div>
    </>
  );
}
