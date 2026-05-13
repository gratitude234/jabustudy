import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NavContextResponse = {
  buyerUnread: number;
  vendorUnread: number;
  pendingVendorOrders: number;
  isVendor: boolean;
  vendorId: string | null;
  isRider: boolean;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) return jsonError(authError.message, 500);
    if (!user) return jsonError("Unauthenticated", 401);

    const admin = createSupabaseAdminClient();

    const [vendorRes, riderRes, buyerUnreadRes] = await Promise.all([
      admin
        .from("vendors")
        .select("id, verification_status")
        .eq("user_id", user.id)
        .eq("vendor_type", "food")
        .maybeSingle(),
      admin.from("riders").select("id").eq("user_id", user.id).maybeSingle(),
      admin.from("conversations").select("buyer_unread").eq("buyer_id", user.id),
    ]);

    if (vendorRes.error) return jsonError(vendorRes.error.message, 500);
    if (riderRes.error) return jsonError(riderRes.error.message, 500);
    if (buyerUnreadRes.error) return jsonError(buyerUnreadRes.error.message, 500);

    const isVendor = Boolean(
      vendorRes.data &&
        ["approved", "verified"].includes(vendorRes.data.verification_status ?? ""),
    );
    const vendorId = isVendor ? vendorRes.data?.id ?? null : null;

    const [vendorUnreadRes, pendingOrdersRes] = await Promise.all([
      vendorId
        ? admin.from("conversations").select("vendor_unread").eq("vendor_id", vendorId)
        : Promise.resolve({ data: [], error: null }),
      vendorId
        ? admin
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("vendor_id", vendorId)
            .eq("status", "pending")
        : Promise.resolve({ count: 0, error: null }),
    ]);

    if (vendorUnreadRes.error) return jsonError(vendorUnreadRes.error.message, 500);
    if (pendingOrdersRes.error) return jsonError(pendingOrdersRes.error.message, 500);

    const payload: NavContextResponse = {
      buyerUnread: (buyerUnreadRes.data ?? []).reduce(
        (sum, row) => sum + (row.buyer_unread ?? 0),
        0,
      ),
      vendorUnread: (vendorUnreadRes.data ?? []).reduce(
        (sum, row) => sum + (row.vendor_unread ?? 0),
        0,
      ),
      pendingVendorOrders: pendingOrdersRes.count ?? 0,
      isVendor,
      vendorId,
      isRider: Boolean(riderRes.data?.id),
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return jsonError(message, 500);
  }
}
