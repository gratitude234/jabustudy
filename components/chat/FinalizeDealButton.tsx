'use client';
// components/chat/FinalizeDealButton.tsx
// Shown inside a marketplace conversation (non-food vendor) after enough
// messages have been exchanged. Lets the buyer formalize an agreed deal
// as a structured order without leaving the chat.

import { useState } from 'react';
import { Loader2, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  conversationId: string;
  listingId: string;
  vendorId: string;
  listingTitle?: string;
  listingPrice?: number | null;
  openOnMount?: boolean;
  onOrderCreated: (orderId: string) => void;
};

function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, '');
}

export default function FinalizeDealButton({
  conversationId,
  listingId,
  vendorId,
  listingTitle,
  listingPrice,
  openOnMount = false,
  onOrderCreated,
}: Props) {
  const [open, setOpen] = useState(openOnMount);
  const [priceDigits, setPriceDigits] = useState(listingPrice ? String(listingPrice) : '');
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>('transfer');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="mx-4 mb-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">Order created!</p>
          </div>
          <a
            href="/my-orders"
            className="shrink-0 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 no-underline"
          >
            Track order →
          </a>
        </div>
      </div>
    );
  }

  async function handleCreate() {
    const price = parseInt(priceDigits, 10);
    if (!priceDigits || !Number.isFinite(price) || price <= 0) {
      setError('Enter the agreed price');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/orders/create-marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          listing_id: listingId,
          vendor_id: vendorId,
          agreed_price: price,
          payment_method: paymentMethod,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to create order');
      setDone(true);
      onOrderCreated(json.order.id);
    } catch (err: any) {
      if (err.message?.includes('bank transfer details')) {
        setError("This seller hasn't added their bank account yet. Ask them to add it in their vendor profile, or choose cash payment instead.");
      } else {
        setError(err.message ?? 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="mx-4 mb-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 transition flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Finalize deal
        </button>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-2">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900">Finalize this deal</p>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {listingTitle && (
          <p className="text-xs text-zinc-500 truncate">🏷️ {listingTitle}</p>
        )}

        {/* Agreed price */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Agreed price</label>
          <div className="flex items-center gap-2 rounded-xl border bg-zinc-50 px-3 py-2.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-900/10">
            <span className="text-sm font-semibold text-zinc-400">₦</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={listingPrice ? listingPrice.toLocaleString('en-NG') : '0'}
              value={priceDigits ? parseInt(priceDigits, 10).toLocaleString('en-NG') : ''}
              onChange={(e) => setPriceDigits(onlyDigits(e.target.value))}
              className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:font-normal placeholder:text-zinc-400"
              autoFocus
            />
          </div>
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Payment method</label>
          <div className="grid grid-cols-2 gap-2">
            {(['transfer', 'cash'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={cn(
                  'rounded-xl border py-2 text-xs font-semibold transition',
                  paymentMethod === m
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                )}
              >
                {m === 'transfer' ? '🏦 Bank transfer' : '💵 Cash on pickup'}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod === 'transfer' && (
          <p className="text-[11px] text-zinc-400">
            You'll see their bank details after creating the order.
          </p>
        )}

        {/* Optional note */}
        <textarea
          placeholder="Add a note — e.g. pickup location, condition agreed…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl border bg-zinc-50 px-3 py-2.5 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 placeholder:text-zinc-400"
        />

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="button"
          onClick={handleCreate}
          disabled={loading || !priceDigits}
          className={cn(
            'w-full rounded-2xl py-3 text-sm font-semibold text-white transition',
            loading || !priceDigits
              ? 'bg-zinc-300 cursor-not-allowed'
              : 'bg-zinc-900 hover:bg-zinc-700'
          )}
        >
          {loading
            ? <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            : <span className="flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4" /> Create order</span>
          }
        </button>

        <p className="text-[11px] text-zinc-400 text-center">
          This creates a formal order record. Both parties will be notified.
        </p>
      </div>
    </div>
  );
}
