// app/api/user/push/route.ts
// Saves or removes a Web Push subscription for any authenticated user.
//
// POST   { endpoint, p256dh, auth } → upserts subscription
// DELETE { endpoint }              → removes subscription

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status })
}

// ── POST — register a push subscription ──────────────────────────────────────
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated')

    const body = await req.json().catch(() => null) as {
      endpoint?: string
      p256dh?: string
      auth?: string
    } | null

    if (!body?.endpoint) return jsonError('endpoint required', 400, 'missing_endpoint')
    if (!body?.p256dh)   return jsonError('p256dh required', 400, 'missing_p256dh')
    if (!body?.auth)     return jsonError('auth required', 400, 'missing_auth')

    const admin = createSupabaseAdminClient()
    await admin
      .from('user_push_subscriptions')
      .upsert({
        user_id:    user.id,
        endpoint:   body.endpoint,
        p256dh:     body.p256dh,
        auth:       body.auth,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' })

    // Trim to the 10 most-recent subscriptions for this user
    const { data: allSubs } = await admin
      .from('user_push_subscriptions')
      .select('id, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    const toDelete = (allSubs ?? []).slice(10).map((s: { id: string }) => s.id)
    if (toDelete.length) {
      await admin.from('user_push_subscriptions').delete().in('id', toDelete)
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

// ── DELETE — remove a subscription ───────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated')

    const body = await req.json().catch(() => null) as { endpoint?: string } | null
    if (!body?.endpoint) return jsonError('endpoint required', 400, 'missing_endpoint')

    const admin = createSupabaseAdminClient()
    await admin
      .from('user_push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', body.endpoint)

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
