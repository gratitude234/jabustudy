// app/listing/[id]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ListingRow, VendorRow } from "@/lib/types";
import OwnerActions from "@/components/listing/OwnerActions";
import AskSellerButton from "@/components/listing/AskSellerButton";
import BuyNowButton from "@/components/listing/BuyNowButton";
import RequestCallbackButton from "@/components/listing/RequestCallbackButton";
import SaveButton from "@/components/listing/SaveButton";
import { VendorRatingBadge } from "@/components/vendor/VendorReviews";
import BackButton from "@/components/listing/BackButton";
import {
  ListingViewTracker,
  ShareButton,
} from "@/components/listing/ListingStatsClient";
import ListingGallery from "@/components/listing/ListingGallery";
import ListingImage from "@/components/ListingImage";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Clock,
  CreditCard,
  Eye,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Truck,
} from "lucide-react";

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncateText(input: string, max = 160) {
  const s = String(input ?? "").trim();
  return s.length <= max ? s : s.slice(0, max).trimEnd() + "…";
}

async function getSiteOrigin() {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envBase) return envBase.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (!host) return "";
  return `${proto}://${host}`;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const { data } = await supabase
    .from("listings")
    .select("id,title,description,image_url,price_label,price,location")
    .eq("id", id)
    .maybeSingle();

  const origin = await getSiteOrigin();
  const url = origin ? `${origin}/listing/${id}` : `/listing/${id}`;

  if (!data) {
    return {
      title: "Listing — Jabumarket",
      description: "See listing details on Jabumarket.",
      alternates: { canonical: url },
      openGraph: { title: "Listing — Jabumarket", description: "See listing details on Jabumarket.", url, siteName: "Jabumarket", type: "website" },
      twitter: { card: "summary_large_image" },
    };
  }

  const t = data.title ? `${data.title} — Jabumarket` : "Listing — Jabumarket";
  const d = data.description ? truncateText(data.description, 160) : "See listing details on Jabumarket.";
  const images = data.image_url ? [data.image_url] : undefined;

  return {
    title: t,
    description: d,
    alternates: { canonical: url },
    openGraph: { title: t, description: d, url, siteName: "Jabumarket", type: "website", images },
    twitter: images
      ? { card: "summary_large_image", title: t, description: d, images }
      : { card: "summary_large_image", title: t, description: d },
  };
}

