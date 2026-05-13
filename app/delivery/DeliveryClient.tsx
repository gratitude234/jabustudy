"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { RiderRow } from "@/lib/types";
import { getWhatsAppLink } from "@/lib/whatsapp";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
  Loader2,
  MapPin,
  Package,
  Phone,
  Search,
  Truck,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ListingMeta = {
  id: string;
  title: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  pickup: string | null;
};

type Step = "form" | "pick_rider" | "done";

const ZONES = ["all", "Campus", "Male Hostels", "Female Hostels", "Town"] as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "D") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function statusLabel(s: string) {
  switch (s) {
    case "open": return "Waiting for rider";
    case "accepted": return "Rider accepted";
    case "picked_up": return "Out for delivery";
    case "delivered": return "Delivered ✓";
    case "cancelled": return "Cancelled";
    default: return s;
  }
}

function statusColor(s: string) {
  switch (s) {
    case "open": return "bg-amber-50 text-amber-800 border-amber-200";
    case "accepted": return "bg-blue-50 text-blue-800 border-blue-200";
    case "picked_up": return "bg-violet-50 text-violet-800 border-violet-200";
    case "delivered": return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "cancelled": return "bg-zinc-50 text-zinc-600 border-zinc-200";
    default: return "bg-zinc-50 text-zinc-700 border-zinc-200";
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DeliveryClient({
  listing,
  riders,
}: {
  listing: ListingMeta | null;
  riders: RiderRow[];
}) {
  const router = useRouter();

  // Request form state
  const [step, setStep] = useState<Step>("form");
  const [dropoff, setDropoff] = useState("");
  const [note, setNote] = useState("");
  const [selectedRider, setSelectedRider] = useState<RiderRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  // Directory filter state
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "busy">("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filteredRiders = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return riders.filter((r) => {
      if (verifiedOnly && !r.verified) return false;
      if (availabilityFilter === "available" && !r.is_available) return false;
      if (availabilityFilter === "busy" && r.is_available) return false;
      if (zone !== "all" && (r.zone ?? "").trim() !== zone) return false;
      if (!needle) return true;
      return (
        (r.name ?? "").toLowerCase().includes(needle) ||
        (r.phone ?? "").includes(needle) ||
        (r.whatsapp ?? "").includes(needle)
      );
    });
  }, [riders, q, zone, availabilityFilter, verifiedOnly]);

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }

  async function copyPhone(phone: string) {
    setCopyingId(phone);
    try {
      await navigator.clipboard.writeText(`+${phone}`);
      showToast("Copied ✅");
    } catch {
      showToast("Copy failed");
    } finally {
      setCopyingId(null);
    }
  }

  async function submitRequest() {
    if (!dropoff.trim() || !listing) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=/delivery?listing=${listing.id}`);
        return;
      }

      const { data, error } = await supabase
        .from("delivery_requests")
        .insert({
          listing_id: listing.id,
          buyer_id: user.id,
          vendor_id: listing.vendor_id ?? null,
          rider_id: selectedRider?.id ?? null,
          dropoff: dropoff.trim(),
          note: note.trim() || null,
          status: "open",
        })
        .select("id")
        .single();

      if (error) throw error;

      setCreatedRequestId((data as any).id);

      // Notify vendor
      if (listing.vendor_id) {
        const vendorResult = await supabase
          .from("vendors")
          .select("user_id")
          .eq("id", listing.vendor_id)
          .maybeSingle();
        const vendorUserId = (vendorResult.data as any)?.user_id;
        if (vendorUserId && vendorUserId !== user.id) {
          await supabase.from("notifications").insert({
            user_id: vendorUserId,
            type: "delivery_request",
            title: "New delivery request",
            body: `${listing.title ?? "Your listing"} → ${dropoff.trim()}`,
            href: `/delivery/requests`,
          });
        }
      }

      // Rider will be notified in-app if they have an account linked.
      // No WhatsApp fallback — all communication is in-app.

      setStep("done");
    } catch (err: any) {
      setSubmitError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Directory-only mode (no listing context) ──────────────────────────────
  if (!listing) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Delivery Agents</h1>
            <p className="text-xs text-zinc-500">Browse campus delivery riders</p>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">
            Looking for a rider? Pick one from the list below and contact them on WhatsApp.
            Coming from a listing? Go to the listing and tap <strong>Request Delivery</strong>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/rider/apply"
              className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
            >
              <Truck className="h-3.5 w-3.5" /> Become a rider
            </Link>
            <Link
              href="/rider/status"
              className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
            >
              <User className="h-3.5 w-3.5" /> Update my availability
            </Link>
            <Link
              href="/delivery/requests"
              className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
            >
              <Package className="h-3.5 w-3.5" /> My delivery requests
            </Link>
          </div>
        </div>

        <RiderDirectory
          riders={filteredRiders}
          all={riders}
          q={q} setQ={setQ}
          zone={zone} setZone={setZone}
          availabilityFilter={availabilityFilter} setAvailabilityFilter={setAvailabilityFilter}
          verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
          showFilters={showFilters} setShowFilters={setShowFilters}
          onCopyPhone={copyPhone}
          copyingId={copyingId}
          selectable={false}
          selectedRider={null}
          onSelectRider={() => {}}
          buildWaMessage={(r) => {
            return [
              "Hi, I need delivery on JABU MARKET.",
              "Drop-off: (my location)",
            ].join("\n");
          }}
        />
        {toast && <Toast text={toast} />}
      </div>
    );
  }

  // ── Step: confirmation ────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border bg-white p-6 shadow-sm text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900">Request submitted!</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {selectedRider
              ? `${selectedRider.name ?? 'Your rider'} has been notified in-app. You'll get updates as the delivery progresses.`
              : "Your request is logged. A rider will be assigned and you'll be notified when they accept."}
          </p>

          <div className="mt-4 rounded-2xl border bg-zinc-50 p-3 text-left text-sm">
            <p className="font-semibold text-zinc-900">{listing.title}</p>
            {listing.pickup && <p className="mt-1 text-xs text-zinc-500">Pickup: {listing.pickup}</p>}
            <p className="mt-0.5 text-xs text-zinc-500">Drop-off: {dropoff}</p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href="/delivery/requests"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white no-underline hover:bg-zinc-800"
            >
              <Package className="h-4 w-4" />
              Track request
            </Link>
            <Link
              href={`/listing/${listing.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
            >
              Back to listing
            </Link>
          </div>
        </div>

        {toast && <Toast text={toast} />}
      </div>
    );
  }

  // ── Step: form + rider selection ─────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/listing/${listing.id}`}
          className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-zinc-50"
          aria-label="Back to listing"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Request Delivery</h1>
          <p className="text-xs text-zinc-500 line-clamp-1">{listing.title}</p>
        </div>
      </div>

      {/* Listing context */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-100">
            <Package className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 line-clamp-1">{listing.title}</p>
            {listing.pickup && (
              <p className="mt-0.5 text-xs text-zinc-500 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                Pickup: {listing.pickup}
              </p>
            )}
            {listing.vendor_name && (
              <p className="mt-0.5 text-xs text-zinc-500">Seller: {listing.vendor_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm space-y-3">
        <p className="text-sm font-bold text-zinc-900">Delivery details</p>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-700">
            Drop-off location <span className="text-red-500">*</span>
          </label>
          <input
            value={dropoff}
            onChange={(e) => setDropoff(e.target.value)}
            placeholder="e.g. Block D Male Hostel, Room 14"
            className="h-11 w-full rounded-2xl border bg-zinc-50 px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <p className="text-[11px] text-zinc-400">Be specific — block, room number, or landmark</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-700">Note to rider (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Call me when you arrive. Package is fragile."
            rows={2}
            className="w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>

        {submitError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {submitError}
          </div>
        )}
      </div>

      {/* Rider selection (optional) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-bold text-zinc-900">
            Pick a rider{" "}
            <span className="text-xs font-normal text-zinc-400">(optional — you can skip)</span>
          </p>
          {selectedRider && (
            <button
              type="button"
              onClick={() => setSelectedRider(null)}
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              Clear
            </button>
          )}
        </div>

        {selectedRider && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900">{selectedRider.name}</p>
              <p className="text-xs text-zinc-500">{selectedRider.zone} • {selectedRider.is_available ? "Available" : "Busy"}</p>
            </div>
            <button type="button" onClick={() => setSelectedRider(null)} className="text-zinc-400 hover:text-zinc-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <RiderDirectory
          riders={filteredRiders}
          all={riders}
          q={q} setQ={setQ}
          zone={zone} setZone={setZone}
          availabilityFilter={availabilityFilter} setAvailabilityFilter={setAvailabilityFilter}
          verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
          showFilters={showFilters} setShowFilters={setShowFilters}
          onCopyPhone={copyPhone}
          copyingId={copyingId}
          selectable={true}
          selectedRider={selectedRider}
          onSelectRider={(r) => setSelectedRider(prev => prev?.id === r.id ? null : r)}
          buildWaMessage={(r) => buildWaMsg(listing, dropoff, note)}
        />
      </div>

      {/* Submit */}
      <div className="sticky bottom-20 md:bottom-6 rounded-3xl border bg-white/90 p-4 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={submitRequest}
          disabled={!dropoff.trim() || submitting}
          className={cn(
            "w-full rounded-2xl py-3.5 text-sm font-semibold transition",
            !dropoff.trim() || submitting
              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
              : "bg-zinc-900 text-white hover:bg-zinc-700"
          )}
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <Truck className="h-4 w-4" />
              {selectedRider ? `Request delivery via ${selectedRider.name}` : "Submit delivery request"}
            </span>
          )}
        </button>
        <p className="mt-2 text-center text-[11px] text-zinc-400">
          {selectedRider
            ? "WhatsApp will open to confirm with your rider"
            : "You can contact a rider after submitting"}
        </p>
      </div>

      {toast && <Toast text={toast} />}
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildWaMsg(listing: ListingMeta, dropoff: string, note: string) {
  return [
    "Hi, I need delivery on JABU MARKET.",
    `Item: ${listing.title ?? ""}`,
    listing.pickup ? `Pickup: ${listing.pickup}` : "",
    dropoff ? `Drop-off: ${dropoff}` : "Drop-off: (to be confirmed)",
    note ? `Note: ${note}` : "",
  ].filter(Boolean).join("\n");
}

// ─── RiderDirectory sub-component ─────────────────────────────────────────────

function RiderDirectory({
  riders, all, q, setQ,
  zone, setZone,
  availabilityFilter, setAvailabilityFilter,
  verifiedOnly, setVerifiedOnly,
  showFilters, setShowFilters,
  onCopyPhone, copyingId,
  selectable, selectedRider, onSelectRider,
  buildWaMessage,
}: {
  riders: RiderRow[];
  all: RiderRow[];
  q: string; setQ: (v: string) => void;
  zone: string; setZone: (v: string) => void;
  availabilityFilter: "all" | "available" | "busy";
  setAvailabilityFilter: (v: "all" | "available" | "busy") => void;
  verifiedOnly: boolean; setVerifiedOnly: (v: boolean) => void;
  showFilters: boolean; setShowFilters: (v: boolean) => void;
  onCopyPhone: (p: string) => void;
  copyingId: string | null;
  selectable: boolean;
  selectedRider: RiderRow | null;
  onSelectRider: (r: RiderRow) => void;
  buildWaMessage: (r: RiderRow) => string;
}) {
  const ZONES = ["all", "Campus", "Male Hostels", "Female Hostels", "Town"] as const;

  return (
    <div className="space-y-3">
      {/* Search + filter toggle */}
      <div className="rounded-3xl border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border bg-zinc-50 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or zone…"
              className="w-full bg-transparent text-sm outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} className="shrink-0">
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold",
              showFilters ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-3 gap-1 rounded-2xl border bg-zinc-50 p-1">
              {(["all", "available", "busy"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAvailabilityFilter(t)}
                  className={cn(
                    "rounded-xl px-2 py-2 text-xs font-semibold capitalize",
                    availabilityFilter === t ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full rounded-2xl border bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none"
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>{z === "all" ? "All zones" : z}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-3 py-2.5",
                verifiedOnly ? "bg-zinc-50" : "bg-white"
              )}
            >
              <span className="text-xs font-semibold text-zinc-900">Verified riders only</span>
              <span className={cn("h-8 w-14 rounded-full border p-1 transition", verifiedOnly ? "bg-zinc-900" : "bg-white")}>
                <span className={cn("block h-6 w-6 rounded-full bg-white shadow transition", verifiedOnly ? "translate-x-6" : "translate-x-0")} />
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-zinc-500">
          {riders.length} rider{riders.length !== 1 ? "s" : ""} found
          {all.length !== riders.length ? ` (of ${all.length})` : ""}
        </p>
        <Link
          href="/rider/apply"
          className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-900"
        >
          Become a rider →
        </Link>
      </div>

      {/* Cards */}
      {riders.length === 0 ? (
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <Truck className="mx-auto mb-3 h-8 w-8 text-zinc-200" />
          <p className="text-sm font-semibold text-zinc-900">No riders found</p>
          <p className="mt-1 text-xs text-zinc-500">Try clearing filters or search terms.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {riders.map((r) => {
            const wa = (r.whatsapp ?? r.phone ?? "").trim();
            const waMsg = buildWaMessage(r);
            const waLink = wa ? getWhatsAppLink(wa, waMsg) : null;
            const phoneDisplay = r.phone ? `+${r.phone}` : wa ? `+${wa}` : null;
            const isSelected = selectedRider?.id === r.id;

            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-3xl border bg-white p-4 shadow-sm transition",
                  isSelected && "border-emerald-300 ring-1 ring-emerald-300"
                )}
              >
                {/* Top row */}
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-xs font-extrabold text-zinc-700">
                    {initials(r.name ?? "?")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{r.name ?? "Unnamed"}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{r.zone ?? "—"}</p>
                    {r.fee_note && (
                      <p className="mt-0.5 text-xs text-zinc-400 italic line-clamp-1">{r.fee_note}</p>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                      Unverified
                    </span>
                  )}
                  <span className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    r.is_available
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  )}>
                    {r.is_available ? "Available" : "Busy"}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {selectable ? (
                    <button
                      type="button"
                      onClick={() => onSelectRider(r)}
                      className={cn(
                        "rounded-2xl border py-2.5 text-xs font-semibold transition",
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-zinc-900 hover:bg-zinc-50"
                      )}
                    >
                      {isSelected ? "✓ Selected" : "Select"}
                    </button>
                  ) : (
                    <a
                      href={waLink ?? "#"}
                      target={waLink ? "_blank" : undefined}
                      rel="noreferrer"
                      onClick={(e) => { if (!waLink) e.preventDefault(); }}
                      className={cn(
                        "rounded-2xl py-2.5 text-xs font-semibold text-center no-underline transition",
                        waLink ? "bg-zinc-900 text-white hover:bg-zinc-700" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                      )}
                    >
                      WhatsApp
                    </a>
                  )}

                  {selectable && waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border py-2.5 text-xs font-semibold text-center text-zinc-900 no-underline hover:bg-zinc-50"
                    >
                      WhatsApp
                    </a>
                  ) : !selectable && phoneDisplay ? (
                    <button
                      type="button"
                      onClick={() => onCopyPhone(r.phone ?? r.whatsapp ?? "")}
                      disabled={copyingId === (r.phone ?? r.whatsapp ?? "")}
                      className="inline-flex items-center justify-center gap-1 rounded-2xl border bg-white py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      {copyingId === (r.phone ?? r.whatsapp ?? "") ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy
                    </button>
                  ) : (
                    <a
                      href={r.phone ? `tel:+${r.phone}` : "#"}
                      className={cn(
                        "inline-flex items-center justify-center gap-1 rounded-2xl border py-2.5 text-xs font-semibold no-underline",
                        r.phone ? "bg-white text-zinc-700 hover:bg-zinc-50" : "bg-zinc-50 text-zinc-400 pointer-events-none"
                      )}
                    >
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
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

function Toast({ text }: { text: string }) {
  return (
    <div className="fixed bottom-24 left-0 right-0 z-50 mx-auto max-w-xs px-4 md:bottom-6">
      <div className="rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-lg">
        {text}
      </div>
    </div>
  );
}