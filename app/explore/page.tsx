// app/explore/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ListingRow, ListingType, ListingCondition, RiderRow, CourierRow } from "@/lib/types";
import { LISTING_CONDITION_LABELS } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import ListingImage from "@/components/ListingImage";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Circle,
  Eye,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import MobileFilterSheet from "@/components/explore/MobileFilterSheet";
import QuickMessageButton from "@/components/explore/QuickMessageButton";
import RecentSearchesBar from "@/components/explore/RecentSearchesBar";
import ExploreNavProgress from "@/components/explore/ExploreNavProgress";
import PriceRangeSlider from "@/components/explore/PriceRangeSlider";
import VendorsClient from "@/app/vendors/VendorsClient";
import DeliveryClient from "@/app/delivery/DeliveryClient";
import CouriersClient from "@/app/couriers/CouriersClient";
import FoodPageShell from "@/app/food/FoodPageShell";
import type { FoodVendorData } from "@/app/food/FoodVendorGrid";
import { isOpenNow } from "@/lib/vendorSchedule";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Explore",
  description:
    "Browse phones, laptops, fashion, food, services and more listed by JABU students and verified vendors.",
  openGraph: {
    title: "Explore — Jabumarket",
    description:
      "Browse phones, laptops, fashion, food, services and more listed by JABU students and verified vendors.",
    type: "website",
  },
};

type ExploreTab = "listings" | "vendors" | "delivery" | "transport" | "food";
type SortKey = "relevance" | "newest" | "price_asc" | "price_desc";
type StatusKey = "active" | "inactive" | "sold";

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function buildExploreHref(params: {
  q?: string;
  type?: string;
  category?: string;
  condition?: string;
  sort?: string;
  page?: string | number;
  sold?: string;
  inactive?: string;
  min_price?: string | number;
  max_price?: string | number;
  negotiable?: string;
}) {
  const sp = new URLSearchParams();
  const q = (params.q ?? "").trim();
  const type = (params.type ?? "all").trim();
  const category = (params.category ?? "all").trim();
  const sort = (params.sort ?? "relevance").trim();
  const pageStr = String(params.page ?? "").trim();

  if (q) sp.set("q", q);
  if (type && type !== "all") sp.set("type", type);
  if (category && category !== "all") sp.set("category", category);
  // FIX #11: "smart" renamed to "relevance" — keep URL compat by treating both as default
  if (sort && sort !== "relevance" && sort !== "smart") sp.set("sort", sort);
  if (params.condition) sp.set("condition", params.condition);
  if (params.sold === "1") sp.set("sold", "1");
  if (params.inactive === "1") sp.set("inactive", "1");
  if (params.negotiable === "1") sp.set("negotiable", "1");
  const minP = String(params.min_price ?? "").trim();
  const maxP = String(params.max_price ?? "").trim();
  if (minP && minP !== "0") sp.set("min_price", minP);
  if (maxP) sp.set("max_price", maxP);
  if (pageStr && pageStr !== "1") sp.set("page", pageStr);
  const qs = sp.toString();
  return qs ? `/explore?${qs}` : "/explore";
}

function clampPage(n: number) {
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 999) return 999;
  return Math.floor(n);
}

