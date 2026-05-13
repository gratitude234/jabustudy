// app/api/delivery/requests/[requestId]/cancel/route.ts
// POST - auth required, verifies buyer_id ownership before cancelling

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Unauthenticated' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: request } = await admin
    .from('delivery_requests')
    .select('id, buyer_id, status, rider_id')
    .eq('id', requestId)
    .single();

  if (!request) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
  if (request.buyer_id !== user.id) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }
  if (request.status !== 'open') {
    return NextResponse.json(
      { ok: false, message: 'Cannot cancel — request is not open' },
      { status: 400 }
    );
  }

  await admin.from('delivery_requests').update({ status: 'cancelled' }).eq('id', requestId);

  try {
    if (request.rider_id) {
      const { data: rider } = await admin
        .from('riders')
        .select('id, user_id')
        .eq('id', request.rider_id)
        .maybeSingle();

      if (rider?.user_id) {
        await insertNotificationBestEffort(
          admin,
          {
            user_id: rider.user_id,
            type: 'delivery_cancelled',
            title: 'Delivery cancelled',
            body: 'The buyer cancelled this delivery request.',
            href: '/rider/dashboard',
          },
          {
            route: '/api/delivery/requests/[requestId]/cancel',
            userId: rider.user_id,
            type: 'delivery_cancelled',
          }
        );

        const { sendRiderPush } = await import('@/lib/webPush');
        void sendRiderPush(rider.id, {
          title: 'Delivery cancelled',
          body: 'The buyer cancelled this delivery request.',
          href: '/rider/dashboard',
          tag: `cancel-${requestId}`,
        });
      }
    }
  } catch {
    // Non-critical.
  }

  return NextResponse.json({ ok: true });
}
