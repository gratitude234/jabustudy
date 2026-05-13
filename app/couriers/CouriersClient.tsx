"use client";
// app/couriers/CouriersClient.tsx
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CourierRow } from "@/lib/types";
import { getWhatsAppLink } from "@/lib/whatsapp";
import {
  Copy,
  Loader2,
  Search,
  Star,
  Phone,
  ShieldCheck,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  Sparkles,
} from "lucide-react";

export default function CouriersClient({
  couriers,
  prefill,
  listingId,
  listingTitle,
  listingPickup,
  loadError,
}: {
  couriers: CourierRow[];
  prefill: string;
  listingId: string;
  listingTitle: string | null;
  listingPickup: string | null;
  loadError: string | null;
}) {
  const [q, setQ] = useState("");

  // Fields
  const [pickup, setPickup] = useState(listingPickup ?? "");
  const [dropoff, setDropoff] = useState("");
  const [budget, setBudget] = useState("");

  // Message
  const [message, setMessage] = useState(prefill);

  // ✅ Collapsible message section:
  // - Open by default when coming from a listing (more context needed)
  // - Collapsed for generic browsing
  const [showMessage, setShowMessage] = useState<boolean>(!!listingTitle);

  const [toast, setToast] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function copyText(text: string) {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(text);
      showToast("Copied ✅");
    } catch {
      showToast("Copy failed — try selecting and copying.");
    } finally {
      setCopying(false);
    }
  }

  const regenerated = useMemo(() => {
    const p = pickup || "(where to pick)";
    const d = dropoff || "(my location)";
    const b = budget ? `₦${budget.replace(/[^\d]/g, "")}` : "(₦...)";

    if (listingTitle) {
      return `Hi! I need campus transport.\n\nItem: ${listingTitle}\nPickup: ${p}\nDrop-off: ${d}\nBudget: ${b}\n\nCan you help?`;
    }

    return `Hi! I need campus transport.\n\nPickup: ${p}\nDrop-off: ${d}\nBudget: ${b}\n\nCan you help?`;
  }, [pickup, dropoff, budget, listingTitle]);

  const messageSummary = useMemo(() => {
    const oneLine = (message || "").replace(/\n+/g, " ").trim();
    if (!oneLine) return "No message set";
    return oneLine.length > 90 ? `${oneLine.slice(0, 90)}…` : oneLine;
  }, [message]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return couriers;

    return couriers.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const base = (c.base_location ?? "").toLowerCase();
      const covers = (c.areas_covered ?? "").toLowerCase();
      return name.includes(needle) || base.includes(needle) || covers.includes(needle);
    });
  }, [couriers, q]);

  return (
    <div className="space-y-4">
      {/* ✅ Quick message (optional) - collapsible */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <button
          type="button"
          onClick={() => setShowMessage((s) => !s)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex items-start gap-2">
            <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-2xl border bg-zinc-50">
              <MessageSquareText className="h-4 w-4 text-zinc-800" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">Quick message (optional)</p>
              <p className="mt-1 text-xs text-zinc-600">
                {showMessage ? "Edit what will be sent to WhatsApp." : messageSummary}
              </p>
            </div>
          </div>

          <div className="mt-1 inline-flex items-center gap-2">
            <span className="rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-800">
              {showMessage ? "Hide" : "Edit"}
            </span>
            {showMessage ? (
              <ChevronUp className="h-4 w-4 text-zinc-700" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-700" />
            )}
          </div>
        </button>

        {showMessage ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMessage(regenerated)}
                className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                <Sparkles className="h-4 w-4" />
                Regenerate
              </button>

              <button
                type="button"
                onClick={() => copyText(message)}
                className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                disabled={copying}
              >
                {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Copy
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="Pickup (e.g. JABU Gate)"
                className="h-11 rounded-2xl border bg-white px-3 text-sm outline-none"
              />
              <input
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                placeholder="Drop-off (e.g. Female Hostel 2)"
                className="h-11 rounded-2xl border bg-white px-3 text-sm outline-none"
              />
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Budget (e.g. 500)"
                className="h-11 rounded-2xl border bg-white px-3 text-sm outline-none"
              />
            </div>

            <div className="mt-3 rounded-3xl border bg-zinc-50 p-3">
              <p className="text-xs font-semibold text-zinc-900">Message (editable)</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                className="mt-2 w-full resize-none rounded-2xl border bg-white p-3 text-sm text-zinc-900 outline-none"
              />
              <p className="mt-2 text-xs text-zinc-500">Always confirm price before sending money.</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Errors */}
      {loadError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900">Couldn’t load transport providers</p>
          <p className="mt-1 text-sm text-rose-800">{loadError}</p>
        </div>
      ) : null}

      {/* Search */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name / base / areas covered…"
            className="w-full bg-transparent text-sm outline-none"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="rounded-xl border bg-white p-2 hover:bg-zinc-50"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* List */}
      <div className="rounded-3xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zinc-700" />
            <p className="text-sm font-semibold text-zinc-900">
              Campus Transport <span className="text-xs text-zinc-500">({filtered.length})</span>
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-zinc-900">No transport providers yet</p>
            <p className="mt-1 text-sm text-zinc-600">
              Admins can add verified transport providers in Supabase.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {filtered.map((c) => {
              const wa = getWhatsAppLink(c.whatsapp, message);

              return (
                <div key={c.id} className="rounded-3xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{c.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">WhatsApp: +{c.whatsapp}</p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                          Verified
                        </span>
                        {c.featured ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                            <Star className="h-3.5 w-3.5" />
                            Featured
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-zinc-700">
                    {c.base_location ? (
                      <p>
                        <span className="text-zinc-500">Base:</span> {c.base_location}
                      </p>
                    ) : null}
                    {c.areas_covered ? (
                      <p>
                        <span className="text-zinc-500">Covers:</span> {c.areas_covered}
                      </p>
                    ) : null}
                    {c.hours ? (
                      <p>
                        <span className="text-zinc-500">Hours:</span> {c.hours}
                      </p>
                    ) : null}
                    {c.price_note ? (
                      <p>
                        <span className="text-zinc-500">Price:</span> {c.price_note}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-black px-4 py-2 text-center text-sm font-semibold text-white no-underline hover:bg-zinc-800"
                    >
                      WhatsApp
                    </a>

                    <a
                      href={c.phone ? `tel:+${c.phone}` : "#"}
                      onClick={(e) => {
                        if (!c.phone) e.preventDefault();
                      }}
                      className={cn(
                        "rounded-2xl border bg-white px-4 py-2 text-center text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50",
                        !c.phone && "pointer-events-none opacity-50"
                      )}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Phone className="h-4 w-4" /> Call
                      </span>
                    </a>

                    <Link
                      href={`/report?courier=${c.id}`}
                      className="col-span-2 rounded-2xl border bg-white px-4 py-2 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-50 no-underline"
                    >
                      Report transport provider
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-20 left-0 right-0 z-50 mx-auto max-w-sm px-4 md:bottom-6">
          <div className="rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
