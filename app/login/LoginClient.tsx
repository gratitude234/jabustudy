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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeNext(next: string | null) {
  const n = (next ?? "").trim();
  if (!n) return "/";

  // Only allow internal, absolute-path routes
  if (!n.startsWith("/")) return "/";
  if (n.startsWith("//")) return "/";
  // Block attempts to smuggle protocol via encoding
  const lowered = decodeURIComponent(n).toLowerCase();
  if (lowered.includes("http://") || lowered.includes("https://")) return "/";

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
      router.replace(next || "/");
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
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/me")}`
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
      <div className="rounded-3xl border bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border bg-zinc-50">
            <ShieldCheck className="h-5 w-5 text-zinc-800" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-zinc-900">Sign in</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Secure access to your account and seller dashboard.
            </p>
          </div>
        </div>
      </div>

      <BannerView banner={banner} onClose={() => setBanner(null)} />

      {/* Form */}
      <div className="rounded-3xl border bg-white p-4 sm:p-5">
        <form onSubmit={signInPassword} className="space-y-4">
          {/* Email */}
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-medium text-zinc-700">
              Email
            </label>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10">
              <Mail className="h-4 w-4 text-zinc-500" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || resetLoading}
                className="w-full bg-transparent text-sm outline-none disabled:opacity-70"
                placeholder="you@example.com"
              />
            </div>
            {!emailValid && email.trim().length > 0 ? (
              <p className="text-[11px] text-rose-700">Enter a valid email address.</p>
            ) : (
              <p className="text-[11px] text-zinc-500">We’ll never share your email.</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-medium text-zinc-700">
              Password
            </label>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10">
              <KeyRound className="h-4 w-4 text-zinc-500" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || resetLoading}
                onKeyUp={(e) => setCapsLock((e as any).getModifierState?.("CapsLock") ?? false)}
                className="w-full bg-transparent text-sm outline-none disabled:opacity-70"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                disabled={loading || resetLoading}
                className="rounded-xl border bg-white p-2 text-zinc-700 hover:bg-zinc-50 disabled:opacity-70"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-zinc-500">
                {capsLock ? <span className="text-amber-700">Caps Lock is ON</span> : "Minimum 6 characters."}
              </p>

              <button
                type="button"
                onClick={forgotPassword}
                disabled={resetLoading || loading}
                className="text-[11px] font-medium text-zinc-900 underline underline-offset-4 disabled:opacity-60"
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
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90",
              (loading || resetLoading) && "opacity-70"
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign in"}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          {/* Footer links */}
          <div className="pt-1 text-center">
            <p className="text-xs text-zinc-600">
              New here?{" "}
              <Link href="/signup" className="font-semibold text-zinc-900 underline underline-offset-4">
                Create an account
              </Link>
            </p>
          </div>
        </form>
      </div>

      {/* Tiny helper footer */}
      <p className="text-center text-[11px] text-zinc-500">
        By signing in, you agree to keep your account secure. If you have issues, try another browser or enable cookies.
      </p>
    </div>
  );
}
