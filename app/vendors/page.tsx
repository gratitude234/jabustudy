// app/vendors/page.tsx
// Server component — fetches vendor data + meta (ratings, listing counts) on the server.
// Passes hydrated data to VendorsClient which handles search/filter UI and pagination.

import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import VendorsClient from "./VendorsClient";

const PER_PAGE = 18;

type VendorType = "food" | "mall" | "student" | "other";
type SortKey = "type" | "name_asc" | "name_desc";

function clampPage(n: number) {
  const p = Number(n);
  if (!Number.isFinite(p) || p < 1) return 1;
  if (p > 999) return 999;
  return Math.floor(p);
}

function VendorsFallback() {
  return (
    <div className="space-y-5">
      <header className="rounded-3xl border bg-white p-4 sm:p-5">
        <div className="h-6 w-32 rounded bg-zinc-100" />
        <div className="mt-2 h-4 w-56 rounded bg-zinc-100" />
        <div className="mt-4 h-11 w-full rounded-2xl bg-zinc-100" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-20 rounded-full bg-zinc-100" />
          ))}
        </div>
      </header>
      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-zinc-100" />
                  <div className="h-3 w-1/2 rounded bg-zinc-100" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-9 w-28 rounded-xl bg-zinc-100" />
                <div className="h-9 w-20 rounded-xl bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const sp = searchParams ? await searchParams : {};

  const qParam = (sp.q ?? "").trim();
  const typeParam = (sp.type ?? "all").trim() as "all" | VendorType;
  const sortParam = (sp.sort ?? "type").trim() as SortKey;
  const pageParam = clampPage(Number(sp.page ?? "1"));

  const supabase = await createSupabaseServerClient();

  const start = (pageParam - 1) * PER_PAGE;
  const end = start + PER_PAGE - 1;

  // Build vendor query
  let query = supabase
    .from("vendors")
    .select(
      "id, name, whatsapp, phone, location, verified, verification_status, vendor_type, avatar_url",
      { count: "exact" }
    )
    .or("verification_status.eq.verified,verified.eq.true");

  if (typeParam !== "all") query = query.eq("vendor_type", typeParam);

  if (qParam) {
    const safe = qParam.replaceAll(",", " ");
    query = query.or(`name.ilike.%${safe}%,location.ilike.%${safe}%`);
  }

  if (sortParam === "name_asc") {
    query = query.order("name", { ascending: true, nullsFirst: false });
  } else if (sortParam === "name_desc") {
    query = query.order("name", { ascending: false, nullsFirst: false });
  } else {
    query = query
      .order("vendor_type", { ascending: true })
      .order("name", { ascending: true, nullsFirst: false });
  }

  query = query.range(start, end);

  const { data: vendorData, count, error } = await query;

  const vendors = (vendorData ?? []) as Array<{
    id: string;
    name: string | null;
    whatsapp: string | null;
    phone: string | null;
    location: string | null;
    verified: boolean;
    vendor_type: VendorType;
    avatar_url: string | null;
  }>;

  // Parallel meta: ratings + active listing counts
  type VendorMeta = { rating: { avg: number; count: number } | null; listingCount: number };
  let vendorMeta: Record<string, VendorMeta> = {};

  const ids = vendors.map((v) => v.id);
  if (ids.length > 0) {
    const [reviewsRes, listingsRes] = await Promise.all([
      supabase
        .from("vendor_reviews")
        .select("vendor_id, rating")
        .in("vendor_id", ids),
      supabase
        .from("listings")
        .select("vendor_id")
        .in("vendor_id", ids)
        .eq("status", "active"),
    ]);

    const rMap: Record<string, { sum: number; count: number }> = {};
    for (const r of reviewsRes.data ?? []) {
      const e = rMap[r.vendor_id];
      rMap[r.vendor_id] = e
        ? { sum: e.sum + r.rating, count: e.count + 1 }
        : { sum: r.rating, count: 1 };
    }

    const lMap: Record<string, number> = {};
    for (const l of listingsRes.data ?? []) {
      lMap[l.vendor_id] = (lMap[l.vendor_id] ?? 0) + 1;
    }

    for (const id of ids) {
      const r = rMap[id];
      vendorMeta[id] = {
        rating: r ? { avg: r.sum / r.count, count: r.count } : null,
        listingCount: lMap[id] ?? 0,
      };
    }
  }

  return (
    <Suspense fallback={<VendorsFallback />}>
      <VendorsClient
        initialVendors={vendors}
        initialTotal={count ?? 0}
        initialMeta={vendorMeta}
        initialError={error?.message ?? null}
        qParam={qParam}
        typeParam={typeParam}
        sortParam={sortParam}
        pageParam={pageParam}
      />
    </Suspense>
  );
}