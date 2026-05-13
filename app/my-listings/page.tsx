// app/my-listings/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ListingRow } from "@/lib/types";
import {
  Search,
  Plus,
  LayoutGrid,
  List as ListIcon,
  ArrowRight,
  Trash2,
  Pencil,
  CheckCircle2,
  RotateCcw,
  Eye,
  EyeOff,
  X,
  MessageCircle,
  Heart,
  BarChart2,
  ArrowUp,
} from "lucide-react";

type Tab = "active" | "sold" | "inactive";
type ViewMode = "grid" | "table";
type Banner = { type: "success" | "error" | "info"; text: string } | null;

const PAGE_SIZE = 12;

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isNoRowError(err: any) {
  const msg = String(err?.message ?? "");
  const code = String(err?.code ?? "");
  return code === "PGRST116" || msg.toLowerCase().includes("0 rows");
}

function Chip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn";
  children: React.ReactNode;
}) {
  const styles =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-zinc-50 text-zinc-700 border-zinc-200";
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs", styles)}>
      {children}
    </span>
  );
}

function BannerView({ banner }: { banner: Banner }) {
  if (!banner) return null;
  const base = "rounded-2xl border p-3 text-sm";
  const tone =
    banner.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : banner.type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-zinc-200 bg-zinc-50 text-zinc-800";
  return <div className={cx(base, tone)}>{banner.text}</div>;
}

