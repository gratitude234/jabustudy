"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  CheckCheck,
  Loader2,
  MessageCircle,
  MoreVertical,
  Send,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import type { OrderPayload } from "@/types/meal-builder";
import OrderBubble from "@/components/chat/OrderBubble";
import MealBuilder from "@/components/chat/MealBuilder";
import FinalizeDealButton from "@/components/chat/FinalizeDealButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  type: "text" | "order";
  order_payload: OrderPayload | null;
  created_at: string;
};

type ConversationMeta = {
  id: string;
  listing_id: string | null;
  order_id: string | null;
  buyer_id: string;
  vendor_id: string;
  buyer_unread: number;
  vendor_unread: number;
  listing: { id: string; title: string | null; image_url: string | null; status: string | null; price: number | null; price_label: string | null } | null;
  vendor: { id: string; name: string | null; user_id: string | null; vendor_type: string | null; accepts_orders: boolean | null } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" });
}

function shouldShowDateSeparator(messages: Message[], index: number) {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].created_at);
  const curr = new Date(messages[index].created_at);
  return prev.toDateString() !== curr.toDateString();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params?.conversationId as string;
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [meta, setMeta] = useState<ConversationMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [receiptUrl,   setReceiptUrl]   = useState<string | null>(null);
  const [paymentActionLoading, setPaymentActionLoading] = useState<"buyer-confirm" | "vendor-confirm-payment" | "payment-dispute" | null>(null);
  const [paymentActionError, setPaymentActionError] = useState<string | null>(null);
  const [vendorBank, setVendorBank] = useState<{
    bank_name: string;
    bank_account_number: string;
    bank_account_name: string;
  } | null>(null);
  const [showMealBuilder, setShowMealBuilder] = useState(false);
  const [hasMarketplaceOrder, setHasMarketplaceOrder] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // FIX (Bug 2 & 3): Keep always-current refs so the real-time subscription
  // never reads stale closure values of userId, vendorId, or meta.
  const userIdRef = useRef<string | null>(null);
  const vendorIdRef = useRef<string | null>(null);
  const metaRef = useRef<ConversationMeta | null>(null);

  const listing = meta ? (Array.isArray(meta.listing) ? meta.listing[0] : meta.listing) : null;
  const vendor = meta ? (Array.isArray(meta.vendor) ? meta.vendor[0] : meta.vendor) : null;

  // Is the current user the vendor or the buyer?
  const isVendorSide = vendorId !== null && meta?.vendor_id === vendorId;
  const otherPartyName = isVendorSide ? "Buyer" : (vendor?.name ?? "Seller");

  // Can show the meal builder button?
  const canShowMealButton =
    !isVendorSide &&
    vendor?.vendor_type === "food" &&
    vendor?.accepts_orders !== false;

  // Show Finalize Deal for non-food vendors with no order yet, after 2+ messages
  const isNonFoodVendor = vendor?.vendor_type !== 'food';
  const canShowFinalizeDeal =
    !isVendorSide &&
    isNonFoodVendor &&
    !hasMarketplaceOrder &&
    messages.filter(m => !m.id.startsWith('opt-')).length >= 2;

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    bottomRef.current?.scrollIntoView({ behavior });
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, type, order_payload, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) ?? []);
  }

  // FIX (Bug 2 & 3): Read from refs so this is always correct regardless of
  // when it's called from inside a stale closure (e.g. the real-time handler).
  async function markRead() {
    const uid = userIdRef.current;
    const currentMeta = metaRef.current;
    if (!uid || !currentMeta) return;
    const vid = vendorIdRef.current;
    const onVendorSide = vid !== null && currentMeta.vendor_id === vid;
    const field = onVendorSide ? "vendor_unread" : "buyer_unread";
    await supabase
      .from("conversations")
      .update({ [field]: 0 })
      .eq("id", conversationId);
  }

  // Initial load
  useEffect(() => {
    if (!conversationId) return;

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id ?? null;
      if (!uid) { router.replace(`/login?next=/inbox/${conversationId}`); return; }
      setUserId(uid);
      userIdRef.current = uid;

      // Get vendor profile
      const { data: vendorData } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      const vid = (vendorData as any)?.id ?? null;
      setVendorId(vid);
      vendorIdRef.current = vid;

      // Load conversation meta
      const { data: convData, error } = await supabase
        .from("conversations")
        .select(`
          id, listing_id, order_id, buyer_id, vendor_id, buyer_unread, vendor_unread,
          listing:listings(id, title, image_url, status, price, price_label),
          vendor:vendors(id, name, user_id, vendor_type, accepts_orders, bank_name, bank_account_number, bank_account_name)
        `)
        .eq("id", conversationId)
        .maybeSingle();

      if (error || !convData) { setNotFound(true); setLoading(false); return; }

      // Access check: must be buyer or vendor
      const conv = convData as unknown as ConversationMeta;
      const convVendor = Array.isArray(conv.vendor) ? conv.vendor[0] : conv.vendor;
      const isBuyer = conv.buyer_id === uid;
      const isVendor = convVendor?.user_id === uid;
      if (!isBuyer && !isVendor) { setNotFound(true); setLoading(false); return; }

      setMeta(conv);
      metaRef.current = conv;

      // Hide FinalizeDealButton if conversation already has an order
      if (conv.order_id) setHasMarketplaceOrder(true);

      // Load order status if this conversation has an order
      if (conv.order_id) {
        const { data: orderData } = await supabase
          .from("orders")
          .select("status, payment_status, payment_method, receipt_url")
          .eq("id", conv.order_id)
          .single();
        if (orderData) {
          setOrderStatus(orderData.status);
          setPaymentStatus((orderData as any).payment_status ?? null);
          setPaymentMethod((orderData as any).payment_method ?? null);
          setReceiptUrl((orderData as any).receipt_url ?? null);
        }
      }

      // Pull vendor bank details for the buyer payment panel
      const vendorForBank = Array.isArray(convData.vendor) ? convData.vendor[0] : convData.vendor as any;
      if (
        vendorForBank?.bank_account_number &&
        vendorForBank?.bank_account_name &&
        vendorForBank?.bank_name
      ) {
        setVendorBank({
          bank_name:           vendorForBank.bank_name,
          bank_account_number: vendorForBank.bank_account_number,
          bank_account_name:   vendorForBank.bank_account_name,
        });
      }

      await loadMessages();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Mark read when meta loads
  useEffect(() => {
    if (meta && userId) markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.id, userId]);

  // Real-time messages — subscription is set up once and never needs to
  // re-subscribe because markRead() now reads from refs, not the closure.
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // FIX (Bug 3): Use ref so userId is never stale here
          if (newMsg.sender_id !== userIdRef.current) markRead();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Real-time order status updates
  useEffect(() => {
    if (!meta?.order_id) return;
    const channel = supabase
      .channel(`order-status:${meta.order_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${meta.order_id}` },
        (payload) => {
          const updated = payload.new as { status: string; payment_status?: string; payment_method?: string; receipt_url?: string };
          if (updated.status) setOrderStatus(updated.status);
          if (updated.payment_status) setPaymentStatus(updated.payment_status);
          if (updated.payment_method) setPaymentMethod(updated.payment_method);
          if (updated.receipt_url) setReceiptUrl(updated.receipt_url);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [meta?.order_id]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom(messages.length <= 1 ? "auto" : "smooth");
  }, [messages.length]);

    // ── Payment action handlers ───────────────────────────────────────────────────
  async function handleBuyerConfirmFromChat() {
    if (!meta?.order_id) return;
    setPaymentActionError(null);
    setPaymentActionLoading("buyer-confirm");
    try {
      const res = await fetch(`/api/orders/${meta.order_id}/buyer-confirm`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (!res.ok || !json?.ok) {
        const errorMessage = json?.error ?? json?.message ?? "Something went wrong. Please try again.";
        setPaymentActionError(errorMessage);
        throw new Error(errorMessage);
      }
      setPaymentStatus("buyer_confirmed");
      setPaymentMethod("transfer");
    } catch (error) {
      console.error("[inbox] buyer-confirm failed:", error);
      const errorMessage = error instanceof Error && error.message
        ? error.message
        : "Something went wrong. Please try again.";
      setPaymentActionError(errorMessage);
      throw error;
    } finally {
      setPaymentActionLoading(null);
    }
  }

  async function handleVendorConfirmFromChat() {
    if (!meta?.order_id) return;
    setPaymentActionError(null);
    setPaymentActionLoading("vendor-confirm-payment");
    try {
      const res = await fetch(`/api/orders/${meta.order_id}/vendor-confirm-payment`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (!res.ok || !json?.ok) {
        const errorMessage = json?.error ?? json?.message ?? "Something went wrong. Please try again.";
        setPaymentActionError(errorMessage);
        throw new Error(errorMessage);
      }
      setPaymentStatus("vendor_confirmed");
      setOrderStatus("preparing");
    } catch (error) {
      console.error("[inbox] vendor-confirm-payment failed:", error);
      const errorMessage = error instanceof Error && error.message
        ? error.message
        : "Something went wrong. Please try again.";
      setPaymentActionError(errorMessage);
      throw error;
    } finally {
      setPaymentActionLoading(null);
    }
  }

  async function handlePaymentDisputeFromChat() {
    if (!meta?.order_id) return;
    setPaymentActionError(null);
    setPaymentActionLoading("payment-dispute");
    try {
      const res = await fetch(`/api/orders/${meta.order_id}/payment-dispute`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (!res.ok || !json?.ok) {
        const errorMessage = json?.error ?? json?.message ?? "Something went wrong. Please try again.";
        setPaymentActionError(errorMessage);
        throw new Error(errorMessage);
      }
      setPaymentStatus("unpaid");
    } catch (error) {
      console.error("[inbox] payment-dispute failed:", error);
      const errorMessage = error instanceof Error && error.message
        ? error.message
        : "Something went wrong. Please try again.";
      setPaymentActionError(errorMessage);
      throw error;
    } finally {
      setPaymentActionLoading(null);
    }
  }

  async function send(chipText?: string) {
    const text = (chipText ?? body).trim();
    if (!text || sending || !userId || !meta) return;

    setSending(true);
    if (!chipText) setBody("");

    // Optimistic insert
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: userId,
      body: text,
      type: "text",
      order_payload: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, sender_id: userId, body: text })
        .select("id, conversation_id, sender_id, body, type, order_payload, created_at")
        .single();

      if (error) throw error;

      // Replace optimistic with real
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? (inserted as Message) : m))
      );

      const { error: conversationError } = await supabase
        .from("conversations")
        .update({
          last_message_preview: text.length > 80 ? text.slice(0, 80) + "…" : text,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
      if (conversationError) throw conversationError;

      const rpcName = isVendorSide ? "increment_buyer_unread" : "increment_vendor_unread";
      const { error: unreadError } = await supabase.rpc(rpcName, { conversation_id: conversationId });
      if (unreadError) throw unreadError;

      // Send in-app notification to other party
      const otherUserId = isVendorSide
        ? meta.buyer_id
        : (vendor?.user_id ?? null);

      if (otherUserId && otherUserId !== userId) {
        await supabase.from("notifications").insert({
          user_id: otherUserId,
          type: "new_message",
          title: `New message about ${listing?.title ?? "a listing"}`,
          body: text.length > 60 ? text.slice(0, 60) + "…" : text,
          href: `/inbox/${conversationId}`,
        });

        // Fire push to other party (vendor→buyer or buyer→vendor)
        void fetch('/api/internal/push-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: otherUserId,
            title: 'New message',
            body: text.length > 80 ? text.slice(0, 80) + '…' : text,
            href: `/inbox/${conversationId}`,
            tag: `msg-${conversationId}`,
          }),
        }).catch(() => {});
      }
    } catch {
      // Rollback optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setBody(text); // restore input
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ── Not found / no access ─────────────────────────────────────────────────
  if (!loading && notFound) {
    return (
      <div className="mx-auto max-w-xl pt-8">
        <div className="rounded-3xl border bg-white p-8 text-center">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <p className="font-semibold text-zinc-900">Conversation not found</p>
          <p className="mt-1 text-sm text-zinc-500">It may have been deleted or you don't have access.</p>
          <Link href="/inbox" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-zinc-800">
            Back to inbox
          </Link>
        </div>
      </div>
    );
  }

  // ── Main chat UI ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-xl flex-col" style={{ height: "100dvh" }}>

      {/* ── Header: single compact bar ── */}
      <div className="flex shrink-0 items-center gap-3 border-b bg-white px-4 py-3">
        <Link
          href="/inbox"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-zinc-200 hover:bg-zinc-50"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Listing image + text — all in one row, tappable to view listing */}
        {listing ? (
          <Link
            href={`/listing/${listing.id}`}
            className="flex min-w-0 flex-1 items-center gap-3 no-underline"
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
              {listing.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-300">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              {/* Title + price on one line */}
              <p className="truncate text-sm font-semibold text-zinc-900">
                {listing.title ?? "Listing"}
                {listing.price != null && (
                  <span className="ml-1.5 font-normal text-zinc-500">
                    · ₦{listing.price.toLocaleString("en-NG")}
                  </span>
                )}
              </p>
              {/* Vendor name + role pill */}
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                {!loading && meta && (
                  <>
                    <span
                      className={[
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        isVendorSide ? "bg-emerald-500" : "bg-blue-500",
                      ].join(" ")}
                    />
                    <span className={isVendorSide ? "font-medium text-emerald-700" : "font-medium text-blue-700"}>
                      {isVendorSide ? "You're selling" : "You're buying"}
                    </span>
                    <span className="text-zinc-300">·</span>
                  </>
                )}
                <span className="truncate">{otherPartyName}</span>
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{otherPartyName}</p>
          </div>
        )}

        <MoreVertical className="h-4 w-4 shrink-0 text-zinc-400" />
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto bg-zinc-50 px-4 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center pt-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-12 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white border border-zinc-100">
              <MessageCircle className="h-6 w-6 text-zinc-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Start the conversation</p>
              <p className="mt-1 text-xs text-zinc-500">
                Ask about availability, price, or anything else.
              </p>
            </div>
            {/* Quick chips shown in the empty state, not buried below fold */}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {["Is this still available?", "Can you do lower?", "Where can we meet?"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => send(chip)}
                  disabled={sending}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.sender_id === userId;
            const isOptimistic = msg.id.startsWith("opt-");
            const showDate = shouldShowDateSeparator(messages, i);

            const prevMsg = i > 0 ? messages[i - 1] : null;
            const isFirstInSequence = !prevMsg || prevMsg.sender_id !== msg.sender_id;
            const showSenderLabel = !isMine && isFirstInSequence;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center justify-center py-3">
                    <span className="rounded-full bg-zinc-200/60 px-3 py-1 text-[11px] text-zinc-500">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} mb-1`}>
                  {showSenderLabel && (
                    <span className={[
                      "mb-1 flex items-center gap-1 px-1 text-[10px] font-semibold",
                      isVendorSide ? "text-blue-500" : "text-emerald-600",
                    ].join(" ")}>
                      {isVendorSide
                        ? <><ShoppingBag className="h-2.5 w-2.5" /> Buyer</>
                        : <><Store className="h-2.5 w-2.5" /> {vendor?.name ?? "Seller"}</>
                      }
                    </span>
                  )}

                  {msg.type === "order" && msg.order_payload ? (
                    <OrderBubble
                      payload={msg.order_payload}
                      isSender={isMine}
                      status={orderStatus ?? undefined}
                      paymentStatus={paymentStatus ?? undefined}
                      paymentMethod={paymentMethod ?? undefined}
                      receiptUrl={receiptUrl}
                      createdAt={msg.created_at}
                      orderId={meta?.order_id ?? undefined}
                      isViewer={isVendorSide ? "vendor" : "buyer"}
                      vendorBank={vendorBank}
                      onBuyerConfirm={handleBuyerConfirmFromChat}
                      onVendorConfirmPayment={handleVendorConfirmFromChat}
                      onPaymentDispute={handlePaymentDisputeFromChat}
                      buyerConfirmLoading={paymentActionLoading === "buyer-confirm"}
                      vendorConfirmLoading={paymentActionLoading === "vendor-confirm-payment"}
                      paymentDisputeLoading={paymentActionLoading === "payment-dispute"}
                      paymentActionError={paymentActionError}
                      orderLabel={vendor?.vendor_type !== 'food' ? '🏷️ Marketplace Order' : undefined}
                    />
                  ) : (
                    <div
                      className={[
                        "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm",
                        isMine
                          ? "rounded-br-md bg-zinc-900 text-white"
                          : "rounded-bl-md bg-white border border-zinc-100 text-zinc-900",
                        isOptimistic ? "opacity-70" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                      <div className={`mt-1 flex items-center gap-1 ${isMine ? "justify-end" : "justify-start"}`}>
                        <span className={`text-[10px] ${isMine ? "text-white/60" : "text-zinc-400"}`}>
                          {formatTime(msg.created_at)}
                        </span>
                        {isMine && !isOptimistic && (
                          <CheckCheck className="h-3 w-3 text-white/60" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Meal Builder overlay */}
      {showMealBuilder && vendor && (
        <div className="border-t bg-zinc-50 px-4 py-3">
          <MealBuilder
            vendorId={meta!.vendor_id}
            onClose={() => setShowMealBuilder(false)}
            onOrderSent={() => setShowMealBuilder(false)}
          />
        </div>
      )}

      {canShowFinalizeDeal && meta && (
        <FinalizeDealButton
          conversationId={conversationId}
          listingId={meta.listing_id ?? ''}
          vendorId={meta.vendor_id}
          listingTitle={listing?.title ?? undefined}
          listingPrice={listing?.price ?? null}
          onOrderCreated={() => setHasMarketplaceOrder(true)}
        />
      )}

      {/* ── Input bar ── */}
      <div className="shrink-0 border-t bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          {canShowMealButton && (
            <button
              type="button"
              onClick={() => setShowMealBuilder(!showMealBuilder)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50"
              aria-label="Build a meal order"
              title="Build a meal order"
            >
              <UtensilsCrossed className="h-4 w-4" />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!body.trim() || sending}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
