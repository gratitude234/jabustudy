"use client";
// app/admin/vendors/page.tsx
import { cn } from "@/lib/utils";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  Search,
  X,
  RefreshCcw,
  AlertTriangle,
  Store,
  MapPin,
  Phone,
  BadgeCheck,
  ShieldAlert,
  FileText,
  Eye,
  Clock,
} from "lucide-react";

type VendorType = "food" | "mall" | "student" | "other";

type RequestRow = {
  id: string;
  vendor_id: string;
  status: "requested" | "under_review" | "approved" | "rejected";
  note: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  vendors?: {
    id: string;
    name: string | null;
    whatsapp: string | null;
    phone: string | null;
    location: string | null;
    vendor_type: VendorType | null;
    verified: boolean | null;
    verification_status: string | null;
  } | null;
};

type DocRow = {
  id: string;
  vendor_id: string;
  doc_type: string;
  file_path: string;
  created_at: string;
};

type Banner = { type: "success" | "error" | "info"; text: string } | null;

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<VendorType, string> = {
  food: "Food",
  mall: "Mall",
  student: "Student",
  other: "Other",
};

function normalizePhone(input?: string | null) {
  if (!input) return "";
  return input.replace(/[^\d+]/g, "").trim();
}

function BannerView({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  if (!banner) return null;

  const cls =
    banner.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : banner.type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-zinc-200 bg-zinc-50 text-zinc-800";

  return (
    <div className={cn("rounded-2xl border p-3 text-sm flex items-start justify-between gap-3", cls)} role="status">
      <span>{banner.text}</span>
      <button onClick={onClose} className="rounded-xl border bg-white/70 p-2 hover:bg-white" aria-label="Close" type="button">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StatusPill({ status }: { status: RequestRow["status"] }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        Rejected
      </span>
    );
  }
  if (status === "under_review") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
        <Eye className="h-3.5 w-3.5" />
        Under review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-800">
      <ShieldAlert className="h-3.5 w-3.5" />
      Requested
    </span>
  );
}

function MiniBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-black px-2 py-1 text-[10px] font-semibold text-white">
      <BadgeCheck className="h-3.5 w-3.5" />
      Verified
    </span>
  ) : (
    <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700">Unverified</span>
  );
}

// ── Pending food vendor applications section ──────────────────────────────────

type PendingVendor = {
  id: string;
  user_id: string | null;
  name: string | null;
  location: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  created_at: string | null;
  verification_status: string | null;
};

