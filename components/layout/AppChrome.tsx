"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import MobileTopBar from "@/components/layout/MobileTopBar";
import StudyBottomNav from "@/components/layout/StudyBottomNav";
import TopNav from "@/components/layout/TopNav";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

const APP_CONTAINER =
  "mx-auto w-full max-w-6xl px-4 md:px-6 lg:max-w-7xl lg:px-8";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);

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
      <Suspense fallback={null}>
        <MobileTopBar />
      </Suspense>

      <Suspense fallback={null}>
        <TopNav />
      </Suspense>

      <main className={[APP_CONTAINER, "py-6 md:py-8", "pb-20 md:pb-8"].join(" ")}>
        {children}
      </main>

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

      <PWAInstallBanner />
    </NotificationsProvider>
  );
}
