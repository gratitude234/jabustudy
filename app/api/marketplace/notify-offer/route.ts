// app/api/marketplace/notify-offer/route.ts
// Inserts an in-app notification and push alert for a marketplace offer.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendVendorPush } from "@/lib/webPush";

type NotifyOfferBody = {
  conversationId?: string;
  listingTitle?: string;
  buyerName?: string;
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

    let body: NotifyOfferBody;
    try {
      body = (await req.json()) as NotifyOfferBody;
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const conversationId = body.conversationId?.trim();
    if (!conversationId) {
      return jsonError("Missing conversationId", 400);
    }

    const admin = createSupabaseAdminClient();
    const { data: conversation, error: conversationErr } = await admin
      .from("conversations")
      .select("id, buyer_id, vendor_id, listing_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationErr) {
      return jsonError(conversationErr.message, 500);
    }
    if (!conversation) {
      return jsonError("Conversation not found", 404);
    }
    if (conversation.buyer_id !== user.id) {
      return jsonError("Forbidden", 403);
    }

    const [{ data: vendor, error: vendorErr }, { data: profile, error: profileErr }] =
      await Promise.all([
        admin
          .from("vendors")
          .select("id, user_id")
          .eq("id", conversation.vendor_id)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

    if (vendorErr) {
      return jsonError(vendorErr.message, 500);
    }
    if (!vendor) {
      return jsonError("Vendor not found", 500);
    }
    if (profileErr) {
      return jsonError(profileErr.message, 500);
    }

    let listingTitle = body.listingTitle?.trim();
    if (!listingTitle && conversation.listing_id) {
      const { data: listing, error: listingErr } = await admin
        .from("listings")
        .select("title")
        .eq("id", conversation.listing_id)
        .maybeSingle();
      if (listingErr) {
        return jsonError(listingErr.message, 500);
      }
      listingTitle = listing?.title?.trim() ?? "";
    }

    const fallbackBuyerName =
      profile?.full_name?.trim() ||
      profile?.email?.split("@")[0]?.trim() ||
      user.email?.split("@")[0]?.trim() ||
      "A buyer";
    const buyerName = body.buyerName?.trim() || fallbackBuyerName;
    const title = `New offer on ${listingTitle || "your listing"}`;
    const notificationBody = `${buyerName} sent you an offer`;
    const href = `/inbox/${conversationId}`;

    if (vendor.user_id && vendor.user_id !== user.id) {
      const { error: notifyErr } = await admin.from("notifications").insert({
        user_id: vendor.user_id,
        type: "new_offer",
        title,
        body: notificationBody,
        href,
      });
      if (notifyErr) {
        return jsonError(notifyErr.message, 500);
      }

      await sendVendorPush(vendor.id, {
        title,
        body: notificationBody,
        href,
        tag: `offer-${conversationId}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return jsonError(message, 500);
  }
}
