'use client';
// app/vendor/setup/page.tsx
// Vendor profile settings page

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Loader2, Store, MapPin, MessageCircle, Clock, CheckCircle2,
  ToggleLeft, ToggleRight, Camera, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VendorRow } from '@/lib/types';
import { DAY_NAMES, DAY_FULL, type DayEntry } from '@/lib/vendorSchedule';

type FormData = {
  name: string;
  description: string;
  location: string;
  whatsapp: string;
  opens_at: string;
  closes_at: string;
  accepts_orders: boolean;
  accepts_delivery: boolean;
  delivery_fee: number;
  avatar_url: string | null;
  day_schedule: DayEntry[] | null;
};

// ── Day schedule editor ───────────────────────────────────────────────────────

function DayScheduleEditor({
  globalOpensAt,
  globalClosesAt,
  schedule,
  onChange,
}: {
  globalOpensAt: string;
  globalClosesAt: string;
  schedule: DayEntry[] | null;
  onChange: (s: DayEntry[] | null) => void;
}) {
  // Build a full 7-day working array, filling gaps with the global hours
  function buildFull(s: DayEntry[] | null): DayEntry[] {
    return Array.from({ length: 7 }, (_, day) => {
      const existing = s?.find((e) => e.day === day);
      return existing ?? {
        day,
        opens_at: globalOpensAt || '07:00',
        closes_at: globalClosesAt || '18:00',
        closed: false,
      };
    });
  }

  const [enabled, setEnabled] = useState(schedule !== null && schedule.length > 0);
  const [days, setDays] = useState<DayEntry[]>(() => buildFull(schedule));

  // Sync global hours into uncustomised days when they change externally
  useEffect(() => {
    if (!enabled) setDays(buildFull(schedule));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalOpensAt, globalClosesAt]);

  function toggleEnabled(val: boolean) {
    setEnabled(val);
    onChange(val ? days : null);
  }

  function updateDay(day: number, patch: Partial<DayEntry>) {
    const next = days.map((d) => d.day === day ? { ...d, ...patch } : d);
    setDays(next);
    onChange(enabled ? next : null);
  }

  return (
    <div className="space-y-3">
      {/* Toggle to enable per-day schedule */}
      <button
        type="button"
        onClick={() => toggleEnabled(!enabled)}
        className={cn(
          'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all',
          enabled ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-200 bg-white'
        )}
      >
        <div>
          <p className="text-sm font-semibold text-zinc-900">Custom hours per day</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {enabled ? 'Editing per-day schedule' : 'Using the same hours every day'}
          </p>
        </div>
        {enabled
          ? <ToggleRight className="h-6 w-6 text-zinc-900 shrink-0" />
          : <ToggleLeft className="h-6 w-6 text-zinc-400 shrink-0" />}
      </button>

      {/* Per-day grid */}
      {enabled && (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
          {days.map((entry) => (
            <div key={entry.day} className={cn(
              'flex items-center gap-3 px-4 py-3',
              entry.closed && 'bg-zinc-50'
            )}>
              {/* Day name */}
              <p className={cn(
                'w-10 shrink-0 text-sm font-semibold',
                entry.closed ? 'text-zinc-400' : 'text-zinc-900'
              )}>
                {DAY_NAMES[entry.day]}
              </p>

              {/* Closed toggle */}
              <button
                type="button"
                onClick={() => updateDay(entry.day, { closed: !entry.closed })}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                  entry.closed
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                )}
              >
                {entry.closed ? 'Closed' : 'Open'}
              </button>

              {/* Time pickers */}
              {!entry.closed && (
                <>
                  <input
                    type="time"
                    value={entry.opens_at ?? ''}
                    onChange={(e) => updateDay(entry.day, { opens_at: e.target.value })}
                    className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                  <span className="text-xs text-zinc-400">–</span>
                  <input
                    type="time"
                    value={entry.closes_at ?? ''}
                    onChange={(e) => updateDay(entry.day, { closes_at: e.target.value })}
                    className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                </>
              )}

              {entry.closed && (
                <p className="flex-1 text-xs text-zinc-400">Not open this day</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Avatar uploader ───────────────────────────────────────────────────────────

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

function AvatarUploader({
  current,
  vendorName,
  onUploaded,
}: {
  current: string | null;
  vendorName: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [status, setStatus] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // If parent updates current (e.g. on initial load), sync preview
  useEffect(() => { if (current && !preview) setPreview(current); }, [current, preview]);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please pick an image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2 MB.');
      return;
    }

    setError(null);
    setStatus('uploading');
    setProgress(10);

    // Local preview while uploading
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      // 1. Get signed URL from our API
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const signRes = await fetch('/api/vendor/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ext, size: file.size }),
      });
      const signJson = await signRes.json();
      if (!signJson.ok) throw new Error(signJson.message ?? 'Failed to get upload URL');

      setProgress(30);

      // 2. Upload directly to Supabase Storage via signed URL
      const uploadRes = await fetch(signJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Storage upload failed (${uploadRes.status})`);

      setProgress(80);

      // 3. Persist public URL to vendor row
      const saveRes = await fetch('/api/vendor/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: signJson.publicUrl }),
      });
      const saveJson = await saveRes.json();
      if (!saveJson.ok) throw new Error(saveJson.message ?? 'Failed to save avatar');

      setProgress(100);
      setStatus('done');
      onUploaded(signJson.publicUrl);
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
      setStatus('error');
      setPreview(current); // revert preview
    }
  }

  function clearAvatar() {
    setPreview(null);
    setStatus('idle');
    setError(null);
    onUploaded('');
    // Persist removal
    fetch('/api/vendor/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_url: null }),
    }).catch(() => {});
  }

  const initials = vendorName
    ? vendorName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Stall photo / logo
      </label>

      <div className="flex items-center gap-4">
        {/* Avatar preview */}
        <div className="relative shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="h-20 w-20 rounded-2xl object-cover border border-zinc-200"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-zinc-100 border border-zinc-200 text-2xl font-bold text-zinc-400 select-none">
              {initials}
            </div>
          )}

          {/* Progress ring overlay while uploading */}
          {status === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}

          {/* Clear button */}
          {preview && status !== 'uploading' && (
            <button
              type="button"
              onClick={clearAvatar}
              className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700"
              title="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Upload button */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={status === 'uploading'}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all',
              status === 'uploading'
                ? 'border-zinc-200 bg-zinc-100 text-zinc-400'
                : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
            )}
          >
            <Camera className="h-4 w-4" />
            {preview ? 'Change photo' : 'Upload photo'}
          </button>
          <p className="text-[11px] text-zinc-400">JPG, PNG or WebP · max 2 MB</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // Reset so same file can be re-selected
            e.target.value = '';
          }}
        />
      </div>

      {/* Progress bar */}
      {status === 'uploading' && (
        <div className="h-1 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {status === 'done' && (
        <p className="text-xs font-medium text-emerald-600">Photo uploaded successfully.</p>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

export default function VendorSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [bankName,     setBankName]     = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName,  setAccountName]  = useState('');
  const [paymentNote,  setPaymentNote]  = useState('');
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    location: '',
    whatsapp: '',
    opens_at: '',
    closes_at: '',
    accepts_orders: false,
    accepts_delivery: true,
    delivery_fee: 0,
    avatar_url: null,
    day_schedule: null,
  });
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [vendorType, setVendorType] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace('/login');
        return;
      }

      const res = await fetch('/api/vendor/setup');
      const json = await res.json();

      if (!json.ok) {
        // Not a vendor or not approved — redirect to vendor home
        router.replace('/vendor');
        return;
      }

      const v: VendorRow = json.vendor;
      setVendorId(v.id);
      setBankName((v as any).bank_name ?? '');
      setAccountNumber((v as any).bank_account_number ?? '');
      setAccountName((v as any).bank_account_name ?? '');
      setPaymentNote((v as any).payment_note ?? '');
      setForm({
        name: v.name ?? '',
        description: v.description ?? '',
        location: v.location ?? '',
        whatsapp: v.whatsapp ?? '',
        opens_at: v.opens_at ?? '',
        closes_at: v.closes_at ?? '',
        accepts_orders: v.accepts_orders ?? false,
        accepts_delivery: (v as any).accepts_delivery ?? true,
        delivery_fee: (v as any).delivery_fee ?? 0,
        avatar_url: (v as any).avatar_url ?? null,
        day_schedule: (v as any).day_schedule ?? null,
      });
      setVendorType((v as any).vendor_type ?? null);
      setLoading(false);
    })();
  }, [router]);

  function set<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (accountNumber && !/^\d{10}$/.test(accountNumber)) {
      setBanner({ type: 'error', text: 'Account number must be exactly 10 digits.' });
      return;
    }
    setSaving(true);
    setBanner(null);

    const res = await fetch('/api/vendor/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        bank_name: bankName || null,
        bank_account_number: accountNumber || null,
        bank_account_name: accountName || null,
        payment_note: paymentNote.trim() || null,
      }),
    });

    const json = await res.json();
    if (json.ok) {
      setBanner({ type: 'success', text: 'Profile updated successfully.' });
    } else {
      setBanner({ type: 'error', text: json.message ?? 'Save failed.' });
    }
    setSaving(false);
  }

  async function toggleOrders() {
    const next = !form.accepts_orders;
    set('accepts_orders', next);

    const res = await fetch('/api/vendor/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepts_orders: next }),
    });

    const json = await res.json();
    if (!json.ok) {
      // Revert
      set('accepts_orders', !next);
      setBanner({ type: 'error', text: json.message ?? 'Failed to update status.' });
    }
  }

  async function toggleDelivery() {
    const next = !form.accepts_delivery;
    set('accepts_delivery', next);

    const res = await fetch('/api/vendor/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepts_delivery: next }),
    });

    const json = await res.json();
    if (!json.ok) {
      set('accepts_delivery', !next);
      setBanner({ type: 'error', text: json.message ?? 'Failed to update delivery setting.' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 pb-24 pt-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Store Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your vendor profile and order settings.</p>
      </div>

      {/* Bank details warning — food vendors must have bank details to receive orders */}
      {vendorType === 'food' && form.accepts_orders && !accountNumber && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 space-y-1">
          <p className="text-sm font-bold text-red-800">⚠️ You can't receive orders yet</p>
          <p className="text-xs text-red-700">
            Your store is open but you have no bank account set up. Students who try to order from you
            will be blocked until you add your payment details below.
          </p>
        </div>
      )}

      {/* Bank details nudge — food vendor is open but bank is incomplete (partial) */}
      {vendorType === 'food' && form.accepts_orders && accountNumber && (!bankName || !accountName) && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 space-y-1">
          <p className="text-sm font-bold text-amber-800">⚠️ Payment details incomplete</p>
          <p className="text-xs text-amber-700">
            Add your bank name and account name so students can confirm who to transfer to.
          </p>
        </div>
      )}

      {/* Taking orders toggle */}
      <button
        type="button"
        onClick={toggleOrders}
        className={cn(
          'w-full flex items-center justify-between rounded-3xl border p-5 text-left transition-all shadow-sm',
          form.accepts_orders
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-zinc-200 bg-white'
        )}
      >
        <div>
          <p className={cn('text-base font-bold', form.accepts_orders ? 'text-emerald-900' : 'text-zinc-900')}>
            {form.accepts_orders ? '✅ Taking orders today' : '⏸ Not accepting orders'}
          </p>
          <p className={cn('mt-0.5 text-sm', form.accepts_orders ? 'text-emerald-700' : 'text-zinc-500')}>
            {form.accepts_orders
              ? 'Customers can order from you right now'
              : 'Toggle on when you\'re ready to receive orders'}
          </p>
        </div>
        {form.accepts_orders
          ? <ToggleRight className="h-8 w-8 text-emerald-600 shrink-0" />
          : <ToggleLeft className="h-8 w-8 text-zinc-400 shrink-0" />}
      </button>

      {vendorType === 'food' && (
        <>
          {/* Delivery toggle */}
          <button
            type="button"
            onClick={toggleDelivery}
            className={cn(
              'w-full flex items-center justify-between rounded-3xl border p-5 text-left transition-all shadow-sm',
              form.accepts_delivery
                ? 'border-blue-300 bg-blue-50'
                : 'border-zinc-200 bg-white'
            )}
          >
            <div>
              <p className={cn('text-base font-bold', form.accepts_delivery ? 'text-blue-900' : 'text-zinc-900')}>
                {form.accepts_delivery ? '🛵 Offering delivery' : '🛵 No delivery'}
              </p>
              <p className={cn('mt-0.5 text-sm', form.accepts_delivery ? 'text-blue-700' : 'text-zinc-500')}>
                {form.accepts_delivery
                  ? 'Customers can select delivery at checkout'
                  : 'Pickup only — toggle on to enable delivery'}
              </p>
            </div>
            {form.accepts_delivery
              ? <ToggleRight className="h-8 w-8 text-blue-600 shrink-0" />
              : <ToggleLeft className="h-8 w-8 text-zinc-400 shrink-0" />}
          </button>

          {/* Delivery fee (only when delivery is enabled) */}
          {form.accepts_delivery && (
            <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-3">
              <p className="text-sm font-semibold text-zinc-900">Delivery fee</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-zinc-500">₦</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={form.delivery_fee}
                  onChange={(e) => set('delivery_fee', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="0"
                />
              </div>
              <p className="text-[11px] text-zinc-400">
                This fee is added to the order total at checkout. Set to 0 for free delivery.
              </p>
            </div>
          )}
        </>
      )}

      {/* Profile form */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-zinc-900">Profile</p>

          <AvatarUploader
            current={form.avatar_url}
            vendorName={form.name}
            onUploaded={(url) => set('avatar_url', url || null)}
          />

          <Field
            label="Canteen / business name"
            icon={<Store className="h-4 w-4" />}
            value={form.name}
            onChange={(v) => set('name', v)}
            placeholder="e.g. Mama Bisi's Kitchen"
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Short description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What do you sell? Shown on your storefront"
              rows={2}
              maxLength={300}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>

          <Field
            label="Location on campus"
            icon={<MapPin className="h-4 w-4" />}
            value={form.location}
            onChange={(v) => set('location', v)}
            placeholder="e.g. Block B Canteen, near the library"
          />

          <Field
            label="WhatsApp number"
            icon={<MessageCircle className="h-4 w-4" />}
            value={form.whatsapp}
            onChange={(v) => set('whatsapp', v)}
            placeholder="08012345678"
            type="tel"
          />
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Payment details</p>
            <p className="text-xs text-zinc-500 mt-1">
              Students will transfer to this account when they order. Make sure it&apos;s correct.
            </p>
          </div>
          <input
            placeholder="Bank name (e.g. GTBank, Access, Opay)"
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <input
            placeholder="Account number (10 digits)"
            inputMode="numeric"
            maxLength={10}
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <input
            placeholder="Account name (as it appears on your bank)"
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Transfer note (optional)
            </label>
            <input
              placeholder="e.g. Include your name and order number in the description"
              value={paymentNote}
              onChange={e => setPaymentNote(e.target.value)}
              maxLength={120}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <p className="text-[11px] text-zinc-400">Shown to buyers when they&apos;re about to transfer. Helps you match payments to orders.</p>
          </div>
        </div>

        {vendorType === 'food' && (
          <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
            <p className="text-sm font-semibold text-zinc-900">Opening hours</p>

            {/* Global default hours — always shown, used as fallback */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <Clock className="h-3.5 w-3.5" /> Default open
                </label>
                <input
                  type="time"
                  value={form.opens_at}
                  onChange={(e) => set('opens_at', e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <Clock className="h-3.5 w-3.5" /> Default close
                </label>
                <input
                  type="time"
                  value={form.closes_at}
                  onChange={(e) => set('closes_at', e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">Applied on any day without a custom schedule.</p>

            <DayScheduleEditor
              globalOpensAt={form.opens_at}
              globalClosesAt={form.closes_at}
              schedule={form.day_schedule}
              onChange={(s) => set('day_schedule', s as any)}
            />
          </div>
        )}

        {banner && (
          <p className={cn(
            'rounded-2xl border px-4 py-3 text-sm',
            banner.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          )}>
            {banner.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-all',
            saving ? 'bg-zinc-400' : 'bg-zinc-900 hover:bg-zinc-700'
          )}
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> Save changes</>
          )}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {icon ? <span className="flex items-center gap-1.5">{icon}{label}</span> : label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
    </div>
  );
}