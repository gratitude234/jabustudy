"use client";
// app/admin/page.tsx
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Bike, Store, Truck, FileText, Star } from "lucide-react";

function StatCard({
  title,
  value,
  subtitle,
  href,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="block rounded-3xl border bg-white p-4 shadow-sm hover:bg-zinc-50 no-underline">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-600">{title}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
          <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl border bg-zinc-50">{icon}</div>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
        Open <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

type AdminListing = {
  id: string;
  title: string | null;
  status: string | null;
  featured: boolean | null;
  vendor_name?: string | null;
};

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    vendorsPending: 0,
    vendorsAll: 0,
    ridersPending: 0,
    ridersAll: 0,
    couriersPending: 0,
    couriersAll: 0,
    studyPending: 0,
  });

  const [listings, setListings] = useState<AdminListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [featuringId, setFeaturingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);

      // Vendors
      const vAll = await supabase.from("vendors").select("id", { count: "exact", head: true });

      // Pending = requests waiting or under review (fallbacks to legacy columns if needed)
      let vPending = await supabase
        .from("vendor_verification_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["requested", "under_review"]);

      if (vPending.error) {
        vPending = await supabase
          .from("vendors")
          .select("id", { count: "exact", head: true })
          .eq("verification_requested", true)
          .eq("verified", false);
      }

      // Riders
      const rAll = await supabase.from("riders").select("id", { count: "exact", head: true });
      const rPending = await supabase.from("riders").select("id", { count: "exact", head: true }).eq("verified", false);

      // Couriers
      const cAll = await supabase.from("couriers").select("id", { count: "exact", head: true });
      const cPending = await supabase.from("couriers").select("id", { count: "exact", head: true }).eq("verified", false);

      // Study uploads
      const sPending = await supabase
        .from("study_materials")
        .select("id", { count: "exact", head: true })
        .eq("approved", false);

      if (!mounted) return;

      setCounts({
        vendorsPending: vPending.count ?? 0,
        vendorsAll: vAll.count ?? 0,
        ridersPending: rPending.count ?? 0,
        ridersAll: rAll.count ?? 0,
        couriersPending: cPending.count ?? 0,
        couriersAll: cAll.count ?? 0,
        studyPending: sPending.count ?? 0,
      });

      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setListingsLoading(true);
    supabase
      .from("listings")
      .select("id, title, status, featured, vendors(name)")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setListings(
          (data ?? []).map((l: any) => ({
            id: l.id,
            title: l.title,
            status: l.status,
            featured: l.featured,
            vendor_name: Array.isArray(l.vendors) ? l.vendors[0]?.name : l.vendors?.name,
          }))
        );
        setListingsLoading(false);
      });
  }, []);

  async function toggleFeature(listingId: string, current: boolean | null) {
    setFeaturingId(listingId);
    try {
      await fetch("/api/admin/listings/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, featured: !current }),
      });
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, featured: !current } : l))
      );
    } finally {
      setFeaturingId(null);
    }
  }

  const cards = useMemo(() => {
    return [
      {
        title: "Vendors",
        value: loading ? "…" : `${counts.vendorsPending}`,
        subtitle: loading ? "Pending requests" : `Pending • ${counts.vendorsAll} total`,
        href: "/admin/vendors",
        icon: <Store className="h-5 w-5 text-zinc-800" />,
      },
      {
        title: "Delivery Agents",
        value: loading ? "…" : `${counts.ridersPending}`,
        subtitle: loading ? "Pending verifications" : `Pending • ${counts.ridersAll} total`,
        href: "/admin/riders",
        icon: <Bike className="h-5 w-5 text-zinc-800" />,
      },
      {
        title: "Campus Transport",
        value: loading ? "…" : `${counts.couriersPending}`,
        subtitle: loading ? "Pending verifications" : `Pending • ${counts.couriersAll} total`,
        href: "/admin/couriers",
        icon: <Truck className="h-5 w-5 text-zinc-800" />,
      },
      {
        title: "Study",
        value: loading ? "…" : `${counts.studyPending}`,
        subtitle: loading ? "Pending uploads" : "Pending uploads",
        href: "/admin/study",
        icon: <FileText className="h-5 w-5 text-zinc-800" />,
      },
    ];
  }, [loading, counts]);

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <p className="text-lg font-semibold text-zinc-900">Admin dashboard</p>
        <p className="mt-1 text-sm text-zinc-600">Quick stats + shortcuts.</p>
      </div>

      <div className={cn("grid gap-3", "sm:grid-cols-2", "lg:grid-cols-3")}>
        {cards.map((c) => (
          <StatCard key={c.title} title={c.title} value={c.value} subtitle={c.subtitle} href={c.href} icon={c.icon} />
        ))}
      </div>

      {/* Featured listings management */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-semibold text-zinc-900">Feature listings</p>
          <p className="text-xs text-zinc-500 ml-auto">Featured listings appear at the top of the homepage.</p>
        </div>

        {listingsLoading ? (
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-zinc-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold text-zinc-500">
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Vendor</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 text-right">Featured</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {listings.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-50">
                    <td className="py-2 pr-4">
                      <Link href={`/listing/${l.id}`} className="font-medium text-zinc-900 hover:underline line-clamp-1">
                        {l.title ?? "Untitled"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-xs text-zinc-500 truncate max-w-[120px]">
                      {l.vendor_name ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        l.status === "active" ? "bg-emerald-50 text-emerald-700" :
                        l.status === "sold" ? "bg-zinc-100 text-zinc-600" :
                        "bg-amber-50 text-amber-700"
                      )}>
                        {l.status ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => toggleFeature(l.id, l.featured)}
                        disabled={featuringId === l.id}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                          l.featured
                            ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                            : "border bg-white text-zinc-700 hover:bg-zinc-50",
                          featuringId === l.id && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Star className={cn("h-3.5 w-3.5", l.featured && "fill-amber-500 text-amber-500")} />
                        {l.featured ? "Unfeature" : "Feature"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
