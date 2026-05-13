'use client';
// components/chat/MealBuilder.tsx
// Dynamic meal builder — renders steps based on vendor's actual menu categories

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ChevronRight, Check, Loader2, X, Plus, Minus, SkipForward,
} from 'lucide-react';
import type { MenuCategoryInfo, StepType, VendorMenuItem } from '@/types/meal-builder';
import { useMealBuilder } from '@/hooks/useMealBuilder';

type Props = {
  vendorId: string;
  vendorName?: string;
  onClose: () => void;
  onOrderSent: (result: { order_id: string; conversation_id: string }) => void;
  prefillLines?: import('@/types/meal-builder').OrderLine[];
};

// ── Shared controls ────────────────────────────────────────────────────────────

function QtyControl({ value, onInc, onDec, min = 0, max = 10 }: {
  value: number; onInc: () => void; onDec: () => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onDec} disabled={value <= min}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white hover:border-zinc-900 disabled:opacity-30">
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-[20px] text-center text-sm font-semibold text-zinc-900">{value}</span>
      <button type="button" onClick={onInc} disabled={value >= max}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white hover:border-zinc-900 disabled:opacity-30">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function OptionCard({ item, selected, onSelect, showUnit = true }: {
  item: VendorMenuItem; selected: boolean; onSelect: () => void; showUnit?: boolean;
}) {
  return (
    <button type="button" onClick={onSelect}
      className={cn(
        'flex flex-col gap-1 rounded-2xl border p-3 text-left transition-all',
        selected ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50'
      )}>
      <span className="text-xl">{item.emoji}</span>
      <span className="text-xs font-semibold leading-tight">{item.name}</span>
      <span className={cn('text-xs', selected ? 'text-zinc-400' : 'text-zinc-500')}>
        ₦{item.price_per_unit.toLocaleString()}{showUnit && item.unit_name !== 'piece' ? ` / ${item.unit_name}` : ''}
      </span>
    </button>
  );
}

// ── Step renderers per StepType ────────────────────────────────────────────────

function SingleStep({ cat, selectedId, onSelect }: {
  cat: MenuCategoryInfo; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Choose your {cat.label.toLowerCase()} *
      </p>
      <div className="grid grid-cols-3 gap-2">
        {cat.items.map((item) => (
          <OptionCard key={item.id} item={item} selected={selectedId === item.id}
            onSelect={() => onSelect(item.id)} showUnit={false} />
        ))}
      </div>
    </div>
  );
}

function SingleQtyStep({ cat, selectedId, selectedQty, onSelect, onInc, onDec }: {
  cat: MenuCategoryInfo; selectedId: string | null; selectedQty: number;
  onSelect: (id: string) => void; onInc: () => void; onDec: () => void;
}) {
  const selected = cat.items.find((i) => i.id === selectedId) ?? null;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Choose your {cat.label.toLowerCase()} *
      </p>
      <div className="grid grid-cols-3 gap-2">
        {cat.items.map((item) => (
          <OptionCard key={item.id} item={item} selected={selectedId === item.id}
            onSelect={() => onSelect(item.id)} />
        ))}
      </div>
      {selected && (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                How many {selected.unit_name}?
              </p>
              <p className="text-xs text-zinc-500">
                ₦{selected.price_per_unit.toLocaleString()} × {selectedQty} = ₦{(selected.price_per_unit * selectedQty).toLocaleString()}
              </p>
            </div>
            <QtyControl value={selectedQty} onInc={onInc} onDec={onDec} min={1} />
          </div>
        </div>
      )}
    </div>
  );
}

