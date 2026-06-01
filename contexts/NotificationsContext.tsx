"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const NOTIFICATIONS_POLL_MS = 60_000;

type NotificationsContextValue = {
  count: number;
};

const NotificationsContext = createContext<NotificationsContextValue>({
  count: 0,
});

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(0);
  const currentUserIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    async function fetchCount(uid: string, requestId: number) {
      const requestKey = `${uid}:${requestId}`;
      if (inFlightRef.current === requestKey) return;
      inFlightRef.current = requestKey;

      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("is_read", false);

        if (error) throw error;
        if (mounted && requestIdRef.current === requestId) {
          setCount(count ?? 0);
        }
      } catch {
        if (mounted && requestIdRef.current === requestId) {
          setCount(0);
        }
      } finally {
        if (inFlightRef.current === requestKey) {
          inFlightRef.current = null;
        }
      }
    }

    function startPolling(uid: string, requestId: number) {
      stopPolling();
      pollTimer = setInterval(() => {
        if (document.visibilityState !== "hidden") {
          void fetchCount(uid, requestId);
        }
      }, NOTIFICATIONS_POLL_MS);
    }

    function refreshCurrentUser() {
      const uid = currentUserIdRef.current;
      if (!uid || document.visibilityState === "hidden") return;
      void fetchCount(uid, requestIdRef.current);
    }

    async function syncForUser(uid: string | null, force = false) {
      if (!force && currentUserIdRef.current === uid) return;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      currentUserIdRef.current = uid;
      inFlightRef.current = null;

      stopPolling();

      if (!uid) {
        setCount(0);
        return;
      }

      await fetchCount(uid, requestId);
      if (!mounted || requestIdRef.current !== requestId) return;
      startPolling(uid, requestId);
    }

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      await syncForUser(data.user?.id ?? null, true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncForUser(session?.user?.id ?? null);
    });

    window.addEventListener("focus", refreshCurrentUser);
    document.addEventListener("visibilitychange", refreshCurrentUser);

    return () => {
      mounted = false;
      requestIdRef.current += 1;
      subscription.unsubscribe();
      stopPolling();
      window.removeEventListener("focus", refreshCurrentUser);
      document.removeEventListener("visibilitychange", refreshCurrentUser);
    };
  }, []);

  return (
    <NotificationsContext.Provider value={{ count }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsCount() {
  return useContext(NotificationsContext).count;
}
