'use client';
// app/vendor/create/page.tsx
// Lightweight normal vendor registration (mall / student / other)

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, MessageCircle, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type VendorType = 'mall' | 'student' | 'other';

const TYPE_LABELS: Record<VendorType, string> = {
  mall: 'Mall / Shop',
  student: 'Student vendor',
  other: 'Other',
};

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  hint,
  required = false,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {icon}
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
      {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

export default function VendorCreatePage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [vendorType, setVendorType] = useState<VendorType>('student');
  const [whatsapp, setWhatsapp] = useState('');
  const [location, setLocation] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        router.replace('/login?next=/vendor/create');
        return;
      }

      // If already a vendor, go to /me
      const { data: existing } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mounted) return;

      if (existing?.id) {
        router.replace('/me');
        return;
      }

      setChecking(false);
    }

    check();
    return () => { mounted = false; };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSubmitting(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      router.replace('/login?next=/vendor/create');
      return;
    }

    const { error: insertError } = await supabase.from('vendors').insert({
      user_id: user.id,
      name: trimmedName,
      vendor_type: vendorType,
      whatsapp: whatsapp.trim() || null,
      location: location.trim() || null,
      verified: false,
      verification_status: 'unverified',
      ...(bankName.trim() ? { bank_name: bankName.trim() } : {}),
      ...(accountNumber.trim().length === 10 ? { bank_account_number: accountNumber.trim() } : {}),
      ...(accountName.trim() ? { bank_account_name: accountName.trim() } : {}),
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.replace('/vendor');
  }

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 pb-28 md:pb-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Start selling on JABU Market</h1>
        <p className="mt-1 text-sm text-zinc-500">Set up your vendor profile in seconds. You can update details anytime.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="Store / Display name"
          icon={<Store className="h-3.5 w-3.5" />}
          value={name}
          onChange={setName}
          placeholder="e.g. Gratitude Provisions"
          required
        />

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vendor type</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TYPE_LABELS) as VendorType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setVendorType(t)}
                className={cn(
                  'rounded-2xl border py-2.5 text-sm font-semibold transition-colors',
                  vendorType === t
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                )}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="WhatsApp"
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          value={whatsapp}
          onChange={setWhatsapp}
          placeholder="+234 801 234 5678"
          hint="Buyers will use this to contact you"
        />

        <Field
          label="Location"
          icon={<MapPin className="h-3.5 w-3.5" />}
          value={location}
          onChange={setLocation}
          placeholder="e.g. JABU Campus / Male Hostels"
        />

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Payment details <span className="normal-case font-normal text-zinc-400">(buyers pay you here)</span>
          </p>
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
          <p className="text-[11px] text-zinc-400">You can add this later — but buyers need it to pay you.</p>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className={cn(
            'w-full rounded-2xl py-3 text-sm font-semibold transition-colors',
            submitting || !name.trim()
              ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
              : 'bg-zinc-900 text-white hover:bg-zinc-800'
          )}
        >
          {submitting ? 'Creating profile…' : 'Create vendor profile →'}
        </button>

        <p className="text-center text-xs text-zinc-400">
          Want to sell food?{' '}
          <a href="/vendor/register" className="font-semibold text-zinc-700 underline underline-offset-2">
            Register as a food vendor
          </a>
        </p>
      </form>
    </div>
  );
}
