// app/api/cron/stale-listings/route.ts
//
// Migration: auto-update updated_at on listings
// CREATE OR REPLACE FUNCTION update_updated_at()
// RETURNS TRIGGER LANGUAGE plpgsql AS $$
// BEGIN
//   NEW.updated_at = now();
//   RETURN NEW;
// END;
// $$;
//
// DROP TRIGGER IF EXISTS listings_updated_at ON public.listings;
// CREATE TRIGGER listings_updated_at
//   BEFORE UPDATE ON public.listings
//   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
//
// Cron: notify sellers when their listing has been active for 30+ days with
// no update. Sends an in-app notification + skips anyone already notified
// in the last 25 days (prevents spam on listings that never get updated).
//
// Schedule: daily at 10:00 UTC (11am WAT) — see vercel.json
// Auth: Bearer CRON_SECRET header
//
// What it does:
//   1. Finds active listings last updated more than 30 days ago
//   2. Skips any whose vendor was already sent a stale notification within 25 days
//   3. Inserts one in-app notification per listing
//   4. Capped at 300 notifications per run

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const STALE_DAYS = 30;
const COOLDOWN_DAYS = 25;
const RUN_LIMIT = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET not set" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== secret) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString();
  const cooldownCutoff = new Date(now.getTime() - COOLDOWN_DAYS * 86_400_000).toISOString();

  // 1. Stale listings: active + not updated in STALE_DAYS
  //    Join vendors to get user_id for notification routing.
  const { data: staleRows, error: staleErr } = await admin
    .from("listings")
    .select("id, title, vendor_id, vendors(id, user_id, name)")
    .eq("status", "active")
    .lt("updated_at", staleCutoff)
    .not("vendor_id", "is", null)
    .limit(RUN_LIMIT);

  if (staleErr) {
    return NextResponse.json({ ok: false, error: staleErr.message }, { status: 500 });
  }

  const rows = (staleRows ?? []) as any[];
  if (!rows.length) return NextResponse.json({ ok: true, notified: 0, skipped: 0 });

  // 2. Check cooldown: which vendor_ids already got a stale notification recently?
  const vendorIds = [...new Set(rows.map((r) => r.vendor_id as string))];

  const { data: recentNotifs } = await admin
    .from("notifications")
    .select("href")
    .eq("type", "stale_listing")
    .gte("created_at", cooldownCutoff)
    .in("href", rows.map((r) => `/listing/${r.id}`));

  const alreadyNotified = new Set<string>(
    (recentNotifs ?? []).map((n: any) => {
      // href is /listing/{id} — extract listing id
      const parts = (n.href as string).split("/");
      return parts[parts.length - 1];
    })
  );

  // 3. Build notifications — one per stale listing, skip cooled-down ones
  const toInsert: any[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (alreadyNotified.has(row.id)) { skipped++; continue; }

    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    if (!vendor?.user_id) { skipped++; continue; }

    const titleShort = (row.title ?? "Your listing").slice(0, 50);

    toInsert.push({
      user_id: vendor.user_id,
      type: "stale_listing",
      title: "Is this still available?",
      body: `"${titleShort}" has been active for ${STALE_DAYS}+ days. Bump it to the top, edit it, or mark it sold.`,
      href: `/listing/${row.id}/edit`,
      is_read: false,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, notified: 0, skipped });
  }

  const { error: insertErr } = await admin.from("notifications").insert(toInsert);

  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notified: toInsert.length, skipped });
}

export { POST as GET };
