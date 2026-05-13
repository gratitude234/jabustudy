"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type NavContextResponse = {
  buyerUnread: number;
  vendorUnread: number;
  pendingVendorOrders: number;
  isVendor: boolean;
  vendorId: string | null;
  isRider: boolean;
};

type NavContextValue = NavContextResponse & {
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

const EMPTY_NAV: NavContextResponse = {
  buyerUnread: 0,
  vendorUnread: 0,
  pendingVendorOrders: 0,
  isVendor: false,
  vendorId: null,
  isRider: false,
};

const NAV_CACHE_TTL_MS = 30_000;
const navCache = new Map<
  string,
  {
    expiresAt: number;
    data: NavContextResponse;
  }
>();

const NavContext = createContext<NavContextValue | undefined>(undefined);

export function NavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [navState, setNavState] = useState<NavContextResponse>(EMPTY_NAV);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async (force = false) => {
      if (!user) {
        setNavState(EMPTY_NAV);
        setLoading(false);
        return;
      }

      const cached = navCache.get(user.id);
      if (!force && cached && cached.expiresAt > Date.now()) {
        setNavState(cached.data);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const res = await fetch("/api/nav/context", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | (Partial<NavContextResponse> & { error?: string })
          | null;

        if (!res.ok || !json) {
          throw new Error(json?.error ?? res.statusText);
        }

        const nextState: NavContextResponse = {
          buyerUnread: Number(json.buyerUnread ?? 0),
          vendorUnread: Number(json.vendorUnread ?? 0),
          pendingVendorOrders: Number(json.pendingVendorOrders ?? 0),
          isVendor: Boolean(json.isVendor),
          vendorId:
            typeof json.vendorId === "string" && json.vendorId.trim().length > 0
              ? json.vendorId
              : null,
          isRider: Boolean(json.isRider),
        };

        navCache.set(user.id, {
          expiresAt: Date.now() + NAV_CACHE_TTL_MS,
          data: nextState,
        });
        setNavState(nextState);
      } catch (error) {
        console.error("[nav-context] failed to refresh:", error);
        setNavState(EMPTY_NAV);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh, user?.id]);

  useEffect(() => {
    if (!user) return;
    void refresh(true);
  }, [pathname, refresh, user]);

  useEffect(() => {
    if (!user) return;

    const conversationChannel = supabase.channel(`nav:conversations:${user.id}`);
    conversationChannel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations", filter: `buyer_id=eq.${user.id}` },
      () => {
        navCache.delete(user.id);
        void refresh(true);
      },
    );

    if (navState.vendorId) {
      conversationChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `vendor_id=eq.${navState.vendorId}`,
        },
        () => {
          navCache.delete(user.id);
          void refresh(true);
        },
      );
    }

    conversationChannel.subscribe();

    return () => {
      void supabase.removeChannel(conversationChannel);
    };
  }, [navState.vendorId, refresh, user]);

  useEffect(() => {
    if (!user || !navState.vendorId) return;

    const ordersChannel = supabase
      .channel(`nav:orders:${navState.vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `vendor_id=eq.${navState.vendorId}`,
        },
        () => {
          navCache.delete(user.id);
          void refresh(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ordersChannel);
    };
  }, [navState.vendorId, refresh, user]);

  const value = useMemo(
    () => ({
      ...navState,
      loading: authLoading || loading,
      refresh,
    }),
    [authLoading, loading, navState, refresh],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavContext() {
  const value = useContext(NavContext);
  if (!value) {
    throw new Error("useNavContext must be used within a NavProvider");
  }
  return value;
}
