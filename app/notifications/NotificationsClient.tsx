"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Bookmark,
  BookCheck,
  BookX,
  CheckCheck,
  CheckCircle2,
  Clock,
  MessageCircle,
  MessageSquarePlus,
  Star,
  ThumbsUp,
  TrendingDown,
  Truck,
  Megaphone,
} from "lucide-react";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function dayLabel(iso: string) {
  const now = new Date();
  const d = new Date(iso);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((todayStart - dStart) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" });
}

type TypeConfig = {
  icon: React.ReactNode;
  bg: string;
  iconColor: string;
  accent: string;
};

function getTypeConfig(type: string): TypeConfig {
  switch (type) {
    case "new_message":
      return {
        icon: <MessageCircle className="h-4 w-4" />,
        bg: "bg-violet-50",
        iconColor: "text-violet-600",
        accent: "border-l-violet-400",
      };
    case "delivery_request":
      return {
        icon: <Truck className="h-4 w-4" />,
        bg: "bg-orange-50",
        iconColor: "text-orange-600",
        accent: "border-l-orange-400",
      };
    case "price_drop":
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        bg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        accent: "border-l-emerald-400",
      };
    case "listing_saved":
      return {
        icon: <Bookmark className="h-4 w-4" />,
        bg: "bg-blue-50",
        iconColor: "text-blue-600",
        accent: "border-l-blue-400",
      };
    case "system":
      return {
        icon: <Megaphone className="h-4 w-4" />,
        bg: "bg-amber-50",
        iconColor: "text-amber-600",
        accent: "border-l-amber-400",
      };
    case "study_answer_posted":
      return {
        icon: <MessageSquarePlus className="h-4 w-4" />,
        bg: "bg-violet-50 dark:bg-violet-950/30",
        iconColor: "text-violet-600 dark:text-violet-400",
        accent: "border-l-violet-400",
      };
    case "study_answer_accepted":
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        accent: "border-l-emerald-400",
      };
    case "study_upvote_milestone":
      return {
        icon: <ThumbsUp className="h-4 w-4" />,
        bg: "bg-blue-50 dark:bg-blue-950/30",
        iconColor: "text-blue-600 dark:text-blue-400",
        accent: "border-l-blue-400",
      };
    case "material_approved":
      return {
        icon: <BookCheck className="h-4 w-4" />,
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        accent: "border-l-emerald-400",
      };
    case "material_rejected":
      return {
        icon: <BookX className="h-4 w-4" />,
        bg: "bg-rose-50 dark:bg-rose-950/30",
        iconColor: "text-rose-600 dark:text-rose-400",
        accent: "border-l-rose-400",
      };
    case "stale_listing":
      return {
        icon: <Clock className="h-4 w-4" />,
        bg: "bg-amber-50",
        iconColor: "text-amber-600",
        accent: "border-l-amber-400",
      };
    case "review_prompt":
      return {
        icon: <Star className="h-4 w-4" />,
        bg: "bg-amber-50",
        iconColor: "text-amber-500",
        accent: "border-l-amber-300",
      };
    case "order_status":
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        bg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        accent: "border-l-emerald-400",
      };
    default:
      return {
        icon: <Bell className="h-4 w-4" />,
        bg: "bg-zinc-50",
        iconColor: "text-zinc-500",
        accent: "border-l-zinc-300",
      };
  }
}

export default function NotificationsClient() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<NotificationRow[]>([]);

  const unread = useMemo(() => rows.filter((r) => !r.is_read).length, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationRow[]>();
    for (const row of rows) {
      const label = dayLabel(row.created_at);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(row);
    }
    return Array.from(map.entries());
  }, [rows]);

  async function loadNotifications(uid: string) {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(60);
      setRows((data as NotificationRow[]) ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    if (!userId || unread === 0) return;
    setRows((prev) => prev.map((r) => ({ ...r, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  }

  async function markRead(id: string) {
    if (!userId) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_read: true } : r)));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }

      await loadNotifications(uid);

      const channel = supabase
        .channel(`notifications:list:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          () => loadNotifications(uid)
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    })();
  }, []);

  if (!userId && !loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pb-28 md:pb-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-zinc-100">
              <BellOff className="h-6 w-6 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Sign in to see notifications</p>
              <p className="mt-1 text-xs text-zinc-500">
                Price drops, listing activity and more — all in one place.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-zinc-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            <h1 className="text-lg font-bold text-zinc-900">Notifications</h1>
            <p className="text-xs text-zinc-500">
              {loading ? "Loading…" : unread > 0 ? `${unread} unread` : "All caught up ✓"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={markAllRead}
          disabled={!userId || unread === 0}
          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all read
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-3xl border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 shrink-0 rounded-2xl bg-zinc-100" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 w-2/3 rounded-full bg-zinc-100" />
                  <div className="h-3 w-4/5 rounded-full bg-zinc-100" />
                </div>
                <div className="h-3 w-12 rounded-full bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-zinc-100">
              <Bell className="h-7 w-7 text-zinc-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">No notifications yet</p>
              <p className="mt-1 text-xs text-zinc-500 max-w-xs mx-auto">
                You'll be notified when prices drop on saved listings, or when someone saves yours.
              </p>
            </div>
            <Link
              href="/explore"
              className="mt-1 inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-xs font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
            >
              Browse listings
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([label, items]) => (
            <div key={label}>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {label}
              </p>
              <div className="space-y-2">
                {items.map((n) => {
                  const cfg = getTypeConfig(n.type);
                  const Wrapper: any = n.href ? Link : "div";
                  const wrapperProps = n.href
                    ? { href: n.href, onClick: () => markRead(n.id) }
                    : { onClick: () => markRead(n.id) };

                  return (
                    <Wrapper
                      key={n.id}
                      {...wrapperProps}
                      className={[
                        "flex items-start gap-3 rounded-3xl border bg-white p-4 shadow-sm transition",
                        "no-underline cursor-pointer hover:bg-zinc-50",
                        !n.is_read ? `border-l-4 ${cfg.accent}` : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${cfg.bg} ${cfg.iconColor}`}>
                        {cfg.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${n.is_read ? "font-medium text-zinc-700" : "font-semibold text-zinc-900"}`}>
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[11px] text-zinc-400 pt-0.5">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                        {n.body ? (
                          <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{n.body}</p>
                        ) : null}
                      </div>

                      {!n.is_read ? (
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-900" />
                      ) : null}
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}