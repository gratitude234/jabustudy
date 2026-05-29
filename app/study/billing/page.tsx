"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import StudyTabs from "../_components/StudyTabs";

type Plan = {
  key: string;
  productType: "plus" | "credits";
  label: string;
  amountNaira: number;
  credits: number;
  plusDays: number | null;
};

type BillingOrder = {
  id: string;
  planKey: string;
  planLabel: string;
  amountNaira: number;
  credits: number;
  plusDays: number | null;
  reference: string;
  status: "pending_payment" | "pending_review" | "approved" | "rejected" | "cancelled";
  receiptPath: string | null;
  senderName: string | null;
  senderBank: string | null;
  transactionReference: string | null;
  createdAt: string;
  expiresAt: string;
  adminNote: string | null;
  paymentMethod: "manual" | "paystack";
  paystackReference: string | null;
};

type BillingSnapshot = {
  ok: boolean;
  plus: { active: boolean; planKey: string | null; activeUntil: string | null };
  credits: { balance: number };
  freeAi: { limit: number; used: number; remaining: number; periodKey: string };
  practice: { limit: number | null; used: number; remaining: number | null; activityDate: string };
  bank: { bankName: string; accountNumber: string; accountName: string };
  plans: Plan[];
  orders: BillingOrder[];
};

type SignedUploadClient = {
  uploadToSignedUrl: (path: string, token: string, file: File) => Promise<{ error: { message?: string } | null }>;
};

function money(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function expiryLabel(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: "Expired", urgent: true };
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return { text: "< 1 hour left", urgent: true };
  if (h < 2) return { text: `${h}h left`, urgent: true };
  if (h < 24) return { text: `${h}h left to pay`, urgent: false };
  return { text: `${Math.floor(h / 24)}d left to pay`, urgent: false };
}

function statusBadge(status: BillingOrder["status"]) {
  const map: Record<BillingOrder["status"], { label: string; cls: string }> = {
    pending_payment: { label: "Awaiting payment", cls: "bg-secondary text-muted-foreground" },
    pending_review: { label: "Under review", cls: "bg-amber-100 text-amber-700" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "Rejected", cls: "bg-rose-100 text-rose-700" },
    cancelled: { label: "Cancelled", cls: "bg-secondary text-muted-foreground" },
  };
  const { label, cls } = map[status] ?? map.cancelled;
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>{label}</span>;
}

const PAYSTACK_ENABLED = process.env.NEXT_PUBLIC_PAYSTACK_ENABLED === "true";

