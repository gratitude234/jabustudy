"use client";
// app/rider/my-deliveries/page.tsx
// Rider delivery history — auth-based, uses status API route

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Loader2, Package, Truck } from "lucide-react";

type DeliveryStatus = "open" | "accepted" | "picked_up" | "delivered" | "cancelled";

type DeliveryRow = {
  id: string;
  order_id: string | null;
  dropoff: string | null;
  note: string | null;
  status: DeliveryStatus;
  created_at: string;
  listing?: { title: string | null } | null;
  vendor?: { name: string | null; location: string | null } | null;
};

function statusLabel(s: DeliveryStatus): string {
  switch (s) {
    case "open": return "Waiting for pickup";
    case "accepted": return "Accepted";
    case "picked_up": return "Picked up";
    case "delivered": return "Delivered ✓";
    case "cancelled": return "Cancelled";
  }
}

function statusStyles(s: DeliveryStatus): string {
  switch (s) {
    case "open": return "bg-amber-50 text-amber-800 border-amber-200";
    case "accepted": return "bg-blue-50 text-blue-800 border-blue-200";
    case "picked_up": return "bg-violet-50 text-violet-800 border-violet-200";
    case "delivered": return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "cancelled": return "bg-zinc-50 text-zinc-500 border-zinc-200";
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RiderMyDeliveriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/rider/login"); return; }

      const { data: riderData } = await supabase
        .from("riders")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!riderData) { router.replace("/rider/login"); return; }

      setRiderId(riderData.id);

      const { data } = await supabase
        .from("delivery_requests")
        .select(`
          id, order_id, dropoff, note, status, created_at,
          listing:listings(title),
          vendor:vendors(name, location)
        `)
        .eq("rider_id", riderData.id)
        .order("created_at", { ascending: false });

      setDeliveries((data as any[]) ?? []);
      setLoading(false);
    })();
  }, [router]);

  async function updateStatus(deliveryId: string, newStatus: DeliveryStatus) {
    setActing(deliveryId);
    const res = await fetch(`/api/rider/delivery/${deliveryId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const json = await res.json();
    if (json.ok) {
      setDeliveries((prev) =>
        prev.map((d) => d.id === deliveryId ? { ...d, status: newStatus } : d)
      );
    }
    setActing(null);
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-28 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/rider/dashboard"
          className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">My Deliveries</h1>
          <p className="text-xs text-zinc-500">All assigned delivery jobs</p>
        </div>
        <Link
          href="/rider/dashboard"
          className="ml-auto text-xs font-semibold text-zinc-500 hover:text-zinc-900 no-underline"
        >
          Dashboard →
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : deliveries.length === 0 ? (
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <Package className="mx-auto mb-3 h-8 w-8 text-zinc-200" />
          <p className="text-sm text-zinc-400">No deliveries assigned yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map((d) => {
            const listing = Array.isArray(d.listing) ? d.listing[0] : d.listing;
            const vendor  = Array.isArray(d.vendor)  ? d.vendor[0]  : d.vendor;

            return (
              <div key={d.id} className="rounded-3xl border bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 truncate">
                      {listing?.title ?? (d.order_id
                        ? `Order #${d.order_id.slice(-6).toUpperCase()}`
                        : `Delivery #${d.id.slice(-6).toUpperCase()}`)}
                    </p>
                    {vendor?.name && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        From: {vendor.name}{vendor.location ? ` · ${vendor.location}` : ''}
                      </p>
                    )}
                    {d.dropoff && (
                      <p className="mt-0.5 text-xs text-zinc-500">📍 {d.dropoff}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-zinc-400">{timeAgo(d.created_at)}</span>
                </div>

                <div className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                  statusStyles(d.status)
                )}>
                  <Truck className="h-3 w-3" />
                  {statusLabel(d.status)}
                </div>

                {d.note && (
                  <p className="text-xs italic text-zinc-400">Note: {d.note}</p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {d.status === "accepted" && (
                    <button
                      type="button"
                      disabled={acting === d.id}
                      onClick={() => updateStatus(d.id, "picked_up")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {acting === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Mark as Picked Up
                    </button>
                  )}
                  {d.status === "picked_up" && (
                    <button
                      type="button"
                      disabled={acting === d.id}
                      onClick={() => updateStatus(d.id, "delivered")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {acting === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Mark as Delivered
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
