'use client';
// components/chat/OrderBubble.tsx
// Renders a structured order card inside the chat thread.
// Now context-aware: shows bank details + "I've paid" for buyers,
// and "Confirm payment" for vendors — so payment can complete without
// leaving the chat.

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Copy, Check } from 'lucide-react';
import type { OrderPayload } from '@/types/meal-builder';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pending',   className: 'border-amber-200 bg-amber-50 text-amber-800' },
  confirmed: { label: 'Confirmed', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  preparing: { label: 'Preparing', className: 'border-purple-200 bg-purple-50 text-purple-800' },
  ready:     { label: 'Ready!',    className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  delivered: { label: 'Delivered', className: 'border-emerald-300 bg-emerald-100 text-emerald-900' },
  cancelled: { label: 'Cancelled', className: 'border-red-200 bg-red-50 text-red-700' },
};

type BankDetails = {
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
};

type Props = {
  payload:       OrderPayload;
  isSender:      boolean;
  status?:       string;
  paymentStatus?: string;
  paymentMethod?: string;
  receiptUrl?:   string | null;
  createdAt:     string;
  orderId?:      string;
  // Buyer-side actions
  isViewer?: 'buyer' | 'vendor';
  vendorBank?: BankDetails | null;
  onBuyerConfirm?:         () => Promise<void>;
  // Vendor-side actions
  onVendorConfirmPayment?: () => Promise<void>;
  onPaymentDispute?:       () => Promise<void>;
  buyerConfirmLoading?: boolean;
  vendorConfirmLoading?: boolean;
  paymentDisputeLoading?: boolean;
  paymentActionError?: string | null;
  orderLabel?: string;
};

function fmt(n: number) { return `₦${n.toLocaleString()}`; }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

// ── Line items ─────────────────────────────────────────────────────────────────

function LineItems({ payload }: { payload: OrderPayload }) {
  if (Array.isArray(payload.lines) && payload.lines.length > 0) {
    const byCategory: Record<string, typeof payload.lines> = {};
    for (const l of payload.lines) {
      const cat = l.category || 'Items';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(l);
    }
    return (
      <>
        {Object.entries(byCategory).map(([cat, lines]) => (
          <div key={cat} className="flex items-start justify-between gap-4 px-4 py-2">
            <span className="shrink-0 text-sm capitalize text-zinc-500">{cat}</span>
            <div className="flex flex-col items-end gap-0.5">
              {lines.map((l) => (
                <span key={l.item_id} className="text-sm font-medium text-zinc-900">
                  {l.emoji} {l.name}{l.qty > 1 ? ` ×${l.qty}` : ''}{' '}
                  <span className="text-zinc-400">{fmt(l.line_total)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }

  // Legacy format
  return (
    <>
      {payload.swallow && (
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm text-zinc-500">Swallow</span>
          <span className="text-sm font-medium text-zinc-900">
            {payload.swallow.emoji} {payload.swallow.name}{' '}
            <span className="text-zinc-400">× {payload.swallow.qty} {payload.swallow.unit_name}{payload.swallow.qty > 1 ? 's' : ''}</span>
          </span>
        </div>
      )}
      {payload.soup && (
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm text-zinc-500">Soup</span>
          <span className="text-sm font-medium text-zinc-900">{payload.soup.emoji} {payload.soup.name}</span>
        </div>
      )}
      {(payload.proteins ?? []).length > 0 && (
        <div className="flex items-start justify-between gap-4 px-4 py-2">
          <span className="shrink-0 text-sm text-zinc-500">Protein</span>
          <div className="flex flex-col items-end gap-0.5">
            {(payload.proteins ?? []).map((p) => (
              <span key={p.item_id} className="text-sm font-medium text-zinc-900">
                {p.emoji} {p.name} <span className="text-zinc-400">× {p.qty}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {payload.drink && (
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm text-zinc-500">Drink</span>
          <span className="text-sm font-medium text-zinc-900">{payload.drink.emoji} {payload.drink.name}</span>
        </div>
      )}
      {(payload.extras ?? []).length > 0 && (
        <div className="flex items-start justify-between gap-4 px-4 py-2">
          <span className="shrink-0 text-sm text-zinc-500">Extras</span>
          <span className="text-right text-sm font-medium text-zinc-900">
            {(payload.extras ?? []).map((e) => `${e.emoji} ${e.name}`).join(' · ')}
          </span>
        </div>
      )}
    </>
  );
}

// ── Buyer payment panel ────────────────────────────────────────────────────────

function BuyerPaymentPanel({
  total,
  paymentStatus,
  paymentMethod,
  vendorBank,
  orderId,
  initialReceiptUploaded,
  onBuyerConfirm,
  buyerConfirmLoading = false,
  paymentActionError,
}: {
  total: number;
  paymentStatus?: string;
  paymentMethod?: string;
  vendorBank?: BankDetails | null;
  orderId?: string;
  initialReceiptUploaded?: boolean;
  onBuyerConfirm?: () => Promise<void>;
  buyerConfirmLoading?: boolean;
  paymentActionError?: string | null;
}) {
  const [copied,         setCopied]         = useState(false);
  const [done,           setDone]           = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [receiptUploaded, setReceiptUploaded] = useState(initialReceiptUploaded ?? false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);

  // Already confirmed — show status only
  if (paymentStatus === 'vendor_confirmed') {
    return (
      <div className="border-t border-emerald-100 bg-emerald-50 px-4 py-2.5">
        <p className="text-xs font-semibold text-emerald-700">✅ Payment confirmed by vendor</p>
      </div>
    );
  }

  if (paymentStatus === 'buyer_confirmed' || done) {
    return (
      <div className="border-t border-blue-100 bg-blue-50 px-4 py-2.5">
        <p className="text-xs font-semibold text-blue-800">💸 Transfer sent — waiting for vendor confirmation</p>
        <p className="mt-0.5 text-[11px] text-blue-600">You'll be notified when the vendor confirms receipt.</p>
      </div>
    );
  }

  if (paymentMethod === 'cash') {
    return (
      <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2">
        <p className="text-xs text-zinc-500">🤝 Paying cash on pickup</p>
      </div>
    );
  }

  // Unpaid — show bank details and action
  async function handleConfirm() {
    if (!onBuyerConfirm) return;
    try {
      await onBuyerConfirm();
      setDone(true);
    } catch {}
  }

  function copyAccount() {
    if (!vendorBank?.bank_account_number) return;
    navigator.clipboard.writeText(vendorBank.bank_account_number).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
          1
        </span>
        <p className="text-xs font-semibold text-amber-900">Transfer to this account</p>
      </div>

      {vendorBank ? (
        <>
          {/* Bank details */}
          <div className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 space-y-0.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-zinc-900">{vendorBank.bank_account_number}</p>
              <button
                type="button"
                onClick={copyAccount}
                className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-zinc-600">{vendorBank.bank_account_name}</p>
            <p className="text-xs text-zinc-400">{vendorBank.bank_name}</p>
          </div>

          <p className="text-[11px] text-amber-700">
            Transfer {fmt(total)} to the account above. Upload your receipt &mdash; the vendor needs proof before confirming.
          </p>

          {/* Receipt upload */}
          {orderId && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  receiptUploaded ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'
                )}>
                  {receiptUploaded ? '✓' : '2'}
                </span>
                <label className="text-[11px] font-semibold text-amber-800">
                  Upload transfer receipt (required)
                </label>
              </div>
              <label className={cn(
                'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-2 text-xs font-medium transition-all',
                receiptUploaded
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50'
              )}>
                {uploading
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                  : receiptUploaded
                  ? <>✅ Receipt uploaded</>
                  : <>📎 Attach screenshot / photo</>}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    setUploadError(null);
                    try {
                      const fd = new FormData();
                      fd.append('receipt', file);
                      const res = await fetch(`/api/orders/${orderId}/receipt`, { method: 'POST', body: fd });
                      const json = await res.json();
                      if (!json.ok) throw new Error(json.message ?? 'Upload failed');
                      setReceiptUploaded(true);
                    } catch (err: any) {
                      setUploadError(err.message ?? 'Upload failed');
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
              {uploadError && (
                <p className="mt-1 text-[11px] text-red-600">{uploadError}</p>
              )}
            </div>
          )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={buyerConfirmLoading || !receiptUploaded}
              className={cn(
                'w-full rounded-xl py-2 text-xs font-semibold transition-all',
                buyerConfirmLoading
                  ? 'bg-zinc-400 text-white cursor-wait'
                  : !receiptUploaded
                  ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                : 'bg-zinc-900 text-white hover:bg-zinc-700'
            )}
            >
              {buyerConfirmLoading
                ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
                : !receiptUploaded
                ? 'Upload receipt to confirm'
                : "I've paid"}
            </button>
            {paymentActionError && (
              <p className="text-sm text-red-500">{paymentActionError}</p>
            )}
          </>
      ) : (
        <p className="text-[11px] text-amber-700">
          This vendor hasn&apos;t set up bank details yet. Contact them via chat to arrange payment.
        </p>
      )}
    </div>
  );
}

// ── Vendor payment panel ───────────────────────────────────────────────────────

function VendorPaymentPanel({
  total,
  paymentStatus,
  receiptUrl,
  onVendorConfirmPayment,
  onPaymentDispute,
  vendorConfirmLoading = false,
  paymentDisputeLoading = false,
  paymentActionError,
}: {
  total: number;
  paymentStatus?: string;
  receiptUrl?: string | null;
  onVendorConfirmPayment?: () => Promise<void>;
  onPaymentDispute?: () => Promise<void>;
  vendorConfirmLoading?: boolean;
  paymentDisputeLoading?: boolean;
  paymentActionError?: string | null;
}) {
  if (paymentStatus === 'vendor_confirmed') {
    return (
      <div className="border-t border-emerald-100 bg-emerald-50 px-4 py-2.5">
        <p className="text-xs font-semibold text-emerald-700">✅ Payment confirmed</p>
      </div>
    );
  }

  if (paymentStatus === 'buyer_confirmed') {
    async function handleConfirm() {
      if (!onVendorConfirmPayment) return;
      try {
        await onVendorConfirmPayment();
      } catch {}
    }

    async function handleDispute() {
      if (!onPaymentDispute) return;
      try {
        await onPaymentDispute();
      } catch {}
    }

    return (
      <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-amber-900">💸 Buyer says they&apos;ve transferred</p>
        <p className="text-[11px] text-amber-700">
          Check your account for {fmt(total)}, then confirm or dispute.
        </p>
        {receiptUrl ? (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl border border-amber-200"
          >
            <img
              src={receiptUrl}
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
            onClick={handleDispute}
            disabled={vendorConfirmLoading || paymentDisputeLoading}
            className="flex-1 rounded-xl border border-amber-300 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            {paymentDisputeLoading ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Not received'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={vendorConfirmLoading || paymentDisputeLoading}
            className={cn(
              'flex-1 rounded-xl py-2 text-xs font-semibold text-white transition-all',
              vendorConfirmLoading ? 'bg-zinc-400' : 'bg-emerald-600 hover:bg-emerald-700'
            )}
          >
            {vendorConfirmLoading ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Confirm payment'}
          </button>
        </div>
        {paymentActionError && (
          <p className="text-sm text-red-500">{paymentActionError}</p>
        )}
      </div>
    );
  }

  if (paymentStatus === 'unpaid') {
    return (
      <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2">
        <p className="text-xs text-zinc-400">⏳ Awaiting payment from buyer</p>
      </div>
    );
  }

  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OrderBubble({
  payload,
  isSender,
  status,
  paymentStatus,
  paymentMethod,
  receiptUrl,
  createdAt,
  orderId,
  isViewer,
  vendorBank,
  onBuyerConfirm,
  onVendorConfirmPayment,
  onPaymentDispute,
  buyerConfirmLoading,
  vendorConfirmLoading,
  paymentDisputeLoading,
  paymentActionError,
  orderLabel,
}: Props) {
  const st = status && STATUS_STYLES[status] ? STATUS_STYLES[status] : STATUS_STYLES.pending;

  return (
    <div className={cn('flex', isSender ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'w-full max-w-[85%] overflow-hidden rounded-3xl border shadow-sm',
        isSender ? 'rounded-br-md border-zinc-200 bg-white' : 'rounded-bl-md border-zinc-200 bg-white'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between bg-zinc-900 px-4 py-2.5">
          <span className="text-xs font-semibold text-white">{orderLabel ?? '🛒 Meal Order'}</span>
          <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', st.className)}>
            {st.label}
          </span>
        </div>

        {/* Line items */}
        <div className="divide-y divide-zinc-100">
          <LineItems payload={payload} />
        </div>

        {/* Fulfillment */}
        {payload.order_type && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2">
            <span className="text-sm text-zinc-500">Fulfillment</span>
            <span className="text-sm font-medium text-zinc-900">
              {payload.order_type === 'delivery'
                ? `🛵 Delivery${payload.delivery_address ? ` to ${payload.delivery_address}` : ''}`
                : '🏃 Pickup'}
            </span>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-zinc-500">Total</span>
          <span className="text-base font-bold text-zinc-900">{fmt(payload.total)}</span>
        </div>

        {/* Payment panel — context-aware per viewer role */}
        {isViewer === 'buyer' && !['cancelled', 'delivered'].includes(status ?? '') && (
          <BuyerPaymentPanel
            total={payload.total}
            paymentStatus={paymentStatus}
            paymentMethod={paymentMethod}
            vendorBank={vendorBank}
            orderId={orderId}
            initialReceiptUploaded={!!receiptUrl}
            onBuyerConfirm={onBuyerConfirm}
            buyerConfirmLoading={buyerConfirmLoading}
            paymentActionError={paymentActionError}
          />
        )}

        {isViewer === 'vendor' && !['cancelled', 'delivered'].includes(status ?? '') && (
          <VendorPaymentPanel
            total={payload.total}
            paymentStatus={paymentStatus}
            receiptUrl={receiptUrl}
            onVendorConfirmPayment={onVendorConfirmPayment}
            onPaymentDispute={onPaymentDispute}
            vendorConfirmLoading={vendorConfirmLoading}
            paymentDisputeLoading={paymentDisputeLoading}
            paymentActionError={paymentActionError}
          />
        )}

        {/* Timestamp */}
        <div className="px-4 pb-2 pt-1 text-right">
          <span className="text-[10px] text-zinc-400">{fmtTime(createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
