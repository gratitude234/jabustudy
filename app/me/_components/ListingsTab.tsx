"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowRight, PlusSquare, MapPin } from "lucide-react";
import { cn } from "./utils";

type Listing = {
  id: string;
  title: string | null;
  price: number | null;
  price_label: string | null;
  category: string | null;
  listing_type: string | null;
  location: string | null;
  status: "active" | "sold" | "inactive";
  created_at: string | null;
};

function formatNaira(amount: number | null | undefined) {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

const statusStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  sold: "bg-zinc-100 text-zinc-500 border-zinc-200",
  inactive: "bg-zinc-50 text-zinc-400 border-zinc-200",
};

export default function ListingsTab({ vendorId }: { vendorId: string | null }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorId) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("listings")
        .select("id,title,price,price_label,category,listing_type,location,status,created_at")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!mounted) return;
      setListings((data as Listing[]) ?? []);
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [vendorId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-zinc-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="rounded-xl border bg-zinc-50 p-4 text-center text-sm text-zinc-500">
        Sign in to see your listings.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{listings.length} listing{listings.length !== 1 ? "s" : ""}</p>
        <Link
          href="/post"
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
        >
          <PlusSquare className="h-3.5 w-3.5" />
          Post new
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-xl border bg-zinc-50 p-5 text-center">
          <p className="text-sm font-semibold text-zinc-900">No listings yet</p>
          <p className="mt-1 text-xs text-zinc-500">Post a product or service to start selling.</p>
          <Link
            href="/post"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Post now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {listings.map((l) => (
            <Link
              key={l.id}
              href={`/listing/${l.id}`}
              className="flex items-center justify-between rounded-xl border bg-white p-3 hover:bg-zinc-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">{l.title ?? "Untitled"}</p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {l.category && (
                    <span className="text-xs text-zinc-500">{l.category}</span>
                  )}
                  {l.location && (
                    <span className="flex items-center gap-0.5 text-xs text-zinc-400">
                      <MapPin className="h-3 w-3" />
                      {l.location}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      statusStyles[l.status] ?? statusStyles.inactive
                    )}
                  >
                    {l.status}
                  </span>
                </div>
              </div>
              <div className="ml-3 shrink-0 text-right">
                <p className="text-sm font-bold text-zinc-900">
                  {l.price ? formatNaira(l.price) : l.price_label ?? "—"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">Edit →</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {listings.length > 0 && (
        <Link
          href="/my-listings"
          className="block text-center text-xs font-medium text-zinc-500 hover:text-zinc-800 pt-1"
        >
          View all in My Listings →
        </Link>
      )}
    </div>
  );
}