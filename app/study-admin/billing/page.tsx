"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote, Check, ExternalLink, Loader2, RefreshCw, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AdminBillingOrder = {
  id: string;
  userId: string;
  planKey: string;
  planLabel: string;
  amountNaira: number;
  credits: number;
  plusDays: number | null;
  reference: string;
  status: "initializing" | "pending_payment" | "pending_review" | "approved" | "failed" | "abandoned" | "expired" | "rejected" | "cancelled";
  receiptUrl: string | null;
  senderName: string | null;
  senderBank: string | null;
  transactionReference: string | null;
  adminNote: string | null;
  createdAt: string;
  submittedAt: string | null;
  paymentMethod: "manual" | "paystack";
  providerStatus: string | null;
  lastVerifiedAt: string | null;
  paidAt: string | null;
  paystackReference: string | null;
  failureDetail: string | null;
  refundStatus: "none" | "pending_review" | "resolved";
  refundedAt: string | null;
  refundAmountNaira: number | null;
  refundNote: string | null;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    displayName: string;
  };
};

function money(amount: number) {
  return `NGN ${amount.toLocaleString("en-NG")}`;
}

function when(iso: string | null) {
  if (!iso) return "Not submitted";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-NG", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: AdminBillingOrder["status"]) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (status === "rejected" || status === "failed") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200";
  if (status === "pending_review" || status === "pending_payment") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200";
  return "border-border bg-background text-muted-foreground";
}

function OrderCard({
  item,
  busyId,
  onReview,
}: {
  item: AdminBillingOrder;
  busyId: string | null;
  onReview: (id: string, action: "approve" | "reject" | "verify-paystack" | "resolve-refund", note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", statusClass(item.status))}>
              {item.status.replace(/_/g, " ")}
            </span>
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold">
              {item.reference}
            </span>
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold capitalize">
              {item.paymentMethod}
            </span>
            {item.refundStatus !== "none" ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Refund {item.refundStatus.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-lg font-extrabold text-foreground">{item.planLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {money(item.amountNaira)} - {item.credits} credits{item.plusDays ? ` - ${item.plusDays} Plus days` : ""}
          </p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="font-bold">Student:</span> {item.user.displayName}</p>
            <p><span className="font-bold">Email:</span> {item.user.email ?? "Unknown"}</p>
            <p><span className="font-bold">Sender:</span> {item.senderName || "Not provided"}</p>
            <p><span className="font-bold">Bank:</span> {item.senderBank || "Not provided"}</p>
            <p><span className="font-bold">Transfer ref:</span> {item.transactionReference || "Not provided"}</p>
            <p><span className="font-bold">Submitted:</span> {when(item.submittedAt)}</p>
            <p><span className="font-bold">Provider status:</span> {item.providerStatus || "Not checked"}</p>
            <p><span className="font-bold">Last verification:</span> {when(item.lastVerifiedAt)}</p>
            <p><span className="font-bold">Paid:</span> {when(item.paidAt)}</p>
            <p className="break-all"><span className="font-bold">Transaction ID:</span> {item.paystackReference || item.transactionReference || "Not recorded"}</p>
          </div>
          {item.failureDetail ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{item.failureDetail}</p> : null}
          {item.refundStatus !== "none" ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Refund reported {when(item.refundedAt)}{item.refundAmountNaira ? ` · ${money(item.refundAmountNaira)}` : ""}{item.refundNote ? ` · ${item.refundNote}` : ""}. Benefits are unchanged until reconciled manually.</p> : null}
          {item.adminNote ? (
            <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground">{item.adminNote}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:w-56 lg:flex-col">
          {item.receiptUrl ? (
            <Link
              href={item.receiptUrl}
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold no-underline hover:bg-secondary"
            >
              Receipt <ExternalLink className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-muted-foreground">
              No receipt
            </span>
          )}
          {item.status === "pending_review" && item.paymentMethod === "manual" ? (
            <>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note for approve/reject"
                rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary lg:w-56"
              />
              <button
                type="button"
                onClick={() => onReview(item.id, "approve", note)}
                disabled={busyId !== null}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve
              </button>
              <button
                type="button"
                onClick={() => onReview(item.id, "reject", note)}
                disabled={busyId !== null}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                Reject
              </button>
            </>
          ) : null}
          {item.paymentMethod === "paystack" ? (
            <button
              type="button"
              onClick={() => onReview(item.id, "verify-paystack", "")}
              disabled={busyId !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-bold text-primary disabled:opacity-60"
            >
              {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verify with Paystack
            </button>
          ) : null}
          {item.refundStatus === "pending_review" ? (
            <>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Required reconciliation note"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary lg:w-56"
              />
              <button
                type="button"
                onClick={() => onReview(item.id, "resolve-refund", note)}
                disabled={busyId !== null || !note.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" /> Resolve review
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function StudyAdminBillingPage() {
  const router = useRouter();
  const [status, setStatus] = useState("pending_review");
  const [items, setItems] = useState<AdminBillingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function getTokenOrRedirect() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent("/study-admin/billing")}`);
      return null;
    }
    return token;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const url = new URL("/api/study-admin/billing/orders", window.location.origin);
      url.searchParams.set("status", status);
      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent("/study-admin/billing")}`);
        return;
      }
      if (res.status === 403) {
        router.replace("/study-admin");
        return;
      }
      const data = await res.json().catch(() => null) as { ok?: boolean; items?: AdminBillingOrder[]; message?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Could not load billing orders.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load billing orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function review(orderId: string, action: "approve" | "reject" | "verify-paystack" | "resolve-refund", note: string) {
    setBusyId(orderId);
    setError(null);
    setMessage(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/billing/orders/${orderId}/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note }),
      });
      const data = await res.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.message || `Could not ${action} order.`);
      setMessage(
        action === "approve"
          ? "Order approved and access granted."
          : action === "reject"
            ? "Order rejected."
            : action === "verify-paystack"
              ? "Paystack verification completed."
              : "Refund review resolved; benefits were left unchanged."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action.replace(/-/g, " ")} order.`);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = items.filter((item) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    return [
      item.reference,
      item.planLabel,
      item.user.email,
      item.user.fullName,
      item.senderName,
      item.transactionReference,
    ].some((value) => String(value ?? "").toLowerCase().includes(term));
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Study Admin</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Billing review</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review manual transfers, verify Paystack orders, and reconcile refunds.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
      {message ? <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</div> : null}

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search reference, student, sender..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} className="rounded-lg p-1 hover:bg-secondary" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-2xl border border-border bg-card px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="pending_review">Pending review</option>
          <option value="refund_review">Refund review</option>
          <option value="initializing">Initializing</option>
          <option value="pending_payment">Awaiting receipt</option>
          <option value="failed">Failed</option>
          <option value="abandoned">Abandoned</option>
          <option value="expired">Expired</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All orders</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Banknote className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-bold text-foreground">No billing orders here</p>
          <p className="mt-1 text-xs text-muted-foreground">Try another status filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <OrderCard
              key={item.id}
              item={item}
              busyId={busyId}
              onReview={review}
            />
          ))}
        </div>
      )}
    </div>
  );
}
