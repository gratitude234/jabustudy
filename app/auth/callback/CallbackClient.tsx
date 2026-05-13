// app/auth/callback/CallbackClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  ArrowRight,
} from "lucide-react";

type Phase = "loading" | "success" | "error";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeNext(next: string | null) {
  const n = (next ?? "").trim();
  if (!n) return "/me";

  if (!n.startsWith("/")) return "/me";
  if (n.startsWith("//")) return "/me";

  let decoded = n;
  try {
    decoded = decodeURIComponent(n);
  } catch {
    decoded = n;
  }

  const lowered = decoded.toLowerCase();
  if (lowered.includes("http://") || lowered.includes("https://")) return "/me";

  return n;
}

function mapAuthError(msg: string) {
  const m = (msg || "").toLowerCase();

  if (m.includes("invalid") && m.includes("code")) return "This sign-in link is invalid or has expired.";
  if (m.includes("expired")) return "This sign-in link has expired. Please request a new one.";
  if (m.includes("auth session missing") || m.includes("session missing"))
    return "We couldn’t create a session. Try enabling cookies, then try again.";
  if (m.includes("network") || m.includes("fetch")) return "Network error. Check your connection and try again.";

  return msg || "Sign-in failed. Please try again.";
}

export default function CallbackClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => normalizeNext(sp.get("next")), [sp]);
  const code = useMemo(() => sp.get("code"), [sp]);

  const didRunRef = useRef(false);
  const aliveRef = useRef(true);

  const [phase, setPhase] = useState<Phase>("loading");
  const [title, setTitle] = useState("Signing you in…");
  const [detail, setDetail] = useState("Verifying your sign-in link and creating a secure session.");
  const [errorText, setErrorText] = useState<string | null>(null);

  async function run() {
    if (didRunRef.current) return;
    didRunRef.current = true;

    setPhase("loading");
    setErrorText(null);
    setTitle("Signing you in…");
    setDetail("Verifying your sign-in link and creating a secure session.");

    try {
      // If code exists, exchange FIRST (more reliable)
      if (code) {
        setDetail("Creating your session…");
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) throw exchangeErr;
      }

      // Then confirm we have a session
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!data.session) {
        throw new Error("No session found. Your link may be expired or already used.");
      }

      setPhase("success");
      setTitle("Signed in ✅");
      setDetail("Redirecting you now…");

      // Tiny delay for smoother UX
      await new Promise((r) => setTimeout(r, 200));

      router.replace(next || "/me");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      const friendly = mapAuthError(e?.message ?? "");
      if (!aliveRef.current) return;

      setPhase("error");
      setTitle("Sign-in failed");
      setDetail(friendly);
      setErrorText(friendly);
    }
  }

  function retry() {
    didRunRef.current = false;
    run().catch(() => {});
  }

  useEffect(() => {
    aliveRef.current = true;
    run().catch(() => {});

    return () => {
      aliveRef.current = false;
    };
    // Only re-run if these change (stable values)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, next]);

  const icon =
    phase === "success" ? (
      <CheckCircle2 className="h-5 w-5 text-zinc-800" />
    ) : phase === "error" ? (
      <AlertTriangle className="h-5 w-5 text-zinc-800" />
    ) : (
      <ShieldCheck className="h-5 w-5 text-zinc-800" />
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-3xl border bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border bg-zinc-50">{icon}</div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
                {phase === "loading" ? <Loader2 className="h-4 w-4 animate-spin text-zinc-700" /> : null}
              </div>
              <p className="mt-1 text-sm text-zinc-600">{detail}</p>
            </div>
          </div>

          {/* Actions */}
          {phase === "error" ? (
            <div className="mt-5 space-y-2">
              <button
                onClick={retry}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                <RefreshCcw className="h-4 w-4" />
                Try again
              </button>

              <Link
                href={`/login?next=${encodeURIComponent(next || "/me")}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 no-underline"
              >
                Go to login
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 no-underline"
              >
                Go home
              </Link>

              {errorText ? (
                <div className="rounded-2xl border bg-zinc-50 p-3 text-xs text-zinc-700">
                  Tip: If this keeps failing, open the link in the same browser you used to request it, and make sure
                  cookies are enabled.
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === "loading" ? (
            <div className="mt-5 space-y-2">
              <div className="rounded-2xl border bg-zinc-50 p-3 text-xs text-zinc-700">
                This usually takes a moment. Please don’t close this page.
              </div>
            </div>
          ) : null}

          {phase === "success" ? (
            <div className="mt-5">
              <Link
                href={next || "/me"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 no-underline"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </div>

        <p className="text-center text-[11px] text-zinc-500">
          Secure sign-in flow • If you see an error, try requesting a new link from Login.
        </p>
      </div>
    </div>
  );
}
