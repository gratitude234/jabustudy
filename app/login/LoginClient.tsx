// app/login/LoginClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  X,
} from "lucide-react";

type Banner = { type: "success" | "error" | "info"; text: string } | null;
const DEFAULT_LOGIN_DESTINATION = "/study";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeNext(next: string | null) {
  const n = (next ?? "").trim();
  if (!n) return DEFAULT_LOGIN_DESTINATION;

  // Only allow internal, absolute-path routes
  if (!n.startsWith("/")) return DEFAULT_LOGIN_DESTINATION;
  if (n.startsWith("//")) return DEFAULT_LOGIN_DESTINATION;
  // Block attempts to smuggle protocol via encoding
  const lowered = decodeURIComponent(n).toLowerCase();
  if (lowered.includes("http://") || lowered.includes("https://")) return DEFAULT_LOGIN_DESTINATION;

  return n;
}

function mapAuthError(msg: string) {
  const m = (msg || "").toLowerCase();

  if (m.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed"))
    return "Your email isn’t confirmed yet. Please confirm it or resend a confirmation email.";
  if (m.includes("auth session missing") || m.includes("session missing"))
    return "Your session couldn’t be created. Try enabling cookies, then sign in again.";
  if (m.includes("network") || m.includes("fetch")) return "Network error. Check your connection and try again.";

  return msg || "Something went wrong. Please try again.";
}

function BannerView({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  if (!banner) return null;

  const base = "rounded-2xl border p-3 text-sm flex items-start justify-between gap-3";
  const tone =
    banner.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : banner.type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-zinc-200 bg-zinc-50 text-zinc-800";

  return (
    <div className={cx(base, tone)} role="status" aria-live="polite">
      <span>{banner.text}</span>
      <button
        onClick={onClose}
        className="rounded-xl border bg-white/70 p-2 text-current hover:bg-white"
        aria-label="Close message"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => normalizeNext(sp.get("next")), [sp]);

  const alive = useRef(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  // Forgot password
  const [resetLoading, setResetLoading] = useState(false);

  // Caps lock warning
  const [capsLock, setCapsLock] = useState(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Auto-dismiss banners (keeps UI clean)
  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), 5500);
    return () => window.clearTimeout(id);
  }, [banner]);

  const emailValid = useMemo(() => {
    const e = email.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }, [email]);

  const passwordValid = useMemo(() => password.trim().length >= 6, [password]);

  function setToast(next: Banner) {
    setBanner(next);
  }

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);

    const em = email.trim();
    if (!emailValid) {
      setToast({ type: "error", text: "Enter a valid email address." });
      return;
    }
    if (!passwordValid) {
      setToast({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: em,
        password,
      });

      if (error) {
        setToast({ type: "error", text: mapAuthError(error.message) });
        return;
      }

      setToast({ type: "success", text: "Welcome back ✅" });
      router.replace(next || DEFAULT_LOGIN_DESTINATION);
      router.refresh();
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  async function forgotPassword() {
    setBanner(null);

    const em = email.trim();
    if (!emailValid) {
      setToast({ type: "error", text: "Enter your email first, then tap ‘Forgot password’." });
      return;
    }

    setResetLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(DEFAULT_LOGIN_DESTINATION)}`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo });

      if (error) {
        setToast({ type: "error", text: mapAuthError(error.message) });
        return;
      }

      setToast({ type: "success", text: "Password reset email sent ✅" });
    } finally {
      if (alive.current) setResetLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Brand header */}
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-primary shadow-[0_8px_32px_rgba(91,53,213,0.35)]">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <h1 className="font-[family-name:var(--font-bricolage)] text-2xl font-extrabold text-foreground">
          Sign in
        </h1>
        <p className="mt-1.5 text-sm text-muted-brand">Secure access to your Jabu Study account.</p>
      </div>

      <BannerView banner={banner} onClose={() => setBanner(null)} />

      {/* Form card */}
      <div className="rounded-[26px] border border-border bg-card p-5 shadow-sm">
        <form onSubmit={signInPassword} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-muted-brand">
              Email
            </label>
            <div className="flex items-center gap-2 rounded-[14px] border border-border bg-background px-3 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition">
              <Mail className="h-4 w-4 shrink-0 text-muted-brand" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || resetLoading}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand/50 disabled:opacity-70"
                placeholder="you@jabu.edu.ng"
              />
            </div>
            {!emailValid && email.trim().length > 0 ? (
              <p className="text-[11px] text-rose-600">Enter a valid email address.</p>
            ) : (
              <p className="text-[11px] text-muted-brand/70">We’ll never share your email.</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-muted-brand">
              Password
            </label>
            <div className="flex items-center gap-2 rounded-[14px] border border-border bg-background px-3 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition">
              <KeyRound className="h-4 w-4 shrink-0 text-muted-brand" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || resetLoading}
                onKeyUp={(e) => setCapsLock((e as any).getModifierState?.("CapsLock") ?? false)}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand/50 disabled:opacity-70"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                disabled={loading || resetLoading}
                className="rounded-lg p-1.5 text-muted-brand hover:bg-primary-light disabled:opacity-70"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-brand/70">
                {capsLock ? <span className="text-amber-600">Caps Lock is ON</span> : "Minimum 6 characters."}
              </p>
              <button
                type="button"
                onClick={forgotPassword}
                disabled={resetLoading || loading}
                className="text-[11px] font-semibold text-primary underline underline-offset-4 disabled:opacity-60"
              >
                {resetLoading ? "Sending…" : "Forgot password?"}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || resetLoading}
            className={cx(
              "inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-4 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(91,53,213,0.3)] hover:opacity-90 transition",
              (loading || resetLoading) && "opacity-70"
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign in"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          {/* Footer link */}
          <p className="pt-1 text-center text-xs text-muted-brand">
            New here?{" "}
            <Link href="/signup" className="font-bold text-foreground underline underline-offset-4 no-underline hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>

      <p className="text-center text-[11px] text-muted-brand/70">
        By signing in, you agree to keep your account secure.
      </p>
    </div>
  );
}
