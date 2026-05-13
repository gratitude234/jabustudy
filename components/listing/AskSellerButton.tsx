"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MessageCircle, Loader2, Tag, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  listingId: string;
  vendorId: string;
  listingTitle?: string;
  listingPrice?: number | null;
  negotiable?: boolean;
  isOwner?: boolean;
  isSold?: boolean;
  variant?: "pill" | "icon";
  className?: string;
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, "");
}

type OpenConversationResult = {
  conversationId: string;
  created: boolean;
};

export default function AskSellerButton({
  listingId,
  vendorId,
  listingTitle,
  listingPrice,
  negotiable = false,
  isOwner = false,
  isSold = false,
  variant = "pill",
  className = "",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Offer panel state
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerDigits, setOfferDigits] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [offerLoading, setOfferLoading] = useState(false);

  if (isOwner) return null;

  // ── Core: open or find conversation ───────────────────────────────────────

  async function openConversation(): Promise<OpenConversationResult | null> {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr) {
      throw new Error(userErr.message);
    }
    if (!user) {
      window.location.href = `/login?next=/listing/${listingId}`;
      return null;
    }

    const res = await fetch("/api/conversations/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, vendorId }),
    });
    const json = (await res.json().catch(() => null)) as
      | { conversationId?: string; created?: boolean; error?: string }
      | null;
    if (!res.ok || !json?.conversationId) {
      throw new Error(json?.error ?? "Couldn't open chat. Please try again.");
    }
    return { conversationId: json.conversationId, created: json.created === true };
  }

  // ── Message seller (plain) ────────────────────────────────────────────────

  async function handleMessage() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const opened = await openConversation();
      if (opened?.conversationId) {
        if (opened.created) {
          void fetch("/api/marketplace/notify-seller", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation_id: opened.conversationId,
              listing_id: listingId,
              vendor_id: vendorId,
            }),
          }).catch(() => {});
        }
        // Fire-and-forget: count this as a contact click for ranking
        void supabase.rpc("listing_stats_increment", {
          p_listing_id: listingId,
          p_event: "contact_click",
          p_amount: 1,
        }).then(null, () => {});
        router.push(`/inbox/${opened.conversationId}`);
      } else {
        setError("Couldn't open chat. Please try again.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Make an offer ─────────────────────────────────────────────────────────

  async function handleOffer() {
    const offerAmount = parseInt(offerDigits, 10);
    if (!offerDigits || !Number.isFinite(offerAmount) || offerAmount <= 0) return;

    setOfferLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) {
        throw new Error(userErr.message);
      }
      if (!user) {
        window.location.href = `/login?next=/listing/${listingId}`;
        return;
      }

      const opened = await openConversation();
      if (!opened?.conversationId) {
        setError("Couldn't open chat. Please try again.");
        return;
      }
      const convId = opened.conversationId;

      if (opened.created) {
        void fetch("/api/marketplace/notify-seller", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: convId,
            listing_id: listingId,
            vendor_id: vendorId,
          }),
        }).catch(() => {});
      }

      // Build the offer message
      const titlePart = listingTitle ? `"${listingTitle}"` : "this listing";
      const askingPart = listingPrice ? ` (asking ${formatNaira(listingPrice)})` : "";
      const notePart = offerNote.trim() ? `\n\n${offerNote.trim()}` : "";
      const body =
        `Hi! I'd like to offer ${formatNaira(offerAmount)} for ${titlePart}${askingPart}.` +
        notePart;

      const { error: messageErr } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        body,
        type: "text",
      });
      if (messageErr) {
        throw new Error(messageErr.message);
      }

      // Update conversation preview
      const { error: conversationErr } = await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: body.slice(0, 120),
        })
        .eq("id", convId);
      if (conversationErr) {
        throw new Error(conversationErr.message);
      }

      const { error: unreadErr } = await supabase.rpc("increment_vendor_unread", {
        convo_id: convId,
      });
      if (unreadErr) {
        throw new Error(unreadErr.message);
      }

      const buyerName =
        typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
          ? user.user_metadata.full_name.trim()
          : user.email?.split("@")[0]?.trim() || "A buyer";
      void fetch("/api/marketplace/notify-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          listingTitle,
          buyerName,
        }),
      }).catch(() => {});

      setOfferOpen(false);
      router.push(`/inbox/${convId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setOfferLoading(false);
    }
  }

  // ── Icon variant ──────────────────────────────────────────────────────────

  if (variant === "icon") {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleMessage}
          disabled={loading || isSold}
          aria-label="Message seller"
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full border transition",
            isSold
              ? "opacity-40 cursor-not-allowed bg-zinc-50 text-zinc-400"
              : "bg-white text-zinc-700 hover:bg-zinc-50",
            className
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        </button>
        {error && <p className="text-[10px] text-red-500 text-center">{error}</p>}
      </div>
    );
  }

  // ── Pill variant ──────────────────────────────────────────────────────────

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Primary CTA row */}
      <div className="flex gap-2">
        {/* Message seller */}
        <button
          type="button"
          onClick={handleMessage}
          disabled={loading || isSold}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
            isSold
              ? "bg-zinc-50 text-zinc-400 cursor-not-allowed"
              : "bg-white text-zinc-900 hover:bg-zinc-50"
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          {loading ? "Opening…" : "Message seller"}
        </button>

        {/* Make an offer — only shown when negotiable */}
        {negotiable && !isSold && (
          <button
            type="button"
            onClick={() => setOfferOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
              offerOpen
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "bg-white text-zinc-900 hover:bg-zinc-50"
            )}
          >
            <Tag className="h-4 w-4" />
            Offer
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", offerOpen && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Offer panel — slides open below */}
      {offerOpen && !isSold && (
        <div className="rounded-2xl border bg-zinc-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-700">
              Your offer
              {listingPrice
                ? ` — asking ${formatNaira(listingPrice)}`
                : ""}
            </p>
            <button
              type="button"
              onClick={() => setOfferOpen(false)}
              className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"
              aria-label="Close offer panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Price input */}
          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10">
            <span className="shrink-0 text-sm font-semibold text-zinc-500">₦</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={listingPrice ? (listingPrice * 0.85).toFixed(0) : "Enter amount"}
              value={offerDigits ? parseInt(offerDigits, 10).toLocaleString("en-NG") : ""}
              onChange={(e) => setOfferDigits(onlyDigits(e.target.value))}
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-zinc-400"
              autoFocus
            />
          </div>

          {/* Optional note */}
          <textarea
            placeholder="Add a note (optional) — e.g. pickup location, condition question…"
            value={offerNote}
            onChange={(e) => setOfferNote(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/10 placeholder:text-zinc-400"
          />

          <button
            type="button"
            onClick={handleOffer}
            disabled={offerLoading || !offerDigits}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
              !offerDigits
                ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                : "bg-zinc-900 text-white hover:bg-zinc-700"
            )}
          >
            {offerLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              : <><Tag className="h-4 w-4" /> Send offer</>
            }
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  );
}
