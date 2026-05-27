"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote, Check, ExternalLink, Loader2, RefreshCw, Search, X } from "lucide-react";
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
  status: "pending_payment" | "pending_review" | "approved" | "rejected" | "cancelled";
  receiptUrl: string | null;
  senderName: string | null;
  senderBank: string | null;
  transactionReference: string | null;
  adminNote: string | null;
  createdAt: string;
  submittedAt: string | null;
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
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "pending_review") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-border bg-background text-muted-foreground";
}

export default function StudyAdminBillingPage() {
  const router = useRouter();
  const [status, setStatus] = useState("pending_review");
  const [items, setItems] = useState<AdminBillingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");
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

  async function review(orderId: string, action: "approve" | "reject") {
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
      setMessage(action === "approve" ? "Order approved and access granted." : "Order rejected.");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action} order.`);
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
          <p className="mt-1 text-sm text-muted-foreground">Confirm manual transfers and activate Plus or credit packs.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div> : null}

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
          <option value="pending_payment">Awaiting receipt</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All orders</option>
        </select>
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional admin note for approve/reject"
        className="min-h-20 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
      />

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
            <div key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", statusClass(item.status))}>
                      {item.status.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold">
                      {item.reference}
                    </span>
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
                  </div>
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
                  {item.status === "pending_review" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => review(item.id, "approve")}
                        disabled={busyId !== null}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => review(item.id, "reject")}
                        disabled={busyId !== null}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
