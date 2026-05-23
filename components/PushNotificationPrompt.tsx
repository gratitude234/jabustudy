'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'

import { subscribeToPush } from '@/components/ServiceWorkerRegister'

const DISMISSED_KEY = 'js_push_prompt_dismissed'

function supportsPush() {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export default function PushNotificationPrompt() {
  const [show, setShow] = useState(false)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    if (!supportsPush()) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(DISMISSED_KEY)) return

    const timer = window.setTimeout(() => setShow(true), 7000)
    return () => window.clearTimeout(timer)
  }, [])

  async function handleEnable() {
    setEnabling(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready
        await subscribeToPush(registration)
      }
      setShow(false)
    } finally {
      setEnabling(false)
    }
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  if (!show) return null

  return (
    <div className="pointer-events-none fixed bottom-36 left-0 right-0 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Get study reminders</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Alerts for streaks, materials, and answers.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="Dismiss notifications prompt"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={enabling}
            className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {enabling ? 'Enabling...' : 'Allow'}
          </button>
        </div>
      </div>
    </div>
  )
}
