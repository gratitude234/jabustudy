"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import BottomNav from "@/components/layout/BottomNav";
import MobileTopBar from "@/components/layout/MobileTopBar";
import StudyBottomNav from "@/components/layout/StudyBottomNav";
import TopNav from "@/components/layout/TopNav";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { subscribeToPush } from "@/components/ServiceWorkerRegister";
import { useAuth } from "@/contexts/AuthContext";
import { NavProvider } from "@/contexts/NavContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { supabase } from "@/lib/supabase";

const APP_CONTAINER =
  "mx-auto w-full max-w-6xl px-4 md:px-6 lg:max-w-7xl lg:px-8";

type ActiveOrderSummary = {
  vendorName: string;
  extraCount: number;
};

type ActiveOrdersResponse = {
  ok?: boolean;
  orders?: Array<{
    id: string;
    vendor?: {
      name?: string | null;
    } | null;
  }>;
  message?: string;
};

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = pathname?.startsWith("/admin") || pathname?.startsWith("/study-admin");
  const isStudyPage = pathname === "/study" || pathname?.startsWith("/study/");
  const isConversationPage = /^\/inbox\/[^/]+$/.test(pathname ?? "");
  const hideActiveOrderBanner = pathname === "/my-orders" || isStudyPage;

  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [activeOrderSummary, setActiveOrderSummary] = useState<ActiveOrderSummary | null>(null);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const worker = (e as CustomEvent<{ worker: ServiceWorker }>).detail.worker;
      setUpdateWorker(worker);
    };

    window.addEventListener("sw-update-available", handleUpdate);
    return () => window.removeEventListener("sw-update-available", handleUpdate);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("jm_notif_dismissed") === "1") return;

    const visitCount = parseInt(localStorage.getItem("jm_visit_count") ?? "0", 10) + 1;
    localStorage.setItem("jm_visit_count", String(visitCount));

    const hasListed = localStorage.getItem("jm_has_listed") === "1";
    if (visitCount >= 3 || hasListed) {
      const timer = window.setTimeout(() => {
        setShowNotifPrompt(true);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, []);

  async function requestNotificationPermission() {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const reg = await navigator.serviceWorker.ready;
      await subscribeToPush(reg);
    }
    setShowNotifPrompt(false);
    localStorage.setItem("jm_notif_dismissed", "1");
  }

  function dismissNotificationPrompt() {
    localStorage.setItem("jm_notif_dismissed", "1");
    setShowNotifPrompt(false);
  }

  const loadActiveOrders = useCallback(async () => {
    if (isAdmin || hideActiveOrderBanner) {
      setActiveOrderSummary(null);
      return;
    }

    if (!user) {
      setActiveOrderSummary(null);
      return;
    }

    const res = await fetch("/api/orders/my?filter=active&limit=5", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as ActiveOrdersResponse | null;

    if (!res.ok || !json?.ok) {
      console.error("[app-chrome] failed to fetch active orders:", json?.message ?? res.statusText);
      setActiveOrderSummary(null);
      return;
    }

    const orders = Array.isArray(json.orders) ? json.orders : [];
    if (orders.length === 0) {
      setActiveOrderSummary(null);
      return;
    }

    setActiveOrderSummary({
      vendorName: orders[0]?.vendor?.name?.trim() || "your vendor",
      extraCount: Math.max(0, orders.length - 1),
    });
  }, [hideActiveOrderBanner, isAdmin, user]);

  useEffect(() => {
    if (authLoading) return;
    const timer = window.setTimeout(() => {
      void loadActiveOrders();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [authLoading, loadActiveOrders, pathname]);

  useEffect(() => {
    if (!user?.id || isAdmin || hideActiveOrderBanner) return;

    const channel = supabase
      .channel(`active-orders:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `buyer_id=eq.${user.id}` },
        () => {
          void loadActiveOrders();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hideActiveOrderBanner, isAdmin, loadActiveOrders, user?.id]);

  if (isAdmin) return <>{children}</>;

  return (
    <NotificationsProvider>
      <NavProvider>
        <Suspense fallback={null}>
          <MobileTopBar />
        </Suspense>

        <Suspense fallback={null}>
          <TopNav />
        </Suspense>

        {activeOrderSummary && !hideActiveOrderBanner && (
          <div className={APP_CONTAINER}>
            <Link
              href="/my-orders"
              className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 no-underline hover:bg-amber-100"
            >
              <span>
                You have an order in progress - {activeOrderSummary.vendorName}
                {activeOrderSummary.extraCount > 0 ? ` +${activeOrderSummary.extraCount} more` : ""}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                View
              </span>
            </Link>
          </div>
        )}

        <main
          className={
            isConversationPage ? "" : [APP_CONTAINER, "py-6 md:py-8", "pb-20 md:pb-8"].join(" ")
          }
        >
          {children}
        </main>

        {isStudyPage ? <StudyBottomNav /> : <BottomNav />}

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

        {showNotifPrompt && !updateWorker && (
          <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4">
            <div className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
              <div className="text-xl">🔔</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Get notified instantly</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Know when buyers message you or prices drop.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={dismissNotificationPrompt} className="text-xs text-muted-foreground">
                  Not now
                </button>
                <button
                  onClick={requestNotificationPermission}
                  className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Enable
                </button>
              </div>
            </div>
          </div>
        )}
      </NavProvider>
    </NotificationsProvider>
  );
}