export default function StudyBillingPage() {
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [paystackRef, setPaystackRef] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<"idle" | "polling" | "done" | "failed">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [txRef, setTxRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 4000);
  }

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    });
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/me", { cache: "no-store" });
      const data = await res.json().catch(() => null) as BillingSnapshot | null;
      if (res.status === 401) { window.location.href = `/login?next=${encodeURIComponent("/study/billing")}`; return; }
      if (!res.ok || !data?.ok) throw new Error((data as { message?: string } | null)?.message ?? "Could not load billing.");
      setSnapshot(data);
      const pending = data.orders.find((o) => o.status === "pending_payment");
      setCheckoutOrderId((cur) => cur ?? pending?.id ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not load billing.", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) setPaystackRef(ref);
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!paystackRef || pollStatus !== "idle") return;
    setPollStatus("polling");
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/billing/orders/status?ref=${encodeURIComponent(paystackRef)}`);
        const data = await res.json().catch(() => null) as { ok?: boolean; order?: BillingOrder } | null;
        if (data?.ok && data.order?.status === "approved") {
          window.clearInterval(interval);
          history.replaceState(null, "", window.location.pathname);
          setPollStatus("done");
          await load();
        } else if (attempts >= 15) {
          window.clearInterval(interval);
          setPollStatus("failed");
        }
      } catch {
        if (attempts >= 15) {
          window.clearInterval(interval);
          setPollStatus("failed");
        }
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [paystackRef, pollStatus]);

  const plusPlans = useMemo(() => snapshot?.plans.filter((p) => p.productType === "plus") ?? [], [snapshot]);
  const creditPlans = useMemo(() => snapshot?.plans.filter((p) => p.productType === "credits") ?? [], [snapshot]);
  const checkoutOrder = snapshot?.orders.find((o) => o.id === checkoutOrderId) ?? null;
  const hasPendingOrder = snapshot?.orders.some((o) => o.status === "pending_payment" || o.status === "pending_review") ?? false;

  async function choosePlan(planKey: string) {
    const existing = snapshot?.orders.find(
      (o) => o.planKey === planKey && (o.status === "pending_payment" || o.status === "pending_review")
    );
    if (existing) { setCheckoutOrderId(existing.id); return; }

    setBusyPlan(planKey);
    try {
      const res = await fetch("/api/billing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json().catch(() => null) as { ok?: boolean; order?: BillingOrder; message?: string } | null;
      if (!res.ok || !data?.ok || !data.order) throw new Error(data?.message ?? "Could not create order.");
      await load();
      setCheckoutOrderId(data.order.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not create order.", "err");
    } finally {
      setBusyPlan(null);
    }
  }

  async function payWithPaystack(planKey: string) {
    setBusyPlan(planKey + "_ps");
    try {
      const res = await fetch("/api/billing/orders/paystack/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json().catch(() => null) as { ok?: boolean; authorizationUrl?: string; message?: string } | null;
      if (!res.ok || !data?.ok || !data.authorizationUrl) throw new Error(data?.message ?? "Could not initialize payment.");
      window.location.href = data.authorizationUrl;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Payment failed.", "err");
      setBusyPlan(null);
    }
  }

  async function cancelOrder(orderId: string) {
    setCancellingId(orderId);
    try {
      const res = await fetch(`/api/billing/orders/${orderId}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Could not cancel.");
      setCheckoutOrderId(null);
      showToast("Order cancelled.");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not cancel.", "err");
    } finally {
      setCancellingId(null);
    }
  }

  async function submitReceipt() {
    if (!checkoutOrder) return;
    if (!file) { showToast("Choose your receipt screenshot or PDF first.", "err"); return; }
    if (!senderName.trim()) { showToast("Your account name is required so we can verify the transfer.", "err"); return; }

    setSubmitting(true);
    try {
      const initRes = await fetch(`/api/billing/orders/${checkoutOrder.id}/receipt/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      const init = await initRes.json().catch(() => null) as { ok?: boolean; bucket?: string; path?: string; token?: string; message?: string } | null;
      if (!initRes.ok || !init?.ok || !init.bucket || !init.path || !init.token) throw new Error(init?.message ?? "Could not prepare upload.");

      const storage = supabase.storage.from(init.bucket) as unknown as SignedUploadClient;
      const { error: uploadErr } = await storage.uploadToSignedUrl(init.path, init.token, file);
      if (uploadErr) throw new Error(uploadErr.message ?? "Receipt upload failed.");

      const submitRes = await fetch(`/api/billing/orders/${checkoutOrder.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptPath: init.path, senderName, senderBank, transactionReference: txRef }),
      });
      const submitted = await submitRes.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!submitRes.ok || !submitted?.ok) throw new Error(submitted?.message ?? "Could not submit payment.");

      setFile(null); setSenderName(""); setSenderBank(""); setTxRef("");
      showToast("Receipt submitted! We'll activate your account once confirmed.");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not submit.", "err");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { plus, credits, freeAi, practice } = snapshot ?? {};

  return (
    <div className="space-y-6 pb-24">
      <StudyTabs />

      {/* Toast */}
      {toast ? (
        <div className={cn(
          "fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-lg",
          toast.type === "ok" ? "bg-foreground text-background" : "bg-rose-600 text-white"
        )}>
          {toast.msg}
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Billing</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">Plans & Credits</h1>
        </div>
        <Link href="/study" className="mt-1 shrink-0 text-sm font-semibold text-primary hover:underline">
          ← Back
        </Link>
      </div>

      {/* Paystack payment confirmed banner */}
      {PAYSTACK_ENABLED && pollStatus === "done" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-extrabold text-emerald-800">Payment confirmed!</p>
            <p className="text-xs text-emerald-700">Your access has been activated.</p>
          </div>
        </div>
      ) : null}

      {/* Paystack payment taking too long banner */}
      {PAYSTACK_ENABLED && pollStatus === "failed" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Payment confirmation is taking longer than expected
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            Your payment may still be processing. Refresh to check the latest status.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh page
          </button>
        </div>
      ) : null}

      {/* Current status — compact bar */}
      {snapshot ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-semibold">
            <BadgeCheck className="h-4 w-4 text-primary" />
            {plus?.active ? (
              <span>Plus — expires {formatDate(plus.activeUntil)}</span>
            ) : (
              <span className="text-muted-foreground">Free plan</span>
            )}
          </span>
          <span className="hidden text-border sm:block">|</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            {credits?.balance ?? 0} credit{credits?.balance !== 1 ? "s" : ""}
            {!plus?.active ? <span className="text-xs">({freeAi?.remaining ?? 0} free AI left)</span> : null}
          </span>
          <span className="hidden text-border sm:block">|</span>
          <span className="text-muted-foreground">
            {practice?.limit === null ? "Unlimited practice" : `${practice?.remaining ?? 0}/${practice?.limit} questions today`}
          </span>
        </div>
      ) : null}

      {/* ── Checkout card (when an order is active) ── */}
      {checkoutOrder ? (
        <div className="rounded-2xl border-2 border-primary/30 bg-card shadow-sm">
          {/* Order header */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Complete your payment</p>
              <p className="mt-0.5 text-base font-extrabold text-foreground">{checkoutOrder.planLabel}</p>
            </div>
            <p className="shrink-0 text-xl font-black tabular-nums text-foreground">{money(checkoutOrder.amountNaira)}</p>
          </div>

          {PAYSTACK_ENABLED && checkoutOrder.paymentMethod === "paystack" && checkoutOrder.status === "pending_payment" ? (
            <div className="px-5 py-6 text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="mt-3 text-base font-bold text-foreground">Waiting for Paystack to confirm your payment…</p>
              <p className="mt-1 text-sm text-muted-foreground">This happens automatically. You can safely close this page and come back.</p>
              <button
                type="button"
                onClick={() => cancelOrder(checkoutOrder.id)}
                disabled={cancellingId === checkoutOrder.id}
                className="mt-4 inline-flex items-center gap-1.5 rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
              >
                {cancellingId === checkoutOrder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Cancel order
              </button>
            </div>
          ) : checkoutOrder.status === "pending_review" ? (
            <div className="px-5 py-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 text-base font-bold text-foreground">Receipt submitted</p>
              <p className="mt-1 text-sm text-muted-foreground">We're verifying your transfer. Your access will activate shortly.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Step 1 */}
              <div className="px-5 py-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Step 1 — Transfer to this account</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Bank</p>
                    <p className="mt-0.5 font-extrabold">{snapshot?.bank.bankName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Account name</p>
                    <p className="mt-0.5 font-extrabold">{snapshot?.bank.accountName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Account number</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="font-extrabold tabular-nums">{snapshot?.bank.accountNumber || "—"}</p>
                      {snapshot?.bank.accountNumber ? (
                        <button type="button" onClick={() => copy(snapshot.bank.accountNumber, "acct")} className="rounded-lg p-1 hover:bg-secondary" aria-label="Copy account number">
                          {copied === "acct" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="mt-0.5 font-extrabold">{money(checkoutOrder.amountNaira)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-primary/8 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">Use as transfer narration</p>
                    <button type="button" onClick={() => copy(checkoutOrder.reference, "ref")} className="rounded-lg p-1 text-primary hover:bg-primary/10" aria-label="Copy reference">
                      {copied === "ref" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1 font-black tracking-wider text-foreground">{checkoutOrder.reference}</p>
                </div>

                {(() => { const e = expiryLabel(checkoutOrder.expiresAt); return (
                  <p className={cn("mt-3 text-xs font-semibold", e.urgent ? "text-rose-600" : "text-muted-foreground")}>
                    {e.text}
                  </p>
                ); })()}
              </div>

              {/* Step 2 */}
              <div className="px-5 py-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Step 2 — Upload your receipt</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Receipt screenshot or PDF</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Your account name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Name on your bank account"
                        className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Your bank</label>
                      <input
                        value={senderBank}
                        onChange={(e) => setSenderBank(e.target.value)}
                        placeholder="e.g. GTBank"
                        className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Transfer reference <span className="font-normal">(optional)</span></label>
                    <input
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder="From your banking app"
                      className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 px-5 py-4">
                <button
                  type="button"
                  onClick={submitReceipt}
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  Submit for review
                </button>
                <button
                  type="button"
                  onClick={() => cancelOrder(checkoutOrder.id)}
                  disabled={cancellingId === checkoutOrder.id}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                >
                  {cancellingId === checkoutOrder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Plans ── */}
      {!hasPendingOrder || !checkoutOrder ? (
        <div className="space-y-5">
          {/* Plus */}
          <div>
            <h2 className="mb-3 text-base font-extrabold text-foreground">JabuStudy Plus</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {plusPlans.map((plan) => {
                const isMonthly = plan.key === "plus_monthly";
                return (
                  <div
                    key={plan.key}
                    className={cn(
                      "relative flex flex-col rounded-2xl border p-5 shadow-sm",
                      isMonthly ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                    )}
                  >
                    {isMonthly ? (
                      <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-3 py-0.5 text-[11px] font-extrabold text-primary-foreground">
                        Best value
                      </span>
                    ) : null}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-extrabold text-foreground">{plan.plusDays}-day Plus</p>
                      <p className="text-xl font-black tabular-nums text-foreground">{money(plan.amountNaira)}</p>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> Unlimited daily practice</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> {plan.credits} AI credits included</li>
                    </ul>
                    {PAYSTACK_ENABLED ? (
                      <button
                        type="button"
                        onClick={() => payWithPaystack(plan.key)}
                        disabled={busyPlan !== null}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-sm font-extrabold text-primary-foreground transition disabled:opacity-60"
                      >
                        {busyPlan === plan.key + "_ps" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Pay instantly — {money(plan.amountNaira)}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => choosePlan(plan.key)}
                      disabled={busyPlan !== null}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-extrabold transition disabled:opacity-60",
                        PAYSTACK_ENABLED
                          ? (isMonthly ? "mt-2 border border-primary/40 text-primary hover:bg-primary/5" : "mt-2 border border-border text-muted-foreground hover:border-primary/40 hover:text-primary")
                          : (isMonthly ? "mt-4 bg-primary text-primary-foreground" : "mt-4 border border-primary bg-transparent text-primary hover:bg-primary/5")
                      )}
                    >
                      {busyPlan === plan.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {PAYSTACK_ENABLED ? "Pay by bank transfer" : `Get Plus — ${money(plan.amountNaira)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Credits */}
          <div>
            <div className="mb-1 flex items-baseline gap-2">
              <h2 className="text-base font-extrabold text-foreground">Top-up credits</h2>
              <span className="text-xs text-muted-foreground">1 credit = 5 AI questions</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {creditPlans.map((plan) => (
                <div
                  key={plan.key}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-extrabold text-foreground">{plan.credits} credits</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{plan.credits * 5} AI questions</p>
                    <p className="mt-2.5 text-lg font-black text-foreground">{money(plan.amountNaira)}</p>
                  </div>
                  {PAYSTACK_ENABLED ? (
                    <button
                      type="button"
                      onClick={() => payWithPaystack(plan.key)}
                      disabled={busyPlan !== null}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
                    >
                      {busyPlan === plan.key + "_ps" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Pay instantly
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => choosePlan(plan.key)}
                    disabled={busyPlan !== null}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-60"
                  >
                    {busyPlan === plan.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {PAYSTACK_ENABLED ? "Bank transfer" : `${plan.credits} credits — ${money(plan.amountNaira)}`}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {PAYSTACK_ENABLED
              ? "Pay instantly with Paystack, or by bank transfer (manual review, usually a few hours)."
              : "Payment by bank transfer. Access activates after manual review (usually within a few hours)."}
          </p>
        </div>
      ) : null}

      {/* ── Order history ── */}
      {snapshot && snapshot.orders.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-bold text-muted-foreground">Order history</h2>
          <div className="overflow-hidden rounded-2xl border border-border">
            {snapshot.orders.slice(0, 6).map((order, i) => (
              <div
                key={order.id}
                className={cn("flex items-center justify-between gap-3 px-4 py-3", i > 0 && "border-t border-border")}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{order.planLabel}</p>
                  <p className="text-xs text-muted-foreground">{order.reference} · {formatDate(order.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {statusBadge(order.status)}
                  {order.status === "rejected" ? (
                    <button
                      type="button"
                      onClick={() => choosePlan(order.planKey)}
                      disabled={busyPlan !== null}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-60"
                    >
                      <RotateCcw className="h-3 w-3" /> Retry
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
