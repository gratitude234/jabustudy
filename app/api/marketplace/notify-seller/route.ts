// app/api/marketplace/notify-seller/route.ts
// Fire-and-forget: called by AskSellerButton when a new conversation is created.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthenticated' }, { status: 401 });
    }

    const body = (await req.json()) as {
      conversation_id: string;
      listing_id: string;
      vendor_id: string;
    };
    const { conversation_id, listing_id, vendor_id } = body;

    if (!conversation_id || !listing_id || !vendor_id) {
      return NextResponse.json({ ok: false, message: 'Missing fields' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const [listingRes, vendorRes] = await Promise.all([
      admin.from('listings').select('title').eq('id', listing_id).single(),
      admin.from('vendors').select('user_id').eq('id', vendor_id).single(),
    ]);

    const listingTitle = (listingRes.data?.title ?? 'a listing').trim();
    const vendorUserId = vendorRes.data?.user_id;

    if (vendorUserId && vendorUserId !== user.id) {
      await insertNotificationBestEffort(
        admin,
        {
          user_id: vendorUserId,
          type: 'new_inquiry',
          title: 'Someone is interested in your listing',
          body: `A buyer just messaged you about "${listingTitle}"`,
          href: `/inbox/${conversation_id}`,
        },
        {
          route: '/api/marketplace/notify-seller',
          userId: vendorUserId,
          type: 'new_inquiry',
        }
      );

      try {
        const { sendVendorPush } = await import('@/lib/webPush');
        void sendVendorPush(vendor_id, {
          title: 'New inquiry',
          body: `Someone messaged you about "${listingTitle}"`,
          href: `/inbox/${conversation_id}`,
          tag: `inquiry-${conversation_id}`,
        });
      } catch {
        // Push failure must never crash the route.
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}
