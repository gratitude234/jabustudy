"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  ReceiptText,
  UploadCloud,
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

type ApiErrorPayload = {
  message?: string;
};

type SignedUploadClient = {
  uploadToSignedUrl: (
    path: string,
    token: string,
    file: File
  ) => Promise<{ error: { message?: string } | null }>;
};

function money(amount: number) {
  return `NGN ${amount.toLocaleString("en-NG")}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "Not active";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(status: BillingOrder["status"]) {
  if (status === "pending_payment") return "Awaiting receipt";
  if (status === "pending_review") return "Pending review";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Cancelled";
}

function statusClass(status: BillingOrder["status"]) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "pending_review") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-border bg-background text-muted-foreground";
}

export default function StudyBillingPage() {
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/me", { cache: "no-store" });
      const data = await res.json().catch(() => null) as BillingSnapshot | null;
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/study/billing")}`;
        return;
      }
      if (!res.ok || !data?.ok) {
        const payload = data as (BillingSnapshot & ApiErrorPayload) | null;
        throw new Error(payload?.message || "Could not load billing.");
      }
      setSnapshot(data);
      const pending = data.orders.find((order) => order.status === "pending_payment") ?? null;
      setActiveOrderId((current) => current ?? pending?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load billing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const plusPlans = useMemo(() => snapshot?.plans.filter((plan) => plan.productType === "plus") ?? [], [snapshot]);
  const creditPlans = useMemo(() => snapshot?.plans.filter((plan) => plan.productType === "credits") ?? [], [snapshot]);
  const activeOrder = snapshot?.orders.find((order) => order.id === activeOrderId) ?? null;
  const pendingOrders = snapshot?.orders.filter((order) => order.status === "pending_payment" || order.status === "pending_review") ?? [];

  async function createOrder(planKey: string) {
    setBusyPlan(planKey);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/billing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json().catch(() => null) as { ok?: boolean; order?: BillingOrder; message?: string } | null;
      if (!res.ok || !data?.ok || !data.order) throw new Error(data?.message || "Could not create order.");
      await load();
      setActiveOrderId(data.order.id);
      setMessage("Order created. Transfer the exact amount and upload your receipt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create order.");
    } finally {
      setBusyPlan(null);
    }
  }

  async function submitReceipt() {
    if (!activeOrder) return;
    if (!file) {
      setError("Choose your receipt screenshot or PDF first.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const initRes = await fetch(`/api/billing/orders/${activeOrder.id}/receipt/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      const init = await initRes.json().catch(() => null) as
        | { ok?: boolean; bucket?: string; path?: string; token?: string; message?: string }
        | null;
      if (!initRes.ok || !init?.ok || !init.bucket || !init.path || !init.token) {
        throw new Error(init?.message || "Could not prepare receipt upload.");
      }

      const storage = supabase.storage.from(init.bucket) as unknown as SignedUploadClient;
      const { error: uploadError } = await storage
        .uploadToSignedUrl(init.path, init.token, file);
      if (uploadError) throw new Error(uploadError.message || "Receipt upload failed.");

      const submitRes = await fetch(`/api/billing/orders/${activeOrder.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptPath: init.path,
          senderName,
          senderBank,
          transactionReference,
        }),
      });
      const submitted = await submitRes.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!submitRes.ok || !submitted?.ok) throw new Error(submitted?.message || "Could not submit payment.");

      setFile(null);
      setSenderName("");
      setSenderBank("");
      setTransactionReference("");
      setMessage("Payment submitted. Your access will activate once confirmed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit payment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <StudyTabs />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Billing</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">JabuStudy Plus & AI credits</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Keep studying for free, then upgrade when you need heavier practice or more AI generation.
          </p>
        </div>
        <Link href="/study" className="text-sm font-semibold text-primary no-underline hover:underline">
          Back to study
        </Link>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div> : null}

      {snapshot ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <BadgeCheck className="h-4 w-4 text-primary" /> Plus
              </div>
              <p className="mt-2 text-2xl font-extrabold">{snapshot.plus.active ? "Active" : "Free"}</p>
              <p className="text-xs text-muted-foreground">
                {snapshot.plus.active ? `Expires ${formatDate(snapshot.plus.activeUntil)}` : "Upgrade for unlimited practice."}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Zap className="h-4 w-4 text-amber-600" /> AI credits
              </div>
              <p className="mt-2 text-2xl font-extrabold tabular-nums">{snapshot.credits.balance}</p>
              <p className="text-xs text-muted-foreground">
                Free AI: {snapshot.freeAi.remaining}/{snapshot.freeAi.limit} left this month.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Practice
              </div>
              <p className="mt-2 text-2xl font-extrabold">
                {snapshot.practice.limit === null ? "Unlimited" : `${snapshot.practice.remaining}/${snapshot.practice.limit}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {snapshot.practice.limit === null ? "Plus removes daily practice limits." : "Free questions left today."}
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-extrabold text-foreground">JabuStudy Plus</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {plusPlans.map((plan) => (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => createOrder(plan.key)}
                  disabled={busyPlan !== null}
                  className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-foreground">{plan.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Unlimited practice, {plan.credits} AI credits, {plan.plusDays} days.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                      {money(plan.amountNaira)}
                    </span>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">
                    {busyPlan === plan.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                    Pay by transfer
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-extrabold text-foreground">Extra AI credits</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {creditPlans.map((plan) => (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => createOrder(plan.key)}
                  disabled={busyPlan !== null}
                  className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CreditCard className="h-5 w-5 text-primary" />
                  <p className="mt-3 text-sm font-extrabold text-foreground">{plan.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">One-time purchase.</p>
                  <p className="mt-4 text-lg font-extrabold">{money(plan.amountNaira)}</p>
                </button>
              ))}
            </div>
          </section>

          {pendingOrders.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-primary" />
                <h2 className="text-base font-extrabold text-foreground">Manual transfer order</h2>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <div className="space-y-3">
                  {pendingOrders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setActiveOrderId(order.id)}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left transition",
                        activeOrderId === order.id ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-secondary/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold text-foreground">{order.planLabel}</p>
                          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{order.reference}</p>
                        </div>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", statusClass(order.status))}>
                          {statusLabel(order.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-bold">{money(order.amountNaira)}</p>
                    </button>
                  ))}
                </div>

                {activeOrder ? (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">Bank</p>
                        <p className="mt-1 text-sm font-extrabold">{snapshot.bank.bankName || "Set JABUSTUDY_BANK_NAME"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">Account number</p>
                        <p className="mt-1 text-sm font-extrabold tabular-nums">{snapshot.bank.accountNumber || "Not configured"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">Account name</p>
                        <p className="mt-1 text-sm font-extrabold">{snapshot.bank.accountName || "Not configured"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">Amount</p>
                        <p className="mt-1 text-sm font-extrabold">{money(activeOrder.amountNaira)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs font-bold uppercase text-primary">Use this narration/reference</p>
                      <p className="mt-1 text-xl font-black tracking-wide text-foreground">{activeOrder.reference}</p>
                    </div>

                    {activeOrder.status === "pending_review" ? (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                        <Clock3 className="h-4 w-4" />
                        Receipt submitted. Waiting for confirmation.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <label className="block">
                          <span className="text-xs font-bold uppercase text-muted-foreground">Receipt screenshot or PDF</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                            className="mt-1 block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={senderName}
                            onChange={(event) => setSenderName(event.target.value)}
                            placeholder="Sender account name"
                            className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                          <input
                            value={senderBank}
                            onChange={(event) => setSenderBank(event.target.value)}
                            placeholder="Sender bank"
                            className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <input
                          value={transactionReference}
                          onChange={(event) => setTransactionReference(event.target.value)}
                          placeholder="Transfer reference (optional)"
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={submitReceipt}
                          disabled={submitting}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                          Submit for review
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {snapshot.orders.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-extrabold text-foreground">Recent orders</h2>
              <div className="space-y-2">
                {snapshot.orders.slice(0, 6).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{order.planLabel}</p>
                      <p className="text-xs text-muted-foreground">{order.reference} - {formatDate(order.createdAt)}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold", statusClass(order.status))}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
