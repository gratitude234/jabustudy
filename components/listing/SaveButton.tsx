"use client";
// components/listing/SaveButton.tsx
import { cn } from "@/lib/utils";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  listingId: string;
  /** Optional: pre-seed from server to avoid flash */
  initialSaved?: boolean;
  /** Render variants */
  variant?: "icon" | "pill";
  className?: string;
}

export default function SaveButton({
  listingId,
  initialSaved = false,
  variant = "icon",
  className,
}: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Controls a brief "pulse" animation on save
  const [pulse, setPulse] = useState(false);

  // Fetch auth + hydrate saved state on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setUserId(user.id);

      // Check if this listing is already saved
      const { data } = await supabase
        .from("listing_saves")
        .select("id")
        .eq("user_id", user.id)
        .eq("listing_id", listingId)
        .maybeSingle();

      if (!cancelled) setSaved(!!data);
    }

    init();
    return () => { cancelled = true; };
  }, [listingId]);

  async function toggle() {
    if (loading) return;

    // Require auth — redirect to login if not signed in
    if (!userId) {
      window.location.href = `/login?next=/listing/${listingId}`;
      return;
    }

    setLoading(true);
    const next = !saved;
    setSaved(next); // optimistic update

    if (next) {
      // Animate on save
      setPulse(true);
      setTimeout(() => setPulse(false), 600);

      // Fetch current listing price + vendor's user_id to record price_at_save and notify seller
      let priceAtSave: number | null = null;
      try {
        const { data: listingData } = await supabase
          .from("listings")
          .select("price, title, vendors(user_id)")
          .eq("id", listingId)
          .maybeSingle();

        priceAtSave = (listingData as any)?.price ?? null;

        // Notify the vendor (if they have a user account and it's not the same user saving)
        const vendorUserId =
          Array.isArray((listingData as any)?.vendors)
            ? (listingData as any).vendors[0]?.user_id
            : (listingData as any)?.vendors?.user_id;

        if (vendorUserId && vendorUserId !== userId) {
          const listingTitle = (listingData as any)?.title ?? "Your listing";
          await supabase.from("notifications").insert({
            user_id: vendorUserId,
            type: "listing_saved",
            title: "Someone saved your listing",
            body: listingTitle,
            href: `/listing/${listingId}`,
          });
        }
      } catch {}

      const { error } = await supabase
        .from("listing_saves")
        .insert({ user_id: userId, listing_id: listingId, price_at_save: priceAtSave });

      if (error) {
        // Rollback on conflict or other error
        setSaved(false);
        console.error("Save failed:", error.message);
      }
    } else {
      const { error } = await supabase
        .from("listing_saves")
        .delete()
        .eq("user_id", userId)
        .eq("listing_id", listingId);

      if (error) {
        setSaved(true); // rollback
        console.error("Unsave failed:", error.message);
      }
    }

    setLoading(false);
  }

  if (variant === "pill") {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={saved ? "Remove from saved" : "Save listing"}
        className={cn(
          "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
          saved
            ? "border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-700"
            : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
          loading && "opacity-60 cursor-not-allowed",
          className
        )}
      >
        <Bookmark
          className={cn(
            "h-4 w-4 transition-transform",
            saved && "fill-current",
            pulse && "scale-125"
          )}
        />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  // Default: icon-only button (for compact contexts)
  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Remove from saved" : "Save listing"}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full border transition",
        saved
          ? "border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-700"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
        loading && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      <Bookmark
        className={cn(
          "h-4 w-4 transition-transform",
          saved && "fill-current",
          pulse && "scale-125"
        )}
      />
    </button>
  );
}