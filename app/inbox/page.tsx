"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  ShoppingBag,
  Store,
  Tag,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  vendor_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  buyer_unread: number;
  vendor_unread: number;
  listing: {
    id: string;
    title: string | null;
    image_url: string | null;
    status: string | null;
  } | null;
  vendor: {
    id: string;
    name: string | null;
    user_id: string | null;
  } | null;
  buyer_meta: {
    email: string | null;
    full_name: string | null;
  } | null;
};

type Tab = "buying" | "selling";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function displayName(meta: { email: string | null; full_name: string | null } | null) {
  if (meta?.full_name?.trim()) return meta.full_name.trim();
  if (meta?.email) return meta.email.split("@")[0];
  return "Unknown";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("buying");
  // tabRef keeps the realtime handler in sync — avoids stale closure (#3)
  const tabRef = useRef<Tab>("buying");
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);

  // Buyer metadata map: buyer_id → {email, full_name}
  const [buyerMeta, setBuyerMeta] = useState<Record<string, { email: string | null; full_name: string | null }>>({});

  async function load(uid: string, vid: string | null) {
    setLoading(true);
    // Read current tab from ref so realtime handler always sees the latest value (#3)
    const currentTab = tabRef.current;
    try {
      if (currentTab === "buying") {
        const { data } = await supabase
          .from("conversations")
          .select(`
            id, listing_id, buyer_id, vendor_id,
            last_message_at, last_message_preview,
            buyer_unread, vendor_unread,
            listing:listings(id, title, image_url, status),
            vendor:vendors(id, name, user_id)
          `)
          .eq("buyer_id", uid)
          .order("last_message_at", { ascending: false });

        setConversations((data as any[]) ?? []);
      } else {
        if (!vid) { setConversations([]); return; }

        const { data } = await supabase
          .from("conversations")
          .select(`
            id, listing_id, buyer_id, vendor_id,
            last_message_at, last_message_preview,
            buyer_unread, vendor_unread,
            listing:listings(id, title, image_url, status),
            vendor:vendors(id, name, user_id)
          `)
          .eq("vendor_id", vid)
          .order("last_message_at", { ascending: false });

        const rows = (data as any[]) ?? [];
        setConversations(rows);

        // Fix #2: Fetch real buyer display names from the profiles table.
        // Falls back to email prefix, then short UUID if neither is available.
        const ids = [...new Set(rows.map((r: any) => r.buyer_id as string))];
        if (ids.length > 0) {
          const metaMap: Record<string, { email: string | null; full_name: string | null }> = {};

          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", ids);

          // Seed with truncated-ID fallback so we never show "Unknown"
          for (const id of ids) {
            metaMap[id] = { email: null, full_name: `Buyer ${id.slice(0, 6)}` };
          }
          for (const p of (profiles as any[]) ?? []) {
            if (p.full_name || p.email) {
              metaMap[p.id] = { email: p.email ?? null, full_name: p.full_name ?? null };
            }
          }
          setBuyerMeta(metaMap);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) { router.replace("/login?next=/inbox"); return; }
      setUserId(uid);

      // Check if user has a vendor profile
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      const vid = (vendor as any)?.id ?? null;
      setVendorId(vid);

      await load(uid, vid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    tabRef.current = tab; // Keep ref in sync whenever tab changes (#3)
    if (userId) load(userId, vendorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Real-time: refresh when any conversation changes for this user
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        load(userId, vendorId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, vendorId]);

  // Fix #8: Show total unread across BOTH roles (buyer + vendor) so the badge
  // is always accurate regardless of which tab is currently active.
  const totalUnread = useMemo(() => {
    return conversations.reduce((sum, c) => {
      // Count whichever role is relevant for each conversation
      const isVendorConv = vendorId && c.vendor_id === vendorId;
      return sum + (isVendorConv ? c.vendor_unread : c.buyer_unread);
    }, 0);
  }, [conversations, vendorId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-28 md:pb-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-zinc-50"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Messages</h1>
            <p className="text-xs text-zinc-500">
              {loading ? "Loading…" : totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl border bg-zinc-50 p-1">
        <button
          type="button"
          onClick={() => setTab("buying")}
          className={[
            "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
            tab === "buying" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700",
          ].join(" ")}
        >
          <ShoppingBag className="h-4 w-4" />
          Buying
        </button>
        <button
          type="button"
          onClick={() => setTab("selling")}
          className={[
            "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
            tab === "selling" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700",
          ].join(" ")}
        >
          <Store className="h-4 w-4" />
          Selling
          {vendorId === null && (
            <span className="text-[10px] text-zinc-400">(no shop)</span>
          )}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 rounded-3xl border bg-white p-4">
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-zinc-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded-full bg-zinc-100" />
                <div className="h-3 w-4/5 rounded-full bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <MessageCircle className="mx-auto h-10 w-10 text-zinc-300" />
          <p className="mt-3 text-sm font-semibold text-zinc-900">
            {tab === "buying" ? "No conversations yet" : "No enquiries yet"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {tab === "buying"
              ? "Find something you like and tap \"Message seller\" to start chatting."
              : "When buyers message you about your listings, they'll appear here."}
          </p>
          {tab === "buying" ? (
            <Link
              href="/explore"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-zinc-800"
            >
              Browse listings <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href="/post"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-zinc-800"
            >
              Post a listing <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => {
            const listing = Array.isArray(c.listing) ? c.listing[0] : c.listing;
            const vendor = Array.isArray(c.vendor) ? c.vendor[0] : c.vendor;
            const isVendorSide = tab === "selling";
            const unread = isVendorSide ? c.vendor_unread : c.buyer_unread;
            const img = listing?.image_url?.trim();
            const title = listing?.title ?? "Listing";
            const otherName = isVendorSide
              ? displayName(buyerMeta[c.buyer_id] ?? null)
              : (vendor?.name ?? "Seller");
            const isSold = listing?.status === "sold";

            return (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                className="flex items-center gap-3 rounded-3xl border bg-white p-4 no-underline shadow-sm transition hover:bg-zinc-50"
              >
                {/* Listing thumbnail */}
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                  )}
                  {isSold && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-[9px] font-bold text-white">SOLD</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-tight ${unread > 0 ? "font-semibold text-zinc-900" : "font-medium text-zinc-700"} line-clamp-1`}>
                      {title}
                    </p>
                    <span className="shrink-0 text-[11px] text-zinc-400">{timeAgo(c.last_message_at)}</span>
                  </div>

                  {/* Role + other party row */}
                  <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {/* Role badge — makes it instantly clear which side you're on */}
                    <span className={[
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                      isVendorSide
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
                    ].join(" ")}>
                      {isVendorSide ? <Store className="h-2.5 w-2.5" /> : <ShoppingBag className="h-2.5 w-2.5" />}
                      {isVendorSide ? "Selling" : "Buying"}
                    </span>
                    <span className="text-xs text-zinc-400">·</span>
                    <span className="text-xs text-zinc-500 truncate">{otherName}</span>
                  </div>

                  {c.last_message_preview ? (
                    <p className={`mt-1 text-xs line-clamp-1 ${unread > 0 ? "text-zinc-700 font-medium" : "text-zinc-400"}`}>
                      {c.last_message_preview}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-400 italic">No messages yet</p>
                  )}
                </div>

                {/* Unread badge */}
                {unread > 0 && (
                  <div className="grid h-5 min-w-[20px] place-items-center rounded-full bg-zinc-900 px-1.5 text-[11px] font-bold text-white shrink-0">
                    {unread > 99 ? "99+" : unread}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}