function PendingFoodVendors() {
  const [vendors, setVendors] = useState<PendingVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('vendors')
      .select('id, user_id, name, location, description, phone, whatsapp, created_at, verification_status')
      .eq('vendor_type', 'food')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: false });
    setVendors((data ?? []) as PendingVendor[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(vendorId: string) {
    setWorking(vendorId);
    const res = await fetch(`/api/admin/vendors/${vendorId}/approve`, { method: 'POST' });
    const json = await res.json();
    if (json.ok) {
      setBanner({ type: 'success', text: 'Vendor approved.' });
      setVendors((prev) => prev.filter((v) => v.id !== vendorId));
    } else {
      setBanner({ type: 'error', text: json.message ?? 'Failed to approve.' });
    }
    setWorking(null);
  }

  async function reject(vendorId: string) {
    const reason = rejectReason.trim();
    if (!reason) { setBanner({ type: 'error', text: 'Enter a rejection reason.' }); return; }
    setWorking(vendorId);
    const res = await fetch(`/api/admin/vendors/${vendorId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (json.ok) {
      setBanner({ type: 'success', text: 'Vendor rejected.' });
      setVendors((prev) => prev.filter((v) => v.id !== vendorId));
      setRejectTarget(null);
      setRejectReason('');
    } else {
      setBanner({ type: 'error', text: json.message ?? 'Failed to reject.' });
    }
    setWorking(null);
  }

  return (
    <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-zinc-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Pending Food Vendor Applications
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">Food vendors waiting for approval</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          <RefreshCcw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {banner && (
        <div className={cn(
          'rounded-2xl border p-3 text-sm flex items-start justify-between gap-3',
          banner.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        )}>
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="rounded-xl border bg-white/70 p-1.5 hover:bg-white">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : vendors.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No pending applications.</p>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => (
            <div key={v.id} className="rounded-3xl border bg-zinc-50 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-zinc-900">{v.name ?? 'Unnamed'}</p>
                  {v.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-600">
                      <MapPin className="h-3.5 w-3.5" /> {v.location}
                    </p>
                  )}
                  {(v.phone ?? v.whatsapp) && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-600">
                      <Phone className="h-3.5 w-3.5" /> {v.phone ?? v.whatsapp}
                    </p>
                  )}
                  {v.description && (
                    <p className="mt-1 text-xs text-zinc-500 italic">{v.description}</p>
                  )}
                </div>
                <span className="text-xs text-zinc-400">
                  {v.created_at ? new Date(v.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : ''}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => approve(v.id)}
                  disabled={working === v.id}
                  className="inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
                >
                  {working === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setRejectTarget(rejectTarget === v.id ? null : v.id)}
                  disabled={working === v.id}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                >
                  <AlertTriangle className="h-3.5 w-3.5" /> Reject
                </button>
              </div>

              {rejectTarget === v.id && (
                <div className="rounded-2xl border border-rose-200 bg-white p-3 space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (required)"
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                  <button
                    type="button"
                    onClick={() => reject(v.id)}
                    disabled={working === v.id}
                    className="w-full rounded-2xl bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    Confirm Rejection
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminVendorsPage() {
  const mounted = useRef(true);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [banner, setBanner] = useState<Banner>(null);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"inbox" | "under_review" | "approved" | "rejected" | "all">("inbox");
  const [type, setType] = useState<"all" | VendorType>("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState<RequestRow | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [working, setWorking] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function fetchPage(nextPage = 1) {
    setLoading(true);
    setBanner(null);

    const from = (nextPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from("vendor_verification_requests")
        .select(
          "id,vendor_id,status,note,rejection_reason,created_at,reviewed_at,reviewed_by,vendors:vendors(id,name,whatsapp,phone,location,vendor_type,verified,verification_status)",
          { count: "exact" }
        );

      if (tab === "inbox") query = query.eq("status", "requested");
      if (tab === "under_review") query = query.eq("status", "under_review");
      if (tab === "approved") query = query.eq("status", "approved");
      if (tab === "rejected") query = query.eq("status", "rejected");

      if (type !== "all") query = query.eq("vendors.vendor_type", type);

      const needle = q.trim();
      if (needle) {
        // Search vendor fields via embedded relationship filters
        // (PostgREST supports filtering on embedded resources in select)
        query = query.or(
          `vendors.name.ilike.%${needle}%,vendors.location.ilike.%${needle}%,vendors.phone.ilike.%${needle}%,vendors.whatsapp.ilike.%${needle}%`
        );
      }

      const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
      if (error) throw error;

      if (!mounted.current) return;
      setRows((data ?? []) as any);
      setTotal(count ?? 0);
      setLoading(false);
    } catch (e: any) {
      if (!mounted.current) return;
      setBanner({ type: "error", text: e?.message ?? "Failed to load requests." });
      setRows([]);
      setTotal(0);
      setLoading(false);
    }
  }

  async function openDrawer(r: RequestRow) {
    setActive(r);
    setDrawerOpen(true);
    setRejectReason("");

    setDocsLoading(true);
    setDocs([]);
    try {
      const { data, error } = await supabase
        .from("vendor_verification_docs")
        .select("id,vendor_id,doc_type,file_path,created_at")
        .eq("vendor_id", r.vendor_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!mounted.current) return;
      setDocs((data ?? []) as any);
    } catch {
      // docs table/bucket may not exist yet
    } finally {
      if (mounted.current) setDocsLoading(false);
    }
  }

  useEffect(() => {
    fetchPage(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, type]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      fetchPage(1);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function tryRpc(name: string, args: any) {
    const { error } = await supabase.rpc(name, args);
    if (!error) return { ok: true as const };

    // function missing
    const msg = String(error.message ?? "");
    if (msg.toLowerCase().includes("function") && msg.toLowerCase().includes("does not exist")) {
      return { ok: false as const, missing: true as const, error };
    }

    return { ok: false as const, missing: false as const, error };
  }

  async function markUnderReview() {
    if (!active) return;
    setWorking(true);
    setBanner(null);

    try {
      // Prefer RPC
      const r1 = await tryRpc("mark_vendor_under_review", { p_request_id: active.id });
      if (!r1.ok && r1.missing) {
        // Fallback (non-atomic)
        const { error: e1 } = await supabase
          .from("vendor_verification_requests")
          .update({ status: "under_review" })
          .eq("id", active.id);
        if (e1) throw e1;

        await supabase.from("vendors").update({ verification_status: "under_review" }).eq("id", active.vendor_id);
      } else if (!r1.ok) {
        throw r1.error;
      }

      setBanner({ type: "success", text: "Marked as under review." });
      setDrawerOpen(false);
      setActive(null);
      await fetchPage(page);
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Update failed." });
    } finally {
      setWorking(false);
    }
  }

  async function approve() {
    if (!active) return;
    setWorking(true);
    setBanner(null);

    try {
      const r1 = await tryRpc("approve_vendor_verification", { p_request_id: active.id });
      if (!r1.ok && r1.missing) {
        // Fallback (non-atomic)
        const { error: e1 } = await supabase
          .from("vendor_verification_requests")
          .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: null, rejection_reason: null })
          .eq("id", active.id);
        if (e1) throw e1;

        const { error: e2 } = await supabase
          .from("vendors")
          .update({ verification_status: "verified", verified: true, verified_at: new Date().toISOString(), rejection_reason: null, rejected_at: null })
          .eq("id", active.vendor_id);
        if (e2) throw e2;
      } else if (!r1.ok) {
        throw r1.error;
      }

      setBanner({ type: "success", text: "Approved." });
      setDrawerOpen(false);
      setActive(null);
      await fetchPage(page);
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Approve failed." });
    } finally {
      setWorking(false);
    }
  }

  async function reject() {
    if (!active) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setBanner({ type: "error", text: "Enter a rejection reason." });
      return;
    }

    setWorking(true);
    setBanner(null);

    try {
      const r1 = await tryRpc("reject_vendor_verification", { p_request_id: active.id, p_reason: reason });
      if (!r1.ok && r1.missing) {
        const { error: e1 } = await supabase
          .from("vendor_verification_requests")
          .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: null, rejection_reason: reason })
          .eq("id", active.id);
        if (e1) throw e1;

        const { error: e2 } = await supabase
          .from("vendors")
          .update({ verification_status: "rejected", verified: false, rejected_at: new Date().toISOString(), rejection_reason: reason })
          .eq("id", active.vendor_id);
        if (e2) throw e2;
      } else if (!r1.ok) {
        throw r1.error;
      }

      setBanner({ type: "success", text: "Rejected." });
      setDrawerOpen(false);
      setActive(null);
      await fetchPage(page);
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Reject failed." });
    } finally {
      setWorking(false);
    }
  }

  async function openDoc(path: string) {
    try {
      const bucket = "vendor-verification";
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Could not open document." });
    }
  }

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Pending food vendor applications */}
      <PendingFoodVendors />

      <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-zinc-900">Vendor Verification</p>
            <p className="mt-1 text-sm text-zinc-600">Review requests, check docs, approve or reject with reasons.</p>
          </div>

          <button
            onClick={() => fetchPage(page)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            type="button"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_220px]">
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search by name, location, phone…"
            />
            {q ? (
              <button onClick={() => setQ("")} className="rounded-xl border bg-white p-2 hover:bg-zinc-50" type="button">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="h-11 rounded-2xl border bg-white px-3 text-sm"
          >
            <option value="all">All types</option>
            <option value="food">Food</option>
            <option value="mall">Mall</option>
            <option value="student">Student</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              { k: "inbox", label: "Requested" },
              { k: "under_review", label: "Under review" },
              { k: "approved", label: "Approved" },
              { k: "rejected", label: "Rejected" },
              { k: "all", label: "All" },
            ] as const
          ).map((t) => {
            const active = tab === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                  "focus:outline-none focus:ring-2 focus:ring-black/10",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                )}
                type="button"
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <BannerView banner={banner} onClose={() => setBanner(null)} />
        </div>
      </div>

      {/* List */}
      <section className="space-y-3">
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl border bg-white p-4">
                <div className="h-4 w-1/2 rounded bg-zinc-100" />
                <div className="mt-2 h-3 w-1/3 rounded bg-zinc-100" />
                <div className="mt-4 h-10 w-full rounded-2xl bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border bg-white p-6 text-center">
            <p className="text-sm font-semibold text-zinc-900">No requests found</p>
            <p className="mt-1 text-sm text-zinc-600">Try changing filters or search.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => {
              const v = r.vendors;
              const name = v?.name ?? "Vendor";
              const phone = normalizePhone(v?.phone ?? v?.whatsapp ?? "");
              const loc = v?.location ?? "Location not set";
              const vt = v?.vendor_type ? TYPE_LABEL[v.vendor_type] : "Unknown";
              const isVerified = (v?.verification_status ?? "") === "verified" || v?.verified === true;

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openDrawer(r)}
                  className="text-left rounded-3xl border bg-white p-4 shadow-sm transition hover:bg-zinc-50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-zinc-900">{name}</p>
                        <MiniBadge verified={isVerified} />
                        <span className="rounded-full border bg-white px-2 py-1 text-[10px] font-semibold text-zinc-700">
                          {vt}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {loc}
                        </span>
                        {phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {phone}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <StatusPill status={r.status} />
                      <span className="text-xs text-zinc-500">
                        {new Date(r.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>

                  {r.rejection_reason ? (
                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                      Reason: {r.rejection_reason}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between rounded-3xl border bg-white p-3">
          <p className="text-xs text-zinc-600">
            Page <span className="font-semibold text-zinc-900">{page}</span> of {pages} • {total} total
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = Math.max(1, page - 1);
                setPage(next);
                fetchPage(next);
              }}
              disabled={page <= 1 || loading}
              className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                const next = Math.min(pages, page + 1);
                setPage(next);
                fetchPage(next);
              }}
              disabled={page >= pages || loading}
              className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Drawer */}
      {drawerOpen && active ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 border-b bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-zinc-900">{active.vendors?.name ?? "Vendor"}</p>
                  <p className="mt-1 text-xs text-zinc-600">Request ID: {active.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-2xl border bg-white p-2 hover:bg-zinc-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill status={active.status} />
                <span className="rounded-full border bg-white px-2 py-1 text-[10px] font-semibold text-zinc-700">
                  <Store className="mr-1 inline h-3.5 w-3.5" />
                  {active.vendors?.vendor_type ? TYPE_LABEL[active.vendors.vendor_type] : "Unknown"}
                </span>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <BannerView banner={banner} onClose={() => setBanner(null)} />

              <div className="rounded-3xl border bg-white p-4">
                <p className="text-sm font-semibold text-zinc-900">Vendor details</p>

                <div className="mt-3 space-y-2 text-sm text-zinc-700">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{active.vendors?.location ?? "Location not set"}</span>
                  </p>
                  {active.vendors?.phone || active.vendors?.whatsapp ? (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{active.vendors?.phone ?? active.vendors?.whatsapp}</span>
                    </p>
                  ) : null}

                  <div className="pt-2">
                    <Link
                      href={`/vendors/${active.vendor_id}`}
                      className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                    >
                      View public profile
                      <ArrowRightIcon />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border bg-white p-4">
                <p className="text-sm font-semibold text-zinc-900">Documents</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Bucket: <span className="font-semibold">vendor-verification</span>
                </p>

                {docsLoading ? (
                  <div className="mt-3 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-12 rounded-2xl bg-zinc-100" />
                    ))}
                  </div>
                ) : docs.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-600">No docs uploaded.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {docs.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900">{d.doc_type}</p>
                          <p className="truncate text-xs text-zinc-600">{d.file_path}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openDoc(d.file_path)}
                          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          <FileText className="h-4 w-4" />
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border bg-white p-4">
                <p className="text-sm font-semibold text-zinc-900">Admin actions</p>
                <p className="mt-1 text-xs text-zinc-600">Use RPC functions for atomic updates (recommended).</p>

                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={markUnderReview}
                    disabled={working || active.status !== "requested"}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                  >
                    {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    Mark under review
                  </button>

                  <button
                    type="button"
                    onClick={approve}
                    disabled={working || (active.status !== "requested" && active.status !== "under_review")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve
                  </button>

                  <div className="rounded-2xl border bg-white p-3">
                    <p className="text-xs font-semibold text-zinc-700">Reject with reason</p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="mt-2 w-full rounded-2xl border bg-white p-3 text-sm outline-none"
                      rows={3}
                      placeholder="e.g. Document unclear, phone mismatch, incomplete profile…"
                    />
                    <button
                      type="button"
                      onClick={reject}
                      disabled={working || (active.status !== "requested" && active.status !== "under_review")}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                    >
                      {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                      Reject
                    </button>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border bg-zinc-50 p-3 text-xs text-zinc-700">
                  If RPC functions are missing, this page falls back to direct updates (less safe). Run the SQL file in
                  <span className="font-semibold"> /supabase/vendor_verification_system.sql</span>.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ArrowRightIcon() {
  return <span className="inline-flex h-4 w-4 items-center justify-center">→</span>;
}
