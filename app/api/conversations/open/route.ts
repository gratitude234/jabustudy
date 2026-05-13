// app/api/conversations/open/route.ts
// Required DB migration for conflict-safe get-or-create:
//   DO $$
//   BEGIN
//     IF EXISTS (
//       SELECT 1
//       FROM public.conversations
//       WHERE listing_id IS NOT NULL
//       GROUP BY buyer_id, vendor_id, listing_id
//       HAVING COUNT(*) > 1
//     ) THEN
//       RAISE EXCEPTION 'Duplicate conversations exist for buyer_id/vendor_id/listing_id. Resolve duplicates before adding the unique constraint.';
//     END IF;
//     IF NOT EXISTS (
//       SELECT 1
//       FROM pg_constraint
//       WHERE conrelid = 'public.conversations'::regclass
//         AND conname = 'conversations_buyer_vendor_listing_key'
//     ) THEN
//       ALTER TABLE public.conversations
//       ADD CONSTRAINT conversations_buyer_vendor_listing_key
//       UNIQUE (buyer_id, vendor_id, listing_id);
//     END IF;
//   END $$;

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OpenConversationBody = {
  listingId?: string;
  vendorId?: string;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Unauthenticated", 401);
    }

    let body: OpenConversationBody;
    try {
      body = (await req.json()) as OpenConversationBody;
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const listingId = body.listingId?.trim();
    const vendorId = body.vendorId?.trim();

    if (!listingId || !vendorId) {
      return jsonError("Missing listingId or vendorId", 400);
    }

    const admin = createSupabaseAdminClient();
    const { data: listing, error: listingErr } = await admin
      .from("listings")
      .select("id, vendor_id")
      .eq("id", listingId)
      .maybeSingle();

    if (listingErr) {
      return jsonError(listingErr.message, 500);
    }
    if (!listing) {
      return jsonError("Listing not found", 404);
    }
    if (listing.vendor_id !== vendorId) {
      return jsonError("Listing vendor mismatch", 400);
    }

    const payload = {
      listing_id: listingId,
      buyer_id: user.id,
      vendor_id: vendorId,
    };

    const { data: inserted, error: upsertErr } = await admin
      .from("conversations")
      .upsert(payload, {
        onConflict: "buyer_id,vendor_id,listing_id",
        ignoreDuplicates: true,
      })
      .select("id")
      .maybeSingle();

    if (upsertErr) {
      return jsonError(upsertErr.message, 500);
    }

    if (inserted?.id) {
      return NextResponse.json({ conversationId: inserted.id, created: true });
    }

    const { data: existing, error: existingErr } = await admin
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .eq("vendor_id", vendorId)
      .maybeSingle();

    if (existingErr) {
      return jsonError(existingErr.message, 500);
    }
    if (!existing?.id) {
      return jsonError("Failed to open conversation", 500);
    }

    return NextResponse.json({ conversationId: existing.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return jsonError(message, 500);
  }
}
