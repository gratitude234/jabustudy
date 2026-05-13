"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { safePushRecent } from "@/lib/utils";
import Link from "next/link";
import { Check, Flag, Share2 } from "lucide-react";

function shouldCount(key: string, windowMs: number) {
  try {
    const now = Date.now();
    const last = Number(localStorage.getItem(key) ?? "0");
    if (!Number.isFinite(last) || last <= 0) {
      localStorage.setItem(key, String(now));
      return true;
    }
    if (now - last > windowMs) {
      localStorage.setItem(key, String(now));
      return true;
    }
    return false;
  } catch {
    return true; // if storage blocked, just count
  }
}


/**
 * Counts a listing view (throttled per device) and records it in recently-viewed.
 */
export function ListingViewTracker({
  listingId,
  title,
  throttleMinutes = 30,
}: {
  listingId: string;
  title?: string;
  throttleMinutes?: number;
}) {
  useEffect(() => {
    if (!listingId) return;

    // Track recently viewed immediately (no throttle needed)
    safePushRecent({
      id: listingId,
      title: title ?? "Listing",
      href: `/listing/${listingId}`,
      when: new Date().toISOString(),
    });

    // Throttled view count for ranking
    const key = `jm_view_${listingId}`;
    const ok = shouldCount(key, throttleMinutes * 60_000);
    if (!ok) return;

    void supabase
      .rpc("listing_stats_increment", {
        p_listing_id: listingId,
        p_event: "view",
        p_amount: 1,
      })
      .then(({ error }) => {
        if (error) console.error("listing_stats_increment(view) failed:", error);
      });
  }, [listingId, title, throttleMinutes]);

  return null;
}

// ─── ShareButton ──────────────────────────────────────────────────────────────

/**
 * Native share sheet on mobile; copy-to-clipboard fallback on desktop.
 * Renders as an icon-only button or a labelled pill depending on `variant`.
 */
export function ShareButton({
  title,
  text,
  url,
  variant = "icon",
  className = "",
}: {
  title: string;
  text: string;
  url: string;
  variant?: "icon" | "pill";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    // 1. Try Web Share API (works on mobile Chrome/Safari and some desktop)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled (AbortError) or not supported — fall through
      }
    }

    // 2. Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort: prompt
      window.prompt("Copy this link:", url);
    }
  }, [title, text, url]);

  const icon = copied
    ? <Check className="h-4 w-4" />
    : <Share2 className="h-4 w-4" />;

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleShare}
        aria-label="Share listing"
        className={[
          "inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold transition",
          copied ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "text-zinc-900 hover:bg-zinc-50",
          className,
        ].filter(Boolean).join(" ")}
      >
        {icon}
        {copied ? "Copied!" : "Share"}
      </button>
    );
  }

  // icon-only (used in top bar + mobile action bar)
  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share listing"
      className={[
        "grid h-10 w-10 place-items-center rounded-full border transition",
        copied ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "bg-white text-zinc-700 hover:bg-zinc-50",
        className,
      ].filter(Boolean).join(" ")}
    >
      {icon}
    </button>
  );
}

/**
 * CTA buttons with click tracking for ranking.
 * WhatsApp and phone have been removed — in-app messaging only.
 */
export function ListingContactActions({
  listingId,
  shareTitle,
  shareText,
  shareUrl,
  variant,
}: {
  listingId: string;
  shareTitle: string;
  shareText: string;
  shareUrl: string;
  variant: "desktop" | "mobile";
}) {
  if (variant === "desktop") {
    return (
      <div className="mt-4">
        <ShareButton
          title={shareTitle}
          text={shareText}
          url={shareUrl}
          variant="pill"
          className="w-full"
        />
      </div>
    );
  }

  // ── Mobile bottom bar: Report | Share ──
  return (
    <div className="grid grid-cols-2 gap-2">
      <Link
        href={`/report?listing=${listingId}`}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
      >
        <Flag className="h-4 w-4" />
        Report
      </Link>

      <ShareButton
        title={shareTitle}
        text={shareText}
        url={shareUrl}
        variant="pill"
      />
    </div>
  );
}