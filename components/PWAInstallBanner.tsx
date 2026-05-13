'use client'

import { useEffect, useState } from 'react'
import { usePWAInstall } from './PWAInstallProvider'
import { X, Download } from 'lucide-react'

const DISMISSED_KEY = 'jm_install_banner_dismissed'
const VISIT_KEY = 'jm_visit_count'

export default function PWAInstallBanner() {
  const { canInstall, triggerInstall, isInstalled } = usePWAInstall()
  const [show, setShow] = useState(false)
  const [showIOS, setShowIOS] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isInstalled) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    // Detect iOS Safari
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    const isIOSSafari = isIOS && isSafari

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true // iOS Safari non-standard property

    if (standalone) return

    // Track visits — show after 2nd visit
    const visits = parseInt(localStorage.getItem(VISIT_KEY) ?? '0', 10) + 1
    localStorage.setItem(VISIT_KEY, String(visits))

    if (visits < 2) return

    // For iOS Safari — no beforeinstallprompt exists, show manual guide
    if (isIOSSafari) {
      const t = setTimeout(() => setShowIOS(true), 3000)
      return () => clearTimeout(t)
    }

    // For Chrome/Android — show after prompt is available
    if (canInstall) {
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    }
  }, [canInstall, isInstalled])

  async function handleInstall() {
    setInstalling(true)
    const outcome = await triggerInstall()
    setInstalling(false)
    if (outcome === 'accepted') {
      setShow(false)
    }
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  if (isInstalled) return null

  return (
    <>
      {/* Android/Chrome install banner */}
      {show && (
        <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card shadow-lg p-3 flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt=""
              className="h-10 w-10 rounded-xl shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Install Jabumarket
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fast, offline-ready, no app store needed
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDismiss}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleInstall}
                disabled={installing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {installing ? 'Installing…' : 'Install'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Safari manual install guide */}
      {showIOS && (
        <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card shadow-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">
                Install Jabumarket on iPhone
              </p>
              <button
                onClick={() => {
                  setShowIOS(false)
                  localStorage.setItem(DISMISSED_KEY, '1')
                }}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground list-decimal pl-4">
              <li>
                Tap the <strong className="text-foreground">Share</strong> button at the bottom of Safari
              </li>
              <li>
                Scroll down and tap <strong className="text-foreground">&quot;Add to Home Screen&quot;</strong>
              </li>
              <li>
                Tap <strong className="text-foreground">Add</strong> — done!
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
