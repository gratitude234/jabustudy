"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";

import StudyTabs from "../_components/StudyTabs";
import { sanitizeBillingReturnPath } from "@/lib/billingReturnPath";
import { BILLING_RETRYABLE_STATUSES, PAYSTACK_ACTIVE_STATUSES, selectBillingVisitOrder } from "@/lib/billingWorkflow";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type OrderStatus =
  | "initializing"
  | "pending_payment"
  | "pending_review"
  | "approved"
  | "failed"
  | "abandoned"
  | "expired"
  | "rejected"
  | "cancelled";

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
  status: OrderStatus;
  receiptPath: string | null;
  senderName: string | null;
  senderBank: string | null;
  transactionReference: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  expiresAt: string;
  adminNote: string | null;
  paymentMethod: "manual" | "paystack";
  paystackReference: string | null;
  providerStatus: string | null;
  initializedAt: string | null;
  lastVerifiedAt: string | null;
  paidAt: string | null;
  failureDetail: string | null;
  returnPath: string;
  refundStatus: "none" | "pending_review" | "resolved";
  refundedAt: string | null;
  refundAmountNaira: number | null;
  refundNote: string | null;
  canResume: boolean;
};

type BillingSnapshot = {
  ok: boolean;
  plus: { active: boolean; planKey: string | null; activeUntil: string | null };
  credits: { balance: number };
  freeTrial: { limit: number; used: number; remaining: number; periodKey: string; questionCount?: number };
  practice: { limit: number | null; used: number; remaining: number | null; activityDate: string };
  bank: { bankName: string; accountNumber: string; accountName: string };
  paystackEnabled: boolean;
  plans: Plan[];
  orders: BillingOrder[];
  historyNextCursor: string | null;
};

type SignedUploadClient = {
  uploadToSignedUrl: (path: string, token: string, file: File) => Promise<{ error: { message?: string } | null }>;
};

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const resumableStatuses = PAYSTACK_ACTIVE_STATUSES as readonly string[];
const retryableStatuses = BILLING_RETRYABLE_STATUSES as readonly string[];

function money(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

function expiryLabel(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: "Expired", urgent: true };
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return { text: "Less than 1 hour left", urgent: true };
  if (hours < 24) return { text: `${hours} hours left to pay`, urgent: hours < 2 };
  return { text: `${Math.floor(hours / 24)} days left to pay`, urgent: false };
}

