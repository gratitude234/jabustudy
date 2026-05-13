// app/delivery/page.tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ListingRow, VendorRow, RiderRow } from "@/lib/types";
import DeliveryClient from "./DeliveryClient";

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams?: Promise<{ listing?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const sp = (await searchParams) ?? {};
  const listingId = (sp.listing ?? "").trim();

  // Fetch listing + vendor when coming from a listing CTA
  let listing: (ListingRow & { vendor?: VendorRow | null }) | null = null;
  if (listingId) {
    const { data } = await supabase
      .from("listings")
      .select(
        "id,title,location,price,price_label,vendor_id,vendor:vendors(id,name,whatsapp,phone,location,verified,vendor_type)"
      )
      .eq("id", listingId)
      .maybeSingle();
    listing = (data as any) ?? null;
  }

  // Riders — verified first, available first
  const { data: ridersData } = await supabase
    .from("riders")
    .select("id,name,phone,whatsapp,zone,fee_note,is_available,verified,created_at")
    .order("verified", { ascending: false })
    .order("is_available", { ascending: false })
    .order("created_at", { ascending: false });

  const riders = (ridersData ?? []) as RiderRow[];

  const vendor = Array.isArray((listing as any)?.vendor)
    ? (listing as any).vendor[0]
    : (listing as any)?.vendor ?? null;

  const pickupLocation =
    vendor?.location ?? listing?.location ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-28 md:pb-6">
      <DeliveryClient
        listing={
          listing
            ? {
                id: listing.id,
                title: listing.title,
                vendor_id: listing.vendor_id ?? null,
                vendor_name: vendor?.name ?? null,
                pickup: pickupLocation,
              }
            : null
        }
        riders={riders}
      />
    </div>
  );
}