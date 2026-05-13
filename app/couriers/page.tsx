// app/couriers/page.tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CourierRow, ListingRow } from "@/lib/types";
import CouriersClient from "./CouriersClient";

export default async function CouriersPage({
  searchParams,
}: {
  searchParams?: Promise<{ listing?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const sp = (await searchParams) ?? {};
  const listingId = (sp.listing ?? "").trim();

  let listing: ListingRow | null = null;
  if (listingId) {
    const { data } = await supabase
      .from("listings")
      .select("id,title,location,category,price,price_label")
      .eq("id", listingId)
      .maybeSingle();
    listing = (data as any) ?? null;
  }

  const { data, error } = await supabase
    .from("couriers")
    .select(
      "id,name,whatsapp,phone,base_location,areas_covered,hours,price_note,verified,active,featured,created_at"
    )
    .eq("active", true)
    .eq("verified", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  const couriers = (data ?? []) as CourierRow[];

  const prefill = listing
    ? `Hi! I need delivery help on campus.\n\nItem: ${listing.title}\nPickup: ${listing.location ?? "(seller location not listed)"}\nDrop-off: (my location)\nBudget: (₦...)\n\nCan you help?`
    : `Hi! I need delivery help on campus.\n\nPickup: (where to pick)\nDrop-off: (my location)\nBudget: (₦...)\n\nCan you help?`;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Campus Transport (Car & Keke)</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Message a verified driver on WhatsApp. No delivery tracking inside Jabumarket.
            </p>
          </div>

          <Link
            href={listingId ? `/listing/${listingId}` : "/"}
            className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 no-underline"
          >
            ← Back
          </Link>
        </div>
      </div>

      <CouriersClient
        listingId={listingId}
        listingTitle={listing?.title ?? null}
        listingPickup={listing?.location ?? null}
        prefill={prefill}
        couriers={couriers}
        loadError={error?.message ?? null}
      />
    </div>
  );
}
