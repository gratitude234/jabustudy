"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, UsersRound, X } from "lucide-react";

import {
  readLocalWhatsAppCommunityStatus,
  saveLocalWhatsAppCommunityStatus,
  shouldShowWhatsAppCommunityPrompt,
  type WhatsAppCommunityStatus,
} from "@/lib/communityStatus";
import { WHATSAPP_GROUP_URL } from "@/lib/community";
import { supabase } from "@/lib/supabase";

type WhatsAppCommunityCTAProps = {
  userId: string | null;
  className?: string;
};

const DISMISS_DAYS = 5;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function WhatsAppCommunityCTA({ userId, className = "" }: WhatsAppCommunityCTAProps) {
  const [resolved, setResolved] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      if (!WHATSAPP_GROUP_URL || !userId) {
        if (mounted) {
          setVisible(false);
          setResolved(true);
        }
        return;
      }

      const localStatus = readLocalWhatsAppCommunityStatus(userId);
      if (!shouldShowWhatsAppCommunityPrompt(localStatus)) {
        if (mounted) {
          setVisible(false);
          setResolved(true);
        }
        return;
      }

      const { data, error } = await supabase
        .from("user_community_status")
        .select("whatsapp_join_clicked_at,whatsapp_join_confirmed_at,whatsapp_dismissed_until")
        .eq("user_id", userId)
        .maybeSingle();

      if (!mounted) return;
      const remoteStatus = (data as WhatsAppCommunityStatus | null) ?? null;
      if (!error && remoteStatus) saveLocalWhatsAppCommunityStatus(userId, remoteStatus);
      setVisible(error ? shouldShowWhatsAppCommunityPrompt(localStatus) : shouldShowWhatsAppCommunityPrompt(remoteStatus));
      setResolved(true);
    }

    void loadStatus();

    return () => {
      mounted = false;
    };
  }, [userId]);

  function upsertStatus(payload: Partial<WhatsAppCommunityStatus>) {
    if (!userId) return;

    saveLocalWhatsAppCommunityStatus(userId, payload);

    void supabase
      .from("user_community_status")
      .upsert(
        {
          user_id: userId,
          ...payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .then(() => {}, () => {});
  }

  function handleJoinClick() {
    const now = new Date().toISOString();
    setVisible(false);
    upsertStatus({
      whatsapp_join_clicked_at: now,
      whatsapp_dismissed_until: null,
    });
  }

  function handleConfirmJoined() {
    const now = new Date().toISOString();
    setVisible(false);
    upsertStatus({
      whatsapp_join_clicked_at: now,
      whatsapp_join_confirmed_at: now,
      whatsapp_dismissed_until: null,
    });
  }

  function handleDismiss() {
    setVisible(false);
    upsertStatus({ whatsapp_dismissed_until: addDays(new Date(), DISMISS_DAYS).toISOString() });
  }

  if (!resolved || !visible || !WHATSAPP_GROUP_URL) return null;

  return (
    <section
      className={`rounded-3xl border border-[#25D366]/30 bg-[#25D366]/5 p-4 shadow-sm ${className}`}
      aria-label="JabuStudy WhatsApp community"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#25D366]/15 text-[#128C4A] dark:text-[#25D366]">
          <UsersRound className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-foreground">Join the JabuStudy community</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Get course updates, CBT question requests, material alerts and important announcements on WhatsApp.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Hide WhatsApp community prompt"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-[#25D366]/10 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleJoinClick}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#128C4A] px-4 py-2 text-xs font-bold text-white no-underline transition hover:bg-[#0f7a40]"
            >
              Join WhatsApp
              <ArrowRight className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={handleConfirmJoined}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#25D366]/30 bg-background px-3 py-2 text-xs font-bold text-[#128C4A] transition hover:bg-[#25D366]/10 dark:text-[#25D366]"
            >
              <Check className="h-3.5 w-3.5" />
              I&apos;ve joined
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