function MultiQtyStep({ cat, quantities, onQtyChange, canAdvance }: {
  cat: MenuCategoryInfo; quantities: Record<string, number>;
  onQtyChange: (id: string, qty: number) => void;
  canAdvance: boolean;
}) {
  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {cat.label} — pick &amp; choose *
      </p>
      <div className="flex flex-col gap-2">
        {cat.items.map((item) => {
          const qty = quantities[item.id] ?? 0;
          return (
            <div key={item.id}
              className={cn('flex items-center gap-3 rounded-2xl border p-3 transition-all',
                qty > 0 ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white')}>
              <span className="text-xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900">{item.name}</p>
                <p className="text-xs text-zinc-500">
                  ₦{item.price_per_unit.toLocaleString()} / {item.unit_name}
                  {qty > 0 && <span className="ml-1 font-semibold text-zinc-900"> · ₦{(item.price_per_unit * qty).toLocaleString()}</span>}
                </p>
              </div>
              <QtyControl value={qty}
                onInc={() => onQtyChange(item.id, qty + 1)}
                onDec={() => onQtyChange(item.id, qty - 1)} />
            </div>
          );
        })}
      </div>
      {!canAdvance && totalQty === 0 && (
        <p className="text-xs text-amber-600 font-medium">Select at least one item to continue</p>
      )}
    </div>
  );
}

function OptionalSingleStep({ cat, selectedId, skipped, onSelect, onSkip }: {
  cat: MenuCategoryInfo; selectedId: string | null; skipped: boolean;
  onSelect: (id: string) => void; onSkip: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {cat.label} — optional
      </p>
      <div className="grid grid-cols-3 gap-2">
        {cat.items.map((item) => (
          <OptionCard key={item.id} item={item} selected={selectedId === item.id}
            onSelect={() => onSelect(item.id)} showUnit={false} />
        ))}
      </div>
      <button type="button" onClick={onSkip}
        className={cn(
          'w-full rounded-2xl border py-2.5 text-sm font-medium transition-all',
          skipped && !selectedId
            ? 'border-zinc-900 bg-zinc-900 text-white'
            : 'border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-500 hover:text-zinc-600'
        )}>
        {skipped && !selectedId ? `✓ No ${cat.label.toLowerCase()}` : `No ${cat.label.toLowerCase()}, thanks`}
      </button>
    </div>
  );
}

function OptionalMultiStep({ cat, selectedIds, skipped, onToggle, onSkip }: {
  cat: MenuCategoryInfo; selectedIds: string[]; skipped: boolean;
  onToggle: (id: string) => void; onSkip: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {cat.label} — pick any (optional)
      </p>
      <div className="flex flex-col gap-2">
        {cat.items.map((item) => {
          const on = selectedIds.includes(item.id);
          return (
            <button key={item.id} type="button" onClick={() => onToggle(item.id)}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3 text-left transition-all',
                on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300'
              )}>
              <span className="text-xl">{item.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className={cn('text-xs', on ? 'text-zinc-400' : 'text-zinc-500')}>
                  +₦{item.price_per_unit.toLocaleString()}
                </p>
              </div>
              <div className={cn('flex h-5 w-5 items-center justify-center rounded-full border',
                on ? 'border-white bg-white' : 'border-zinc-300 bg-white')}>
                {on && <Check className="h-3 w-3 text-zinc-900" />}
              </div>
            </button>
          );
        })}
        {cat.items.length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-400">No {cat.label.toLowerCase()} available</p>
        )}
      </div>
      <button type="button" onClick={onSkip}
        className={cn(
          'w-full rounded-2xl border py-2.5 text-sm font-medium transition-all',
          skipped && selectedIds.length === 0
            ? 'border-zinc-900 bg-zinc-900 text-white'
            : 'border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-500 hover:text-zinc-600'
        )}>
        {skipped && selectedIds.length === 0 ? `✓ No ${cat.label.toLowerCase()}` : `Skip ${cat.label.toLowerCase()}`}
      </button>
    </div>
  );
}

