"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function removeCurrentChannel() {
      const channel = channelRef.current;
      channelRef.current = null;

      if (channel) {
        await supabase.removeChannel(channel);
      }
    }

    async function fetchCount(uid: string, requestId: number) {
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
      }
    }

    async function syncForUser(uid: string | null) {
      if (currentUserIdRef.current === uid && (!uid || channelRef.current)) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      currentUserIdRef.current = uid;

      await removeCurrentChannel();
      if (!mounted || requestIdRef.current !== requestId) return;

      if (!uid) {
        setCount(0);
        return;
      }

      await fetchCount(uid, requestId);
      if (!mounted || requestIdRef.current !== requestId) return;

      const channel = supabase
        .channel(`notifications:provider:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          () => {
            void fetchCount(uid, requestIdRef.current);
          }
        );

      channelRef.current = channel;
      channel.subscribe();
    }

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      await syncForUser(data.user?.id ?? null);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncForUser(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      requestIdRef.current += 1;
      subscription.unsubscribe();
      void removeCurrentChannel();
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
