"use client";
// app/signup/SignupClient.tsx
// Collects name + email + password. Writes full_name to profiles on signup.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Mail, KeyRound, Eye, EyeOff, Loader2, ArrowRight,
  User, X, RefreshCw, CheckCircle2,
} from "lucide-react";

type Banner = { type: "success" | "error" | "info"; text: string } | null;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeNext(next: string | null) {
  const n = (next ?? "").trim();
  if (!n) return "/me";
  if (!n.startsWith("/")) return "/me";
  if (n.startsWith("//")) return "/me";
  const lowered = decodeURIComponent(n).toLowerCase();
  if (lowered.includes("http://") || lowered.includes("https://")) return "/me";
  return n;
}

function mapAuthError(msg: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("user already registered") || m.includes("already registered"))
    return "This email already has an account. Try logging in instead.";
  if (m.includes("email address") && m.includes("invalid")) return "That email address doesn't look valid.";
  if (m.includes("password") && m.includes("weak")) return "Choose a stronger password.";
  if (m.includes("network") || m.includes("fetch")) return "Network error. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}

function BannerView({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  if (!banner) return null;
  const base = "rounded-2xl border p-3 text-sm flex items-start justify-between gap-3";
  const tone =
    banner.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
    banner.type === "error"   ? "border-rose-200 bg-rose-50 text-rose-800" :
                                "border-zinc-200 bg-zinc-50 text-zinc-800";
  return (
    <div className={cx(base, tone)} role="status" aria-live="polite">
      <span>{banner.text}</span>
      <button onClick={onClose}
        className="rounded-xl border bg-white/70 p-2 text-current hover:bg-white" aria-label="Close">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  if (!d) return email;
  return `${u.slice(0, 2)}${u.length > 2 ? "***" : ""}@${d}`;
}

export default function SignupClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => normalizeNext(sp.get("next")), [sp]);
  const alive = useRef(true);

  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [banner, setBanner]       = useState<Banner>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [sentTo, setSentTo]       = useState<string | null>(null);
  const [cooldown, setCooldown]   = useState(0);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), 5500);
    return () => window.clearTimeout(id);
  }, [banner]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const nameValid     = fullName.trim().length >= 2;
  const emailValid    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.trim().length >= 6;
  const confirmOk     = !confirm.trim() || confirm === password;

  function toast(next: Banner) { setBanner(next); }

  async function upsertProfile(userId: string, name: string, userEmail: string) {
    try {
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: name.trim(),
        email: userEmail.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    } catch {
      // Non-critical — profile name is cosmetic, don't block signup
    }
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);

    const em = email.trim();
    const nm = fullName.trim();

    if (!nameValid)       return toast({ type: "error", text: "Please enter your name." });
    if (!emailValid)      return toast({ type: "error", text: "Enter a valid email address." });
    if (!passwordValid)   return toast({ type: "error", text: "Password must be at least 6 characters." });
    if (confirm !== password) return toast({ type: "error", text: "Passwords do not match." });

    setLoading(true);
    try {
      const emailRedirectTo = typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: em,
        password,
        options: {
          emailRedirectTo,
          data: { full_name: nm },
        },
      });

      if (error) { toast({ type: "error", text: mapAuthError(error.message) }); return; }

      // Session immediately available (email confirm disabled in Supabase settings)
      if (data.session && data.user) {
        await upsertProfile(data.user.id, nm, em);
        toast({ type: "success", text: "Account created ✅ Redirecting…" });
        router.replace(next || "/me");
        router.refresh();
        return;
      }

      // Email confirmation required
      setPendingConfirm(true);
      setSentTo(em);
      setCooldown(30);
      toast({ type: "success", text: "Confirmation email sent. Check your inbox." });
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (cooldown > 0) return;
    setBanner(null);
    const em = email.trim();
    if (!emailValid) return toast({ type: "error", text: "Enter a valid email address." });
    setLoading(true);
    try {
      const emailRedirectTo = typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        : undefined;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: em,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });
      if (error) { toast({ type: "error", text: mapAuthError(error.message) }); return; }
      setCooldown(30);
      toast({ type: "success", text: "Confirmation email re-sent ✅" });
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  if (pendingConfirm) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border bg-zinc-50">
              <CheckCircle2 className="h-5 w-5 text-zinc-800" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-zinc-900">Confirm your email</h1>
              <p className="mt-1 text-sm text-zinc-600">
                We sent a confirmation link to{" "}
                <span className="font-semibold text-zinc-900">{sentTo ? maskEmail(sentTo) : "your email"}</span>.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border bg-zinc-50 p-3">
            <p className="text-sm text-zinc-700">
              Open your email and tap the link to finish creating your account. Check spam if you don't see it.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={resendConfirmation} disabled={loading || cooldown > 0}
              className={cx("inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 sm:w-auto",
                (loading || cooldown > 0) && "opacity-60")}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            </button>
            <button type="button" onClick={() => { setPendingConfirm(false); setSentTo(null); setCooldown(0); setBanner(null); }}
              disabled={loading} className="text-sm font-medium text-zinc-700 underline underline-offset-4 disabled:opacity-60">
              Wrong email?
            </button>
          </div>
          <div className="mt-4">
            <Link href={`/login?next=${encodeURIComponent(next || "/me")}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 no-underline">
              Go to login <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <BannerView banner={banner} onClose={() => setBanner(null)} />
        <p className="text-center text-[11px] text-zinc-500">
          If confirmation links fail, open them in the same browser you used to sign up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border bg-white p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-zinc-900">Create your account</h1>
        <p className="mt-1 text-sm text-zinc-600">
          For students buying, selling, or ordering food on campus.
        </p>
      </div>

      <BannerView banner={banner} onClose={() => setBanner(null)} />

      <div className="rounded-3xl border bg-white p-4 sm:p-5">
        <form onSubmit={signup} className="space-y-4">
          {/* Full name */}
          <div className="space-y-1">
            <label htmlFor="fullname" className="text-xs font-medium text-zinc-700">Full name</label>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10">
              <User className="h-4 w-4 text-zinc-500" />
              <input id="fullname" type="text" autoComplete="name" value={fullName}
                onChange={(e) => setFullName(e.target.value)} disabled={loading}
                className="w-full bg-transparent text-sm outline-none disabled:opacity-70"
                placeholder="e.g. Adeola Bello" />
            </div>
            {!nameValid && fullName.trim().length > 0
              ? <p className="text-[11px] text-rose-700">Enter at least 2 characters.</p>
              : <p className="text-[11px] text-zinc-500">This is how you appear to vendors.</p>}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-medium text-zinc-700">Email</label>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10">
              <Mail className="h-4 w-4 text-zinc-500" />
              <input id="email" type="email" inputMode="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}
                className="w-full bg-transparent text-sm outline-none disabled:opacity-70"
                placeholder="you@example.com" />
            </div>
            {!emailValid && email.trim().length > 0
              ? <p className="text-[11px] text-rose-700">Enter a valid email address.</p>
              : <p className="text-[11px] text-zinc-500">We don't share your email.</p>}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-medium text-zinc-700">Password</label>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10">
              <KeyRound className="h-4 w-4 text-zinc-500" />
              <input id="password" type={showPw ? "text" : "password"} autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
                className="w-full bg-transparent text-sm outline-none disabled:opacity-70"
                placeholder="Create a password" />
              <button type="button" onClick={() => setShowPw((s) => !s)} disabled={loading}
                className="rounded-xl border bg-white p-2 text-zinc-700 hover:bg-zinc-50 disabled:opacity-70"
                aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!passwordValid && password.trim().length > 0
              ? <p className="text-[11px] text-rose-700">Minimum 6 characters.</p>
              : <p className="text-[11px] text-zinc-500">Use at least 6 characters.</p>}
          </div>

          {/* Confirm password */}
          <div className="space-y-1">
            <label htmlFor="confirm" className="text-xs font-medium text-zinc-700">Confirm password</label>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10">
              <KeyRound className="h-4 w-4 text-zinc-500" />
              <input id="confirm" type={showCf ? "text" : "password"} autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading}
                className="w-full bg-transparent text-sm outline-none disabled:opacity-70"
                placeholder="Re-enter password" />
              <button type="button" onClick={() => setShowCf((s) => !s)} disabled={loading}
                className="rounded-xl border bg-white p-2 text-zinc-700 hover:bg-zinc-50 disabled:opacity-70"
                aria-label={showCf ? "Hide" : "Show"}>
                {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!confirmOk && <p className="text-[11px] text-rose-700">Passwords don't match.</p>}
          </div>

          <button type="submit" disabled={loading}
            className={cx(
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90",
              loading && "opacity-70"
            )}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Creating…" : "Create account"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          <div className="pt-1 text-center">
            <p className="text-xs text-zinc-600">
              Already have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent(next || "/me")}`}
                className="font-semibold text-zinc-900 underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>

      <p className="text-center text-[11px] text-zinc-500">
        By creating an account you agree to keep your login details secure.
      </p>
    </div>
  );
}