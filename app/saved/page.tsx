"use client";
// app/saved/page.tsx
import { cn } from "@/lib/utils";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Bookmark,
  ArrowLeft,
  MapPin,
  Image as ImageIcon,
  ArrowRight,
  Loader2,
  TrendingDown,
} from "lucide-react";
import ListingImage from "@/components/ListingImage";
import SaveButton from "@/components/listing/SaveButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type SavedListing = {
  save_id: string;
  listing_id: string;
  saved_at: string;
  price_at_save: number | null;
  title: string | null;
  price: number | null;
  price_label: string | null;
  category: string | null;
  listing_type: string | null;
  location: string | null;
  image_url: string | null;
  negotiable: boolean | null;
  status: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNaira(amount: number | null | undefined) {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

function PriceChip({
  price,
  priceLabel,
}: {
  price: number | null | undefined;
  priceLabel?: string | null;
}) {
  const label = (priceLabel ?? "").trim();
  const text = price ? formatNaira(price) : label || "Contact";
  return (
    <div className="shrink-0 rounded-xl bg-zinc-100 px-3 py-1.5 text-sm font-bold text-zinc-900">
      {text}
    </div>
  );
}

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  sold: {
    text: "SOLD",
    cls: "bg-red-600 text-white",
  },
  inactive: {
    text: "INACTIVE",
    cls: "bg-zinc-700 text-white",
  },
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SavedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saves, setSaves] = useState<SavedListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // Auth check
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(`/login?next=/saved`);
        return;
      }

      // Fetch saves joined with listing data
      const { data, error: fetchErr } = await supabase
        .from("listing_saves")
        .select(
          `
          id,
          listing_id,
          created_at,
          price_at_save,
          listings (
            id, title, price, price_label, category,
            listing_type, location, image_url, negotiable, status
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchErr) {
        if (!cancelled) setError(fetchErr.message);
        return;
      }

      // Flatten the join shape
      const rows: SavedListing[] = ((data as any[]) ?? [])
        .map((row: any) => {
          const l = Array.isArray(row.listings)
            ? row.listings[0]
            : row.listings;
          if (!l) return null;
          return {
            save_id: row.id,
            listing_id: l.id,
            saved_at: row.created_at,
            price_at_save: row.price_at_save ?? null,
            title: l.title,
            price: l.price,
            price_label: l.price_label,
            category: l.category,
            listing_type: l.listing_type,
            location: l.location,
            image_url: l.image_url,
            negotiable: l.negotiable,
            status: l.status,
          };
        })
        .filter(Boolean) as SavedListing[];

      if (!cancelled) {
        setSaves(rows);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // When SaveButton unsaves a listing, remove it from the local list
  function handleUnsave(listingId: string) {
    setSaves((prev) => prev.filter((s) => s.listing_id !== listingId));
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
          <span className="text-sm text-zinc-600">Loading your saved listings…</span>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-8">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load saved listings: {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Page ─────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-28 pt-5 sm:pb-10 sm:pt-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm text-zinc-800 no-underline hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-100">
              <Bookmark className="h-4 w-4 text-zinc-800" />
            </span>
            <h1 className="text-lg font-semibold text-zinc-900">Saved listings</h1>
          </div>
          <p className="mt-0.5 text-xs text-zinc-600">
            {saves.length === 0
              ? "Nothing saved yet."
              : `${saves.length} listing${saves.length === 1 ? "" : "s"} saved`}
          </p>
        </div>

        {saves.length > 0 && (
          <Link
            href="/explore"
            className="shrink-0 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Explore more
          </Link>
        )}
      </div>

      {/* Empty state */}
      {saves.length === 0 && (
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-zinc-100">
              <Bookmark className="h-6 w-6 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">No saved listings yet</p>
              <p className="mt-1 text-sm text-zinc-600">
                Tap the bookmark icon on any listing to save it here.
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Browse listings <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Grid */}
      {saves.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {saves.map((s) => {
            const img = (s.image_url ?? "").trim();
            const statusBadge = s.status ? STATUS_LABELS[s.status] : null;
            const title = s.title ?? "Untitled listing";
            const priceDrop =
              s.price !== null &&
              s.price_at_save !== null &&
              s.price < s.price_at_save;
            const priceDropAmount =
              priceDrop && s.price_at_save !== null
                ? s.price_at_save - (s.price as number)
                : 0;

            return (
              <div
                key={s.save_id}
                className="group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-[1px] hover:bg-zinc-50"
              >
                {/* Image */}
                <Link href={`/listing/${s.listing_id}`} className="block">
                  <div className="relative h-40 w-full bg-zinc-100">
                    {img ? (
                      <ListingImage
                        src={img}
                        alt={title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />

                    {statusBadge && (
                      <div className="absolute left-3 top-3">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            statusBadge.cls
                          )}
                        >
                          {statusBadge.text}
                        </span>
                      </div>
                    )}

                    {s.category && (
                      <div className="absolute bottom-3 left-3">
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-zinc-900 backdrop-blur">
                          {s.category}
                        </span>
                      </div>
                    )}

                    {priceDrop && (
                      <div className="absolute bottom-3 right-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                          <TrendingDown className="h-3 w-3" />
                          Price dropped
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Details */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/listing/${s.listing_id}`}
                      className="min-w-0 no-underline"
                    >
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {title}
                      </p>
                      {s.location && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-zinc-600">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{s.location}</span>
                        </div>
                      )}
                    </Link>

                    <div className="shrink-0 text-right">
                      <PriceChip price={s.price} priceLabel={s.price_label} />
                      {priceDrop && s.price_at_save !== null && (
                        <p className="mt-1 text-[11px] text-zinc-400 line-through">
                          was {formatNaira(s.price_at_save)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tags row */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.listing_type && (
                      <span className="rounded-full border bg-white px-2 py-0.5 text-xs text-zinc-700">
                        {s.listing_type}
                      </span>
                    )}
                    {s.negotiable && (
                      <span className="rounded-full border bg-white px-2 py-0.5 text-xs text-zinc-700">
                        Negotiable
                      </span>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Link
                      href={`/listing/${s.listing_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 no-underline hover:text-zinc-900"
                    >
                      View details <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    {/* SaveButton handles the unsave; we listen via onUnsave */}
                    <UnsaveButton
                      listingId={s.listing_id}
                      onUnsave={() => handleUnsave(s.listing_id)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── UnsaveButton ─────────────────────────────────────────────────────────────
// A thin wrapper around the supabase delete so we can fire onUnsave
// and immediately remove the card from the wishlist without a reload.

function UnsaveButton({
  listingId,
  onUnsave,
}: {
  listingId: string;
  onUnsave: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { error } = await supabase
      .from("listing_saves")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId);

    if (!error) onUnsave();
    else setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      aria-label="Remove from saved"
      className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bookmark className="h-3.5 w-3.5 fill-current" />
      )}
      Saved
    </button>
  );
}