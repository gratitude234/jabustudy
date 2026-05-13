'use client';
// app/vendor/register/page.tsx
// Food vendor registration — single clean form, includes hours, no redundant confirm step

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Loader2, Store, MapPin, Phone, MessageCircle,
  FileText, Clock, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FormData = {
  name: string;
  location: string;
  phone: string;
  whatsapp: string;
  description: string;
  opens_at: string;
  closes_at: string;
};

const EMPTY: FormData = {
  name: '', location: '', phone: '', whatsapp: '',
  description: '', opens_at: '07:00', closes_at: '18:00',
};

function Field({
  label, icon, value, onChange, placeholder, type = 'text', hint, required = false,
}: {
  label: string; icon?: React.ReactNode; value: string;
  onChange: (v: string) => void; placeholder?: string;
  type?: string; hint?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {icon}{label}{required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
      {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

export default function VendorRegisterPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.replace('/login?next=/vendor/register'); return; }

      const { data: existing } = await supabase
        .from('vendors').select('id, verification_status')
        .eq('user_id', authData.user.id).maybeSingle();

      if (existing) {
        // Already registered — send them to the right place
        if (existing.verification_status === 'approved') {
          router.replace('/vendor');
        } else {
          router.replace('/vendor');
        }
        return;
      }

      setChecking(false);
    })();
  }, [router]);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim())     { setError('Business name is required'); return; }
    if (!form.location.trim()) { setError('Location on campus is required'); return; }
    if (!form.opens_at)        { setError('Opening time is required'); return; }
    if (!form.closes_at)       { setError('Closing time is required'); return; }

    setSubmitting(true);

    const res = await fetch('/api/vendor/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        ...(bankName.trim() ? { bank_name: bankName.trim() } : {}),
        ...(accountNumber.trim().length === 10 ? { bank_account_number: accountNumber.trim() } : {}),
        ...(accountName.trim() ? { bank_account_name: accountName.trim() } : {}),
      }),
    });

    const json = await res.json();
    if (!json.ok) {
      setError(json.message ?? 'Registration failed. Please try again.');
      setSubmitting(false);
      return;
    }

    router.replace('/vendor?applied=1');
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-24 pt-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Set up your food stall</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Fill in your details. An admin reviews every application before you go live — usually within 24 hours.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Your business */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your business</p>

          <Field
            label="Canteen / business name" icon={<Store className="h-4 w-4" />}
            value={form.name} onChange={(v) => set('name', v)}
            placeholder="e.g. Mama Tunde's Kitchen" required
          />

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <FileText className="h-4 w-4" /> What you sell
            </label>
            <textarea
              value={form.description} onChange={(e) => set('description', e.target.value)}
              placeholder="e.g. Hot Nigerian swallow, soups, proteins, rice dishes, drinks — served fresh daily"
              rows={2} maxLength={300}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <p className="text-[11px] text-zinc-400">Shown to students on your vendor profile. Keep it short and clear.</p>
          </div>
        </div>

        {/* Bank details */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Payment details</p>
          <input
            type="text"
            placeholder="Bank name (e.g. GTBank, Opay, Palmpay)"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Account number (10 digits)"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <input
            type="text"
            placeholder="Account name (as on your bank)"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <p className="text-[11px] text-zinc-400">
            Required before you can receive orders. You can also add this after approval.
          </p>
        </div>

        {/* Section 2: Where & when */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Where & when</p>

          <Field
            label="Location on campus" icon={<MapPin className="h-4 w-4" />}
            value={form.location} onChange={(v) => set('location', v)}
            placeholder="e.g. Block B Canteen, near the library" required
            hint="Be specific — students use this to find you."
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <Clock className="h-3.5 w-3.5" /> Opens at <span className="text-red-400">*</span>
              </label>
              <input type="time" value={form.opens_at} onChange={(e) => set('opens_at', e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <Clock className="h-3.5 w-3.5" /> Closes at <span className="text-red-400">*</span>
              </label>
              <input type="time" value={form.closes_at} onChange={(e) => set('closes_at', e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
            </div>
          </div>
          <p className="text-[11px] text-zinc-400">
            Students see an "Open" or "Outside hours" badge on the food page based on these times.
          </p>
        </div>

        {/* Section 3: Contact */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact (optional)</p>

          <Field
            label="WhatsApp number" icon={<MessageCircle className="h-4 w-4" />}
            value={form.whatsapp} onChange={(v) => set('whatsapp', v)}
            placeholder="08012345678" type="tel"
            hint="Shown on your profile so students can reach you directly."
          />
          <Field
            label="Phone number" icon={<Phone className="h-4 w-4" />}
            value={form.phone} onChange={(v) => set('phone', v)}
            placeholder="08012345678" type="tel"
          />
        </div>

        {/* What happens next */}
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-zinc-900">What happens after you submit</p>
          <div className="space-y-2 text-sm text-zinc-600">
            <p className="flex items-start gap-2"><span className="mt-0.5 text-base">1.</span> Admin reviews your application — usually within 24 hours.</p>
            <p className="flex items-start gap-2"><span className="mt-0.5 text-base">2.</span> You get a notification when you're approved.</p>
            <p className="flex items-start gap-2"><span className="mt-0.5 text-base">3.</span> You add your menu items and flip the toggle to go live.</p>
          </div>
        </div>

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all',
            submitting ? 'bg-zinc-400' : 'bg-zinc-900 hover:bg-zinc-700'
          )}>
          {submitting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            : <><CheckCircle2 className="h-4 w-4" /> Submit application <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </div>
  );
}