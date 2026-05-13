// app/api/marketplace/bump-listing/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json() as { listing_id: string };
    const { listing_id } = body;
    if (!listing_id) {
      return NextResponse.json({ ok: false, message: 'Missing listing_id' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Verify the listing belongs to the caller's vendor
    const { data: listing } = await admin
      .from('listings')
      .select('id, vendor_id, status, updated_at')
      .eq('id', listing_id)
      .maybeSingle();

    if (!listing) {
      return NextResponse.json({ ok: false, message: 'Listing not found' }, { status: 404 });
    }

    const { data: vendor } = await admin
      .from('vendors')
      .select('id')
      .eq('id', listing.vendor_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!vendor) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    // Check 48-hour cooldown via updated_at
    const WINDOW_MS = 48 * 60 * 60 * 1000;
    const lastUpdated = listing.updated_at ? new Date(listing.updated_at).getTime() : 0;
    const now = Date.now();

    if (now - lastUpdated < WINDOW_MS) {
      const nextBumpAt = new Date(lastUpdated + WINDOW_MS).toISOString();
      return NextResponse.json({
        ok: false,
        code: 'TOO_SOON',
        message: 'You can only bump a listing once every 48 hours.',
        next_bump_at: nextBumpAt,
      });
    }

    const nowIso = new Date().toISOString();
    const { error } = await admin
      .from('listings')
      .update({ created_at: nowIso, updated_at: nowIso })
      .eq('id', listing_id);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    const nextBumpAt = new Date(now + WINDOW_MS).toISOString();
    return NextResponse.json({ ok: true, next_bump_at: nextBumpAt });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ ok: false, message: err?.message ?? 'Server error' }, { status: 500 });
  }
}
