'use client';
// app/rider/login/page.tsx
// Rider authentication — sign up / log in, then link to existing rider profile

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, Truck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'auth' | 'link' | 'done';

function normalizePhone(s: string) {
  return s.replace(/[^\d]/g, '');
}

export default function RiderLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('auth');

  // Auth step
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState<string | null>(null);

  // Link step
  const [phone, setPhone]           = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError]     = useState<string | null>(null);
  const [riderName, setRiderName]     = useState<string | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }

      setStep('link');
    } catch (err: any) {
      setAuthError(err.message ?? 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setLinkError(null);
    setLinkLoading(true);

    try {
      const res = await fetch('/api/rider/link-account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: normalizePhone(phone) }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to link account');

      setRiderName(json.rider?.name ?? 'Rider');
      setStep('done');
    } catch (err: any) {
      setLinkError(err.message ?? 'Something went wrong');
    } finally {
      setLinkLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-8 pb-28">
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          <h1 className="text-xl font-bold text-zinc-900">
            Welcome, {riderName}!
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your account is linked. You'll now receive push notifications for new
            delivery jobs.
          </p>
          <button
            type="button"
            onClick={() => router.replace('/rider/dashboard')}
            className="mt-6 w-full rounded-2xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Go to dashboard →
          </button>
        </div>
      </div>
    );
  }

  if (step === 'link') {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-8 pb-28">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep('auth')}
            className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Link your rider profile</h1>
            <p className="text-xs text-zinc-500">Enter the phone number you registered with</p>
          </div>
        </div>

        <form onSubmit={handleLink} className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-sm text-zinc-600">
            Enter the phone number that was used when you applied to become a rider.
            This links your new account to your existing profile.
          </p>

          <input
            type="tel"
            inputMode="tel"
            placeholder="e.g. 08012345678"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setLinkError(null); }}
            className="w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
            required
          />

          {linkError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {linkError}
            </p>
          )}

          <button
            type="submit"
            disabled={linkLoading || normalizePhone(phone).length < 10}
            className={cn(
              'w-full rounded-2xl py-3 text-sm font-semibold transition',
              linkLoading || normalizePhone(phone).length < 10
                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                : 'bg-zinc-900 text-white hover:bg-zinc-700'
            )}
          >
            {linkLoading
              ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Linking…</span>
              : 'Link my profile'}
          </button>
        </form>
      </div>
    );
  }

  // Auth step
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8 pb-28">
      <div className="flex items-center gap-3">
        <Link
          href="/delivery"
          className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Rider account</h1>
          <p className="text-xs text-zinc-500">Sign in to manage your deliveries</p>
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-100">
            <Truck className="h-5 w-5 text-zinc-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {authMode === 'login' ? 'Sign in to your rider account' : 'Create a rider account'}
            </p>
            <p className="text-xs text-zinc-500">
              {authMode === 'login'
                ? 'Use the email you signed up with'
                : 'Use your email to create an account'}
            </p>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
            className="w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
            className="w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
            required
            autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
          />

          {authError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={authLoading || !email.trim() || password.length < 6}
            className={cn(
              'w-full rounded-2xl py-3 text-sm font-semibold transition',
              authLoading || !email.trim() || password.length < 6
                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                : 'bg-zinc-900 text-white hover:bg-zinc-700'
            )}
          >
            {authLoading
              ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {authMode === 'login' ? 'Signing in…' : 'Creating account…'}</span>
              : authMode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setAuthMode(m => m === 'login' ? 'signup' : 'login'); setAuthError(null); }}
          className="mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-900"
        >
          {authMode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </div>

      <div className="rounded-3xl border bg-zinc-50 p-4">
        <p className="text-xs font-semibold text-zinc-700">Not a rider yet?</p>
        <p className="mt-1 text-xs text-zinc-500">
          Apply to join the delivery team — admin will review and add you.
        </p>
        <Link
          href="/rider/apply"
          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white no-underline hover:bg-zinc-800"
        >
          <Truck className="h-3.5 w-3.5" />
          Apply as a rider
        </Link>
      </div>
    </div>
  );
}
