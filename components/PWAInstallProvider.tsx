'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type PWAInstallContext = {
  canInstall: boolean
  triggerInstall: () => Promise<'accepted' | 'dismissed' | null>
  isInstalled: boolean
}

const ctx = createContext<PWAInstallContext>({
  canInstall: false,
  triggerInstall: async () => null,
  isInstalled: false,
})

export function usePWAInstall() {
  return useContext(ctx)
}

export default function PWAInstallProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already running as installed PWA
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true
    if (standalone) {
      setIsInstalled(true)
      return
    }

    // Pick up the event if it already fired before this component mounted.
    // The inline script in layout.tsx captures it on window.__pwaInstallPrompt
    // so we never miss it even on slow-hydrating pages.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const early = (window as any).__pwaInstallPrompt as BeforeInstallPromptEvent | null
    if (early) {
      setDeferredPrompt(early)
    }

    // Also listen for future fires (e.g. after the user dismisses once and
    // Chrome re-evaluates eligibility) and for our custom 'pwaInstallReady'
    // event fired by the inline script.
    function handlePrompt(e: Event) {
      e.preventDefault?.()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    function handleReady() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (window as any).__pwaInstallPrompt as BeforeInstallPromptEvent | null
      if (p) setDeferredPrompt(p)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('pwaInstallReady', handleReady)

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__pwaInstallPrompt = null
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('pwaInstallReady', handleReady)
    }
  }, [])

  async function triggerInstall() {
    if (!deferredPrompt) return null
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__pwaInstallPrompt = null
    return outcome
  }

  return (
    <ctx.Provider
      value={{
        canInstall: !!deferredPrompt,
        triggerInstall,
        isInstalled,
      }}
    >
      {children}
    </ctx.Provider>
  )
}