import Link from "next/link";
import type { ListingRow } from "@/lib/types";

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function isListingNew(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

export default function ListingCard({ listing }: { listing: ListingRow }) {
  const priceText =
    listing.price !== null
      ? formatNaira(listing.price)
      : listing.price_label ?? "Contact for price";

  const typeLabel = listing.listing_type === "product" ? "Product" : "Service";
  const isSold = listing.status === "sold";
  const isInactive = listing.status === "inactive";
  const isNew = !isSold && !isInactive && isListingNew(listing.created_at);

  return (
    <Link
      href={`/listing/${listing.id}`}
      className={[
        // Mobile stays the same; desktop gets slightly richer affordances.
        "group block overflow-hidden rounded-2xl border bg-white no-underline transition md:hover:shadow-sm",
        (isSold || isInactive) ? "opacity-80" : "",
      ].join(" ")}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-zinc-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.image_url ?? "https://placehold.co/1200x900?text=Jabumarket"}
          alt={listing.title}
          className={[
            "h-full w-full object-cover transition-transform duration-200",
            (isSold || isInactive) ? "" : "group-hover:scale-[1.02]",
          ].join(" ")}
        />

        {/* Status / New badge */}
        {isSold ? (
          <div className="absolute left-3 top-3">
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
              SOLD
            </span>
          </div>
        ) : isInactive ? (
          <div className="absolute left-3 top-3">
            <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs font-semibold text-white">
              INACTIVE
            </span>
          </div>
        ) : isNew ? (
          <div className="absolute left-3 top-3">
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              NEW
            </span>
          </div>
        ) : null}

        {/* Type + Negotiable */}
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-800 backdrop-blur">
            {typeLabel}
          </span>

          {listing.negotiable ? (
            <span className="rounded-full bg-black/80 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
              Negotiable
            </span>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4">
        <p className="line-clamp-2 text-sm font-semibold text-zinc-900 md:text-[15px]">
          {listing.title}
        </p>

        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="text-sm font-bold text-zinc-900 md:text-[15px]">{priceText}</p>
          <span className="text-xs text-zinc-500 md:rounded-full md:bg-zinc-100 md:px-2 md:py-1 md:text-[11px]">
            {listing.category}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span className="truncate">{listing.location ?? "—"}</span>
          {listing.created_at ? (
            <span className="shrink-0">
              {new Date(listing.created_at).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}