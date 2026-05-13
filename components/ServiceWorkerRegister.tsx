'use client'

// Add NEXT_PUBLIC_VAPID_PUBLIC_KEY=[same value as VAPID_PUBLIC_KEY] to .env.local

import { useEffect } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData], c => c.charCodeAt(0))
}

async function registerEndpoint(
  endpoint: string,
  p256dh: string,
  auth: string,
  route: string,
) {
  await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, p256dh, auth }),
  })
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  role?: 'vendor' | 'rider',
) {
  try {
    if (!VAPID_PUBLIC_KEY) return

    let sub = await registration.pushManager.getSubscription()

    if (!sub) {
      // Only subscribe if permission already granted —
      // prompting is handled elsewhere
      if (Notification.permission !== 'granted') return

      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    if (!sub) return

    const { endpoint, keys } = sub.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    // Always register to user_push_subscriptions (drives in-app bell count)
    await registerEndpoint(endpoint, keys.p256dh, keys.auth, '/api/user/push')

    // Also register to the role-specific table so role push helpers work
    if (role === 'vendor') {
      await registerEndpoint(endpoint, keys.p256dh, keys.auth, '/api/vendor/push')
    } else if (role === 'rider') {
      await registerEndpoint(endpoint, keys.p256dh, keys.auth, '/api/rider/push')
    }
  } catch {
    // Silent — push is not critical
  }
}

type Props = {
  /** Pass 'vendor' in the vendor layout, 'rider' in the rider layout. */
  role?: 'vendor' | 'rider'
}

export default function ServiceWorkerRegister({ role }: Props = {}) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
    const vapidKey = encodeURIComponent(VAPID_PUBLIC_KEY)

    navigator.serviceWorker
      .register(`/sw.js?v=${buildId}&vapid=${vapidKey}`)
      .then(async (registration) => {
        // Handle SW updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              const event = new CustomEvent('sw-update-available', {
                detail: { worker: newWorker },
              })
              window.dispatchEvent(event)
            }
          })
        })

        // Subscribe to push if already have permission
        if (Notification.permission === 'granted') {
          await subscribeToPush(registration, role)
        }
      })
      .catch(() => {
        // SW registration failed — not critical
      })
  }, [role])

  return null
}