const CATEGORIES = [
  "Phones", "Laptops", "Electronics", "Fashion", "Provisions",
  "Books & Stationery", "Food", "Beauty", "Services", "Repairs",
  "Tutoring", "Others",
];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  const supabase = await createSupabaseServerClient();
  const sp = (searchParams ? await searchParams : {}) as {
    tab?: string; q?: string; type?: string; category?: string;
    condition?: string; sort?: string; page?: string; sold?: string;
    inactive?: string; min_price?: string; max_price?: string;
    negotiable?: string; open?: string;
  };

  const activeTab = (sp.tab ?? "listings") as ExploreTab;

  // ── Vendors tab ────────────────────────────────────────────────────────────
  if (activeTab === "vendors") {
    const PER_PAGE_V = 18;
    type VendorType = "food" | "mall" | "student" | "other";
    type VSortKey = "type" | "name_asc" | "name_desc";
    const vQ = (sp.q ?? "").trim();
    const vType = (sp.type ?? "all").trim() as "all" | VendorType;
    const vSort = (sp.sort ?? "type").trim() as VSortKey;
    const vPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const vStart = (vPage - 1) * PER_PAGE_V;
    const vEnd = vStart + PER_PAGE_V - 1;

    let vQuery = supabase
      .from("vendors")
      .select("id, name, whatsapp, phone, location, verified, verification_status, vendor_type, avatar_url", { count: "exact" })
      .or("verification_status.eq.verified,verified.eq.true")
      .is("suspended_at", null);
    if (vType !== "all") vQuery = vQuery.eq("vendor_type", vType);
    if (vQ) {
      const safe = vQ.replaceAll(",", " ");
      vQuery = vQuery.or(`name.ilike.%${safe}%,location.ilike.%${safe}%`);
    }
    if (vSort === "name_asc") vQuery = vQuery.order("name", { ascending: true, nullsFirst: false });
    else if (vSort === "name_desc") vQuery = vQuery.order("name", { ascending: false, nullsFirst: false });
    else vQuery = vQuery.order("vendor_type", { ascending: true }).order("name", { ascending: true, nullsFirst: false });
    vQuery = vQuery.range(vStart, vEnd);

    const { data: vData, count: vCount, error: vErr } = await vQuery;
    const vVendors = (vData ?? []) as any[];
    type VMeta = { rating: { avg: number; count: number } | null; listingCount: number };
    let vMeta: Record<string, VMeta> = {};
    const vIds = vVendors.map((v: any) => v.id);
    if (vIds.length > 0) {
      const [revRes, lstRes] = await Promise.all([
        supabase.from("vendor_reviews").select("vendor_id, rating").in("vendor_id", vIds),
        supabase.from("listings").select("vendor_id").in("vendor_id", vIds).eq("status", "active"),
      ]);
      const rMap: Record<string, { sum: number; count: number }> = {};
      for (const r of revRes.data ?? []) {
        const e = rMap[r.vendor_id];
        rMap[r.vendor_id] = e ? { sum: e.sum + r.rating, count: e.count + 1 } : { sum: r.rating, count: 1 };
      }
      const lMap: Record<string, number> = {};
      for (const l of lstRes.data ?? []) lMap[l.vendor_id] = (lMap[l.vendor_id] ?? 0) + 1;
      for (const id of vIds) {
        const r = rMap[id];
        vMeta[id] = { rating: r ? { avg: r.sum / r.count, count: r.count } : null, listingCount: lMap[id] ?? 0 };
      }
    }
    return (
      <div className="space-y-4">
        <ExploreTabs active="vendors" />
        <VendorsClient
          initialVendors={vVendors} initialTotal={vCount ?? 0} initialMeta={vMeta}
          initialError={vErr?.message ?? null} qParam={vQ} typeParam={vType}
          sortParam={vSort} pageParam={vPage}
        />
      </div>
    );
  }

  // ── Delivery tab ───────────────────────────────────────────────────────────
  if (activeTab === "delivery") {
    const { data: ridersData } = await supabase.from("riders")
      .select("id,name,phone,whatsapp,zone,fee_note,is_available,verified,created_at")
      .order("verified", { ascending: false })
      .order("is_available", { ascending: false })
      .order("created_at", { ascending: false });
    const riders = (ridersData ?? []) as RiderRow[];
    return (
      <div className="space-y-4">
        <ExploreTabs active="delivery" />
        <div className="mx-auto max-w-2xl">
          <DeliveryClient listing={null} riders={riders} />
        </div>
      </div>
    );
  }

  // ── Transport tab ──────────────────────────────────────────────────────────
  if (activeTab === "transport") {
    const { data: couriersData, error: couriersError } = await supabase.from("couriers")
      .select("id,name,whatsapp,phone,base_location,areas_covered,hours,price_note,verified,active,featured,created_at")
      .eq("active", true).eq("verified", true)
      .order("featured", { ascending: false }).order("created_at", { ascending: false });
    const couriers = (couriersData ?? []) as CourierRow[];
    const prefill = `Hi! I need campus transport.\n\nPickup: (where to pick)\nDrop-off: (my location)\nBudget: (₦...)\n\nCan you help?`;
    return (
      <div className="space-y-4">
        <ExploreTabs active="transport" />
        <CouriersClient listingId="" listingTitle={null} listingPickup={null}
          prefill={prefill} couriers={couriers} loadError={couriersError?.message ?? null} />
      </div>
    );
  }

  // ── Food tab ───────────────────────────────────────────────────────────────
  if (activeTab === "food") {
    const onlyOpen = sp.open === "1";
    const { data: { user } } = await supabase.auth.getUser();
    let isAlreadyVendor = false;
    if (user) {
      const { data: existingVendor } = await supabase.from("vendors").select("id")
        .eq("user_id", user.id).eq("vendor_type", "food").maybeSingle();
      isAlreadyVendor = !!existingVendor;
    }
    const { data: vendors } = await supabase.from("vendors")
      .select("id, name, description, avatar_url, opens_at, closes_at, accepts_orders, accepts_delivery, day_schedule")
      .eq("vendor_type", "food").eq("accepts_orders", true)
      .or("verified.eq.true,verification_status.eq.verified")
      .is("suspended_at", null)
      .order("name", { ascending: true });
    const list = vendors ?? [];

    if (list.length === 0) {
      return (
        <div className="space-y-4">
          <ExploreTabs active="food" />
          <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
            <div>
              <h1 className="text-xl font-bold text-zinc-900">Order Food</h1>
              <p className="mt-1 text-sm text-zinc-500">Pick a vendor and build your meal</p>
            </div>
            <div className="rounded-3xl border bg-white p-8 text-center">
              <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
              <p className="font-semibold text-zinc-900">No food vendors available right now</p>
              <p className="mt-1 text-sm text-zinc-500">Check back later!</p>
            </div>
          </div>
        </div>
      );
    }

    const vendorIds = list.map((v) => v.id);
    const [reviewsRes, menuRes] = await Promise.all([
      supabase.from("vendor_reviews").select("vendor_id, rating").in("vendor_id", vendorIds),
      supabase.from("vendor_menu_items").select("vendor_id, name, emoji, stock_count")
        .in("vendor_id", vendorIds).eq("active", true)
        .order("sort_order", { ascending: true }).limit(60),
    ]);

    const ratingsMap: Record<string, { avg: number; count: number }> = {};
    for (const r of reviewsRes.data ?? []) {
      const e = ratingsMap[r.vendor_id];
      ratingsMap[r.vendor_id] = e
        ? { avg: (e.avg * e.count + r.rating) / (e.count + 1), count: e.count + 1 }
        : { avg: r.rating, count: 1 };
    }

    const menuMap: Record<string, Array<{ name: string; emoji: string; stock_count: number | null }>> = {};
    for (const item of menuRes.data ?? []) {
      if (!menuMap[item.vendor_id]) menuMap[item.vendor_id] = [];
      if (menuMap[item.vendor_id].length < 4)
        menuMap[item.vendor_id].push({ name: item.name, emoji: item.emoji ?? "🍽", stock_count: (item as any).stock_count ?? null });
    }

    const openCount = list.filter((v) => isOpenNow(v) === true).length;
    const filteredList = onlyOpen ? list.filter((v) => isOpenNow(v) === true) : list;

    function formatHour(time: string | null | undefined): string {
      if (!time) return "";
      const [h, m] = time.split(":");
      const hour = parseInt(h, 10);
      const minute = m ?? "00";
      const suffix = hour >= 12 ? "pm" : "am";
      const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return minute === "00" ? `${display}${suffix}` : `${display}:${minute}${suffix}`;
    }

    function minutesUntilWATTime(time: string | null | undefined): number | null {
      if (!time) return null;
      const [h, m] = time.split(":");
      const openMinutes = parseInt(h, 10) * 60 + parseInt(m ?? "0", 10);
      const now = new Date();
      const watMinutes = ((now.getUTCHours() + 1) * 60 + now.getUTCMinutes()) % (24 * 60);
      let diff = openMinutes - watMinutes;
      if (diff < 0) diff += 24 * 60;
      return diff;
    }

    function getVendorStatusMeta(open: boolean | null, opensAt: string | null) {
      if (open === true) {
        return { label: "Open", tone: "open" as const };
      }
      if (open === false && opensAt) {
        const minutesUntilOpen = minutesUntilWATTime(opensAt);
        if (minutesUntilOpen !== null && minutesUntilOpen <= 120) {
          return { label: `Opens at ${formatHour(opensAt)}`, tone: "soon" as const };
        }
        return { label: "Closed", tone: "closed" as const };
      }
      if (open === false) {
        return { label: "Closed", tone: "closed" as const };
      }
      return { label: null, tone: null };
    }

    return (
      <div className="space-y-4">
        <ExploreTabs active="food" />
        <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-zinc-900">Order Food</h1>
              <p className="mt-1 text-sm text-zinc-500">
                {openCount > 0 ? `${openCount} vendor${openCount !== 1 ? "s" : ""} open now` : "Pick a vendor and build your meal"}
              </p>
            </div>
            {user && (
              <Link href="/my-orders" className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground no-underline hover:bg-secondary/50">
                My Orders
              </Link>
            )}
            <Link
              href={onlyOpen ? "/explore?tab=food" : "/explore?tab=food&open=1"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition",
                onlyOpen ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              Open now
              {openCount > 0 && !onlyOpen && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">{openCount}</span>
              )}
            </Link>
          </div>

          <FoodPageShell
            vendors={filteredList.map((v) => {
              const rating = ratingsMap[v.id];
              const menuItems = menuMap[v.id] ?? [];
              const open = isOpenNow(v);
              const status = getVendorStatusMeta(open, v.opens_at);
              const hours = v.opens_at && v.closes_at ? `${formatHour(v.opens_at)} – ${formatHour(v.closes_at)}` : null;
              return {
                id: v.id, user_id: (v as any).user_id ?? null, name: v.name, description: v.description,
                avatar_url: v.avatar_url, opens_at: v.opens_at, closes_at: v.closes_at,
                open, hours, rating: rating ?? null, menuItems,
                statusLabel: status.label,
                statusTone: status.tone,
                day_schedule: (v as any).day_schedule ?? null,
                accepts_delivery: (v as any).accepts_delivery ?? null,
              } satisfies FoodVendorData;
            })}
            emptyNode={
              filteredList.length === 0 ? (
                <div className="rounded-3xl border bg-white p-8 text-center">
                  <Circle className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
                  <p className="font-semibold text-zinc-900">No vendors open right now</p>
                  <p className="mt-1 text-sm text-zinc-500">Check back during meal times.</p>
                  <Link href="/explore?tab=food" className="mt-4 inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50">
                    View all vendors
                  </Link>
                </div>
              ) : null
            }
          />

          {user && !isAlreadyVendor && (
            <div className="mt-2 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-xl">🍽</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900">Run a canteen or food stall?</p>
                  <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">
                    Students order through the app. You see a live queue, set your own hours, and get push alerts — no WhatsApp chaos.
                  </p>
                </div>
              </div>
              <Link href="/vendor/register" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-2.5 text-sm font-semibold text-white no-underline hover:bg-zinc-700">
                Sell food on Jabumarket
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Listings tab ───────────────────────────────────────────────────────────
  const qRaw = (sp.q ?? "").trim();
  const q = qRaw;
  const type = (sp.type ?? "all") as "all" | ListingType;
  const category = (sp.category ?? "all").trim();
  // FIX #11: accept legacy "smart" from URLs, treat as "relevance"
  const rawSort = (sp.sort ?? "relevance").trim();
  const sort = (rawSort === "smart" ? "relevance" : rawSort) as SortKey;

  const VALID_CONDITIONS: ListingCondition[] = ["new", "fairly_used", "used", "for_parts"];
  const conditionFilter = sp.condition && VALID_CONDITIONS.includes(sp.condition as ListingCondition)
    ? (sp.condition as ListingCondition) : null;

  const includeSold = sp.sold === "1";
  const includeInactive = sp.inactive === "1";
  const onlyNegotiable = sp.negotiable === "1";
  const minPrice = sp.min_price ? parseInt(sp.min_price, 10) : null;
  const maxPrice = sp.max_price ? parseInt(sp.max_price, 10) : null;

  const page = clampPage(Number(sp.page ?? "1"));
  const PAGE_SIZE = 24;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const statuses: StatusKey[] = ["active"];
  if (includeInactive) statuses.push("inactive");
  if (includeSold) statuses.push("sold");

  const rpcBaseParams = {
    p_q: qRaw && qRaw.length >= 2 ? qRaw : null,
    p_type: type === "all" ? "all" : type,
    p_category: category,
    p_statuses: statuses,
    p_min_price: minPrice ?? null,
    p_max_price: maxPrice ?? null,
    p_negotiable: onlyNegotiable ? true : null,
    p_condition: conditionFilter ?? null,
  } as const;

  let listings: ListingRow[] = [];
  let error: any = null;
  let count: number | null = null;

  if (sort === "relevance") {
    const [rankedResult, countResult] = await Promise.all([
      supabase.rpc("explore_ranked_listings", { ...rpcBaseParams, p_from: from, p_to: to }),
      supabase.rpc("explore_ranked_count", rpcBaseParams),
    ]);
    listings = (rankedResult.data ?? []) as ListingRow[];
    count = typeof countResult.data === "number" ? countResult.data : null;
    error = rankedResult.error ?? countResult.error ?? null;
  } else {
    let query = supabase.from("listings").select(
      "id,title,description,listing_type,category,condition,price,price_label,location,image_url,negotiable,status,created_at,vendor_id"
    );
    let countQuery = supabase.from("listings").select("id", { count: "exact", head: true });

    const applyFilters = <T extends typeof query | typeof countQuery>(q: T): T => {
      if (type !== "all") q = (q as typeof query).eq("listing_type", type) as T;
      if (category !== "all") q = (q as typeof query).eq("category", category) as T;
      q = (q as typeof query).in("status", statuses) as T;
      if (minPrice !== null && Number.isFinite(minPrice)) q = (q as typeof query).gte("price", minPrice) as T;
      if (maxPrice !== null && Number.isFinite(maxPrice)) q = (q as typeof query).lte("price", maxPrice) as T;
      if (onlyNegotiable) q = (q as typeof query).eq("negotiable", true) as T;
      if (conditionFilter) q = (q as typeof query).eq("condition", conditionFilter) as T;
      if (qRaw && qRaw.length >= 2) {
        q = (q as typeof query).textSearch("search_vector", qRaw, { type: "websearch", config: "english" }) as T;
      }
      q = (q as typeof query).not("vendor_id", "in", `(select id from vendors where vendor_type = 'food')`) as T;
      return q;
    };

    query = applyFilters(query);
    countQuery = applyFilters(countQuery);

    if (sort === "price_asc") {
      query = query.order("price", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    } else if (sort === "price_desc") {
      query = query.order("price", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }
    query = query.range(from, to);

    const [{ data, error: dataError }, { count: c, error: countError }] = await Promise.all([query, countQuery]);
    listings = (data ?? []) as ListingRow[];
    count = c ?? null;
    error = dataError ?? countError ?? null;
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : from + 1;
  const showingTo = Math.min(total, to + 1);

  type VendorSnippet = {
    id: string;
    name: string | null;
    location: string | null;
    verified: boolean | null;
    verification_status: string | null;
    vendor_type: string | null;
    avatar_url: string | null;
  };
  let vendorMap: Record<string, VendorSnippet> = {};
  let statsMap: Record<string, { views: number; saves: number }> = {};

  const listingIds = listings.map((l) => l.id);
  const vendorIds = [...new Set(listings.map((l) => (l as any).vendor_id).filter(Boolean))] as string[];

  const parallelFetches: Promise<void>[] = [];
  if (vendorIds.length > 0) {
    parallelFetches.push(
      (async () => {
        const { data } = await supabase.from("vendors")
          .select("id, name, location, verified, verification_status, vendor_type, avatar_url")
          .in("id", vendorIds);
        for (const v of data ?? []) vendorMap[v.id] = v as VendorSnippet;
      })()
    );
  }
  if (listingIds.length > 0) {
    parallelFetches.push(
      (async () => {
        const { data } = await supabase.from("listing_stats")
          .select("listing_id, views, saves")
          .in("listing_id", listingIds);
        for (const s of data ?? [])
          statsMap[s.listing_id] = { views: Number(s.views ?? 0), saves: Number(s.saves ?? 0) };
      })()
    );
  }
  await Promise.all(parallelFetches);

  const activeFilters = {
    q, type, category, condition: conditionFilter ?? "", sort,
    sold: includeSold ? "1" : "", inactive: includeInactive ? "1" : "",
    negotiable: onlyNegotiable ? "1" : "",
    min_price: minPrice !== null ? String(minPrice) : "",
    max_price: maxPrice !== null ? String(maxPrice) : "",
  };

  const hasAnyFilter =
    !!q || type !== "all" || category !== "all" || !!conditionFilter ||
    sort !== "relevance" || includeSold || includeInactive || onlyNegotiable ||
    minPrice !== null || maxPrice !== null;

  const clearSearchHref = buildExploreHref({ ...activeFilters, q: "", page: 1 });

  // ── Shared filter panel content (rendered once, used in both sidebar + sheet)
  const filterContent = (
    <div className="space-y-5">
      {/* Type */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Type</p>
        <div className="flex flex-wrap gap-2">
          <Pill href={buildExploreHref({ ...activeFilters, type: "all", page: 1 })} active={type === "all"} label="All" />
          <Pill href={buildExploreHref({ ...activeFilters, type: "product", page: 1 })} active={type === "product"} label="Products" />
          <Pill href={buildExploreHref({ ...activeFilters, type: "service", page: 1 })} active={type === "service"} label="Services" />
        </div>
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Sort</p>
        <div className="grid grid-cols-2 gap-2">
          {/* FIX #11: "Smart" → "Relevance" */}
          <SortLink href={buildExploreHref({ ...activeFilters, sort: "relevance", page: 1 })} active={sort === "relevance"} label="Relevance" />
          <SortLink href={buildExploreHref({ ...activeFilters, sort: "newest", page: 1 })} active={sort === "newest"} label="Newest" />
          <SortLink href={buildExploreHref({ ...activeFilters, sort: "price_asc", page: 1 })} active={sort === "price_asc"} label="Price ↑" />
          <SortLink href={buildExploreHref({ ...activeFilters, sort: "price_desc", page: 1 })} active={sort === "price_desc"} label="Price ↓" />
        </div>
      </div>

      {/* Negotiable */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Options</p>
        <SmallToggle href={buildExploreHref({ ...activeFilters, negotiable: onlyNegotiable ? "" : "1", page: 1 })} active={onlyNegotiable} label="Negotiable only" />
      </div>

      {/* Condition */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Condition</p>
        <div className="flex flex-wrap gap-2">
          <Pill href={buildExploreHref({ ...activeFilters, condition: "", page: 1 })} active={!conditionFilter} label="Any" />
          {(Object.entries(LISTING_CONDITION_LABELS) as [ListingCondition, string][]).map(([value, label]) => (
            <Pill key={value}
              href={buildExploreHref({ ...activeFilters, condition: conditionFilter === value ? "" : value, page: 1 })}
              active={conditionFilter === value} label={label} />
          ))}
        </div>
      </div>

      {/* Price range */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Price range (₦)</p>
        <PriceRangeSlider
          currentMin={minPrice} currentMax={maxPrice}
          baseHref={buildExploreHref({ ...activeFilters, min_price: "", max_price: "", page: 1 })}
        />
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Visibility</p>
        <div className="flex flex-wrap items-center gap-2">
          <SmallToggle href={buildExploreHref({ ...activeFilters, sold: includeSold ? "" : "1", page: 1 })} active={includeSold} label="Include sold" />
          <SmallToggle href={buildExploreHref({ ...activeFilters, inactive: includeInactive ? "" : "1", page: 1 })} active={includeInactive} label="Include inactive" />
        </div>
      </div>

      {/* Category — desktop only (mobile has the chip strip) */}
      <div className="hidden md:block space-y-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Category</p>
        <div className="grid grid-cols-1 gap-1.5">
          <Chip href={buildExploreHref({ ...activeFilters, category: "all", page: 1 })} active={category === "all"} label="All" />
          {CATEGORIES.map((c) => (
            <Chip key={c} href={buildExploreHref({ ...activeFilters, category: c, page: 1 })}
              active={category.toLowerCase() === c.toLowerCase()} label={c} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Link href="/explore" className="rounded-2xl border bg-white px-4 py-2 text-sm text-zinc-800 no-underline hover:bg-zinc-50">
          Reset all
        </Link>
        <span className="text-xs text-zinc-400">{hasAnyFilter ? "Filtered" : "All listings"}</span>
      </div>
    </div>
  );

  // ── Active filter chips (shared row) ───────────────────────────────────────
  const activeChips = hasAnyFilter ? (
    // FIX #7: scrollbar-width:none on the actual flex row, not a parent wrapper
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {q ? <ActiveChip label={`"${q}"`} href={clearSearchHref} /> : null}
      {type !== "all" ? <ActiveChip label={type === "product" ? "Products" : "Services"} href={buildExploreHref({ ...activeFilters, type: "all", page: 1 })} /> : null}
      {category !== "all" ? <ActiveChip label={category} href={buildExploreHref({ ...activeFilters, category: "all", page: 1 })} /> : null}
      {sort !== "relevance" ? (
        <ActiveChip label={sort === "price_asc" ? "Price ↑" : sort === "price_desc" ? "Price ↓" : "Newest"}
          href={buildExploreHref({ ...activeFilters, sort: "relevance", page: 1 })} />
      ) : null}
      {onlyNegotiable ? <ActiveChip label="Negotiable" href={buildExploreHref({ ...activeFilters, negotiable: "", page: 1 })} /> : null}
      {conditionFilter ? <ActiveChip label={LISTING_CONDITION_LABELS[conditionFilter]} href={buildExploreHref({ ...activeFilters, condition: "", page: 1 })} /> : null}
      {minPrice !== null || maxPrice !== null ? (
        <ActiveChip
          label={`₦${minPrice !== null ? minPrice.toLocaleString("en-NG") : "0"} – ${maxPrice !== null ? "₦" + maxPrice.toLocaleString("en-NG") : "any"}`}
          href={buildExploreHref({ ...activeFilters, min_price: "", max_price: "", page: 1 })}
        />
      ) : null}
      {includeSold ? <ActiveChip label="Sold" href={buildExploreHref({ ...activeFilters, sold: "", page: 1 })} /> : null}
      {includeInactive ? <ActiveChip label="Inactive" href={buildExploreHref({ ...activeFilters, inactive: "", page: 1 })} /> : null}
      <Link href="/explore" className="ml-auto shrink-0 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 no-underline hover:bg-zinc-50">
        Clear all
      </Link>
    </div>
  ) : null;

  // ── Results section (rendered ONCE — FIX #8) ───────────────────────────────
  const resultsSection = (
    <div className="space-y-4">
      {listings.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-100">
            <Search className="h-5 w-5 text-zinc-500" />
          </div>
          <p className="mt-4 text-sm font-semibold text-zinc-900">No matching listings yet</p>
          <p className="mt-1 max-w-lg text-sm leading-6 text-zinc-600">
            Try fewer filters, check a nearby category, or browse the newest campus listings.
            {qRaw && qRaw.length < 2 ? (
              <span className="ml-1 text-xs text-zinc-500">Search works best with at least 2 characters.</span>
            ) : null}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/explore" className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white no-underline hover:bg-zinc-800">Clear filters</Link>
            <Link href="/explore?sort=newest" className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 no-underline hover:bg-zinc-50">Browse newest</Link>
            <Link href="/explore?tab=food&open=1" className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 no-underline hover:bg-zinc-50">Open food vendors</Link>
            <Link href="/post" className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 no-underline hover:bg-zinc-50">Post a listing</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} vendor={vendorMap[(l as any).vendor_id] ?? null} stats={statsMap[l.id] ?? null} />
            ))}
          </div>

          {/* Pagination — FIX #9: use aria-disabled + no href on prev when page=1 */}
          <div className="flex items-center justify-between gap-3">
            {page <= 1 ? (
              <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-300 select-none">
                <ArrowLeft className="h-4 w-4" /> Prev
              </span>
            ) : (
              <Link href={buildExploreHref({ ...activeFilters, page: page - 1 })}
                className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-medium no-underline hover:bg-zinc-50">
                <ArrowLeft className="h-4 w-4" /> Prev
              </Link>
            )}

            <div className="text-xs text-zinc-600 sm:text-sm">
              Page <span className="font-medium text-zinc-900">{page}</span> of{" "}
              <span className="font-medium text-zinc-900">{totalPages}</span>
            </div>

            {page >= totalPages ? (
              <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-300 select-none">
                Next <ArrowRight className="h-4 w-4" />
              </span>
            ) : (
              <Link href={buildExploreHref({ ...activeFilters, page: page + 1 })}
                className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-medium no-underline hover:bg-zinc-50">
                Next <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <ExploreTabs active="listings" />

      <Suspense fallback={null}>
        <ExploreNavProgress />
      </Suspense>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-zinc-900">Explore JABU Market</h1>
          {error ? (
            <p className="mt-1 text-sm text-red-600">Couldn't load listings. Check Supabase env vars + server logs.</p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
              Showing <span className="font-medium text-zinc-900">{showingFrom}</span>–
              <span className="font-medium text-zinc-900">{showingTo}</span> of{" "}
              <span className="font-medium text-zinc-900">{total}</span>
              {q ? <> for <span className="font-medium text-zinc-900">"{q}"</span></> : null}
            </p>
          )}
        </div>
        <Link href="/post" className="hidden sm:inline-flex rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white no-underline hover:bg-zinc-800">
          Post
        </Link>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
        {[
          { href: "/explore?sort=newest", label: "Fresh listings" },
          { href: "/explore?type=service", label: "Services" },
          { href: "/explore?tab=food&open=1", label: "Open food" },
          { href: "/explore?tab=vendors", label: "Verified vendors" },
          { href: "/explore?tab=delivery", label: "Delivery riders" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 no-underline hover:bg-zinc-50"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* ── Desktop layout: sidebar + results — FIX #5 (single render) ───────── */}
      <div className="hidden md:grid md:grid-cols-[280px,1fr] md:gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Desktop search */}
          <div className="rounded-3xl border bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-zinc-900">Search</p>
            <form method="GET" action="/explore">
              <div className="flex items-center gap-2 rounded-2xl border bg-zinc-50 px-3 py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-900/10">
                <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                <input
                  name="q" defaultValue={q}
                  placeholder="Search phones, food, services…"
                  className="h-8 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                />
                {/* FIX #10: preserve ALL filters in search form */}
                {type !== "all" && <input type="hidden" name="type" value={type} />}
                {category !== "all" && <input type="hidden" name="category" value={category} />}
                {sort !== "relevance" && <input type="hidden" name="sort" value={sort} />}
                {includeSold && <input type="hidden" name="sold" value="1" />}
                {includeInactive && <input type="hidden" name="inactive" value="1" />}
                {onlyNegotiable && <input type="hidden" name="negotiable" value="1" />}
                {conditionFilter && <input type="hidden" name="condition" value={conditionFilter} />}
                {minPrice !== null && <input type="hidden" name="min_price" value={String(minPrice)} />}
                {maxPrice !== null && <input type="hidden" name="max_price" value={String(maxPrice)} />}
              </div>
              <button type="submit" className="mt-2 w-full rounded-xl bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                Search
              </button>
            </form>
          </div>

          {/* Sidebar filter panel */}
          <div className="rounded-3xl border bg-white p-4 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-zinc-900">Filters</p>
            {filterContent}
          </div>
        </div>

        {/* Desktop results */}
        <div className="min-w-0 space-y-4">
          {activeChips}
          {resultsSection}
        </div>
      </div>

      {/* ── Mobile layout ─────────────────────────────────────────────────────
          FIX #1: sticky header no longer uses arbitrary height — content below
          has natural top padding from space-y-4 on the parent.
          FIX #3: removed inline <style> tag.
      ────────────────────────────────────────────────────────────────────── */}
      <div className="md:hidden">
        {/* Sticky search + filter bar */}
        <div className="sticky top-0 z-20 -mx-4 border-b bg-white/95 px-4 pb-3 pt-2 backdrop-blur-sm">
          {/* Search row */}
          <div className="flex items-center gap-2">
            <form method="GET" action="/explore" className="flex flex-1 items-center gap-2 rounded-2xl border bg-zinc-50 px-3 py-2 focus-within:bg-white">
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
              <input
                name="q" defaultValue={q}
                placeholder="Search phones, food, services…"
                className="h-8 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              {/* FIX #10: preserve ALL filters */}
              {type !== "all" && <input type="hidden" name="type" value={type} />}
              {category !== "all" && <input type="hidden" name="category" value={category} />}
              {sort !== "relevance" && <input type="hidden" name="sort" value={sort} />}
              {includeSold && <input type="hidden" name="sold" value="1" />}
              {includeInactive && <input type="hidden" name="inactive" value="1" />}
              {onlyNegotiable && <input type="hidden" name="negotiable" value="1" />}
              {conditionFilter && <input type="hidden" name="condition" value={conditionFilter} />}
              {minPrice !== null && <input type="hidden" name="min_price" value={String(minPrice)} />}
              {maxPrice !== null && <input type="hidden" name="max_price" value={String(maxPrice)} />}
              {/* FIX #13: only show × when there's an active query */}
              {q ? (
                <Link href={clearSearchHref} aria-label="Clear search"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100">
                  ×
                </Link>
              ) : null}
            </form>
            <button type="submit" form="" className="hidden" />

            {/* Mobile filter sheet — FIX #5: filterContent rendered once here */}
            <MobileFilterSheet hasActiveFilters={hasAnyFilter}>
              {filterContent}
            </MobileFilterSheet>
          </div>

          {/* Recent searches */}
          <RecentSearchesBar q={q} activeFilters={activeFilters} />

          {/* Active filter chips */}
          {activeChips ? <div className="mt-2">{activeChips}</div> : null}

          {/* Category chip strip — FIX #3: Tailwind class instead of inline <style> */}
          <div className="relative mt-3 -mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent" />
            <div className="flex w-max items-center gap-2">
              <Chip href={buildExploreHref({ ...activeFilters, category: "all", page: 1 })} active={category === "all"} label="All" />
              {CATEGORIES.map((c) => (
                <Chip key={c} href={buildExploreHref({ ...activeFilters, category: c, page: 1 })}
                  active={category.toLowerCase() === c.toLowerCase()} label={c} />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile results — FIX #8: single render, not duplicated */}
        <div className="mt-4">
          {resultsSection}
        </div>
        {/* FIX #6: removed "Post Listing" CTA at bottom of mobile results */}
      </div>
    </div>
  );
}

// ── Small components ───────────────────────────────────────────────────────────

function Pill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium no-underline", active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-800 hover:bg-zinc-50")}>
      {label}
    </Link>
  );
}

function SortLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={cn("rounded-2xl border px-3 py-2 text-sm font-medium no-underline text-center", active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-900 hover:bg-zinc-50")}>
      {label}
    </Link>
  );
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium no-underline", active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-800 hover:bg-zinc-50")}>
      {label}
    </Link>
  );
}

function SmallToggle({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium no-underline", active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-800 hover:bg-zinc-50")}>
      {label}
    </Link>
  );
}

function ActiveChip({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} title="Remove filter"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 no-underline hover:bg-zinc-50">
      {label}
      <span className="grid h-4 w-4 place-items-center rounded-full bg-zinc-100 text-zinc-600">×</span>
    </Link>
  );
}

const CONDITION_BADGE: Record<string, { label: string; cls: string }> = {
  new:         { label: "New",         cls: "bg-emerald-500 text-white" },
  fairly_used: { label: "Fairly used", cls: "bg-amber-400 text-white" },
  used:        { label: "Used",        cls: "bg-zinc-500 text-white" },
  for_parts:   { label: "For parts",   cls: "bg-red-500 text-white" },
};

function ListingCard({
  listing, vendor, stats,
}: {
  listing: ListingRow;
  vendor: { id: string; name: string | null; location: string | null; verified: boolean | null; verification_status: string | null; vendor_type: string | null; avatar_url: string | null } | null;
  stats: { views: number; saves: number } | null;
}) {
  const priceText = listing.price !== null ? formatNaira(listing.price) : listing.price_label ?? "Contact for price";
  const typeLabel = listing.listing_type === "product" ? "Product" : "Service";
  const isSold = listing.status === "sold";
  const isInactive = listing.status === "inactive";
  const desc = (listing.description ?? "").trim();
  const isVerified = vendor?.verified === true || vendor?.verification_status === "verified";
  const hasEngagement = (stats?.saves ?? 0) > 0 || (stats?.views ?? 0) > 8;

  // FIX #4: isNew computed server-side but badge has suppressHydrationWarning
  const isNew = !isSold && !isInactive && !!listing.created_at &&
    Date.now() - new Date(listing.created_at).getTime() < 24 * 60 * 60 * 1000;

  return (
    <Link
      href={`/listing/${listing.id}`}
      className={cn("group overflow-hidden rounded-2xl border bg-white no-underline transition-shadow hover:shadow-sm", (isSold || isInactive) && "opacity-90")}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
        <ListingImage
          src={listing.image_url ?? "/images/placeholder.svg"}
          alt={listing.title ?? "Listing"}
          className={cn("transition-transform", !(isSold || isInactive) && "group-hover:scale-[1.02]")}
        />

        {/* Status badge — top-left. suppressHydrationWarning on isNew (FIX #4) */}
        {isSold ? (
          <div className="absolute left-3 top-3">
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">SOLD</span>
          </div>
        ) : isInactive ? (
          <div className="absolute left-3 top-3">
            <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs font-semibold text-white">INACTIVE</span>
          </div>
        ) : (
          <div className="absolute left-3 top-3" suppressHydrationWarning>
            {isNew ? (
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">NEW</span>
            ) : isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-white">✓ Verified</span>
            ) : null}
          </div>
        )}

        {/* Condition badge — top-right */}
        {listing.condition && CONDITION_BADGE[listing.condition] && (
          <div className="absolute right-3 top-3">
            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", CONDITION_BADGE[listing.condition].cls)}>
              {CONDITION_BADGE[listing.condition].label}
            </span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-sm font-bold text-zinc-950 shadow-sm">
          {priceText}
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">{typeLabel}</span>
          {listing.category ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">{listing.category}</span> : null}
          {hasEngagement ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">Popular</span> : null}
        </div>

        <p className="text-base font-bold text-zinc-900">
          {priceText}
          {listing.negotiable && <span className="ml-2 text-xs font-normal text-zinc-500">· Negotiable</span>}
        </p>

        <div>
          <p className="line-clamp-2 text-sm font-semibold text-zinc-900">{listing.title ?? "Untitled listing"}</p>
          {desc ? <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{desc}</p> : null}
        </div>

        {vendor?.name ? (
          <div className="flex items-center gap-1.5">
            {vendor.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
                {(vendor.name ?? "V")[0].toUpperCase()}
              </div>
            )}
            <span className="truncate text-xs text-zinc-500">{vendor.name}</span>
            {isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
            {vendor.vendor_type === "mall" && (
              <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Store</span>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span className="truncate">{listing.location ?? "—"}</span>
          <div className="flex shrink-0 items-center gap-2">
            {stats && stats.views > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                <Eye className="h-3 w-3" />
                {stats.views}
              </span>
            )}
            {stats && stats.saves > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                🔖 {stats.saves}
              </span>
            )}
            <span>{listing.created_at ? timeAgo(listing.created_at) : ""}</span>
            {!isSold && !isInactive && (listing as any).vendor_id && vendor?.vendor_type !== 'food' && (
              <QuickMessageButton
                listingId={listing.id}
                vendorId={(listing as any).vendor_id as string}
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Explore tab bar ────────────────────────────────────────────────────────────

const EXPLORE_TABS: { key: ExploreTab; label: string; emoji: string }[] = [
  { key: "listings",  label: "Listings",  emoji: "🏷️" },
  { key: "vendors",   label: "Vendors",   emoji: "🏪" },
  { key: "food",      label: "Food",      emoji: "🍽️" },
  { key: "delivery",  label: "Delivery",  emoji: "🛵" },
  { key: "transport", label: "Transport", emoji: "🚗" },
];

function ExploreTabs({ active }: { active: ExploreTab }) {
  return (
    <div className="relative -mx-4 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0">
      <div className="flex w-max gap-2 md:w-auto">
        {EXPLORE_TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <Link key={tab.key}
              href={tab.key === "listings" ? "/explore" : `/explore?tab=${tab.key}`}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-2xl border px-3 py-2 text-sm font-medium no-underline transition-colors",
                isActive ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              )}
            >
              <span className="text-base leading-none">{tab.emoji}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
