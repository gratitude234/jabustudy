// lib/webPush.ts
// Sends Web Push notifications using the `web-push` npm package with VAPID.
//
// Required env vars:
//   VAPID_PUBLIC_KEY             — base64url EC P-256 public key
//   VAPID_PRIVATE_KEY            — base64url EC P-256 private key
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY — same value as VAPID_PUBLIC_KEY (client-exposed)
//   VAPID_SUBJECT                — mailto: or https: URI identifying the sender
//
// Server-only — never import this file in client components.

import webpush from 'web-push'
import { createSupabaseAdminClient } from './supabase/admin'

export type PushPayload = {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  href?: string
  data?: Record<string, unknown>
}

// Tri-state result: 'ok' | 'expired' (410/404 — delete sub) | 'error' (transient — keep sub)
type SendResult = 'ok' | 'expired' | 'error'

// ── VAPID config — lazy singleton ─────────────────────────────────────────────

let _vapidConfigured = false

function ensureVapid() {
  if (_vapidConfigured) return
  const pub  = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const sub  = process.env.VAPID_SUBJECT ?? 'mailto:admin@jabumarket.com'
  if (!pub || !priv) throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set')
  webpush.setVapidDetails(sub, pub, priv)
  _vapidConfigured = true
}

// ── Core send ─────────────────────────────────────────────────────────────────

/**
 * Send a Web Push notification to a single device subscription.
 * Returns:
 *   'ok'      — delivered successfully
 *   'expired' — subscription is gone (410/404) — caller should delete it
 *   'error'   — transient failure — caller should NOT delete the subscription
 * Never throws.
 */
export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<SendResult> {
  try {
    ensureVapid()

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({
        title: payload.title,
        body:  payload.body,
        icon:  payload.icon  ?? '/icon-192.png',
        badge: payload.badge ?? '/icon-192.png',
        tag:   payload.tag,
        data:  { href: payload.href ?? '/', ...payload.data },
      }),
    )

    return 'ok'
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      const code = (err as { statusCode: number }).statusCode
      // 410 Gone / 404 = subscription expired — safe to delete
      if (code === 410 || code === 404) return 'expired'
    }
    // Transient error (network, 429, 5xx) — keep the subscription
    console.error('[webPush] sendPush error:', err)
    return 'error'
  }
}

// ── Fan-out helpers ───────────────────────────────────────────────────────────

async function fanOut(
  subs: { endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
  table: 'user_push_subscriptions' | 'vendor_push_subscriptions' | 'rider_push_subscriptions',
): Promise<void> {
  if (!subs.length) return

  const results = await Promise.allSettled(subs.map(s => sendPush(s, payload)))

  // Only delete subscriptions confirmed expired (410/404) — never delete on transient errors
  const expiredEndpoints = subs
    .filter((_, i) => {
      const r = results[i]
      return r.status === 'fulfilled' && r.value === 'expired'
    })
    .map(s => s.endpoint)

  if (expiredEndpoints.length) {
    const admin = createSupabaseAdminClient()
    await admin.from(table).delete().in('endpoint', expiredEndpoints)
  }
}

/**
 * Send a Web Push notification to all devices of a given user (buyer/student).
 * Auto-removes expired subscriptions. Never throws.
 */
export async function sendUserPush(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: subs } = await admin
      .from('user_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    await fanOut(subs ?? [], payload, 'user_push_subscriptions')
  } catch {
    // Never throw — push is fire-and-forget
  }
}

/**
 * Send a Web Push notification to all devices of a given rider.
 * Auto-removes expired subscriptions. Never throws.
 */
export async function sendRiderPush(
  riderId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: subs } = await admin
      .from('rider_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('rider_id', riderId)

    await fanOut(subs ?? [], payload, 'rider_push_subscriptions')
  } catch {
    // Never throw — push is fire-and-forget
  }
}

/**
 * Send a Web Push notification to all devices of a given vendor.
 * Auto-removes expired subscriptions. Never throws.
 */
export async function sendVendorPush(
  vendorId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: subs } = await admin
      .from('vendor_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('vendor_id', vendorId)

    await fanOut(subs ?? [], payload, 'vendor_push_subscriptions')
  } catch {
    // Never throw — push is fire-and-forget
  }
}