function FulfillmentStep({ orderType, deliveryAddress, onOrderTypeChange, onAddressChange, acceptsDelivery, deliveryFee }: {
  orderType: 'pickup' | 'delivery'; deliveryAddress: string;
  onOrderTypeChange: (t: 'pickup' | 'delivery') => void;
  onAddressChange: (v: string) => void;
  acceptsDelivery: boolean;
  deliveryFee: number;
}) {
  const types: Array<'pickup' | 'delivery'> = acceptsDelivery ? ['pickup', 'delivery'] : ['pickup'];

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">How do you want it?</p>
      <div className={cn('grid gap-3', types.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {types.map((type) => (
          <button key={type} type="button" onClick={() => onOrderTypeChange(type)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all',
              orderType === type ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
            )}>
            <span className="text-2xl">{type === 'pickup' ? '🏃' : '🛵'}</span>
            <span className="text-sm font-semibold capitalize">{type}</span>
            <span className={cn('text-xs', orderType === type ? 'text-zinc-400' : 'text-zinc-500')}>
              {type === 'pickup'
                ? "I'll come to pick up"
                : deliveryFee > 0 ? `+₦${deliveryFee.toLocaleString()} delivery fee` : 'Free delivery'}
            </span>
          </button>
        ))}
      </div>
      {orderType === 'delivery' && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Delivery location *
          </label>
          <input type="text" value={deliveryAddress} onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Room / block / location on campus"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
        </div>
      )}
    </div>
  );
}

