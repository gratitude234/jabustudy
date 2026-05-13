"use client";
// app/admin/riders/page.tsx
import { cn } from "@/lib/utils";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { RiderRow } from "@/lib/types";
import { CheckCircle2, Loader2, Search, X, RefreshCcw, AlertTriangle } from "lucide-react";

type AdminRider = RiderRow;

type Banner = { type: "success" | "error" | "info"; text: string } | null;

const PAGE_SIZE = 25;

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
      <button onClick={onClose} className="rounded-xl border bg-white/70 p-2 hover:bg-white" aria-label="Close">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AdminRidersPage() {
  const mounted = useRef(true);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminRider[]>([]);
  const [banner, setBanner] = useState<Banner>(null);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"pending" | "verified" | "all">("pending");
  const [availability, setAvailability] = useState<"all" | "available" | "busy">("all");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const [workingIds, setWorkingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function fetchPage(nextPage = page) {
    setLoading(true);
    setBanner(null);

    const from = (nextPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("riders")
      .select("id, name, phone, whatsapp, zone, fee_note, is_available, verified, created_at", { count: "exact" });

    if (tab === "pending") query = query.eq("verified", false);
    if (tab === "verified") query = query.eq("verified", true);

    if (availability === "available") query = query.eq("is_available", true);
    if (availability === "busy") query = query.eq("is_available", false);

    const needle = q.trim();
    if (needle) query = query.or(`name.ilike.%${needle}%,phone.ilike.%${needle}%,whatsapp.ilike.%${needle}%`);

    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);

    if (!mounted.current) return;

    if (error) {
      setBanner({ type: "error", text: error.message });
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as AdminRider[]);
    setTotal(count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    fetchPage(1);
    setPage(1);
    setSelected({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, availability]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      fetchPage(1);
      setPage(1);
      setSelected({});
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggleAll(checked: boolean) {
    if (!checked) return setSelected({});
    const next: Record<string, boolean> = {};
    rows.forEach((r) => (next[r.id] = true));
    setSelected(next);
  }

  async function bulkUpdate(ids: string[], patch: Partial<AdminRider>, successText: string) {
    if (!ids.length) return;
    setBanner(null);

    const nextWorking: Record<string, boolean> = {};
    ids.forEach((id) => (nextWorking[id] = true));
    setWorkingIds((p) => ({ ...p, ...nextWorking }));

    try {
      const { error } = await supabase.from("riders").update(patch).in("id", ids);
      if (error) throw error;
      setBanner({ type: "success", text: successText });
      setSelected({});
      await fetchPage(page);
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Update failed" });
    } finally {
      setWorkingIds((prev) => {
        const copy = { ...prev };
        ids.forEach((id) => delete copy[id]);
        return copy;
      });
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-zinc-900">Delivery Agents</p>
            <p className="mt-1 text-sm text-zinc-600">Verify delivery agents and manage their availability in the directory.</p>
          </div>

          <button
            onClick={() => fetchPage(page)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_200px]">
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name / phone / WhatsApp…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value as any)}
            className="rounded-2xl border bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900"
          >
            <option value="all">All availability</option>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
          </select>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border bg-white p-1">
          {(["pending", "verified", "all"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold capitalize",
                tab === t ? "bg-black text-white" : "text-zinc-800 hover:bg-zinc-50"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <BannerView banner={banner} onClose={() => setBanner(null)} />

      {selectedIds.length ? (
        <div className="rounded-3xl border bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-zinc-900">{selectedIds.length} selected</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => bulkUpdate(selectedIds, { verified: true }, "Verified ✅")}
                className="rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white"
              >
                Verify
              </button>
              <button
                onClick={() => bulkUpdate(selectedIds, { verified: false }, "Unverified ✅")}
                className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Unverify
              </button>
              <button
                onClick={() => bulkUpdate(selectedIds, { is_available: true }, "Marked Available ✅")}
                className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Set Available
              </button>
              <button
                onClick={() => bulkUpdate(selectedIds, { is_available: false }, "Marked Busy ✅")}
                className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Set Busy
              </button>
              <button
                onClick={() => setSelected({})}
                className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-white px-4 py-3">
          <p className="text-sm font-semibold text-zinc-900">
            Results <span className="text-xs text-zinc-500">({total})</span>
          </p>
          {loading ? (
            <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => selected[r.id])}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="px-4 py-3">Delivery Agent</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-600">
                    No delivery agents found for this filter.
                  </td>
                </tr>
              ) : null}

              {rows.map((r) => {
                const isSelected = !!selected[r.id];
                const isWorking = !!workingIds[r.id];

                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => setSelected((p) => ({ ...p, [r.id]: e.target.checked }))}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900">{r.name ?? "Unnamed delivery agent"}</div>
                      <div className="text-xs text-zinc-500">{r.fee_note ?? ""}</div>
                    </td>

                    <td className="px-4 py-3">{r.zone ?? "-"}</td>
                    <td className="px-4 py-3">{r.phone ?? "-"}</td>
                    <td className="px-4 py-3">{r.whatsapp ?? "-"}</td>

                    <td className="px-4 py-3">
                      {r.is_available ? (
                        <span className="inline-flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" /> Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-amber-700">
                          <AlertTriangle className="h-4 w-4" /> Busy
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.verified ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                          Verified
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                          Pending
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => bulkUpdate([r.id], { verified: !r.verified }, r.verified ? "Unverified ✅" : "Verified ✅")}
                          disabled={isWorking}
                          className={cn(
                            "rounded-2xl border px-3 py-2 text-xs font-semibold",
                            r.verified ? "bg-white text-zinc-900 hover:bg-zinc-50" : "bg-black text-white hover:bg-zinc-800",
                            "disabled:opacity-50"
                          )}
                        >
                          {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {r.verified ? "Unverify" : "Verify"}
                        </button>

                        <button
                          onClick={() => bulkUpdate([r.id], { is_available: !r.is_available }, "Updated ✅")}
                          disabled={isWorking}
                          className="rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          Toggle availability
                        </button>

                        <Link
                          href={r.whatsapp ? `https://wa.me/${String(r.whatsapp).replace(/[^\d]/g, "")}` : "#"}
                          target={r.whatsapp ? "_blank" : undefined}
                          className={cn(
                            "rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 no-underline",
                            !r.whatsapp && "pointer-events-none opacity-50"
                          )}
                        >
                          WhatsApp
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-xs text-zinc-500">
            Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => {
                const p = Math.max(1, page - 1);
                setPage(p);
                setSelected({});
                fetchPage(p);
              }}
              className="rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page >= Math.max(1, Math.ceil(total / PAGE_SIZE)) || loading}
              onClick={() => {
                const p = Math.min(Math.max(1, Math.ceil(total / PAGE_SIZE)), page + 1);
                setPage(p);
                setSelected({});
                fetchPage(p);
              }}
              className="rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
