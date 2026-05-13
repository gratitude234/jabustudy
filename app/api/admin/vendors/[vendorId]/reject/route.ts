// app/api/admin/vendors/[vendorId]/reject/route.ts
// Admin-only endpoint - rejects a food vendor application

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  req: Request,
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

    const body = (await req.json().catch(() => null)) as { reason?: string } | null;
    const reason = body?.reason?.trim();
    if (!reason) return jsonError('Rejection reason is required', 400, 'missing_reason');

    const admin = createSupabaseAdminClient();

    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('id, user_id, name, verification_status')
      .eq('id', vendorId)
      .single();

    if (vendorErr || !vendor) return jsonError('Vendor not found', 404, 'not_found');

    const { error: updateErr } = await admin
      .from('vendors')
      .update({
        verification_status: 'rejected',
        accepts_orders: false,
        verified: false,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        reviewed_by: adminUser.userId,
      })
      .eq('id', vendorId);

    if (updateErr) return jsonError(updateErr.message, 500, 'update_failed');

    if (vendor.user_id) {
      await insertNotificationBestEffort(
        admin,
        {
          user_id: vendor.user_id,
          type: 'vendor_rejected',
          title: 'Vendor application update',
          body: `Your vendor application was not approved. Reason: ${reason}`,
          href: '/vendor',
        },
        {
          route: '/api/admin/vendors/[vendorId]/reject',
          userId: vendor.user_id,
          type: 'vendor_rejected',
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