export default async function ListingPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from("listings")
    .select(
      `id,title,description,listing_type,category,price,price_label,location,image_url,image_urls,negotiable,status,created_at,vendor_id,
      vendor:vendors(id,name,whatsapp,phone,verified,vendor_type,location,avatar_url)`
    )
    .eq("id", id)
    .single();

  if (error || !data) return notFound();

  const row = data as ListingRow & { vendor?: any };
  const joinedVendor = (row as any).vendor;
  let vendor: VendorRow | null =
    Array.isArray(joinedVendor) ? joinedVendor[0] ?? null : joinedVendor ?? null;

  if (!vendor && (row as any).vendor_id) {
    const { data: v2 } = await supabase
      .from("vendors")
      .select("id,name,whatsapp,phone,verified,vendor_type,location,avatar_url")
      .eq("id", (row as any).vendor_id)
      .maybeSingle();
    vendor = (v2 as any) ?? null;
  }

  const listing: ListingRow & { vendor?: VendorRow | null } = {
    ...(row as ListingRow),
    vendor,
  };

  const isSold = listing.status === "sold";
  const isInactive = listing.status === "inactive";
  const isActive = listing.status === "active";
  const isVerified = Boolean(vendor?.verified);
  const categorySafe = String((listing as any).category ?? "").trim();
  const typeLabel = listing.listing_type === "product" ? "Product" : "Service";
  const priceText =
    listing.price !== null
      ? formatNaira(listing.price)
      : listing.price_label?.trim() || "Contact for price";
  const desc = String(listing.description ?? "").trim();
  const isLongDesc = desc.length > 240;

  // Gallery images
  const rawUrls = (listing as any).image_urls as string[] | null | undefined;
  const galleryImages: string[] =
    Array.isArray(rawUrls) && rawUrls.length > 0
      ? rawUrls.filter(Boolean)
      : listing.image_url?.trim()
      ? [listing.image_url.trim()]
      : [];

  const origin = await getSiteOrigin();
  const listingUrl = origin
    ? `${origin}/listing/${listing.id}?utm_source=share`
    : `/listing/${listing.id}`;
  const shareTitle = listing.title?.trim() || "Listing on Jabumarket";
  const shareLocation = (listing.location ?? vendor?.location ?? "").toString().trim();
  const shareText = [
    `Check this on Jabumarket: ${shareTitle}`,
    `Price: ${priceText}`,
    shareLocation ? `Location: ${shareLocation}` : null,
    `View: ${listingUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Parallel data fetches
  const [statsRes, moreFromSellerRes, similarItemsRes] = await Promise.all([
    supabase
      .from("listing_stats")
      .select("views, saves")
      .eq("listing_id", listing.id)
      .maybeSingle(),
    listing.vendor_id
      ? supabase
          .from("listings")
          .select("id, title, price, price_label, category, image_url, negotiable, status")
          .eq("vendor_id", listing.vendor_id)
          .neq("id", listing.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
    categorySafe
      ? supabase
          .from("listings")
          .select("id, title, price, price_label, category, image_url, negotiable, status, location")
          .eq("category", categorySafe)
          .neq("id", listing.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);

  const viewCount: number = (statsRes.data as any)?.views ?? 0;
  const saveCount: number = (statsRes.data as any)?.saves ?? 0;
  const moreFromSeller = (moreFromSellerRes.data ?? []) as ListingRow[];
  const allSimilar = (similarItemsRes.data ?? []) as ListingRow[];

  // De-duplicate: remove items already in moreFromSeller
  const moreFromSellerIds = new Set(moreFromSeller.map((s) => s.id));
  const similarItems = allSimilar.filter((s) => !moreFromSellerIds.has(s.id)).slice(0, 6);

  const vendorInitial = (vendor?.name ?? "V")[0].toUpperCase();
  const avatarUrl = (vendor as any)?.avatar_url as string | null | undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title ?? "Listing",
    description: desc || undefined,
    image: galleryImages.length > 0 ? galleryImages : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: listing.price ?? undefined,
      availability:
        listing.status === "active"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      url: listingUrl,
      seller: vendor?.name
        ? { "@type": "Person", name: vendor.name }
        : undefined,
    },
  };

  const statusBadge = isSold ? (
    <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">SOLD</span>
  ) : isInactive ? (
    <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs font-semibold text-white">INACTIVE</span>
  ) : undefined;

  const cornerBadges = listing.negotiable ? (
    <span className="rounded-full bg-black/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
      Negotiable
    </span>
  ) : undefined;

  return (
    <div className="overflow-x-hidden pb-28 lg:pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ListingViewTracker listingId={listing.id} title={listing.title ?? undefined} />

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 py-2">
        <BackButton />
        <div className="flex items-center gap-2">
          {categorySafe ? (
            <span className="max-w-[36vw] truncate rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-700">
              {categorySafe}
            </span>
          ) : null}
          <span className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-700">
            {typeLabel}
          </span>
          <ShareButton title={shareTitle} text={shareText} url={listingUrl} variant="icon" />
        </div>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className="mt-3 grid gap-4 lg:grid-cols-5">

        {/* Left — Gallery */}
        <div className="lg:col-span-3 min-w-0">
          {galleryImages.length > 0 ? (
            <ListingGallery
              images={galleryImages}
              alt={listing.title ?? "Listing"}
              statusBadge={statusBadge}
              cornerBadges={cornerBadges}
            />
          ) : (
            <div className="flex h-[40svh] min-h-[220px] max-h-[300px] sm:h-[340px] sm:max-h-none lg:h-[420px] items-center justify-center rounded-2xl border bg-zinc-100 text-zinc-300">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* More from seller — desktop only, below gallery */}
          {moreFromSeller.length > 0 ? (
            <div className="mt-5 hidden lg:block space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">
                  More from {vendor?.name ?? "this seller"}
                </p>
                {vendor ? (
                  <Link href={`/vendors/${vendor.id}`} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                    View all →
                  </Link>
                ) : null}
              </div>
              <MiniListingScroll items={moreFromSeller} />
            </div>
          ) : null}
        </div>

        {/* Right — Details */}
        <div className="lg:col-span-2 space-y-3 min-w-0">

          {/* Status banner */}
          {isSold ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-700">This listing is sold</p>
              <p className="mt-0.5 text-xs text-red-600">Browse similar items below.</p>
              {categorySafe ? (
                <Link
                  href={`/explore?category=${encodeURIComponent(categorySafe)}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 no-underline"
                >
                  Browse {categorySafe} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          ) : isInactive ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-sm font-semibold text-zinc-800">This listing is inactive</p>
              <p className="mt-0.5 text-xs text-zinc-500">It may be temporarily unavailable.</p>
            </div>
          ) : null}

          {/* Main details card */}
          <div className="rounded-2xl border bg-white p-4 sm:p-5 space-y-4">

            {/* Title + Price */}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl leading-tight">
                {listing.title ?? "Untitled listing"}
              </h1>
              <p className="mt-2 text-2xl font-extrabold text-zinc-900">
                {priceText}
                {listing.negotiable ? (
                  <span className="ml-2 text-sm font-normal text-zinc-500">· Negotiable</span>
                ) : null}
              </p>
            </div>

            {/* Stats strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
              {listing.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {listing.location}
                </span>
              ) : null}
              {listing.created_at ? (
                <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span suppressHydrationWarning>{timeAgo(listing.created_at)}</span>
                </span>
              ) : null}
              {viewCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 shrink-0" />
                  {viewCount.toLocaleString()} {viewCount === 1 ? "view" : "views"}
                </span>
              ) : null}
              {saveCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Bookmark className="h-3.5 w-3.5 shrink-0" />
                  {saveCount.toLocaleString()} {saveCount === 1 ? "save" : "saves"}
                </span>
              ) : null}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                {typeLabel}
              </span>
              {categorySafe ? (
                <Link
                  href={`/explore?category=${encodeURIComponent(categorySafe)}`}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 no-underline"
                >
                  {categorySafe}
                </Link>
              ) : null}
              {listing.negotiable ? (
                <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white">
                  Negotiable
                </span>
              ) : null}
            </div>

            {/* Description — text rendered ONCE, CSS clamp toggled by <details> */}
            {desc ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Description
                </p>
                {isLongDesc ? (
                  <details className="group">
                    <summary className="cursor-pointer list-none text-xs font-semibold text-zinc-900 hover:underline">
                      <span className="group-open:hidden">Read more â†“</span>
                      <span className="hidden group-open:inline">Show less â†‘</span>
                    </summary>
                    <p className="text-sm leading-relaxed text-zinc-700 line-clamp-5 group-open:line-clamp-none">
                      {desc}
                    </p>
                  </details>
                ) : (
                  <p className="text-sm leading-relaxed text-zinc-700">{desc}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No description provided.</p>
            )}

            {/* Desktop CTAs — hidden on mobile (bottom bar handles it) */}
            {listing.vendor_id ? (
              <div className="hidden lg:block space-y-2 pt-1">
                {vendor?.vendor_type !== 'food' && isActive && !isSold && (
                  <BuyNowButton
                    listingId={listing.id}
                    vendorId={listing.vendor_id}
                    vendorName={vendor?.name ?? undefined}
                    listingTitle={listing.title ?? undefined}
                    listingPrice={listing.price}
                    size="full"
                  />
                )}
                <AskSellerButton
                  listingId={listing.id}
                  vendorId={listing.vendor_id}
                  listingTitle={listing.title ?? undefined}
                  listingPrice={listing.price}
                  negotiable={listing.negotiable ?? false}
                  isSold={isSold}
                />
                <div className="flex gap-2">
                  <SaveButton listingId={listing.id} variant="pill" className="flex-1" />
                  <ShareButton title={shareTitle} text={shareText} url={listingUrl} variant="pill" />
                </div>
                {!isSold && isActive ? (
                  <Link
                    href={`/delivery?listing=${listing.id}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-zinc-700 no-underline hover:bg-zinc-50"
                  >
                    <Truck className="h-4 w-4" />
                    Request delivery
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-600 sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <span>
                  <span className="block font-semibold text-zinc-900">Pay after order</span>
                  Bank or cash details are handled after the order opens.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <span>
                  <span className="block font-semibold text-zinc-900">Chat first</span>
                  Confirm condition, pickup point and availability with the seller.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <span>
                  <span className="block font-semibold text-zinc-900">Trade safely</span>
                  Meet publicly and inspect items before paying.
                </span>
              </div>
            </div>
          </div>

          {/* Seller card */}
          {vendor ? (
            <Link
              href={`/vendors/${vendor.id}`}
              className="flex items-center gap-3 rounded-2xl border bg-white p-4 no-underline hover:bg-zinc-50 transition"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={vendor?.name ?? "Vendor"}
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-100 text-sm font-bold text-zinc-600">
                  {vendorInitial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900 truncate">
                    {vendor.name ?? "Vendor"}
                  </span>
                  {isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </span>
                  ) : null}
                  {vendor.vendor_type === "food" ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Food vendor</span>
                  ) : vendor.vendor_type === "mall" ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Campus shop</span>
                  ) : vendor.vendor_type === "student" ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">Student seller</span>
                  ) : null}
                </div>
                <div className="mt-1">
                  <VendorRatingBadge vendorId={vendor.id} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {vendor.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {vendor.location}
                    </span>
                  ) : null}
                  <span>View seller profile and other listings</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300" />
            </Link>
          ) : null}

          {/* Owner actions */}
          <OwnerActions
            listingId={listing.id}
            listingVendorId={listing.vendor_id}
            status={listing.status}
          />
        </div>
      </div>

      {/* ── Below-fold ───────────────────────────────────────────────── */}
      <div className="mt-6 space-y-6">

        {/* More from seller — mobile only (desktop shows below gallery) */}
        {moreFromSeller.length > 0 ? (
          <div className="lg:hidden space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900">
                More from {vendor?.name ?? "this seller"}
              </p>
              {vendor ? (
                <Link href={`/vendors/${vendor.id}`} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                  View all →
                </Link>
              ) : null}
            </div>
            <MiniListingScroll items={moreFromSeller} />
          </div>
        ) : null}

        {/* Similar items — ONE section, de-duplicated from moreFromSeller */}
        {similarItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900">
                {categorySafe ? `More in ${categorySafe}` : "Explore more"}
              </p>
              {categorySafe ? (
                <Link
                  href={`/explore?category=${encodeURIComponent(categorySafe)}`}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
                >
                  See all →
                </Link>
              ) : null}
            </div>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {similarItems.map((s) => {
                const sImg = s.image_url?.trim();
                return (
                  <Link
                    key={s.id}
                    href={`/listing/${s.id}`}
                    className="min-w-[180px] overflow-hidden rounded-2xl border bg-white no-underline hover:bg-zinc-50 transition sm:min-w-0"
                  >
                    <div className="relative aspect-[4/3] bg-zinc-100 overflow-hidden">
                      {sImg ? (
                        <ListingImage src={sImg} alt={s.title ?? ""} className="h-full w-full object-cover" />
                      ) : null}
                      {s.negotiable ? (
                        <span className="absolute right-2 top-2 rounded-full bg-zinc-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Neg.
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs font-semibold text-zinc-900 leading-snug">
                        {s.title ?? "Listing"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-zinc-900">
                        {s.price !== null ? formatNaira(s.price) : s.price_label?.trim() || "Contact"}
                      </p>
                      {(s as any).location ? (
                        <p className="mt-0.5 text-[11px] text-zinc-400 truncate">{(s as any).location}</p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Safety — one-liner, no card */}
        <p className="pb-2 text-center text-xs text-zinc-400">
          Meet in public. Inspect before paying. Report suspicious listings.
        </p>
      </div>

      {/* ── Mobile sticky bottom bar ─────────────────────────────────── */}
      {listing.vendor_id && !isSold ? (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-2 rounded-2xl border bg-white/95 p-2.5 shadow-lg backdrop-blur-sm">
            {vendor?.vendor_type !== 'food' ? (
              <>
                <div className="flex-1">
                  <BuyNowButton
                    listingId={listing.id}
                    vendorId={listing.vendor_id}
                    vendorName={vendor?.name ?? undefined}
                    listingTitle={listing.title ?? undefined}
                    listingPrice={listing.price}
                  />
                </div>
                <AskSellerButton
                  listingId={listing.id}
                  vendorId={listing.vendor_id}
                  listingTitle={listing.title ?? undefined}
                  listingPrice={listing.price}
                  negotiable={listing.negotiable ?? false}
                  isSold={isSold}
                  variant="icon"
                />
                {vendor?.whatsapp ? (
                  <RequestCallbackButton
                    vendorId={listing.vendor_id}
                    listingId={listing.id}
                    variant="compact"
                  />
                ) : null}
                <SaveButton listingId={listing.id} variant="icon" className="shrink-0" />
              </>
            ) : (
              <>
                <div className="flex-1">
                  <AskSellerButton
                    listingId={listing.id}
                    vendorId={listing.vendor_id}
                    listingTitle={listing.title ?? undefined}
                    listingPrice={listing.price}
                    negotiable={listing.negotiable ?? false}
                    isSold={isSold}
                  />
                </div>
                {vendor?.whatsapp ? (
                  <RequestCallbackButton
                    vendorId={listing.vendor_id}
                    listingId={listing.id}
                    variant="compact"
                  />
                ) : null}
                <SaveButton listingId={listing.id} variant="icon" className="shrink-0" />
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Mini listing scroll strip ─────────────────────────────────────────────────

function MiniListingScroll({ items }: { items: ListingRow[] }) {
  return (
    <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-3">
      {items.map((s) => (
        <Link
          key={s.id}
          href={`/listing/${s.id}`}
          className="min-w-[140px] overflow-hidden rounded-2xl border bg-white no-underline hover:bg-zinc-50 transition sm:min-w-0"
        >
          <div className="relative h-24 w-full bg-zinc-100 overflow-hidden">
            {s.image_url ? (
              <ListingImage src={s.image_url} alt={s.title ?? ""} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="p-2.5">
            <p className="line-clamp-2 text-xs font-semibold text-zinc-900 leading-snug">
              {s.title ?? "Listing"}
            </p>
            <p className="mt-1 text-xs font-bold text-zinc-900">
              {s.price !== null
                ? `₦${s.price.toLocaleString("en-NG")}`
                : s.price_label?.trim() || "—"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
