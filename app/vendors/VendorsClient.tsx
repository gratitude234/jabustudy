"use client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  SlidersHorizontal,
  BadgeCheck,
  MapPin,
  Phone,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Star,
  Package,
  UtensilsCrossed,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type VendorType = "food" | "mall" | "student" | "other";
type SortKey = "type" | "name_asc" | "name_desc";

export type VendorRow = {
  id: string;
  name: string | null;
  whatsapp: string | null;
  phone: string | null;
  location: string | null;
  verified: boolean;
  vendor_type: VendorType;
  avatar_url?: string | null;
};

export type VendorMeta = {
  rating: { avg: number; count: number } | null;
  listingCount: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PER_PAGE = 18;

const LABELS: Record<VendorType, string> = {
  food: "Food",
  mall: "Mall",
  student: "Students",
  other: "Other",
};

const SECTION_TITLES: Record<VendorType, string> = {
  food: "Food Vendors",
  mall: "JABU Mall Shops",
  student: "Students",
  other: "Other Vendors",
};

const SORTS = [
  { key: "type" as SortKey, label: "By Type" },
  { key: "name_asc" as SortKey, label: "A–Z" },
  { key: "name_desc" as SortKey, label: "Z–A" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(input?: string | null) {
  if (!input) return "";
  return input.replace(/[^\d]/g, "");
}

function waLink(phone?: string | null, text?: string) {
  const p = normalizePhone(phone);
  if (!p) return "";
  const msg = encodeURIComponent(text ?? "Hi, I found you on Jabu Market.");
  return `https://wa.me/${p}?text=${msg}`;
}

function updateParams(
  pathname: string,
  sp: URLSearchParams,
  patch: Record<string, string | null | undefined>
) {
  const next = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
        "focus:outline-none focus:ring-2 focus:ring-black/10",
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
      )}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  initialVendors: VendorRow[];
  initialTotal: number;
  initialMeta: Record<string, VendorMeta>;
  initialError: string | null;
  qParam: string;
  typeParam: "all" | VendorType;
  sortParam: SortKey;
  pageParam: number;
}

export default function VendorsClient({
  initialVendors,
  initialTotal,
  initialMeta,
  initialError,
  qParam,
  typeParam,
  sortParam,
  pageParam,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Local search input state (debounced before pushing to URL)
  const [q, setQ] = useState(qParam);
  const [showFilters, setShowFilters] = useState(false);
  const debouncedRef = useRef<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(initialTotal / PER_PAGE));

  function pushPatch(patch: Record<string, string | null | undefined>) {
    router.push(updateParams(pathname, sp, patch));
  }

  function applySearch(nextQ: string) {
    pushPatch({ q: nextQ.trim() || null, page: "1" });
  }

  function clearSearch() {
    setQ("");
    pushPatch({ q: null, page: "1" });
  }

  function setType(next: "all" | VendorType) {
    pushPatch({ type: next === "all" ? null : next, page: "1" });
  }

  function setSort(next: SortKey) {
    pushPatch({ sort: next === "type" ? null : next, page: "1" });
  }

  function goPage(nextPage: number) {
    const safe = Math.min(Math.max(1, nextPage), totalPages);
    pushPatch({ page: String(safe) });
  }

  // Group vendors by type (for the "By Type" sort view)
  const grouped: Record<VendorType, VendorRow[]> = {
    food: [], mall: [], student: [], other: [],
  };
  for (const v of initialVendors) grouped[v.vendor_type]?.push(v);
  const isGrouped = sortParam === "type";

  return (
    <div className="space-y-5">
      {/* Header + search + filters */}
      <header className="rounded-3xl border bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Vendors</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {initialError
                ? "Could not load vendors"
                : `${initialTotal.toLocaleString()} verified vendor${initialTotal === 1 ? "" : "s"} found`}
              {qParam ? (
                <>
                  {" "}for{" "}
                  <span className="font-medium text-zinc-900">"{qParam}"</span>
                </>
              ) : null}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
              "hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-black/10",
              showFilters && "bg-zinc-50"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-black/10">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => {
                const next = e.target.value;
                setQ(next);
                if (debouncedRef.current) window.clearTimeout(debouncedRef.current);
                debouncedRef.current = window.setTimeout(() => applySearch(next), 350);
              }}
              placeholder="Search verified vendors by name or location…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
            {q?.trim() ? (
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-xl p-2 hover:bg-zinc-100"
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-zinc-600" />
              </button>
            ) : null}
          </div>

          {/* Type filter pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill active={typeParam === "all"} onClick={() => setType("all")}>All</Pill>
            {(Object.keys(LABELS) as VendorType[]).map((t) => (
              <Pill key={t} active={typeParam === t} onClick={() => setType(t)}>
                {LABELS[t]}
              </Pill>
            ))}
          </div>

          {/* Sort row */}
          <div className={cn("mt-3", showFilters ? "" : "hidden sm:block")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">Sort</span>
              {SORTS.map((s) => (
                <Pill
                  key={s.key}
                  active={sortParam === s.key}
                  onClick={() => setSort(s.key)}
                >
                  {s.label}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Error */}
      {initialError ? (
        <div className="rounded-3xl border bg-white p-5">
          <p className="text-sm font-medium text-zinc-900">Couldn't load vendors</p>
          <p className="mt-1 text-sm text-zinc-600">{initialError}</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-4 inline-flex items-center justify-center rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Results */}
      {!initialError && (
        <div className="space-y-8">
          {initialTotal === 0 ? (
            <div className="rounded-3xl border bg-white p-6 text-center">
              <p className="text-sm font-semibold text-zinc-900">No verified vendors found</p>
              <p className="mt-1 text-sm text-zinc-600">
                Try a different search, or switch the vendor type filter.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setType("all")}
                  className="rounded-2xl border px-4 py-2 text-sm hover:bg-zinc-50"
                >
                  View all types
                </button>
                {qParam ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
                  >
                    Clear search
                  </button>
                ) : null}
              </div>
            </div>
          ) : isGrouped ? (
            // Grouped by vendor type
            (Object.keys(grouped) as VendorType[]).map((type) => {
              const list = grouped[type];
              if (!list.length) return null;
              return (
                <section key={type} className="space-y-3">
                  <h2 className="text-sm font-semibold text-zinc-800">
                    {SECTION_TITLES[type]}{" "}
                    <span className="text-zinc-400">({list.length})</span>
                  </h2>
                  <VendorGrid vendors={list} meta={initialMeta} />
                </section>
              );
            })
          ) : (
            // Flat list (A-Z / Z-A)
            <VendorGrid vendors={initialVendors} meta={initialMeta} />
          )}
        </div>
      )}

      {/* Pagination */}
      {!initialError && initialTotal > 0 ? (
        <div className="flex items-center justify-between rounded-3xl border bg-white p-4">
          <p className="text-sm text-zinc-600">
            Page{" "}
            <span className="font-medium text-zinc-900">{pageParam}</span> of{" "}
            <span className="font-medium text-zinc-900">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goPage(pageParam - 1)}
              disabled={pageParam <= 1}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
                pageParam <= 1 ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-50"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              type="button"
              onClick={() => goPage(pageParam + 1)}
              disabled={pageParam >= totalPages}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
                pageParam >= totalPages ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-50"
              )}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Vendor grid + card ────────────────────────────────────────────────────────

function VendorGrid({
  vendors,
  meta,
}: {
  vendors: VendorRow[];
  meta: Record<string, VendorMeta>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {vendors.map((v) => (
        <VendorCard key={v.id} vendor={v} meta={meta[v.id] ?? null} />
      ))}
    </div>
  );
}

function VendorCard({
  vendor: v,
  meta,
}: {
  vendor: VendorRow;
  meta: VendorMeta | null;
}) {
  const phone = normalizePhone(v.phone);
  const whatsapp = normalizePhone(v.whatsapp);
  const hasWA = Boolean(whatsapp);
  const hasPhone = Boolean(phone);

  return (
    <div className="rounded-2xl border bg-white p-4 transition hover:bg-zinc-50">
      {/* Avatar + name + badges */}
      <div className="flex items-start gap-3">
        {v.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.avatar_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-sm font-bold text-zinc-500">
            {(v.name ?? "V")[0].toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <Link href={`/vendors/${v.id}`} className="block no-underline">
            <p className="truncate text-base font-semibold text-zinc-900">
              {v.name ?? "Vendor"}
            </p>
          </Link>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700">
              {LABELS[v.vendor_type]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified
            </span>
          </div>
        </div>
      </div>

      {/* Rating + listing count */}
      {meta && (meta.rating || meta.listingCount > 0) ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {meta.rating ? (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-900">
                {meta.rating.avg.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-400">({meta.rating.count})</span>
            </span>
          ) : null}
          {meta.listingCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <Package className="h-3.5 w-3.5" />
              {meta.listingCount} listing{meta.listingCount !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Location */}
      <div className="mt-3 flex items-start gap-2 text-sm text-zinc-600">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
        <p className="line-clamp-2">{v.location ?? "Location not provided"}</p>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {v.vendor_type === "food" ? (
          // Food vendors are fully siloed — send directly to ordering flow
          <>
            <Link
              href={`/vendors/${v.id}`}
              className="inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium text-zinc-900 no-underline hover:bg-zinc-50"
            >
              View menu
            </Link>
            <Link
              href={`/vendors/${v.id}?order=true`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white no-underline hover:bg-zinc-700"
            >
              <UtensilsCrossed className="h-4 w-4" />
              Order food
            </Link>
          </>
        ) : (
          // Non-food vendors — standard marketplace actions
          <>
            <Link
              href={`/vendors/${v.id}`}
              className="inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium text-zinc-900 no-underline hover:bg-zinc-50"
            >
              View profile
            </Link>

            {hasWA ? (
              <a
                href={waLink(whatsapp, "Hi, I found you on Jabu Market. I'm interested in your services.")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-2 text-sm font-medium text-white no-underline"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            ) : (
              <span className="inline-flex items-center justify-center rounded-xl border border-dashed px-3 py-2 text-xs text-zinc-500">
                No WhatsApp
              </span>
            )}

            {hasPhone ? (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-zinc-900 no-underline hover:bg-zinc-50"
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}