function ReviewStep({ builder, onSend, sending, sent, vendorName, onGoToOrders, vendorClosed, deliveryFee, submitError }: {
  builder: ReturnType<typeof useMealBuilder>;
  onSend: () => void; sending: boolean; sent: boolean;
  vendorName?: string;
  onGoToOrders: () => void;
  vendorClosed?: boolean;
  deliveryFee?: number;
  submitError?: string | null;
}) {
  const { categories, state, itemsById, total, goToStep } = builder;
  const effectiveDeliveryFee = state.orderType === 'delivery' ? (deliveryFee ?? 0) : 0;
  const grandTotal = total + effectiveDeliveryFee;
  const [countdown, setCountdown] = useState(3);

  // Auto-navigate countdown when sent
  useEffect(() => {
    if (!sent) return;
    if (countdown <= 0) { onGoToOrders(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [sent, countdown, onGoToOrders]);

  if (sent) {
    // Build a compact line list from state for the confirmation
    const lines: { emoji: string; name: string; qty: number; total: number }[] = [];
    for (const cat of categories) {
      const cs = state.categories[cat.name];
      if (!cs || cs.skipped) continue;
      if (cat.stepType === 'required_single') {
        if (!cs.selectedId) continue;
        const item = itemsById[cs.selectedId];
        if (item) lines.push({ emoji: item.emoji, name: item.name, qty: 1, total: item.price_per_unit });
      } else if (cat.stepType === 'required_single_qty') {
        if (!cs.selectedId) continue;
        const item = itemsById[cs.selectedId];
        if (item) lines.push({ emoji: item.emoji, name: item.name, qty: cs.selectedQty, total: item.price_per_unit * cs.selectedQty });
      } else if (cat.stepType === 'required_multi_qty') {
        for (const [id, qty] of Object.entries(cs.quantities)) {
          if (qty <= 0) continue;
          const item = itemsById[id];
          if (item) lines.push({ emoji: item.emoji, name: item.name, qty, total: item.price_per_unit * qty });
        }
      } else if (cat.stepType === 'optional_single') {
        if (!cs.selectedId) continue;
        const item = itemsById[cs.selectedId];
        if (item) lines.push({ emoji: item.emoji, name: item.name, qty: 1, total: item.price_per_unit });
      } else if (cat.stepType === 'optional_multi') {
        for (const id of cs.selectedIds) {
          const item = itemsById[id];
          if (item) lines.push({ emoji: item.emoji, name: item.name, qty: 1, total: item.price_per_unit });
        }
      }
    }

    return (
      <div className="flex flex-col items-center gap-5 px-2 py-6 text-center">
        {/* Success icon */}
        <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
          <Check className="h-8 w-8 text-emerald-600" strokeWidth={2.5} />
        </div>

        {/* Heading */}
        <div>
          <p className="text-base font-bold text-zinc-900">Order placed!</p>
          {vendorName && (
            <p className="mt-1 text-sm text-zinc-500">From {vendorName}</p>
          )}
        </div>

        {/* Order lines */}
        {lines.length > 0 && (
          <div className="w-full rounded-2xl border border-zinc-100 bg-zinc-50 divide-y divide-zinc-100 text-left">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-zinc-700">
                  {l.emoji} {l.name}{l.qty > 1 ? ` ×${l.qty}` : ''}
                </span>
                <span className="text-sm font-medium text-zinc-900">
                  ₦{l.total.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 rounded-b-2xl">
              <span className="text-sm text-zinc-400">Total charged</span>
              <span className="text-sm font-bold text-white">₦{grandTotal.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Message */}
        <p className="text-sm text-zinc-500 max-w-xs">
          {state.orderType === 'delivery'
            ? "We'll notify you when your order is on the way."
            : "We'll notify you when your order is ready for pickup."}
        </p>

        {/* CTA + countdown */}
        <div className="w-full space-y-2">
          <button
            type="button"
            onClick={onGoToOrders}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Track your order
          </button>
          <p className="text-xs text-zinc-400">
            Redirecting automatically in {countdown}s…
          </p>
        </div>
      </div>
    );
  }

  // Build summary lines
  const summaryLines: { label: string; value: string; catName: string }[] = [];
  for (const cat of categories) {
    const cs = state.categories[cat.name];
    if (!cs || cs.skipped) continue;

    if (cat.stepType === 'required_single' || cat.stepType === 'required_single_qty') {
      if (!cs.selectedId) continue;
      const item = itemsById[cs.selectedId];
      if (!item) continue;
      const qty = cat.stepType === 'required_single_qty' ? cs.selectedQty : 1;
      summaryLines.push({
        label: cat.label,
        value: `${item.emoji} ${item.name}${qty > 1 ? ` × ${qty} ${item.unit_name}s` : ''} — ₦${(item.price_per_unit * qty).toLocaleString()}`,
        catName: cat.name,
      });
    } else if (cat.stepType === 'required_multi_qty') {
      const lines = Object.entries(cs.quantities)
        .filter(([, q]) => q > 0)
        .map(([id, qty]) => {
          const item = itemsById[id];
          return item ? `${item.emoji} ${item.name} ×${qty} — ₦${(item.price_per_unit * qty).toLocaleString()}` : '';
        })
        .filter(Boolean);
      if (lines.length > 0) summaryLines.push({ label: cat.label, value: lines.join('\n'), catName: cat.name });
    } else if (cat.stepType === 'optional_single') {
      if (!cs.selectedId) continue;
      const item = itemsById[cs.selectedId];
      if (!item) continue;
      summaryLines.push({ label: cat.label, value: `${item.emoji} ${item.name} — ₦${item.price_per_unit.toLocaleString()}`, catName: cat.name });
    } else if (cat.stepType === 'optional_multi') {
      const vals = cs.selectedIds.map((id) => {
        const item = itemsById[id];
        return item ? `${item.emoji} ${item.name} — ₦${item.price_per_unit.toLocaleString()}` : '';
      }).filter(Boolean);
      if (vals.length > 0) summaryLines.push({ label: cat.label, value: vals.join('\n'), catName: cat.name });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Order summary</p>

      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="divide-y divide-zinc-100">
          {summaryLines.map((row) => (
            <button key={row.catName} type="button" onClick={() => goToStep(row.catName)}
              className="flex w-full items-start justify-between gap-4 px-4 py-2.5 text-left hover:bg-zinc-50">
              <span className="shrink-0 text-sm text-zinc-500">{row.label}</span>
              <span className="text-right text-sm font-medium text-zinc-900 whitespace-pre-line">{row.value}</span>
            </button>
          ))}
          {effectiveDeliveryFee > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-zinc-500">🛵 Delivery fee</span>
              <span className="text-sm font-medium text-zinc-900">₦{effectiveDeliveryFee.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-b-2xl border-t border-zinc-200 bg-zinc-900 px-4 py-3">
          <span className="text-sm text-zinc-400">Total</span>
          <span className="text-base font-bold text-white">₦{grandTotal.toLocaleString()}</span>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Note to vendor (optional)
        </label>
        <textarea value={state.pickupNote}
          onChange={(e) => builder.setPickupNote(e.target.value)}
          placeholder="e.g. No pepper please, extra plate of soup…"
          rows={2} maxLength={200}
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
      </div>

      <button type="button" onClick={onSend} disabled={sending || vendorClosed}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-all',
          (sending || vendorClosed) ? 'bg-zinc-400 cursor-not-allowed' : 'bg-zinc-900 hover:bg-zinc-700'
        )}>
        {sending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending order…</>
          : vendorClosed
          ? 'Vendor is closed — check back later'
          : <><Check className="h-4 w-4" /> Place order</>}
      </button>
      {submitError && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {submitError}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MealBuilder({ vendorId, vendorName, onClose, onOrderSent, prefillLines }: Props) {
  const router = useRouter();
  const builder = useMealBuilder({ vendorId, onOrderSent, initialLines: prefillLines });
  const {
    categories, status, error, state, step, stepIndex, steps, total, canAdvance,
    goNext, goBack, goToStep, selectSingle, setSingleQty, setMultiQty,
    toggleMultiItem, skipCategory, setOrderType, setDeliveryAddress, submitOrder,
    draftRestored, discardDraft, vendorClosed, deliveryFee, reviewFeeLoading, acceptsDelivery,
  } = builder;

  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [confirmStartOver, setConfirmStartOver] = useState(false);
  const showDraftBanner = draftRestored && !draftBannerDismissed;

  const isStepDone = (s: string): boolean => {
    if (s === 'fulfillment') return true;
    if (s === 'review') return false;
    const cat = categories.find((c) => c.name === s);
    if (!cat) return false;
    const cs = state.categories[s];
    if (!cs) return false;
    if (cs.skipped) return true;
    switch (cat.stepType) {
      case 'required_single':     return cs.selectedId !== null;
      case 'required_single_qty': return cs.selectedId !== null;
      case 'required_multi_qty':  return Object.values(cs.quantities).some((q) => q > 0);
      case 'optional_single':     return cs.selectedId !== null || cs.skipped;
      case 'optional_multi':      return cs.selectedIds.length > 0 || cs.skipped;
      default: return false;
    }
  };

  const getStepLabel = (s: string): string => {
    if (s === 'fulfillment') return 'Delivery';
    if (s === 'review') return 'Review';
    const cat = categories.find((c) => c.name === s);
    return cat ? cat.label : s;
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading menu…
        </div>
      </div>
    );
  }

  if (status === 'error' || !categories.length) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? 'Menu unavailable'}
      </div>
    );
  }

  const currentCat = categories.find((c) => c.name === step);
  const cs = state.categories[step] ?? { selectedId: null, selectedQty: 1, quantities: {}, selectedIds: [], skipped: false };

  const isSent = status === 'sent';

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm">
      {/* Header — hidden after order is placed */}
      {!isSent && (
        <div className="sticky top-0 z-10 rounded-t-3xl bg-zinc-900 px-4 pt-3 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Build your meal</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Step {stepIndex + 1} of {steps.length} — {getStepLabel(step)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-amber-400">₦{total.toLocaleString()}</span>
              <button type="button" onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-full bg-zinc-700 hover:bg-zinc-600">
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-0.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Draft restored banner */}
      {showDraftBanner && !isSent && (
        <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-2">
          <p className="text-xs font-medium text-amber-800">Previous selections restored</p>
          {confirmStartOver ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-700">Sure?</span>
              <button type="button" onClick={() => { discardDraft(); setDraftBannerDismissed(true); }}
                className="text-xs font-semibold text-red-600 hover:text-red-800">Yes, clear</button>
              <button type="button" onClick={() => setConfirmStartOver(false)}
                className="text-xs font-medium text-amber-600 hover:text-amber-900">Keep</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmStartOver(true)}
              className="text-xs font-medium text-amber-600 hover:text-amber-900">
              Start over
            </button>
          )}
        </div>
      )}

      {/* Vendor closed banner — shown whenever accepts_orders flips off mid-flow */}
      {vendorClosed && !isSent && (
        <div className="flex items-start gap-2.5 border-b border-red-100 bg-red-50 px-4 py-3">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
          <div>
            <p className="text-xs font-semibold text-red-800">This vendor just closed</p>
            <p className="text-xs text-red-700 mt-0.5">
              Your selections are saved — come back when they reopen.
            </p>
          </div>
        </div>
      )}
      {!isSent && (
        <div className="relative border-b border-zinc-100">
          <div className="flex overflow-x-auto scrollbar-none">
          {steps.map((s, i) => {
            const done = isStepDone(s) && i !== stepIndex;
            const active = s === step;
            return (
              <button key={s} type="button" onClick={() => goToStep(s)}
                className={cn(
                  'flex-shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all',
                  active  ? 'border-zinc-900 text-zinc-900' :
                  done    ? 'border-transparent text-emerald-600' :
                            'border-transparent text-zinc-400'
                )}>
                {done ? '✓ ' : ''}{getStepLabel(s)}
              </button>
            );
          })}
        </div>
          {/* Right fade to signal more tabs */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
        </div>
      )}

      {/* Step body */}
      <div className="p-4">
        {step === 'fulfillment' && (
          <FulfillmentStep
            orderType={state.orderType}
            deliveryAddress={state.deliveryAddress}
            onOrderTypeChange={setOrderType}
            onAddressChange={setDeliveryAddress}
            acceptsDelivery={acceptsDelivery}
            deliveryFee={deliveryFee}
          />
        )}

        {step === 'review' && reviewFeeLoading && (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating delivery fee…
            </div>
          </div>
        )}

        {step === 'review' && !reviewFeeLoading && (
          <ReviewStep
            builder={builder}
            onSend={submitOrder}
            sending={status === 'sending'}
            sent={isSent}
            vendorName={vendorName}
            onGoToOrders={() => router.push('/my-orders')}
            vendorClosed={vendorClosed}
            deliveryFee={deliveryFee}
            submitError={error}
          />
        )}

        {currentCat && currentCat.stepType === 'required_single' && (
          <SingleStep cat={currentCat} selectedId={cs.selectedId}
            onSelect={(id) => selectSingle(currentCat.name, id)} />
        )}

        {currentCat && currentCat.stepType === 'required_single_qty' && (
          <SingleQtyStep cat={currentCat} selectedId={cs.selectedId} selectedQty={cs.selectedQty}
            onSelect={(id) => selectSingle(currentCat.name, id)}
            onInc={() => setSingleQty(currentCat.name, cs.selectedQty + 1)}
            onDec={() => setSingleQty(currentCat.name, cs.selectedQty - 1)} />
        )}

        {currentCat && currentCat.stepType === 'required_multi_qty' && (
          <MultiQtyStep cat={currentCat} quantities={cs.quantities}
            onQtyChange={(id, qty) => setMultiQty(currentCat.name, id, qty)}
            canAdvance={canAdvance} />
        )}

        {currentCat && currentCat.stepType === 'optional_single' && (
          <OptionalSingleStep cat={currentCat} selectedId={cs.selectedId} skipped={cs.skipped}
            onSelect={(id) => selectSingle(currentCat.name, id)}
            onSkip={() => skipCategory(currentCat.name)} />
        )}

        {currentCat && currentCat.stepType === 'optional_multi' && (
          <OptionalMultiStep cat={currentCat} selectedIds={cs.selectedIds} skipped={cs.skipped}
            onToggle={(id) => toggleMultiItem(currentCat.name, id)}
            onSkip={() => skipCategory(currentCat.name)} />
        )}
      </div>

      {/* Nav buttons — hidden on review and after sent */}
      {step !== 'review' && !isSent && (
        <div className="flex gap-2 px-4 pb-4">
          {stepIndex > 0 && (
            <button type="button" onClick={goBack}
              className="flex items-center gap-1 rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          <button type="button" onClick={goNext} disabled={!canAdvance}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-2xl py-2.5 text-sm font-semibold transition-all',
              canAdvance ? 'bg-zinc-900 text-white hover:bg-zinc-700' : 'cursor-not-allowed bg-zinc-100 text-zinc-400'
            )}>
            {step === 'fulfillment' ? 'Review order' : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
