// Server-only: never import this file in client components.

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

type SendResult = 'ok' | 'expired' | 'error'

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const sub = process.env.VAPID_SUBJECT ?? 'mailto:admin@jabu.study'
  if (!pub || !priv) throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set')
  webpush.setVapidDetails(sub, pub, priv)
  vapidConfigured = true
}

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
        body: payload.body,
        icon: payload.icon ?? '/icon-192.png',
        badge: payload.badge ?? '/icon-192.png',
        tag: payload.tag,
        data: { href: payload.href ?? '/', ...payload.data },
      }),
    )

    return 'ok'
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      const code = (err as { statusCode: number }).statusCode
      if (code === 410 || code === 404) return 'expired'
    }
    console.error('[webPush] sendPush error:', err)
    return 'error'
  }
}

async function fanOut(
  subs: { endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
): Promise<void> {
  if (!subs.length) return

  const results = await Promise.allSettled(subs.map(s => sendPush(s, payload)))
  const expiredEndpoints = subs
    .filter((_, i) => {
      const r = results[i]
      return r.status === 'fulfilled' && r.value === 'expired'
    })
    .map(s => s.endpoint)

  if (expiredEndpoints.length) {
    const admin = createSupabaseAdminClient()
    await admin.from('user_push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }
}

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

    await fanOut(subs ?? [], payload)
  } catch {
    // Push is fire-and-forget.
  }
}

export type NotificationCategory =
  | 'answers'
  | 'upvotes'
  | 'materials'
  | 'quizzes'
  | 'milestones'
  | 'reminders'
  | 'rep_alerts'

/**
 * Like sendUserPush but silently skips if the user has disabled this category.
 * Fail-open: if the preference lookup fails, the push is sent anyway.
 */
export async function sendUserPushIfAllowed(
  userId: string,
  payload: PushPayload,
  category: NotificationCategory,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from('user_notification_preferences')
      .select('push_categories')
      .eq('user_id', userId)
      .maybeSingle()
    const prefs = (data?.push_categories ?? {}) as Record<string, boolean>
    if (prefs[category] === false) return
  } catch { /* fail-open */ }
  await sendUserPush(userId, payload)
}

/**
 * Filter a list of userIds to those who have NOT disabled the given category.
 * Users with no preference row are included (opt-out model, default = enabled).
 * Fail-open: returns the full list if the DB query fails.
 */
export async function filterPushAllowed(
  userIds: string[],
  category: NotificationCategory,
): Promise<string[]> {
  if (!userIds.length) return []
  try {
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from('user_notification_preferences')
      .select('user_id, push_categories')
      .in('user_id', userIds)
    const optedOut = new Set<string>()
    for (const row of data ?? []) {
      if ((row.push_categories as Record<string, boolean>)[category] === false)
        optedOut.add(row.user_id)
    }
    return userIds.filter(id => !optedOut.has(id))
  } catch {
    return userIds
  }
}
