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
      listing_id: string;
      old_price: number;
      new_price: number;
    };
    const { listing_id, old_price, new_price } = body;

    if (!listing_id || typeof old_price !== 'number' || typeof new_price !== 'number') {
      return NextResponse.json({ ok: false, message: 'Missing fields' }, { status: 400 });
    }

    if (new_price >= old_price) {
      return NextResponse.json({ ok: true, notified: 0 });
    }

    const admin = createSupabaseAdminClient();

    const [titleRes, savesRes] = await Promise.all([
      admin.from('listings').select('title').eq('id', listing_id).maybeSingle(),
      admin
        .from('listing_saves')
        .select('user_id, price_at_save')
        .eq('listing_id', listing_id)
        .not('price_at_save', 'is', null)
        .gt('price_at_save', new_price)
        .limit(50),
    ]);

    const listingTitle = (titleRes.data?.title ?? 'A saved listing').trim();
    const savers = savesRes.data ?? [];

    if (savers.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 });
    }

    const notifications = savers.map((saver) => ({
      user_id: saver.user_id,
      type: 'price_drop',
      title: 'Price drop on a saved listing',
      body: `"${listingTitle}" dropped from ₦${old_price.toLocaleString()} to ₦${new_price.toLocaleString()}`,
      href: `/listing/${listing_id}`,
    }));

    await insertNotificationBestEffort(admin, notifications, {
      route: '/api/marketplace/price-drop-notify',
      type: 'price_drop',
    });

    return NextResponse.json({ ok: true, notified: notifications.length });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
