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
const DEFAULT_SIGNUP_DESTINATION = "/study/onboarding?next=/study";
const DEFAULT_LOGIN_DESTINATION = "/study";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeNext(next: string | null) {
  const n = (next ?? "").trim();
  if (!n) return DEFAULT_SIGNUP_DESTINATION;
  if (!n.startsWith("/")) return DEFAULT_SIGNUP_DESTINATION;
  if (n.startsWith("//")) return DEFAULT_SIGNUP_DESTINATION;
  const lowered = decodeURIComponent(n).toLowerCase();
  if (lowered.includes("http://") || lowered.includes("https://")) return DEFAULT_SIGNUP_DESTINATION;
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
  const jabuEmail     = /@(?:[a-z0-9-]+\.)*jabu\.edu\.ng$/i.test(email.trim());
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
        router.replace(next || DEFAULT_SIGNUP_DESTINATION);
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
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-primary-light">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-[family-name:var(--font-bricolage)] text-2xl font-extrabold text-foreground">
            Confirm your email
          </h1>
          <p className="mt-1.5 text-sm text-muted-brand">
            We sent a link to{" "}
            <span className="font-bold text-foreground">{sentTo ? maskEmail(sentTo) : "your email"}</span>.
          </p>
        </div>

        <div className="rounded-[26px] border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="rounded-[14px] border border-border bg-background p-3">
            <p className="text-sm text-muted-brand">
              Open your email and tap the link to finish creating your account. Check spam if you don't see it.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={resendConfirmation} disabled={loading || cooldown > 0}
              className={cx("inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-primary-light sm:w-auto transition",
                (loading || cooldown > 0) && "opacity-60")}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            </button>
            <button type="button" onClick={() => { setPendingConfirm(false); setSentTo(null); setCooldown(0); setBanner(null); }}
              disabled={loading} className="text-sm font-semibold text-muted-brand underline underline-offset-4 disabled:opacity-60">
              Wrong email?
            </button>
          </div>
          <Link href={`/login?next=${encodeURIComponent(DEFAULT_LOGIN_DESTINATION)}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-4 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(91,53,213,0.3)] hover:opacity-90 no-underline transition">
            Go to login <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <BannerView banner={banner} onClose={() => setBanner(null)} />
        <p className="text-center text-[11px] text-muted-brand/70">
          If confirmation links fail, open them in the same browser you used to sign up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-bricolage)] text-2xl font-extrabold text-foreground">
          Create account
        </h1>
        <p className="mt-1.5 text-sm text-muted-brand">
          Join with your JABU student email for the best experience.
        </p>
      </div>

      <BannerView banner={banner} onClose={() => setBanner(null)} />

      <div className="rounded-[26px] border border-border bg-card p-5 shadow-sm">
        <form onSubmit={signup} className="space-y-4">
          {/* Full name */}
          <div className="space-y-1.5">
            <label htmlFor="fullname" className="text-xs font-semibold text-muted-brand">Full name</label>
            <div className="flex items-center gap-2 rounded-[14px] border border-border bg-background px-3 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition">
              <User className="h-4 w-4 shrink-0 text-muted-brand" />
              <input id="fullname" type="text" autoComplete="name" value={fullName}
                onChange={(e) => setFullName(e.target.value)} disabled={loading}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand/50 disabled:opacity-70"
                placeholder="e.g. Adeola Bello" />
            </div>
            {!nameValid && fullName.trim().length > 0
              ? <p className="text-[11px] text-rose-600">Enter at least 2 characters.</p>
              : <p className="text-[11px] text-muted-brand/70">This is how you appear across Jabu Study.</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-muted-brand">Email</label>
            <div className="flex items-center gap-2 rounded-[14px] border border-border bg-background px-3 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition">
              <Mail className="h-4 w-4 shrink-0 text-muted-brand" />
              <input id="email" type="email" inputMode="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand/50 disabled:opacity-70"
                placeholder="you@jabu.edu.ng" />
            </div>
            {!emailValid && email.trim().length > 0
              ? <p className="text-[11px] text-rose-600">Enter a valid email address.</p>
              : email.trim().length > 0 && !jabuEmail
                ? <p className="text-[11px] text-amber-700">A JABU email is recommended so your account feels more trusted on campus.</p>
                : jabuEmail
                  ? <p className="text-[11px] text-emerald-700">Great - your JABU email helps classmates recognize you.</p>
                  : <p className="text-[11px] text-muted-brand/70">Use your JABU student email if you have one. We don't share it.</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-muted-brand">Password</label>
            <div className="flex items-center gap-2 rounded-[14px] border border-border bg-background px-3 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition">
              <KeyRound className="h-4 w-4 shrink-0 text-muted-brand" />
              <input id="password" type={showPw ? "text" : "password"} autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand/50 disabled:opacity-70"
                placeholder="Create a password" />
              <button type="button" onClick={() => setShowPw((s) => !s)} disabled={loading}
                className="rounded-lg p-1.5 text-muted-brand hover:bg-primary-light disabled:opacity-70"
                aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!passwordValid && password.trim().length > 0
              ? <p className="text-[11px] text-rose-600">Minimum 6 characters.</p>
              : <p className="text-[11px] text-muted-brand/70">Use at least 6 characters.</p>}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-xs font-semibold text-muted-brand">Confirm password</label>
            <div className="flex items-center gap-2 rounded-[14px] border border-border bg-background px-3 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition">
              <KeyRound className="h-4 w-4 shrink-0 text-muted-brand" />
              <input id="confirm" type={showCf ? "text" : "password"} autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand/50 disabled:opacity-70"
                placeholder="Re-enter password" />
              <button type="button" onClick={() => setShowCf((s) => !s)} disabled={loading}
                className="rounded-lg p-1.5 text-muted-brand hover:bg-primary-light disabled:opacity-70"
                aria-label={showCf ? "Hide" : "Show"}>
                {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!confirmOk && <p className="text-[11px] text-rose-600">Passwords don't match.</p>}
          </div>

          <button type="submit" disabled={loading}
            className={cx(
              "inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-4 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(91,53,213,0.3)] hover:opacity-90 transition",
              loading && "opacity-70"
            )}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Creating…" : "Create account"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          <p className="pt-1 text-center text-xs text-muted-brand">
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(DEFAULT_LOGIN_DESTINATION)}`}
              className="font-bold text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>
      </div>

      <p className="text-center text-[11px] text-muted-brand/70">
        By creating an account you agree to keep your login details secure.
      </p>
    </div>
  );
}
