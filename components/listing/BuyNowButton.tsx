'use client';
// components/listing/BuyNowButton.tsx
// Primary purchase CTA on listing detail pages for non-food vendors.
// Creates a conversation + marketplace order in one tap, then navigates to inbox.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShoppingBag, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type Props = {
  listingId: string;
  vendorId: string;
  vendorName?: string;
  listingTitle?: string;
  listingPrice?: number | null;
  size?: 'full' | 'compact';
};

function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, '');
}

export default function BuyNowButton({
  listingId,
  vendorId,
  vendorName,
  listingTitle,
  listingPrice,
  size = 'full',
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [priceDigits, setPriceDigits] = useState(listingPrice ? String(listingPrice) : '');
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>('transfer');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authWall, setAuthWall] = useState(false);

  async function openConversation(): Promise<string> {
    const res = await fetch('/api/conversations/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, vendorId }),
    });
    const json = (await res.json().catch(() => null)) as
      | { conversationId?: string; error?: string }
      | null;
    if (!res.ok || !json?.conversationId) {
      throw new Error(json?.error ?? 'Could not open conversation');
    }
    return json.conversationId;
  }

  async function handleBuyNow() {
    const price = parseInt(priceDigits, 10);
    if (!priceDigits || !Number.isFinite(price) || price <= 0) {
      setError('Enter the price');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        setAuthWall(true);
        setConfirmOpen(false);
        setLoading(false);
        return;
      }

      const conversationId = await openConversation();

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

      // Navigate to inbox where the OrderBubble + payment flow is ready
      router.push(`/inbox/${conversationId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      if (message.includes('bank transfer details')) {
        setError("This seller hasn't added their bank account yet. Try cash payment or message them instead.");
      } else if (message.includes('already has an order')) {
        setError('You already have an active order for this item. Check your inbox.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOpenConfirmation() {
    const price = parseInt(priceDigits, 10);
    if (!priceDigits || !Number.isFinite(price) || price <= 0) {
      setError('Enter the price');
      return;
    }

    setError(null);
    setConfirmOpen(true);
  }

  // Auth wall
  if (authWall) {
    return (
      <div className="rounded-2xl border bg-zinc-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900">Sign in to buy</p>
          <button type="button" onClick={() => setAuthWall(false)}>
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>
        <p className="text-xs text-zinc-600">Create a free account in under a minute.</p>
        <div className="flex gap-2">
          <a
            href={`/signup?next=/listing/${listingId}`}
            className="flex-1 rounded-2xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white no-underline hover:bg-zinc-800"
          >
            Sign up free
          </a>
          <a
            href={`/login?next=/listing/${listingId}`}
            className="flex-1 rounded-2xl border bg-white px-4 py-2.5 text-center text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
          >
            Log in
          </a>
        </div>
      </div>
    );
  }

  // Closed state — just the button
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition',
          size === 'full'
            ? 'w-full px-4 py-3 text-sm bg-zinc-900 text-white hover:bg-zinc-700'
            : 'px-4 py-2.5 text-sm bg-zinc-900 text-white hover:bg-zinc-700'
        )}
      >
        <ShoppingBag className="h-4 w-4" />
        Buy now
      </button>
    );
  }

  // Open panel
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900">
          {listingTitle ? `Buy: ${listingTitle.slice(0, 40)}${listingTitle.length > 40 ? '…' : ''}` : 'Complete purchase'}
        </p>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Price */}
      <div>
        <label className="block text-xs font-semibold text-zinc-500 mb-1">
          {listingPrice ? 'Confirm price' : 'Agreed price'}
        </label>
        <div className="flex items-center gap-2 rounded-xl border bg-zinc-50 px-3 py-2.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-900/10">
          <span className="text-sm font-semibold text-zinc-400">&#8358;</span>
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
        <label className="block text-xs font-semibold text-zinc-500 mb-1">Payment</label>
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
              {m === 'transfer' ? 'Bank transfer' : 'Cash on pickup'}
            </button>
          ))}
        </div>
        {paymentMethod === 'transfer' && (
          <p className="mt-1 text-[11px] text-zinc-400">
            Seller&apos;s bank details appear after the order is created.
          </p>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-600">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
        No payment is collected here. The order opens chat so you can confirm pickup, delivery and payment with the seller.
      </div>

      {/* Note */}
      <textarea
        placeholder="Add a note, pickup location or condition question..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-xl border bg-zinc-50 px-3 py-2.5 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 placeholder:text-zinc-400"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleOpenConfirmation}
        disabled={loading || !priceDigits}
        className={cn(
          'w-full rounded-2xl py-3 text-sm font-semibold text-white transition',
          loading || !priceDigits
            ? 'bg-zinc-300 cursor-not-allowed'
            : 'bg-zinc-900 hover:bg-zinc-700'
        )}
      >
        {loading ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        ) : (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Review order
          </span>
        )}
      </button>

      <p className="text-[11px] text-zinc-400 text-center">
        Creates an order and opens chat. No payment taken yet.
      </p>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-zinc-900">Confirm order</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {listingTitle ?? "This listing"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-lg font-bold text-zinc-900">
                ₦{parseInt(priceDigits || "0", 10).toLocaleString("en-NG")}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {paymentMethod === "transfer" ? "Bank transfer" : "Cash on pickup"} to {vendorName ?? "seller"}
              </p>
              {note.trim() && (
                <p className="mt-2 text-xs text-zinc-500">{note.trim()}</p>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={loading}
                className={cn(
                  "flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
                  loading ? "bg-zinc-300 cursor-not-allowed" : "bg-zinc-900 hover:bg-zinc-700"
                )}
              >
                {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