function statusBadge(order: BillingOrder) {
  const labels: Record<OrderStatus, string> = {
    initializing: "Opening checkout",
    pending_payment: "Payment pending",
    pending_review: "Under review",
    approved: "Fulfilled",
    failed: "Failed",
    abandoned: "Not completed",
    expired: "Expired",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  const tones: Record<OrderStatus, string> = {
    initializing: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
    pending_payment: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    failed: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
    abandoned: "bg-secondary text-muted-foreground",
    expired: "bg-secondary text-muted-foreground",
    rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
    cancelled: "bg-secondary text-muted-foreground",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", tones[order.status])}>
      {labels[order.status]}
      {order.refundStatus === "pending_review" ? " · Refund review" : ""}
    </span>
  );
}

function currentLoginNext() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function removeCallbackReference() {
  const url = new URL(window.location.href);
  url.searchParams.delete("ref");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function StudyBillingPage() {
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);
  const [historyItems, setHistoryItems] = useState<BillingOrder[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<BillingOrder | null>(null);
  const [pollState, setPollState] = useState<"idle" | "checking" | "delayed">("idle");
  const [pageError, setPageError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [queryReturnPath, setQueryReturnPath] = useState("/study");
  const [offer, setOffer] = useState<string | null>(null);
  const pollRunRef = useRef(0);
  const verificationInFlightRef = useRef(false);

  function showToast(message: string, tone: "ok" | "error" = "ok") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4500);
  }

  function redirectToLogin() {
    window.location.assign(`/login?next=${encodeURIComponent(currentLoginNext())}`);
  }

  function mergeOrder(order: BillingOrder) {
    setSnapshot((current) => current ? {
      ...current,
      orders: current.orders.some((item) => item.id === order.id)
        ? current.orders.map((item) => item.id === order.id ? order : item)
        : [order, ...current.orders],
    } : current);
    setHistoryItems((current) => current.some((item) => item.id === order.id)
      ? current.map((item) => item.id === order.id ? order : item)
      : [order, ...current]);
  }

  async function loadBilling(options?: { quiet?: boolean }) {
    if (options?.quiet) setRefreshing(true);
    else setInitialLoading(true);
    setPageError(null);
    try {
      const response = await fetch("/api/billing/me", { cache: "no-store" });
      const data = await response.json().catch(() => null) as (BillingSnapshot & { message?: string }) | null;
      if (response.status === 401) {
        redirectToLogin();
        return null;
      }
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Could not load Billing.");
      setSnapshot(data);
      setHistoryItems(data.orders);
      setHistoryCursor(data.historyNextCursor);
      return data;
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not load Billing.");
      return null;
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  async function verifyOnce(reference: string) {
    if (verificationInFlightRef.current) return null;
    verificationInFlightRef.current = true;
    try {
      const response = await fetch(`/api/billing/orders/status?ref=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as {
        ok?: boolean;
        order?: BillingOrder;
        terminal?: boolean;
        retryable?: boolean;
        message?: string;
      } | null;
      if (response.status === 401) {
        redirectToLogin();
        return null;
      }
      if (!response.ok || !data?.ok || !data.order) throw new Error(data?.message || "Could not check payment status.");
      mergeOrder(data.order);
      setStatusMessage(`Paystack status: ${data.order.providerStatus || data.order.status}.`);
      if (data.order.status === "approved") {
        pollRunRef.current += 1;
        setConfirmedOrder(data.order);
        setCheckoutOrderId(null);
        setPollState("idle");
        removeCallbackReference();
        await loadBilling({ quiet: true });
      }
      return { order: data.order, terminal: Boolean(data.terminal), retryable: Boolean(data.retryable) };
    } finally {
      verificationInFlightRef.current = false;
    }
  }

  async function pollPayment(reference: string) {
    const runId = ++pollRunRef.current;
    setPollState("checking");
    setPageError(null);
    for (let attempt = 0; attempt < 15; attempt += 1) {
      if (runId !== pollRunRef.current) return;
      try {
        const result = await verifyOnce(reference);
        if (runId !== pollRunRef.current || !result) return;
        if (result.order.status === "approved") return;
        if (result.terminal) {
          setPollState("idle");
          return;
        }
      } catch (error) {
        if (attempt === 14) {
          setPageError(error instanceof Error ? error.message : "Could not confirm the payment.");
        }
      }
      if (attempt < 14) await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    if (runId === pollRunRef.current) {
      setPollState("delayed");
      setStatusMessage("Payment confirmation is delayed. You can check again safely.");
    }
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      const query = new URLSearchParams(window.location.search);
      setQueryReturnPath(sanitizeBillingReturnPath(query.get("returnTo")));
      setOffer(query.get("offer"));
      const data = await loadBilling();
      if (!active || !data) return;
      const callbackReference = new URLSearchParams(window.location.search).get("ref");
      const callbackOrder = callbackReference
        ? data.orders.find((order) => order.reference === callbackReference && order.paymentMethod === "paystack")
        : null;
      if (callbackReference) {
        setCheckoutOrderId(callbackOrder?.id ?? null);
        void pollPayment(callbackReference);
        return;
      }
      const target = selectBillingVisitOrder(data.orders, callbackReference);
      if (target && target.status !== "approved") {
        setCheckoutOrderId(target.id);
        void pollPayment(target.reference);
      } else if (callbackOrder?.status === "approved") {
        setConfirmedOrder(callbackOrder);
        removeCallbackReference();
      } else setCheckoutOrderId(target?.id ?? null);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
      pollRunRef.current += 1;
    };
    // The bootstrap intentionally runs once; subsequent refreshes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plusPlans = useMemo(() => snapshot?.plans.filter((plan) => plan.productType === "plus") ?? [], [snapshot]);
  const visiblePlusPlans = useMemo(
    () => offer === "exam-sprint" ? plusPlans.filter((plan) => plan.key === "plus_monthly") : plusPlans,
    [offer, plusPlans],
  );
  const creditPlans = useMemo(() => snapshot?.plans.filter((plan) => plan.productType === "credits") ?? [], [snapshot]);
  const checkoutOrder = snapshot?.orders.find((order) => order.id === checkoutOrderId) ?? null;
  const returnPath = confirmedOrder?.returnPath || checkoutOrder?.returnPath || queryReturnPath;
  const blocksPlans = checkoutOrder && ["initializing", "pending_payment", "pending_review"].includes(checkoutOrder.status);

  async function startPayment(planKey: string) {
    if (!snapshot) return;
    setBusyPlan(planKey);
    setPageError(null);
    try {
      const endpoint = snapshot.paystackEnabled ? "/api/billing/orders/paystack/init" : "/api/billing/orders";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, returnTo: returnPath }),
      });
      const data = await response.json().catch(() => null) as {
        ok?: boolean;
        authorizationUrl?: string;
        order?: BillingOrder;
        reused?: boolean;
        message?: string;
      } | null;
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      if (!response.ok || !data?.ok || !data.order) throw new Error(data?.message || "Could not start payment.");
      mergeOrder(data.order);
      setCheckoutOrderId(data.order.id);
      if (snapshot.paystackEnabled) {
        if (!data.authorizationUrl) throw new Error("Paystack did not return a checkout link.");
        window.location.assign(data.authorizationUrl);
      } else {
        await loadBilling({ quiet: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start payment.";
      setPageError(message);
      showToast(message, "error");
      await loadBilling({ quiet: true });
    } finally {
      setBusyPlan(null);
    }
  }

  async function resumePayment(order: BillingOrder) {
    setBusyAction(`resume:${order.id}`);
    setPageError(null);
    try {
      const response = await fetch(`/api/billing/orders/${order.id}/resume`, { method: "POST" });
      const data = await response.json().catch(() => null) as { ok?: boolean; authorizationUrl?: string; message?: string } | null;
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      if (!response.ok || !data?.ok || !data.authorizationUrl) throw new Error(data?.message || "This checkout cannot be resumed.");
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "This checkout cannot be resumed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function checkNow(order: BillingOrder) {
    if (verificationInFlightRef.current) return;
    setBusyAction(`check:${order.id}`);
    setPageError(null);
    try {
      const result = await verifyOnce(order.reference);
      if (result && !result.terminal && result.order.status !== "approved") {
        setPollState("delayed");
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not check payment status.");
    } finally {
      setBusyAction(null);
    }
  }

  async function startOver(order: BillingOrder) {
    pollRunRef.current += 1;
    setBusyAction(`cancel:${order.id}`);
    setPageError(null);
    try {
      const response = await fetch(`/api/billing/orders/${order.id}/cancel`, { method: "POST" });
      const data = await response.json().catch(() => null) as { ok?: boolean; order?: BillingOrder; message?: string } | null;
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      if (!response.ok || !data?.ok || !data.order) throw new Error(data?.message || "Could not close this checkout.");
      mergeOrder(data.order);
      setCheckoutOrderId(null);
      setPollState("idle");
      showToast("Checkout closed. A late successful payment will still be credited safely.");
      await loadBilling({ quiet: true });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not close this checkout.");
      await loadBilling({ quiet: true });
    } finally {
      setBusyAction(null);
    }
  }

  function copy(value: string, key: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? null : current), 1800);
    });
  }

  async function submitReceipt() {
    if (!checkoutOrder || checkoutOrder.paymentMethod !== "manual") return;
    if (!file) return showToast("Choose a receipt screenshot or PDF first.", "error");
    if (!senderName.trim()) return showToast("Enter the name on the sending account.", "error");
    setBusyAction(`submit:${checkoutOrder.id}`);
    setPageError(null);
    try {
      const initResponse = await fetch(`/api/billing/orders/${checkoutOrder.id}/receipt/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      const init = await initResponse.json().catch(() => null) as {
        ok?: boolean;
        bucket?: string;
        path?: string;
        token?: string;
        message?: string;
      } | null;
      if (!initResponse.ok || !init?.ok || !init.bucket || !init.path || !init.token) {
        throw new Error(init?.message || "Could not prepare the receipt upload.");
      }
      const storage = supabase.storage.from(init.bucket) as unknown as SignedUploadClient;
      const { error: uploadError } = await storage.uploadToSignedUrl(init.path, init.token, file);
      if (uploadError) throw new Error(uploadError.message || "Receipt upload failed.");
      const submitResponse = await fetch(`/api/billing/orders/${checkoutOrder.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptPath: init.path,
          senderName,
          senderBank,
          transactionReference,
        }),
      });
      const submitted = await submitResponse.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!submitResponse.ok || !submitted?.ok) throw new Error(submitted?.message || "Could not submit the payment.");
      setFile(null);
      setSenderName("");
      setSenderBank("");
      setTransactionReference("");
      showToast("Receipt submitted for review.");
      await loadBilling({ quiet: true });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not submit the receipt.");
    } finally {
      setBusyAction(null);
    }
  }

  async function loadMoreHistory() {
    if (!historyCursor) return;
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/billing/orders?cursor=${encodeURIComponent(historyCursor)}&limit=20`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as {
        ok?: boolean;
        items?: BillingOrder[];
        nextCursor?: string | null;
        message?: string;
      } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Could not load more payments.");
      setHistoryItems((current) => [...current, ...(data.items || []).filter((item) => !current.some((old) => old.id === item.id))]);
      setHistoryCursor(data.nextCursor ?? null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not load more payments.");
    } finally {
      setLoadingHistory(false);
    }
  }

  if (initialLoading && !snapshot) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-muted-foreground">Loading your plans and payments…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <StudyTabs />

      <div className="sr-only" aria-live="polite" aria-atomic="true">{statusMessage}</div>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed bottom-24 left-1/2 z-50 w-[min(92vw,34rem)] -translate-x-1/2 rounded-2xl px-5 py-3 text-center text-sm font-semibold shadow-lg",
            toast.tone === "ok" ? "bg-foreground text-background" : "bg-rose-700 text-white"
          )}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Billing</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">Plans &amp; AI credits</h1>
        </div>
        <Link href={returnPath} className={cn("mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary no-underline hover:underline", focusRing)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
      </div>

      {pageError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-extrabold">Something needs attention</p>
              <p className="mt-0.5 text-sm">{pageError}</p>
            </div>
          </div>
          <button type="button" onClick={() => void loadBilling({ quiet: true })} className={cn("inline-flex items-center justify-center gap-2 rounded-xl border border-current/30 px-3 py-2 text-sm font-bold", focusRing)}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" /> Retry
          </button>
        </div>
      ) : null}

      {confirmedOrder ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-extrabold">Payment confirmed</p>
              <p className="mt-1 text-sm">{confirmedOrder.planLabel} is active. Your payment reference is {confirmedOrder.reference}.</p>
              <Link href={confirmedOrder.returnPath} className={cn("mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white no-underline hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950", focusRing)}>
                Continue
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {pollState === "delayed" && checkoutOrder ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="text-sm font-extrabold">Confirmation is taking longer than usual</p>
          <p className="mt-1 text-sm">Do not pay twice. Check again, or share reference <strong>{checkoutOrder.reference}</strong> with support.</p>
          <button type="button" onClick={() => void checkNow(checkoutOrder)} disabled={busyAction !== null} className={cn("mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-500/50 px-3 py-2 text-sm font-bold disabled:opacity-60", focusRing)}>
            {busyAction === `check:${checkoutOrder.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Check again
          </button>
          <Link href="/support" className={cn("ml-3 inline-flex rounded-xl px-3 py-2 text-sm font-bold text-amber-950 underline dark:text-amber-100", focusRing)}>Contact support</Link>
        </div>
      ) : null}

      {snapshot ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-semibold">
            <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            {snapshot.plus.active ? `Plus · expires ${formatDate(snapshot.plus.activeUntil)}` : "Free plan"}
          </span>
          <span className="text-muted-foreground"><Zap className="mr-1 inline h-4 w-4 text-amber-500" aria-hidden="true" />{snapshot.credits.balance} AI credit{snapshot.credits.balance === 1 ? "" : "s"}</span>
          <span className="text-muted-foreground">
            {snapshot.practice.limit === null
              ? "Unlimited practice"
              : `${snapshot.practice.remaining ?? 0} of ${snapshot.practice.limit} questions left today`}
          </span>
        </div>
      ) : null}

      {checkoutOrder && checkoutOrder.status !== "approved" ? (
        <section className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-card shadow-sm" aria-labelledby="checkout-heading">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Current checkout</p>
              <h2 id="checkout-heading" className="mt-0.5 text-base font-extrabold">{checkoutOrder.planLabel}</h2>
            </div>
            <p className="shrink-0 text-xl font-black tabular-nums">{money(checkoutOrder.amountNaira)}</p>
          </div>

          {checkoutOrder.paymentMethod === "paystack" ? (
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(checkoutOrder)}
                <span className="text-xs font-semibold text-muted-foreground">Reference {checkoutOrder.reference}</span>
              </div>
              {checkoutOrder.status === "initializing" ? (
                <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground" role="status">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" /> Secure checkout is opening. This normally takes a few seconds.
                </div>
              ) : retryableStatuses.includes(checkoutOrder.status) ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
                  <p className="font-extrabold">This checkout was not completed.</p>
                  <p className="mt-1">{checkoutOrder.failureDetail || "No charge was confirmed. You can safely try again."}</p>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm font-bold">Complete payment in Paystack</p>
                  <p className="mt-1 text-sm text-muted-foreground">You can return here at any time. We check Paystack before changing this order.</p>
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {checkoutOrder.status === "pending_payment" && checkoutOrder.canResume ? (
                  <button type="button" onClick={() => void resumePayment(checkoutOrder)} disabled={busyAction !== null} className={cn("inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground disabled:opacity-60", focusRing)}>
                    {busyAction === `resume:${checkoutOrder.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Continue to Paystack
                  </button>
                ) : null}
                {checkoutOrder.status === "pending_payment" ? (
                  <button type="button" onClick={() => void checkNow(checkoutOrder)} disabled={busyAction !== null || pollState === "checking"} className={cn("inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-60", focusRing)}>
                    {pollState === "checking" || busyAction === `check:${checkoutOrder.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Check status
                  </button>
                ) : null}
                {retryableStatuses.includes(checkoutOrder.status) ? (
                  <button type="button" onClick={() => void startPayment(checkoutOrder.planKey)} disabled={busyPlan !== null} className={cn("inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground disabled:opacity-60", focusRing)}>
                    {busyPlan === checkoutOrder.planKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Try again
                  </button>
                ) : null}
                {resumableStatuses.includes(checkoutOrder.status) ? (
                  <button type="button" onClick={() => void startOver(checkoutOrder)} disabled={busyAction !== null} className={cn("inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-60", focusRing)}>
                    {busyAction === `cancel:${checkoutOrder.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Start over
                  </button>
                ) : null}
              </div>
            </div>
          ) : checkoutOrder.status === "pending_review" ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
              <p className="mt-3 font-extrabold">Receipt submitted</p>
              <p className="mt-1 text-sm text-muted-foreground">A Study Admin is checking your legacy bank transfer.</p>
            </div>
          ) : checkoutOrder.status === "pending_payment" ? (
            <div className="divide-y divide-border">
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Legacy bank transfer</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <p className="text-sm"><span className="block text-xs text-muted-foreground">Bank</span><strong>{snapshot?.bank.bankName || "Not configured"}</strong></p>
                  <p className="text-sm"><span className="block text-xs text-muted-foreground">Account name</span><strong>{snapshot?.bank.accountName || "Not configured"}</strong></p>
                  <div className="text-sm"><span className="block text-xs text-muted-foreground">Account number</span><div className="flex items-center gap-2"><strong>{snapshot?.bank.accountNumber || "Not configured"}</strong>{snapshot?.bank.accountNumber ? <button type="button" aria-label="Copy account number" onClick={() => copy(snapshot.bank.accountNumber, "account")} className={cn("rounded-lg p-1 hover:bg-secondary", focusRing)}>{copied === "account" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button> : null}</div></div>
                  <p className="text-sm"><span className="block text-xs text-muted-foreground">Exact amount</span><strong>{money(checkoutOrder.amountNaira)}</strong></p>
                </div>
                <div className="mt-4 rounded-xl bg-primary/10 p-3"><p className="text-xs font-bold text-primary">Transfer narration</p><div className="flex items-center gap-2"><strong>{checkoutOrder.reference}</strong><button type="button" aria-label="Copy payment reference" onClick={() => copy(checkoutOrder.reference, "reference")} className={cn("rounded-lg p-1 hover:bg-primary/10", focusRing)}>{copied === "reference" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button></div></div>
                {(() => { const expiry = expiryLabel(checkoutOrder.expiresAt); return <p className={cn("mt-3 text-xs font-semibold", expiry.urgent ? "text-rose-600 dark:text-rose-300" : "text-muted-foreground")}>{expiry.text}</p>; })()}
              </div>
              <div className="space-y-3 p-5">
                <label className="block text-xs font-bold text-muted-foreground">Receipt screenshot or PDF<input type="file" accept="image/*,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} className={cn("mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm", focusRing)} /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-muted-foreground">Sending account name<input value={senderName} onChange={(event) => setSenderName(event.target.value)} className={cn("mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground", focusRing)} /></label>
                  <label className="text-xs font-bold text-muted-foreground">Sending bank<input value={senderBank} onChange={(event) => setSenderBank(event.target.value)} className={cn("mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground", focusRing)} /></label>
                </div>
                <label className="block text-xs font-bold text-muted-foreground">Transfer reference (optional)<input value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} className={cn("mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground", focusRing)} /></label>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="button" onClick={() => void submitReceipt()} disabled={busyAction !== null} className={cn("inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground disabled:opacity-60", focusRing)}>{busyAction === `submit:${checkoutOrder.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}Submit for review</button>
                  <button type="button" onClick={() => void startOver(checkoutOrder)} disabled={busyAction !== null} className={cn("rounded-xl px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-secondary disabled:opacity-60", focusRing)}>Cancel</button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!blocksPlans && snapshot ? (
        <section className="space-y-6" aria-labelledby="plans-heading">
          <div>
            <h2 id="plans-heading" className="text-lg font-extrabold">{offer === "exam-sprint" ? "Unlock Exam Sprint" : "JabuStudy Plus"}</h2>
            {offer === "exam-sprint" ? <p className="mt-1 text-sm text-muted-foreground">Get every available Exam Sprint mock plus all normal Plus benefits for 30 days.</p> : null}
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot.plus.active
                ? "Buying Plus again extends your current expiry; you do not lose remaining time."
                : "Recommended for regular study: unlimited practice plus included AI credits."}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {visiblePlusPlans.map((plan) => {
                const recommended = plan.key === "plus_monthly";
                return (
                  <article key={plan.key} className={cn("relative flex flex-col rounded-2xl border p-5 shadow-sm", recommended ? "border-primary/50 bg-primary/5" : "border-border bg-card")}>
                    {recommended ? <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold text-primary-foreground">Best value</span> : null}
                    <div className="flex items-start justify-between gap-3"><h3 className="font-extrabold">{plan.plusDays}-day Plus</h3><p className="text-xl font-black">{money(plan.amountNaira)}</p></div>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">{offer === "exam-sprint" ? <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />All published Exam Sprint mocks</li> : null}<li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Unlimited daily practice</li><li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{plan.credits} AI credits included</li></ul>
                    <button type="button" onClick={() => void startPayment(plan.key)} disabled={busyPlan !== null} className={cn("mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold disabled:opacity-60", recommended ? "bg-primary text-primary-foreground" : "border border-primary text-primary hover:bg-primary/10", focusRing)}>{busyPlan === plan.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{snapshot.plus.active ? "Extend Plus" : "Get Plus"} · {money(plan.amountNaira)}</button>
                  </article>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-extrabold">AI credit top-ups</h2>
            <p className="mt-1 text-sm text-muted-foreground">One-off top-ups for AI question generation. Plus is usually better value for free users who practise often.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {creditPlans.map((plan) => (
                <article key={plan.key} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                  <h3 className="font-extrabold">{plan.credits} AI credits</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Up to {plan.credits * 5} AI questions</p>
                  <p className="mt-3 text-lg font-black">{money(plan.amountNaira)}</p>
                  <button type="button" onClick={() => void startPayment(plan.key)} disabled={busyPlan !== null} className={cn("mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-60", focusRing)}>{busyPlan === plan.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Buy top-up</button>
                </article>
              ))}
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">{snapshot.paystackEnabled ? "Secure checkout by Paystack. Access activates after verified payment." : "Legacy bank transfer is available while Paystack is offline."}</p>
        </section>
      ) : null}

      {historyItems.length > 0 ? (
        <section aria-labelledby="history-heading">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 id="history-heading" className="text-base font-extrabold">Payment history</h2>{refreshing ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" />Refreshing</span> : null}</div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {historyItems.map((order, index) => (
              <article key={order.id} className={cn("grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center", index > 0 && "border-t border-border")}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{order.planLabel}</p>{statusBadge(order)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{money(order.amountNaira)} · {order.paymentMethod === "paystack" ? "Paystack" : "Bank transfer"} · {formatDate(order.paidAt || order.submittedAt || order.createdAt)}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">Order {order.reference}{order.paystackReference ? ` · Transaction ${order.paystackReference}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  {retryableStatuses.includes(order.status) ? <button type="button" onClick={() => void startPayment(order.planKey)} disabled={busyPlan !== null} className={cn("inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-60", focusRing)}><RotateCcw className="h-3.5 w-3.5" />Retry</button> : null}
                  <Link href={`/study/billing/receipt/${order.id}`} className={cn("text-xs font-bold text-primary no-underline hover:underline", focusRing)}>Details</Link>
                </div>
              </article>
            ))}
          </div>
          {historyCursor ? <button type="button" onClick={() => void loadMoreHistory()} disabled={loadingHistory} className={cn("mx-auto mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold disabled:opacity-60", focusRing)}>{loadingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Load more</button> : null}
        </section>
      ) : null}
    </div>
  );
}
