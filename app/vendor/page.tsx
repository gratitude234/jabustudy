'use client';
// app/vendor/page.tsx
// Vendor home dashboard with:
// - Smart pending state ("while you wait" actions)
// - Post-approval guided onboarding checklist
// - Normal dashboard once set up

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Loader2, ShoppingBag, ChefHat, Settings, ToggleLeft, ToggleRight,
  Clock, CheckCircle2, Bell, ArrowRight, Store, AlertCircle, AlertTriangle,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VendorRow } from '@/lib/types';
import { subscribeToPush } from '@/components/ServiceWorkerRegister';

type OrderSummary = {
  pending: number; active: number; ready: number;
  today_count: number; today_revenue: number;
};

type DayStats = {
  date: string;   // 'Mon', 'Tue', etc.
  dateIso: string; // YYYY-MM-DD for highlighting today
  orders: number;
  revenue: number;
};

// ── 7-day chart ────────────────────────────────────────────────────────────────

function WeekChart({ days }: { days: DayStats[] }) {
  const [mode, setMode] = useState<'orders' | 'revenue'>('orders');

  const values  = days.map((d) => mode === 'orders' ? d.orders : d.revenue);
  const maxVal  = Math.max(...values, 1);
  const todayIso = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  const W = 280, H = 80, barW = 28, gap = (W - days.length * barW) / (days.length + 1);

  // Best-selling day
  const bestIdx = values.indexOf(Math.max(...values));

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-900">Last 7 days</p>
        <div className="flex gap-1 rounded-full border border-zinc-200 p-0.5">
          <button
            type="button"
            onClick={() => setMode('orders')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-all',
              mode === 'orders' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
            )}
          >
            Orders
          </button>
          <button
            type="button"
            onClick={() => setMode('revenue')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-all',
              mode === 'revenue' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
            )}
          >
            Revenue
          </button>
        </div>
      </div>

      {/* SVG bar chart */}
      <svg
        viewBox={`0 0 ${W} ${H + 24}`}
        width="100%"
        style={{ overflow: 'visible' }}
      >
        {days.map((d, i) => {
          const x      = gap + i * (barW + gap);
          const val    = values[i];
          const barH   = maxVal > 0 ? Math.max((val / maxVal) * H, val > 0 ? 4 : 0) : 0;
          const y      = H - barH;
          const isToday = d.dateIso === todayIso;
          const isBest  = i === bestIdx && val > 0;

          return (
            <g key={d.dateIso}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={6}
                className={cn(
                  isToday ? 'fill-zinc-900' : isBest ? 'fill-zinc-400' : 'fill-zinc-200'
                )}
              />
              {/* Value label above bar (only if non-zero) */}
              {val > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={isToday ? 600 : 400}
                  fill={isToday ? '#18181b' : '#71717a'}
                >
                  {mode === 'revenue'
                    ? val >= 1000 ? `₦${(val / 1000).toFixed(1)}k` : `₦${val}`
                    : val}
                </text>
              )}
              {/* Day label below */}
              <text
                x={x + barW / 2}
                y={H + 16}
                textAnchor="middle"
                fontSize={10}
                fontWeight={isToday ? 600 : 400}
                fill={isToday ? '#18181b' : '#a1a1aa'}
              >
                {isToday ? 'Today' : d.date}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Summary row */}
      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
        <div>
          <p className="text-xs text-zinc-500">7-day total</p>
          <p className="text-sm font-semibold text-zinc-900">
            {mode === 'orders'
              ? `${values.reduce((a, b) => a + b, 0)} orders`
              : `₦${values.reduce((a, b) => a + b, 0).toLocaleString()}`}
          </p>
        </div>
        {bestIdx >= 0 && values[bestIdx] > 0 && (
          <div className="text-right">
            <p className="text-xs text-zinc-500">Best day</p>
            <p className="text-sm font-semibold text-zinc-900">
              {days[bestIdx].dateIso === todayIso ? 'Today' : days[bestIdx].date}
              {mode === 'revenue'
                ? ` · ₦${values[bestIdx].toLocaleString()}`
                : ` · ${values[bestIdx]} orders`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onboarding checklist ───────────────────────────────────────────────────────

type ChecklistState = {
  hasMenuItems: boolean;
  hasHours: boolean;
  hasGoneLive: boolean;
  hasBankDetails: boolean;
};

function OnboardingChecklist({ vendor, checklist }: { vendor: VendorRow; checklist: ChecklistState }) {
  const allDone = checklist.hasMenuItems && checklist.hasHours && checklist.hasGoneLive && checklist.hasBankDetails;
  if (allDone) return null;

  const steps = [
    {
      done: true,
      label: 'Application approved',
      sub: 'Your food stall is registered on JABU Market',
      href: null,
      cta: null,
    },
    {
      done: checklist.hasMenuItems,
      label: checklist.hasMenuItems ? 'Menu items added' : 'Add your menu items',
      sub: checklist.hasMenuItems
        ? 'Students can now see what you sell'
        : 'Without menu items, the Order button is hidden — students cannot place orders.',
      href: '/vendor/menu',
      cta: 'Add items →',
    },
    {
      done: checklist.hasHours,
      label: checklist.hasHours ? 'Opening hours set' : 'Set your opening hours',
      sub: checklist.hasHours
        ? 'Students can see your open/closed status'
        : 'Without hours, students can\'t tell if you\'re open',
      href: '/vendor/setup',
      cta: 'Set hours →',
    },
    {
      done: checklist.hasBankDetails,
      label: checklist.hasBankDetails ? 'Bank details added' : 'Add your bank details',
      sub: checklist.hasBankDetails
        ? 'Buyers can pay you directly.'
        : 'Required before buyers can complete payment.',
      href: '/vendor/setup',
      cta: 'Add details →',
    },
    {
      done: checklist.hasGoneLive,
      label: checklist.hasGoneLive ? 'You went live!' : 'Flip the toggle to go live',
      sub: checklist.hasGoneLive
        ? 'Students can now place orders with you'
        : 'Complete the steps above, then flip the toggle below',
      href: null,
      cta: null,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const pct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-zinc-900">Getting started</p>
          <span className="text-xs font-semibold text-zinc-500">{completedCount}/{steps.length} done</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div className="h-full rounded-full bg-zinc-900 transition-all duration-500"
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="divide-y divide-zinc-100">
        {steps.map((step, i) => (
          <div key={i} className={cn(
            'flex items-start gap-3 px-5 py-3.5',
            !step.done && step.href ? 'hover:bg-zinc-50' : ''
          )}>
            {/* Step indicator */}
            <div className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              step.done ? 'bg-zinc-900' : 'border-2 border-zinc-200 bg-white'
            )}>
              {step.done && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', step.done ? 'text-zinc-400 line-through' : 'text-zinc-900')}>
                {step.label}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">{step.sub}</p>
            </div>

            {!step.done && step.href && step.cta && (
              <Link href={step.href}
                className="shrink-0 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white no-underline hover:bg-zinc-700">
                {step.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

// ── Rejected → resubmit flow ──────────────────────────────────────────────────

function RejectedResubmit({
  vendor,
  onResubmitted,
}: {
  vendor: VendorRow;
  onResubmitted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name:        vendor.name        ?? '',
    location:    vendor.location    ?? '',
    whatsapp:    vendor.whatsapp    ?? '',
    description: vendor.description ?? '',
    opens_at:    (vendor as any).opens_at  ?? '07:00',
    closes_at:   (vendor as any).closes_at ?? '18:00',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())     { setError('Business name is required'); return; }
    if (!form.location.trim()) { setError('Location is required'); return; }
    setSubmitting(true);
    setError(null);

    const res  = await fetch('/api/vendor/register', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.message ?? 'Resubmission failed'); setSubmitting(false); return; }
    onResubmitted();
  }

  if (!editing) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-8">
        {/* Rejection notice */}
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">Application not approved</p>
              {(vendor as any).rejection_reason && (
                <p className="mt-1.5 text-sm text-red-700">
                  Reason: {(vendor as any).rejection_reason}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action card */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-zinc-900">What you can do</p>
          <p className="text-sm text-zinc-600">
            Fix the issue above, then resubmit. Your existing menu items and data are saved —
            only the application details need updating.
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Edit and resubmit
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Edit form ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-24 pt-4">
      <div>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-zinc-900">Edit your application</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Update the details and resubmit. An admin will review it again.
        </p>
      </div>

      {/* Show rejection reason as a persistent reminder while editing */}
      {(vendor as any).rejection_reason && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">
            <span className="font-semibold">Rejection reason:</span>{' '}
            {(vendor as any).rejection_reason}
          </p>
        </div>
      )}

      <form onSubmit={handleResubmit} className="space-y-4">
        {/* Business info */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your business</p>

          <FormField label="Business name *" value={form.name} onChange={(v) => set('name', v)}
            placeholder="e.g. Mama Tunde's Kitchen" />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">What you sell</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="e.g. Hot Nigerian swallow, soups, rice dishes…"
              rows={2} maxLength={300}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
        </div>

        {/* Where & when */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Where &amp; when</p>

          <FormField label="Location on campus *" value={form.location} onChange={(v) => set('location', v)}
            placeholder="e.g. Block B Canteen, near the library"
            hint="Be specific — admin uses this to verify your stall." />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">Opens at</label>
              <input type="time" value={form.opens_at} onChange={(e) => set('opens_at', e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">Closes at</label>
              <input type="time" value={form.closes_at} onChange={(e) => set('closes_at', e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact (optional)</p>
          <FormField label="WhatsApp number" value={form.whatsapp} onChange={(v) => set('whatsapp', v)}
            placeholder="08012345678" type="tel" />
        </div>

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <button type="submit" disabled={submitting}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all',
            submitting ? 'bg-zinc-400' : 'bg-zinc-900 hover:bg-zinc-700'
          )}>
          {submitting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            : <><CheckCircle2 className="h-4 w-4" /> Submit application</>}
        </button>
      </form>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, hint, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
      {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

// ── Go-offline confirmation modal ─────────────────────────────────────────────

function GoOfflineModal({
  activeCount,
  onConfirm,
  onCancel,
}: {
  activeCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        minHeight: 320,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--border-radius-lg)',
        padding: '0 16px',
      }}
      className="fixed inset-0 z-50"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl mx-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-base font-bold text-zinc-900">
              You have {activeCount} active order{activeCount > 1 ? 's' : ''}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Going offline will stop new orders, but you must still fulfil your existing ones.
            </p>
          </div>
        </div>

        <ul className="mb-5 space-y-2 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-amber-500">•</span>
            Your {activeCount} current customer{activeCount > 1 ? 's' : ''} will be notified you've paused new orders.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-amber-500">•</span>
            Their existing orders are not cancelled — you still need to prepare and hand them over.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-amber-500">•</span>
            No new orders will come in once you go offline.
          </li>
        </ul>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Stay online
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Go offline
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bank details card ──────────────────────────────────────────────────────────

function BankDetailsCard({ vendor, onSaved }: { vendor: VendorRow; onSaved: (patch: { bank_name: string | null; bank_account_number: string | null; bank_account_name: string | null }) => void }) {
  const bankName    = (vendor as any).bank_name           as string | null;
  const accountNum  = (vendor as any).bank_account_number as string | null;
  const accountName = (vendor as any).bank_account_name   as string | null;
  const hasBank     = !!(bankName && accountNum && accountName);

  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [fBankName, setFBankName]     = useState(bankName ?? '');
  const [fAcctNum, setFAcctNum]       = useState(accountNum ?? '');
  const [fAcctName, setFAcctName]     = useState(accountName ?? '');

  async function handleSave() {
    if (fAcctNum && !/^\d{10}$/.test(fAcctNum)) {
      setError('Account number must be exactly 10 digits.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/vendor/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank_name: fBankName.trim() || null,
        bank_account_number: fAcctNum.trim() || null,
        bank_account_name: fAcctName.trim() || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!json.ok) { setError(json.message ?? 'Save failed'); return; }
    onSaved({ bank_name: fBankName.trim() || null, bank_account_number: fAcctNum.trim() || null, bank_account_name: fAcctName.trim() || null });
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900">Bank account</p>
          <button type="button" onClick={() => setEditing(true)}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900">
            {hasBank ? 'Edit' : 'Add'}
          </button>
        </div>
        {hasBank ? (
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 space-y-0.5">
            <p className="text-sm font-semibold text-zinc-900">{accountNum}</p>
            <p className="text-xs text-zinc-600">{accountName}</p>
            <p className="text-xs text-zinc-400">{bankName}</p>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-zinc-300 px-4 py-3 text-left hover:border-zinc-400">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600 text-base">₦</div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Add bank account</p>
              <p className="text-xs text-zinc-500">Students will transfer to this account when paying</p>
            </div>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-3">
      <p className="text-sm font-semibold text-zinc-900">Bank account</p>
      <input
        placeholder="Bank name (e.g. GTBank, Access, Opay)"
        value={fBankName}
        onChange={e => setFBankName(e.target.value)}
        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
      <input
        placeholder="Account number (10 digits)"
        inputMode="numeric"
        maxLength={10}
        value={fAcctNum}
        onChange={e => setFAcctNum(e.target.value.replace(/\D/g, '').slice(0, 10))}
        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
      <input
        placeholder="Account name (as it appears on your bank)"
        value={fAcctName}
        onChange={e => setFAcctName(e.target.value)}
        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={() => { setEditing(false); setError(null); }}
          className="flex-1 rounded-2xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className={cn(
            'flex-1 rounded-2xl py-2.5 text-sm font-semibold text-white transition-all',
            saving ? 'bg-zinc-400' : 'bg-zinc-900 hover:bg-zinc-700'
          )}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function VendorDashboardPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const justApplied = sp.get('applied') === '1';

  const [loading, setLoading]   = useState(true);
  const [vendor, setVendor]     = useState<VendorRow | null>(null);
  const [summary, setSummary]   = useState<OrderSummary>({ pending: 0, active: 0, ready: 0, today_count: 0, today_revenue: 0 });
  const [weekData, setWeekData] = useState<DayStats[]>([]);
  const [toggling, setToggling] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistState>({ hasMenuItems: false, hasHours: false, hasGoneLive: false, hasBankDetails: false });
  const [goOfflineModal, setGoOfflineModal] = useState<{ activeCount: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.replace('/login'); return; }

      const { data: v } = await supabase
        .from('vendors')
        .select('id, user_id, name, description, location, whatsapp, accepts_orders, verification_status, vendor_type, opens_at, closes_at, rejection_reason, suspended_at, suspension_reason, pause_until, bank_name, bank_account_number, bank_account_name')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (v) {
        setVendor(v as VendorRow);

        // Auto-resume if pause_until has elapsed — vendor forgot to un-pause
        if (
          (v as any).pause_until &&
          new Date((v as any).pause_until) < new Date() &&
          !v.accepts_orders
        ) {
          try {
            await supabase
              .from('vendors')
              .update({ accepts_orders: true, pause_until: null, pause_reason: null })
              .eq('id', v.id);
            setVendor((prev: any) => prev ? {
              ...prev,
              accepts_orders: true,
              pause_until: null,
              pause_reason: null,
            } : prev);
          } catch { /* non-critical — vendor can resume manually */ }
        }

        if ((v as VendorRow).verification_status === 'approved') {
          // Fetch last 7 days of orders in one query
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
          sevenDaysAgo.setHours(0, 0, 0, 0);

          const { data: orders } = await supabase
            .from('orders')
            .select('id, status, total, created_at')
            .eq('vendor_id', v.id)
            .gte('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: true });

          if (orders) {
            // WAT = UTC+1 — convert to local date for grouping
            const toWATDate = (iso: string) => {
              const d = new Date(iso);
              d.setHours(d.getUTCHours() + 1); // shift to WAT
              return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
            };

            const todayWAT = (() => {
              const d = new Date();
              d.setHours(d.getUTCHours() + 1);
              return d.toLocaleDateString('en-CA');
            })();

            // Build 7-day skeleton
            const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const days: DayStats[] = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(sevenDaysAgo);
              d.setDate(d.getDate() + i);
              const iso = d.toLocaleDateString('en-CA');
              return {
                date:    DAY_LABELS[d.getDay()],
                dateIso: iso,
                orders:  0,
                revenue: 0,
              };
            });

            const dayMap: Record<string, DayStats> = {};
            for (const day of days) dayMap[day.dateIso] = day;

            const todayOrders = orders.filter((o) => toWATDate(o.created_at) === todayWAT);

            for (const o of orders) {
              const key = toWATDate(o.created_at);
              if (!dayMap[key]) continue;
              dayMap[key].orders += 1;
              if (o.status !== 'cancelled') dayMap[key].revenue += o.total ?? 0;
            }

            setWeekData(days);
            setSummary({
              pending: todayOrders.filter((o) => o.status === 'pending').length,
              active:  todayOrders.filter((o) => o.status === 'confirmed' || o.status === 'preparing').length,
              ready:   todayOrders.filter((o) => o.status === 'ready').length,
              today_count: todayOrders.length,
              today_revenue: todayOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.total ?? 0), 0),
            });
          }

          // Check onboarding checklist completion
          const { data: menuItems } = await supabase
            .from('vendor_menu_items')
            .select('id')
            .eq('vendor_id', v.id)
            .limit(1);

          setChecklist({
            hasMenuItems: (menuItems?.length ?? 0) > 0,
            hasHours: !!v.opens_at && !!v.closes_at,
            hasGoneLive: (v as VendorRow).accepts_orders === true,
            hasBankDetails: !!(v.bank_name && v.bank_account_number && v.bank_account_name),
          });
        }
      }

      setLoading(false);
    })();
  }, [router]);

  // ── Subscribe vendor device to push notifications ────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    async function subscribeVendorPush() {
      try {
        const reg = await navigator.serviceWorker.ready;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          // No existing subscription — create one via the shared helper
          await subscribeToPush(reg);
          sub = await reg.pushManager.getSubscription();
        }
        if (!sub) return;

        const json = sub.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        };

        // Save to vendor_push_subscriptions so order notifications work
        await fetch('/api/vendor/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: json.endpoint,
            p256dh:   json.keys.p256dh,
            auth:     json.keys.auth,
          }),
        });
      } catch {
        // Non-critical — never block the dashboard
      }
    }

    void subscribeVendorPush();
  }, []);


  async function toggleOrders() {
    if (!vendor) return;
    const next = !vendor.accepts_orders;

    // Going OFFLINE — check for active orders first
    if (!next) {
      const { data: active } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendor.id)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready']);

      const activeCount = (active as any)?.count ?? 0;
      if (activeCount > 0) {
        setGoOfflineModal({ activeCount });
        return; // wait for modal confirmation
      }
    }

    await doGoOffline(next);
  }

  async function doGoOffline(next: boolean) {
    if (!vendor) return;
    setToggling(true);
    setGoOfflineModal(null);

    setVendor((prev) => prev ? { ...prev, accepts_orders: next } : prev);

    const body: Record<string, unknown> = { accepts_orders: next };
    if (next) {
      // Turning on — clear any pause fields
      body.pause_until = null;
      body.pause_reason = null;
    }
    const res = await fetch('/api/vendor/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (!json.ok) {
      setVendor((prev) => prev ? { ...prev, accepts_orders: !next } : prev);
    } else if (next) {
      setChecklist((c) => ({ ...c, hasGoneLive: true }));
    } else {
      // Just went offline — notify students with active orders
      void fetch(`/api/vendor/notify-pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendor.id }),
      }).catch(() => {});
    }
    setToggling(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // ── No vendor row ──────────────────────────────────────────────────────────
  if (!vendor) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-8">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          {/* Headline */}
          <div className="mb-5 text-center">
            <span className="text-4xl">🍽</span>
            <p className="mt-3 text-lg font-bold text-zinc-900">Sell food on Jabumarket</p>
            <p className="mt-1 text-sm text-zinc-500">
              Your campus canteen — powered by the app.
            </p>
          </div>

          {/* Proof points */}
          <div className="space-y-3 mb-6">
            {[
              { icon: '📲', heading: 'Students order through the app', sub: 'No DMs, no shouting across the canteen.' },
              { icon: '📋', heading: 'You see everything in a live queue', sub: 'Pending, preparing, ready — all in one screen.' },
              { icon: '🔔', heading: 'Push alerts on your phone', sub: 'New orders reach you even when the app is closed.' },
            ].map(({ icon, heading, sub }) => (
              <div key={heading} className="flex items-start gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <span className="mt-0.5 text-base leading-none shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{heading}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          <Link href="/vendor/register"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-3 text-sm font-semibold text-white no-underline hover:bg-zinc-700">
            Register your stall <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const status = vendor.verification_status;

  // ── Pending approval ───────────────────────────────────────────────────────
  if (status === 'pending') {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-8">
        {justApplied && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
            <p className="font-semibold text-emerald-900">Application submitted!</p>
            <p className="mt-1 text-sm text-emerald-700">An admin will review it shortly — usually within 24 hours.</p>
          </div>
        )}

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">Application under review</p>
              <p className="mt-1 text-sm text-amber-800">
                <strong>{vendor.name}</strong> — you'll receive a notification when approved.
              </p>
            </div>
          </div>
        </div>

        {/* While you wait — key insight: pending vendors CAN already set up */}
        {vendor.vendor_type === 'food' ? (
          <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-zinc-900">While you wait — get ahead</p>
            <p className="text-sm text-zinc-500">
              You don't need to be approved to set up your menu. Add your items now so you're ready to go live the moment approval comes through.
            </p>

            <Link href="/vendor/menu"
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 no-underline hover:bg-zinc-100">
              <div className="flex items-center gap-3">
                <ChefHat className="h-5 w-5 text-zinc-600" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Set up your menu</p>
                  <p className="text-xs text-zinc-500">Add your food items, prices, and categories</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>

            <Link href="/vendor/setup"
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 no-underline hover:bg-zinc-100">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-zinc-600" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Review your profile</p>
                  <p className="text-xs text-zinc-500">Check your hours, location, and contact details</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
          </div>
        ) : (
          <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-zinc-900">While you wait — get ahead</p>
            <p className="text-sm text-zinc-500">
              Your verification is being reviewed. In the meantime, post your first listing so buyers find you straight away.
            </p>
            <Link href="/post"
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 no-underline hover:bg-zinc-100">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-zinc-600" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Post a listing</p>
                  <p className="text-xs text-zinc-500">Add a product or service to start selling</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
            <Link href="/vendor/setup"
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 no-underline hover:bg-zinc-100">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-zinc-600" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Add bank details</p>
                  <p className="text-xs text-zinc-500">So buyers can pay you when a deal is agreed</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ── Rejected ──────────────────────────────────────────────────────────────
  if (status === 'rejected') {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Application rejected</p>
          {vendor.rejection_reason && (
            <p className="mt-1 text-xs text-amber-800">{vendor.rejection_reason}</p>
          )}
          <p className="mt-2 text-xs text-amber-700">
            Fix the issues above and resubmit from the register page.
          </p>
        </div>
        <RejectedResubmit vendor={vendor} onResubmitted={() => router.replace('/vendor?applied=1')} />
      </div>
    );
  }

  // ── Approved dashboard ─────────────────────────────────────────────────────
  const isFoodVendor = vendor.vendor_type === 'food';
  const showChecklist = !checklist.hasMenuItems || !checklist.hasHours || !checklist.hasBankDetails;

  if (!isFoodVendor) {
    // ── Normal (non-food) vendor dashboard ──────────────────────────────────
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{vendor.name}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {vendor.vendor_type === 'mall' ? 'Campus shop' : 'Student vendor'} · Seller dashboard
          </p>
        </div>

        {/* Bank details warning — most critical */}
        {!(vendor as any).bank_account_number && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Bank details missing</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Buyers cannot finalize deals until you add your bank account number.
              </p>
            </div>
            <Link
              href="/vendor/setup"
              className="shrink-0 self-center rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 no-underline"
            >
              Add now →
            </Link>
          </div>
        )}

        {/* Storefront link */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Your storefront</p>
            <p className="mt-0.5 text-xs text-zinc-500 font-mono truncate">
              jabumarket.com/vendors/{vendor.id}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/vendors/${vendor.id}`).catch(() => {});
              }}
              className="rounded-xl border bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Copy link
            </button>
            <Link
              href={`/vendors/${vendor.id}`}
              className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 no-underline"
            >
              View →
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <NormalVendorStats vendorId={vendor.id} />

        {/* Quick links */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-2">
          <p className="text-sm font-semibold text-zinc-900 mb-3">Manage</p>
          <QuickLink href="/my-listings"          icon={<Store className="h-5 w-5" />}          label="My listings" />
          <QuickLink href="/inbox"                icon={<MessageCircle className="h-5 w-5" />}   label="Messages" />
          <QuickLink href="/vendor/setup"         icon={<Settings className="h-5 w-5" />}        label="Edit profile & bank details" />
          <QuickLink href={`/vendors/${vendor.id}`} icon={<ArrowRight className="h-5 w-5" />}   label="View storefront" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Go-offline confirmation modal */}
      {goOfflineModal && (
        <GoOfflineModal
          activeCount={goOfflineModal.activeCount}
          onConfirm={() => doGoOffline(false)}
          onCancel={() => setGoOfflineModal(null)}
        />
      )}

    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">{vendor.name}</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Vendor Dashboard</p>
      </div>

      {(vendor as any).suspended_at && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Your account is suspended</p>
          {(vendor as any).suspension_reason && (
            <p className="mt-1 text-xs text-red-700">{(vendor as any).suspension_reason}</p>
          )}
          <p className="mt-2 text-xs text-red-600">Contact support to resolve this.</p>
        </div>
      )}

      {/* Onboarding checklist — shown until menu + hours + bank are set */}
      {showChecklist && (
        <OnboardingChecklist vendor={vendor} checklist={checklist} />
      )}

      {/* Taking orders toggle */}
      <button type="button" onClick={toggleOrders} disabled={toggling}
        className={cn(
          'w-full flex items-center justify-between rounded-3xl border p-5 text-left transition-all shadow-sm disabled:opacity-70',
          vendor.accepts_orders ? 'border-emerald-300 bg-emerald-50' : 'border-zinc-200 bg-white'
        )}>
        <div>
          <p className={cn('text-base font-bold', vendor.accepts_orders ? 'text-emerald-900' : 'text-zinc-900')}>
            {vendor.accepts_orders ? '✅ Taking orders today' : '⏸ Not accepting orders'}
          </p>
          <p className={cn('mt-0.5 text-sm', vendor.accepts_orders ? 'text-emerald-700' : 'text-zinc-500')}>
            {vendor.accepts_orders
              ? 'Customers can place orders now'
              : showChecklist ? 'Complete the checklist above to go live' : 'Toggle on to start receiving orders'}
          </p>
        </div>
        {toggling
          ? <Loader2 className="h-5 w-5 animate-spin text-zinc-400 shrink-0" />
          : vendor.accepts_orders
          ? <ToggleRight className="h-8 w-8 text-emerald-600 shrink-0" />
          : <ToggleLeft className="h-8 w-8 text-zinc-400 shrink-0" />}
      </button>

      {/* Pause for N minutes — food vendor only, shown when accepting orders */}
      {vendor.accepts_orders && (
        <div className="flex gap-2 px-1 -mt-2">
          <p className="text-xs text-zinc-500 self-center mr-1">Pause for:</p>
          {[15, 30, 60].map((mins) => (
            <button
              key={mins}
              type="button"
              disabled={pausing}
              onClick={async () => {
                setPausing(true);
                const pauseUntil = new Date(Date.now() + mins * 60 * 1000).toISOString();
                await supabase
                  .from('vendors')
                  .update({ accepts_orders: false, pause_until: pauseUntil, pause_reason: `Paused for ${mins} min` })
                  .eq('id', vendor.id);
                setVendor((prev) => prev ? { ...prev, accepts_orders: false } as VendorRow : prev);
                setPausing(false);
              }}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              {mins}m
            </button>
          ))}
        </div>
      )}

      {/* Today's order summary */}
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-900">Today's orders</p>
          <Link href="/vendor/orders"
            className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-900">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatusCard label="Pending" count={summary.pending} color="amber" icon={Clock} />
          <StatusCard label="Active"  count={summary.active}  color="blue"  icon={ChefHat} />
          <StatusCard label="Ready"   count={summary.ready}   color="emerald" icon={Bell} />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-zinc-900">{summary.today_count}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Orders today</p>
        </div>
        <div className="rounded-3xl border bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-zinc-900">₦{summary.today_revenue.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Revenue today</p>
        </div>
      </div>

      {/* 7-day chart */}
      {weekData.length > 0 && <WeekChart days={weekData} />}

      {/* Bank account */}
      {!(vendor as any).bank_account_number && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-900">⚠️ Bank details missing</p>
          <p className="mt-0.5 text-xs text-amber-700">
            Buyers cannot finalize deals with you until you add your bank account. Add it below.
          </p>
        </div>
      )}
      <BankDetailsCard
        vendor={vendor}
        onSaved={(patch) => setVendor((prev) => prev ? { ...prev, ...patch } as VendorRow : prev)}
      />

      {/* Quick links */}
      <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-2">
        <p className="text-sm font-semibold text-zinc-900 mb-3">Quick links</p>
        <QuickLink href="/vendor/menu"   icon={<ChefHat className="h-5 w-5" />}    label="Manage menu" />
        <QuickLink href="/vendor/orders" icon={<ShoppingBag className="h-5 w-5" />} label="View orders" />
        <QuickLink href="/vendor/setup"  icon={<Settings className="h-5 w-5" />}    label="Edit profile & hours" />
      </div>
    </div>
    </>
  );
}

function NormalVendorStats({ vendorId }: { vendorId: string }) {
  const [stats, setStats] = useState<{ listings: number; active: number; messages: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [listingsRes, convoRes] = await Promise.all([
        supabase.from('listings').select('id, status').eq('vendor_id', vendorId),
        supabase.from('conversations').select('id, vendor_unread').eq('vendor_id', vendorId),
      ]);
      const listings = listingsRes.data ?? [];
      const convos = convoRes.data ?? [];
      setStats({
        listings: listings.length,
        active: listings.filter((l: any) => l.status === 'active').length,
        messages: convos.reduce((sum: number, c: any) => sum + (c.vendor_unread ?? 0), 0),
      });
    })();
  }, [vendorId]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
        <p className="text-2xl font-bold text-zinc-900">{stats.listings}</p>
        <p className="mt-0.5 text-xs text-zinc-500">Total listings</p>
      </div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
        <p className="text-2xl font-bold text-zinc-900">{stats.active}</p>
        <p className="mt-0.5 text-xs text-zinc-500">Active now</p>
      </div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
        <p className={cn('text-2xl font-bold', stats.messages > 0 ? 'text-red-600' : 'text-zinc-900')}>{stats.messages}</p>
        <p className="mt-0.5 text-xs text-zinc-500">Unread messages</p>
      </div>
    </div>
  );
}

function StatusCard({
  label, count, color, icon: Icon,
}: { label: string; count: number; color: 'amber' | 'blue' | 'emerald'; icon: typeof Clock }) {
  const colors = {
    amber:   'bg-amber-50 text-amber-900 border-amber-200',
    blue:    'bg-blue-50 text-blue-900 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  };
  return (
    <div className={cn('rounded-2xl border p-3 text-center', colors[color])}>
      <Icon className="mx-auto mb-1 h-4 w-4 opacity-60" />
      <p className="text-xl font-bold">{count}</p>
      <p className="text-xs font-medium opacity-70">{label}</p>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href}
      className="flex items-center justify-between rounded-2xl border border-zinc-100 px-4 py-3 no-underline hover:bg-zinc-50 transition-colors">
      <span className="flex items-center gap-3 text-sm font-semibold text-zinc-900">
        <span className="text-zinc-400">{icon}</span>{label}
      </span>
      <ArrowRight className="h-4 w-4 text-zinc-400" />
    </Link>
  );
}
export default function VendorDashboardPage() {
  return (
    <Suspense>
      <VendorDashboardPageInner />
    </Suspense>
  );
}