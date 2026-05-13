// app/api/vendor/register/route.ts
// POST  - creates a new food vendor application
// PATCH - resubmits a rejected application (updates fields + resets to pending)

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

type VendorBody = {
  name?: string;
  location?: string;
  phone?: string;
  whatsapp?: string;
  description?: string;
  opens_at?: string;
  closes_at?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const admin = createSupabaseAdminClient();

    const { data: existing } = await admin
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) return jsonError('You already have a vendor account', 409, 'already_exists');

    const body = (await req.json().catch(() => null)) as VendorBody | null;

    if (!body?.name?.trim()) return jsonError('Business name is required', 400, 'missing_name');
    if (!body?.location?.trim()) return jsonError('Location is required', 400, 'missing_location');
    const vendorName = body.name.trim();
    const vendorLocation = body.location.trim();

    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .insert({
        user_id: user.id,
        name: vendorName,
        location: vendorLocation,
        phone: body.phone?.trim() || null,
        whatsapp: body.whatsapp?.trim() || null,
        description: body.description?.trim() || null,
        opens_at: body.opens_at || null,
        closes_at: body.closes_at || null,
        bank_name: body.bank_name?.trim() || null,
        bank_account_number: body.bank_account_number?.trim() || null,
        bank_account_name: body.bank_account_name?.trim() || null,
        vendor_type: 'food',
        verification_status: 'pending',
        accepts_orders: false,
      })
      .select()
      .single();

    if (vendorErr || !vendor) {
      return jsonError(vendorErr?.message ?? 'Failed to create vendor', 500, 'insert_failed');
    }

    const { data: admins } = await admin.from('admins').select('user_id');
    if (admins && admins.length > 0) {
      await insertNotificationBestEffort(
        admin,
        admins.map((adminRow: { user_id: string }) => ({
          user_id: adminRow.user_id,
          type: 'vendor_application',
          title: 'New food vendor application',
          body: `${vendorName} — ${vendorLocation}`,
          href: '/admin/vendors',
        })),
        {
          route: '/api/vendor/register',
          type: 'vendor_application',
        }
      );
    }

    return NextResponse.json({ ok: true, vendor_id: vendor.id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const admin = createSupabaseAdminClient();

    const { data: existing } = await admin
      .from('vendors')
      .select('id, verification_status, name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) return jsonError('No vendor account found', 404, 'not_found');
    if (existing.verification_status !== 'rejected') {
      return jsonError('Only rejected applications can be resubmitted', 400, 'not_rejected');
    }

    const body = (await req.json().catch(() => null)) as VendorBody | null;
    if (!body?.name?.trim()) return jsonError('Business name is required', 400, 'missing_name');
    if (!body?.location?.trim()) return jsonError('Location is required', 400, 'missing_location');
    const vendorName = body.name.trim();
    const vendorLocation = body.location.trim();

    const { error: updateErr } = await admin
      .from('vendors')
      .update({
        name: vendorName,
        location: vendorLocation,
        phone: body.phone?.trim() || null,
        whatsapp: body.whatsapp?.trim() || null,
        description: body.description?.trim() || null,
        opens_at: body.opens_at || null,
        closes_at: body.closes_at || null,
        verification_status: 'pending',
        rejection_reason: null,
        rejected_at: null,
        reviewed_by: null,
      })
      .eq('id', existing.id);

    if (updateErr) return jsonError(updateErr.message, 500, 'update_failed');

    const { data: admins } = await admin.from('admins').select('user_id');
    if (admins && admins.length > 0) {
      await insertNotificationBestEffort(
        admin,
        admins.map((adminRow: { user_id: string }) => ({
          user_id: adminRow.user_id,
          type: 'vendor_application',
          title: 'Vendor resubmitted application',
          body: `${vendorName} updated and resubmitted`,
          href: '/admin/vendors',
        })),
        {
          route: '/api/vendor/register',
          type: 'vendor_application',
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