function Skeleton({ className }: { className: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-zinc-100", className)} />;
}

function StatusPill({ status }: { status: ListingRow["status"] }) {
  const s = status;
  const cls =
    s === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "sold"
      ? "bg-zinc-100 text-zinc-700 border-zinc-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium", cls)}>
      {s.toUpperCase()}
    </span>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-full px-3 py-2 text-sm border transition",
        active ? "bg-black text-white border-black" : "bg-white text-zinc-700 hover:bg-zinc-50"
      )}
    >
      {children}
    </button>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl p-3 sm:inset-0 sm:flex sm:items-center sm:justify-center">
        <div className="w-full rounded-3xl border bg-white p-4 shadow-xl sm:max-w-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{title}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border bg-white p-2 text-zinc-700 hover:bg-zinc-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function MyListingsPage() {
  const router = useRouter();
  const aliveRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<Banner>(null);

  const [tab, setTab] = useState<Tab>("active");
  const [view, setView] = useState<ViewMode>("grid");

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, { views: number; contact_clicks: number; saves: number }>>({});
  const [counts, setCounts] = useState({ active: 0, sold: 0, inactive: 0 });

  const [qInput, setQInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [soldId, setSoldId] = useState<string | null>(null);
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [bumpMessages, setBumpMessages] = useState<Record<string, string>>({});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ListingRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // persist view mode
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("jm_my_listings_view");
      if (stored === "grid" || stored === "table") setView(stored);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("jm_my_listings_view", view);
    } catch {}
  }, [view]);

  // auto-dismiss banners
  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), 4500);
    return () => window.clearTimeout(id);
  }, [banner]);

  function toast(next: Banner) {
    setBanner(next);
  }

  const emptyText = useMemo(() => {
    if (tab === "active") return "No active listings yet.";
    if (tab === "sold") return "No sold listings yet.";
    return "No inactive listings yet.";
  }, [tab]);

  async function ensureVendor(): Promise<string | null> {
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr) {
      const m = String(userErr.message ?? "").toLowerCase();
      if (m.includes("auth session missing") || m.includes("session missing")) {
        router.replace("/login");
        return null;
      }
      toast({ type: "error", text: userErr.message });
      return null;
    }

    const user = userData.user;
    if (!user) {
      router.replace("/login");
      return null;
    }

    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (vendorErr) {
      if (isNoRowError(vendorErr)) {
        // Friendly path: ask them to complete profile on /me
        toast({ type: "info", text: "Complete your vendor profile before managing listings." });
        return null;
      }
      toast({ type: "error", text: vendorErr.message });
      return null;
    }

    return vendor.id as string;
  }

  async function loadCounts(vId: string) {
    // head:true avoids fetching rows; count gives totals
    const base = (status: Tab) =>
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("vendor_id", vId).eq("status", status);

    const [a, s, i] = await Promise.all([base("active"), base("sold"), base("inactive")]);

    if (!aliveRef.current) return;

    setCounts({
      active: a.count ?? 0,
      sold: s.count ?? 0,
      inactive: i.count ?? 0,
    });
  }

  async function load(currentTab: Tab, currentPage: number, currentQuery: string, vId?: string) {
    setBanner(null);
    setLoading(true);

    try {
      const vid = vId ?? (await ensureVendor());
      if (!vid) {
        setLoading(false);
        setVendorId(null);
        setListings([]);
        setHasMore(false);
        return;
      }

      setVendorId(vid);

      // counts can load in parallel (non-blocking)
      loadCounts(vid).catch(() => {});

      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let req = supabase
        .from("listings")
        .select("*")
        .eq("vendor_id", vid)
        .eq("status", currentTab)
        .order("created_at", { ascending: false });

      const q = currentQuery.trim();
      if (q) {
        // Search title OR category OR location
        const like = `%${q.replace(/%/g, "")}%`;
        req = req.or(`title.ilike.${like},category.ilike.${like},location.ilike.${like}`);
      }

      req = req.range(from, to);

      const { data, error } = await req;

      if (error) {
        toast({ type: "error", text: error.message });
        setListings([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as ListingRow[];
      setListings(rows);
      setHasMore(rows.length === PAGE_SIZE);

      // Fetch stats for this page's listings in one query
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        supabase
          .from("listing_stats")
          .select("listing_id,views,contact_clicks,saves")
          .in("listing_id", ids)
          .then(({ data: sData, error: sErr }) => {
            if (sErr || !sData) return;
            const map: Record<string, { views: number; contact_clicks: number; saves: number }> = {};
            for (const s of sData) {
              map[s.listing_id] = {
                views: s.views ?? 0,
                contact_clicks: s.contact_clicks ?? 0,
                saves: s.saves ?? 0,
              };
            }
            setStatsMap(map);
          });
      }
    } catch (err: any) {
      console.error(err);
      toast({ type: "error", text: err?.message ?? "Something went wrong." });
      setListings([]);
      setHasMore(false);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    aliveRef.current = true;

    // initial load
    load(tab, page, query).catch(() => {});

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // refresh data if auth changes (login/logout)
      load(tab, page, query).catch(() => {});
    });

    return () => {
      aliveRef.current = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload when tab/query/page changes
  useEffect(() => {
    load(tab, page, query, vendorId ?? undefined).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, query]);

  // Reset page when tab/query changes
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, query]);

  function applySearch() {
    setQuery(qInput.trim());
  }

  function clearSearch() {
    setQInput("");
    setQuery("");
  }

  async function updateStatus(id: string, next: Tab) {
    if (!vendorId) return;
    setRowBusyId(id);
    setBanner(null);

    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: next })
        .eq("id", id)
        .eq("vendor_id", vendorId);

      if (error) {
        toast({ type: "error", text: error.message });
        return;
      }

      // Optimistic: remove from current list immediately
      setListings((prev) => prev.filter((x) => x.id !== id));
      toast({ type: "success", text: `Updated to ${next.toUpperCase()} ✅` });

      // refresh counts
      loadCounts(vendorId).catch(() => {});
    } finally {
      setRowBusyId(null);
    }
  }

  async function markSold(id: string) {
    if (!vendorId) return;
    setSoldId(id);
    try {
      await supabase.from("listings").update({ status: "sold" }).eq("id", id).eq("vendor_id", vendorId);
      loadCounts(vendorId).catch(() => {});
      setTimeout(() => {
        setSoldId(null);
        setListings((prev) => prev.filter((x) => x.id !== id));
      }, 2000);
    } catch {
      setSoldId(null);
    }
  }

  function openDelete(l: ListingRow) {
    setDeleteTarget(l);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!vendorId || !deleteTarget) return;
    setDeleting(true);
    setBanner(null);

    try {
      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("vendor_id", vendorId);

      if (error) {
        toast({ type: "error", text: error.message });
        return;
      }

      setListings((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      toast({ type: "success", text: "Listing deleted ✅" });
      loadCounts(vendorId).catch(() => {});
      setDeleteOpen(false);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleBump(listingId: string) {
    if (bumpingId) return;
    setBumpingId(listingId);
    setBumpMessages((prev) => ({ ...prev, [listingId]: "" }));
    try {
      const res = await fetch("/api/marketplace/bump-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const json = await res.json() as { ok: boolean; code?: string; message?: string; next_bump_at?: string };
      if (!json.ok) {
        if (json.code === "TOO_SOON" && json.next_bump_at) {
          const nextTime = new Date(json.next_bump_at).toLocaleString("en-NG", {
            month: "short", day: "2-digit", hour: "numeric", minute: "2-digit",
          });
          setBumpMessages((prev) => ({ ...prev, [listingId]: `Next bump available ${nextTime}` }));
        } else {
          setBumpMessages((prev) => ({ ...prev, [listingId]: json.message ?? "Bump failed." }));
        }
        return;
      }
      setBumpMessages((prev) => ({ ...prev, [listingId]: "Bumped to top ✓" }));
      setTimeout(() => setBumpMessages((prev) => ({ ...prev, [listingId]: "" })), 3000);
    } catch {
      setBumpMessages((prev) => ({ ...prev, [listingId]: "Bump failed." }));
    } finally {
      setBumpingId(null);
    }
  }

  const toolbarHint = useMemo(() => {
    if (tab === "active") return "Active listings are visible on Explore.";
    if (tab === "inactive") return "Inactive listings are hidden from Explore.";
    return "Sold listings stay visible (optional) but marked as sold.";
  }, [tab]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Header */}
      <div className="rounded-3xl border bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-900">My Listings</h1>
              <Chip>
                {counts.active + counts.sold + counts.inactive} total
              </Chip>
            </div>
            <p className="mt-1 text-sm text-zinc-600">Manage what you’ve posted.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/post"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 sm:w-auto no-underline"
            >
              <Plus className="h-4 w-4" />
              Post Listing
            </Link>

            <Link
              href="/me"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 sm:w-auto no-underline"
            >
              Account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border bg-zinc-50 p-3">
            <p className="text-xs text-zinc-600">Active</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">{counts.active}</p>
          </div>
          <div className="rounded-2xl border bg-zinc-50 p-3">
            <p className="text-xs text-zinc-600">Sold</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">{counts.sold}</p>
          </div>
          <div className="rounded-2xl border bg-zinc-50 p-3">
            <p className="text-xs text-zinc-600">Inactive</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">{counts.inactive}</p>
          </div>
        </div>
      </div>

      <BannerView banner={banner} />

      {/* Controls */}
      <div className="rounded-3xl border bg-white p-4 sm:p-5 space-y-3">
        {/* Tabs (scrollable on small screens) */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <TabBtn active={tab === "active"} onClick={() => setTab("active")}>
            Active
          </TabBtn>
          <TabBtn active={tab === "sold"} onClick={() => setTab("sold")}>
            Sold
          </TabBtn>
          <TabBtn active={tab === "inactive"} onClick={() => setTab("inactive")}>
            Inactive
          </TabBtn>
        </div>

        {/* Search + view toggle */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search title, category, or location…"
            />
            {qInput || query ? (
              <button
                onClick={clearSearch}
                className="rounded-xl border bg-white p-2 text-zinc-700 hover:bg-zinc-50"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}

            <button
              onClick={applySearch}
              className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Search
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <p className="text-xs text-zinc-500">{toolbarHint}</p>

            <div className="inline-flex overflow-hidden rounded-2xl border bg-white">
              <button
                onClick={() => setView("grid")}
                className={cx(
                  "inline-flex items-center gap-2 px-3 py-2 text-sm",
                  view === "grid" ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-50"
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setView("table")}
                className={cx(
                  "inline-flex items-center gap-2 px-3 py-2 text-sm",
                  view === "table" ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-50"
                )}
                aria-label="Table view"
              >
                <ListIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Missing vendor profile path */}
      {!vendorId && !loading ? (
        <div className="rounded-3xl border bg-white p-5">
          <p className="text-sm font-semibold text-zinc-900">Set up your vendor profile</p>
          <p className="mt-1 text-sm text-zinc-600">
            You need a vendor profile to manage listings. Complete it first, then come back here.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/me"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 no-underline"
            >
              Go to Account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/post"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 no-underline"
            >
              Try posting anyway
              <Plus className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        view === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl border bg-white overflow-hidden">
                <Skeleton className="h-36 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-3/5" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border bg-white p-4">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              ))}
            </div>
          </div>
        )
      ) : listings.length === 0 ? (
        <div className="rounded-3xl border bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold text-zinc-900">{emptyText}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {query ? "Try a different search term, or clear search." : "Post a listing to get started."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/post"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 no-underline"
            >
              <Plus className="h-4 w-4" />
              Post Listing
            </Link>
            {query ? (
              <button
                onClick={clearSearch}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Clear search
              </button>
            ) : (
              <Link
                href="/explore"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 no-underline"
              >
                Browse marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      ) : view === "grid" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const priceText =
                l.price !== null ? formatNaira(l.price) : l.price_label ?? "Contact for price";

              const busy = rowBusyId === l.id;

              return (
                <div key={l.id} className="rounded-3xl border bg-white overflow-hidden">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={l.image_url ?? "https://placehold.co/1200x900?text=JabuMarket"}
                      alt={l.title}
                      className="h-40 w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute left-3 top-3">
                      <StatusPill status={l.status} />
                    </div>
                    {l.negotiable ? (
                      <div className="absolute right-3 top-3">
                        <Chip tone="neutral">Negotiable</Chip>
                      </div>
                    ) : null}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/listing/${l.id}`} className="no-underline">
                          <p className="text-sm font-semibold text-zinc-900 line-clamp-2">{l.title}</p>
                        </Link>
                        <p className="mt-1 text-sm font-bold text-zinc-900">{priceText}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {l.category} • {l.location ?? "—"}
                        </p>
                      </div>
                    </div>

                    {/* Stats strip */}
                    {(() => {
                      const s = statsMap[l.id];
                      const views = s?.views ?? 0;
                      const contacts = s?.contact_clicks ?? 0;
                      const saves = s?.saves ?? 0;
                      return (
                        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                          <span className="flex items-center gap-1" title="Views">
                            <Eye className="h-3.5 w-3.5 text-zinc-400" />
                            {views.toLocaleString()}
                          </span>
                          <span className="text-zinc-200">|</span>
                          <span className="flex items-center gap-1" title="Contact taps">
                            <MessageCircle className="h-3.5 w-3.5 text-zinc-400" />
                            {contacts.toLocaleString()}
                          </span>
                          <span className="text-zinc-200">|</span>
                          <span className="flex items-center gap-1" title="Saves">
                            <Heart className="h-3.5 w-3.5 text-zinc-400" />
                            {saves.toLocaleString()}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/listing/${l.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50 no-underline"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Link>

                      <Link
                        href={`/listing/${l.id}/edit`}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50 no-underline"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Link>

                      {l.status === "active" ? (
                        <>
                          <button
                            onClick={() => handleBump(l.id)}
                            disabled={bumpingId === l.id}
                            className={cx(
                              "inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50",
                              bumpingId === l.id && "opacity-60"
                            )}
                          >
                            <ArrowUp className="h-4 w-4" />
                            Bump ↑
                          </button>
                          <button
                            onClick={() => markSold(l.id)}
                            disabled={soldId === l.id}
                            className={cx(
                              "inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100",
                              soldId === l.id && "border-emerald-200 bg-emerald-50 text-emerald-700"
                            )}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {soldId === l.id ? "Sold ✓" : "Mark sold"}
                          </button>
                          <button
                            onClick={() => updateStatus(l.id, "inactive")}
                            disabled={busy}
                            className={cx(
                              "inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50",
                              busy && "opacity-60"
                            )}
                          >
                            <EyeOff className="h-4 w-4" />
                            Hide
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => updateStatus(l.id, "active")}
                          disabled={busy}
                          className={cx(
                            "inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-3 py-2 text-xs font-medium text-white hover:opacity-90",
                            busy && "opacity-60"
                          )}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Re-activate
                        </button>
                      )}

                      <button
                        onClick={() => openDelete(l)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                    {bumpMessages[l.id] ? (
                      <p className="mt-1 text-xs text-zinc-500">{bumpMessages[l.id]}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50",
                page === 0 && "opacity-60"
              )}
            >
              Previous
            </button>

            <p className="text-xs text-zinc-500">Page {page + 1}</p>

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50",
                !hasMore && "opacity-60"
              )}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Table view (mobile-first: stacked rows) */}
          <div className="rounded-3xl border bg-white overflow-hidden">
            <div className="hidden sm:grid sm:grid-cols-[1fr_140px_120px_160px_220px] gap-3 border-b bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-700">
              <div>Listing</div>
              <div>Price</div>
              <div>Status</div>
              <div className="flex items-center gap-1"><BarChart2 className="h-3.5 w-3.5" /> Stats</div>
              <div className="text-right">Actions</div>
            </div>

            <div className="divide-y">
              {listings.map((l) => {
                const priceText =
                  l.price !== null ? formatNaira(l.price) : l.price_label ?? "Contact for price";
                const busy = rowBusyId === l.id;

                return (
                  <div key={l.id} className="p-4 sm:grid sm:grid-cols-[1fr_140px_120px_160px_220px] sm:items-center sm:gap-3">
                    <div className="min-w-0">
                      <Link href={`/listing/${l.id}`} className="no-underline">
                        <p className="text-sm font-semibold text-zinc-900 line-clamp-2">{l.title}</p>
                      </Link>
                      <p className="mt-1 text-xs text-zinc-500">
                        {l.category} • {l.location ?? "—"}
                      </p>
                    </div>

                    <div className="mt-2 text-sm font-bold text-zinc-900 sm:mt-0">{priceText}</div>

                    <div className="mt-2 sm:mt-0">
                      <StatusPill status={l.status} />
                    </div>

                    {/* Stats cell */}
                    <div className="mt-2 sm:mt-0">
                      {(() => {
                        const s = statsMap[l.id];
                        return (
                          <div className="flex flex-col gap-0.5 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {(s?.views ?? 0).toLocaleString()} views
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {(s?.contact_clicks ?? 0).toLocaleString()} contacts
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {(s?.saves ?? 0).toLocaleString()} saves
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
                      <Link
                        href={`/listing/${l.id}/edit`}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50 no-underline"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Link>

                      {l.status === "active" ? (
                        <>
                          <button
                            onClick={() => handleBump(l.id)}
                            disabled={bumpingId === l.id}
                            className={cx(
                              "inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50",
                              bumpingId === l.id && "opacity-60"
                            )}
                          >
                            <ArrowUp className="h-4 w-4" />
                            Bump ↑
                          </button>
                          <button
                            onClick={() => markSold(l.id)}
                            disabled={soldId === l.id}
                            className={cx(
                              "inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100",
                              soldId === l.id && "border-emerald-200 bg-emerald-50 text-emerald-700"
                            )}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {soldId === l.id ? "Sold ✓" : "Mark sold"}
                          </button>
                          <button
                            onClick={() => updateStatus(l.id, "inactive")}
                            disabled={busy}
                            className={cx(
                              "inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50",
                              busy && "opacity-60"
                            )}
                          >
                            <EyeOff className="h-4 w-4" />
                            Hide
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => updateStatus(l.id, "active")}
                          disabled={busy}
                          className={cx(
                            "inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-3 py-2 text-xs font-medium text-white hover:opacity-90",
                            busy && "opacity-60"
                          )}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Re-activate
                        </button>
                      )}

                      <button
                        onClick={() => openDelete(l)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50",
                page === 0 && "opacity-60"
              )}
            >
              Previous
            </button>

            <p className="text-xs text-zinc-500">Page {page + 1}</p>

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50",
                !hasMore && "opacity-60"
              )}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Delete modal */}
      <Modal
        open={deleteOpen}
        title="Delete listing?"
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
      >
        <p className="text-sm text-zinc-700">
          This will permanently delete{" "}
          <span className="font-semibold text-zinc-900">{deleteTarget?.title ?? "this listing"}</span>.
          This action can’t be undone.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => {
              if (deleting) return;
              setDeleteOpen(false);
              setDeleteTarget(null);
            }}
            className="inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleting}
            className={cx(
              "inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90",
              deleting && "opacity-60"
            )}
          >
            {deleting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}