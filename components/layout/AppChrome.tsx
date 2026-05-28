"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import MobileTopBar from "@/components/layout/MobileTopBar";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";
import SidebarNav from "@/components/layout/SidebarNav";
import StudyBottomNav from "@/components/layout/StudyBottomNav";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

const APP_CONTAINER =
  "mx-auto w-full max-w-6xl px-4 md:px-6 lg:max-w-7xl lg:px-8";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const hasDesktopSidebar = pathname?.startsWith("/study") && !pathname.startsWith("/study-admin");

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const worker = (e as CustomEvent<{ worker: ServiceWorker }>).detail.worker;
      setUpdateWorker(worker);
    };

    window.addEventListener("sw-update-available", handleUpdate);
    return () => window.removeEventListener("sw-update-available", handleUpdate);
  }, []);

  if (pathname?.startsWith("/study-admin")) return <>{children}</>;

  return (
    <NotificationsProvider>
      {/* Mobile top bar (hidden at md+) */}
      <Suspense fallback={null}>
        <MobileTopBar />
      </Suspense>

      {/* Desktop sidebar (hidden below md) */}
      <Suspense fallback={null}>
        <SidebarNav />
      </Suspense>

      {/* Content shifted right by sidebar width at md+ */}
      <div className={hasDesktopSidebar ? "md:ml-[220px]" : undefined}>
        <main className={[APP_CONTAINER, "py-6 md:py-8", "pb-20 md:pb-8"].join(" ")}>
          {children}
        </main>
      </div>

      <StudyBottomNav />

      {updateWorker && (
        <div className="pointer-events-none fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
            <p className="text-sm font-semibold text-foreground">App updated</p>
            <button
              onClick={() => {
                updateWorker.postMessage({ type: "SKIP_WAITING" });
                window.location.reload();
              }}
              className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white"
            >
              Reload
            </button>
          </div>
        </div>
      )}

      {/* Floating WhatsApp support button */}
      <a
        href="https://wa.me/2347041022336"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat us on WhatsApp"
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-6"
      >
        {/* WhatsApp icon */}
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        <span className="text-sm font-semibold text-white">Need help?</span>
      </a>

      <PushNotificationPrompt />
      <PWAInstallBanner />
    </NotificationsProvider>
  );
}
