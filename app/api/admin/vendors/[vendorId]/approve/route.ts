// app/api/admin/vendors/[vendorId]/approve/route.ts
// Admin-only endpoint - approves a food vendor application

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const { vendorId } = await params;

    let adminUser: { userId: string };
    try {
      adminUser = await requireAdmin();
    } catch (error: unknown) {
      const adminError = error as { message?: string; status?: number };
      return jsonError(adminError.message ?? 'Forbidden', adminError.status ?? 403, 'forbidden');
    }

    const admin = createSupabaseAdminClient();

    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('id, user_id, name, verification_status')
      .eq('id', vendorId)
      .single();

    if (vendorErr || !vendor) return jsonError('Vendor not found', 404, 'not_found');
    if (vendor.verification_status === 'approved') {
      return jsonError('Already approved', 409, 'already_approved');
    }

    const { error: updateErr } = await admin
      .from('vendors')
      .update({
        verification_status: 'approved',
        accepts_orders: true,
        verified: true,
        verified_at: new Date().toISOString(),
        reviewed_by: adminUser.userId,
        rejection_reason: null,
        rejected_at: null,
      })
      .eq('id', vendorId);

    if (updateErr) return jsonError(updateErr.message, 500, 'update_failed');

    if (vendor.user_id) {
      await insertNotificationBestEffort(
        admin,
        {
          user_id: vendor.user_id,
          type: 'vendor_approved',
          title: 'Vendor account approved!',
          body: 'Your vendor account has been approved! You can now set up your menu and start receiving orders.',
          href: '/vendor',
        },
        {
          route: '/api/admin/vendors/[vendorId]/approve',
          userId: vendor.user_id,
          type: 'vendor_approved',
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
