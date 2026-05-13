// app/api/admin/listings/feature/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  try {
    try {
      await requireAdmin();
    } catch (e: unknown) {
      const err = e as { message?: string; status?: number };
      return jsonError(err?.message ?? 'Forbidden', err?.status ?? 403);
    }

    const body = await req.json() as { listing_id: string; featured: boolean };
    const { listing_id, featured } = body;

    if (!listing_id || typeof featured !== 'boolean') {
      return jsonError('Missing listing_id or featured', 400);
    }

    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from('listings')
      .update({ featured })
      .eq('id', listing_id);

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ ok: false, message: err?.message ?? 'Server error' }, { status: 500 });
  }
}
