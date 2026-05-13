// public/sw.js
// Service worker for Jabumarket
// — Caching (PWA offline support)
// — Web Push notifications

const params = new URLSearchParams(self.location.search)
const CACHE_NAME = 'jabumarket-' + (params.get('v') ?? 'dev')

// Store VAPID key in SW scope for pushsubscriptionchange re-subscription
const VAPID_PUBLIC_KEY = params.get('vapid') ?? ''

const PRECACHE_URLS = ['/offline']

const NETWORK_ONLY = [
  '/api/',
  '/auth/',
  '/me',
  '/me/',
  '/inbox',
  '/inbox/',
  '/my-orders',
  '/my-listings',
  '/saved',
  '/notifications',
  '/vendor/',
  '/vendor',
  '/rider/',
  '/study-admin/',
  '/admin/',
]

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Cache size helper — iterative, not recursive ──────────────────────────────
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  const toDelete = keys.slice(0, Math.max(0, keys.length - maxItems))
  await Promise.all(toDelete.map((k) => cache.delete(k)))
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  const isNetworkOnly =
    NETWORK_ONLY.some((p) => url.pathname === p || url.pathname.startsWith(p)) ||
    url.searchParams.has('_rsc')

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    isNetworkOnly
  ) return

  // Cache-first for static assets (_next/static)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
            trimCache(CACHE_NAME, 60)
          })
          return res
        })
      })
    )
    return
  }

  // Network-first for pages — fall back to cache, then /offline
  e.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, clone)
          trimCache(CACHE_NAME, 60)
        })
        return res
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/offline'))
      )
  )
})

// ── Push event ────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'New notification', body: '', data: {} }

  try {
    if (event.data) {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    }
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:     data.body,
      icon:     data.icon  ?? '/icon-192.png',
      badge:    data.badge ?? '/icon-192.png',
      tag:      data.tag   ?? `jabu-${Date.now()}`,
      renotify: true,
      vibrate:  [200, 100, 200],
      data:     data.data ?? {},
    })
  )
})

// ── Push subscription change — re-register silently rotated subscriptions ─────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const appServerKey = VAPID_PUBLIC_KEY
          ? Uint8Array.from(atob(
              VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/') +
              '='.repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4)
            ), c => c.charCodeAt(0))
          : undefined

        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          ...(appServerKey ? { applicationServerKey: appServerKey } : {}),
        })

        const json = newSub.toJSON()
        const { endpoint, keys } = json

        // Re-register the new subscription on the server
        await fetch('/api/user/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint,
            p256dh: keys?.p256dh,
            auth:   keys?.auth,
          }),
        })
      } catch (err) {
        console.error('[SW] pushsubscriptionchange failed:', err)
      }
    })()
  )
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.href ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.startsWith(self.location.origin))
        if (existing) {
          existing.focus()
          return existing.navigate(targetUrl)
        }
        return self.clients.openWindow(targetUrl)
      })
  )
})

// ── Message handler (SW updates) ─────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
