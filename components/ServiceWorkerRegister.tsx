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
) {
  await fetch('/api/user/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, p256dh, auth }),
  })
}

export async function subscribeToPush(registration: ServiceWorkerRegistration) {
  try {
    if (!VAPID_PUBLIC_KEY) return

    let sub = await registration.pushManager.getSubscription()

    if (!sub) {
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

    await registerEndpoint(endpoint, keys.p256dh, keys.auth)
  } catch {
    // Push is optional.
  }
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
    const vapidKey = encodeURIComponent(VAPID_PUBLIC_KEY)

    navigator.serviceWorker
      .register(`/sw.js?v=${buildId}&vapid=${vapidKey}`)
      .then(async (registration) => {
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

        if (Notification.permission === 'granted') {
          await subscribeToPush(registration)
        }
      })
      .catch(() => {
        // Service worker registration is optional.
      })
  }, [])

  return null
}
