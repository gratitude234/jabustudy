export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { formatPlanLabel, normalizeOrder, signedReceiptUrl, type BillingOrderRow } from "@/lib/studyBilling";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function errorInfo(error: unknown) {
  const e = error as { message?: unknown; status?: unknown; code?: unknown };
  return {
    message: typeof e.message === "string" ? e.message : "Server error",
    status: typeof e.status === "number" ? e.status : 500,
    code: typeof e.code === "string" ? e.code : "SERVER_ERROR",
  };
}

export async function GET(req: Request) {
  try {
    const { isSuper } = await requireStudyModeratorFromRequest(req);
    if (!isSuper) return jsonError("Only main Study Admins can review billing.", 403, "STUDY_ADMIN_REQUIRED");

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending_review";
    const limit = Math.min(100, Math.max(5, Number(url.searchParams.get("limit") || 50)));
    const admin = createSupabaseAdminClient();

    let query = admin
      .from("study_billing_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as BillingOrderRow[];
    const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
    const profileMap = new Map<string, { email: string | null; fullName: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id,email,full_name")
        .in("id", userIds);
      for (const profile of (profiles ?? []) as ProfileRow[]) {
        profileMap.set(String(profile.id), {
          email: profile.email ?? null,
          fullName: profile.full_name ?? null,
        });
      }
    }

    const items = await Promise.all(rows.map(async (row) => {
      const order = normalizeOrder(row);
      const profile = profileMap.get(row.user_id) ?? null;
      return {
        ...order,
        planLabel: formatPlanLabel(order.planKey),
        receiptUrl: await signedReceiptUrl(row.receipt_path),
        user: {
          id: row.user_id,
          email: profile?.email ?? null,
          fullName: profile?.fullName ?? null,
          displayName: profile?.fullName ?? profile?.email ?? "Unknown student",
        },
      };
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error: unknown) {
    const info = errorInfo(error);
    return jsonError(info.message, info.status, info.code);
  }
}
