"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { DeliveryRequestRow } from "@/lib/types";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RequestWithListing = DeliveryRequestRow & {
  listing: { id: string; title: string | null; image_url: string | null } | null;
  rider: { id: string; name: string | null; phone: string | null; whatsapp: string | null } | null;
};

const STATUS_ORDER: DeliveryRequestRow["status"][] = [
  "open",
  "accepted",
  "picked_up",
  "delivered",
  "cancelled",
];

function statusLabel(s: string) {
  switch (s) {
    case "open": return "Pending";
    case "accepted": return "Rider confirmed";
    case "picked_up": return "On the way";
    case "delivered": return "Delivered";
    case "cancelled": return "Cancelled";
    default: return s;
  }
}

function statusIcon(s: string) {
  switch (s) {
    case "open": return <Clock className="h-4 w-4" />;
    case "accepted": return <CheckCircle2 className="h-4 w-4" />;
    case "picked_up": return <Truck className="h-4 w-4" />;
    case "delivered": return <CheckCircle2 className="h-4 w-4" />;
    case "cancelled": return <X className="h-4 w-4" />;
    default: return <Package className="h-4 w-4" />;
  }
}

function statusStyles(s: string) {
  switch (s) {
    case "open": return "bg-amber-50 text-amber-800 border-amber-200";
    case "accepted": return "bg-blue-50 text-blue-800 border-blue-200";
    case "picked_up": return "bg-violet-50 text-violet-800 border-violet-200";
    case "delivered": return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "cancelled": return "bg-zinc-50 text-zinc-500 border-zinc-200";
    default: return "bg-zinc-50 text-zinc-700 border-zinc-200";
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function DeliveryRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestWithListing[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadRequests(uid: string) {
    const { data } = await supabase
      .from("delivery_requests")
      .select(`
        id, listing_id, buyer_id, vendor_id, rider_id,
        dropoff, note, status, created_at, updated_at,
        listing:listings(id, title, image_url),
        rider:riders(id, name, phone, whatsapp, zone)
      `)
      .eq("buyer_id", uid)
      .order("created_at", { ascending: false });
    setRequests((data as any[]) ?? []);
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login?next=/delivery/requests"); return; }

      await loadRequests(user.id);
      setLoading(false);

      // Real-time status updates
      channel = supabase
        .channel(`delivery-requests:${user.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_requests',
          filter: `buyer_id=eq.${user.id}`,
        }, () => loadRequests(user.id))
        .subscribe();
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cancel(id: string) {
    setCancellingId(id);
    const res = await fetch(`/api/delivery/requests/${id}/cancel`, { method: 'POST' });
    const json = await res.json();
    if (json.ok) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
      );
    }
    setCancellingId(null);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-28 md:pb-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/delivery"
          className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">My Delivery Requests</h1>
          <p className="text-xs text-zinc-500">Track your delivery activity</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-3xl border bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded-full bg-zinc-100" />
                  <div className="h-3 w-1/2 rounded-full bg-zinc-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-zinc-100">
            <Truck className="h-6 w-6 text-zinc-300" />
          </div>
          <p className="text-sm font-semibold text-zinc-900">No delivery requests yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            When you request delivery for a listing, it'll show here.
          </p>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-xs font-semibold text-white no-underline hover:bg-zinc-800"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const listing = Array.isArray(req.listing) ? req.listing[0] : req.listing;
            const rider = Array.isArray(req.rider) ? req.rider[0] : req.rider;
            const canCancel = req.status === "open";

            return (
              <div key={req.id} className="rounded-3xl border bg-white p-4 shadow-sm">
                {/* Top */}
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                    {listing?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-zinc-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-900 line-clamp-1">
                        {listing?.title ?? "Listing"}
                      </p>
                      <span className="shrink-0 text-[11px] text-zinc-400">{timeAgo(req.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">→ {req.dropoff}</p>
                  </div>
                </div>

                {/* Status */}
                <div className={cn(
                  "mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold",
                  statusStyles(req.status)
                )}>
                  {statusIcon(req.status)}
                  {statusLabel(req.status)}
                </div>

                {/* Rider info */}
                {rider && (
                  <div className="mt-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
                    <p className="font-semibold text-blue-800 mb-0.5">Your rider</p>
                    <p className="font-medium">{rider.name ?? "Unnamed"}</p>
                    {(rider as any).zone && (
                      <p className="mt-0.5 text-blue-700">Zone: {(rider as any).zone}</p>
                    )}
                    {(rider.phone ?? rider.whatsapp) && (
                      <p className="mt-0.5 text-blue-700">+{rider.phone ?? rider.whatsapp}</p>
                    )}
                  </div>
                )}

                {req.note && (
                  <p className="mt-2 text-xs text-zinc-400 italic">Note: {req.note}</p>
                )}

                {/* Actions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing?.id && (
                    <Link
                      href={`/listing/${listing.id}`}
                      className="inline-flex items-center gap-1.5 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
                    >
                      View listing
                    </Link>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => cancel(req.id)}
                      disabled={cancellingId === req.id}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {cancellingId === req.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Cancel
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