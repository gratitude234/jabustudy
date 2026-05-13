"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  Calculator,
  ChevronRight,
  GraduationCap,
  MessagesSquare,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/studyAnalytics";
import type { StudyHomeMoreBadgeTone } from "@/lib/studyAnalytics.types";
import { cn } from "@/lib/utils";
import { useStudyPrefs } from "./StudyPrefsContext";
import { invalidateMoreBadges, useMoreBadges, type MoreBadgesPayload } from "./useMoreBadges";

type QuickMoreSheetProps = {
  open: boolean;
  onClose: () => void;
};

type GroupName = "TRACK" | "COMMUNITY" | "PLAN & CONTRIBUTE";
type RowKey = keyof MoreBadgesPayload["badges"];
type TintName = "blue" | "amber" | "coral" | "pink" | "purple" | "green";

type RowDef = {
  group: GroupName;
  key: RowKey;
  href: string;
  label: string;
  icon: typeof Calculator;
  tint: TintName;
};

type MoreBadge = {
  label: string;
  tone: StudyHomeMoreBadgeTone;
} | null;

const GROUP_ORDER: readonly GroupName[] = [
  "TRACK",
  "COMMUNITY",
  "PLAN & CONTRIBUTE",
] as const;

const ROW_DEFS: readonly RowDef[] = [
  {
    group: "TRACK",
    key: "gpa",
    href: "/study/gpa",
    label: "GPA calculator",
    icon: Calculator,
    tint: "blue",
  },
  {
    group: "TRACK",
    key: "leaderboard",
    href: "/study/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    tint: "amber",
  },
  {
    group: "COMMUNITY",
    key: "qa_forum",
    href: "/study/questions",
    label: "Q&A forum",
    icon: MessagesSquare,
    tint: "coral",
  },
  {
    group: "COMMUNITY",
    key: "tutors",
    href: "/study/tutors",
    label: "Tutors",
    icon: GraduationCap,
    tint: "pink",
  },
  {
    group: "PLAN & CONTRIBUTE",
    key: "ai_plan",
    href: "/study/ai-plan",
    label: "AI study plan",
    icon: BrainCircuit,
    tint: "purple",
  },
  {
    group: "PLAN & CONTRIBUTE",
    key: "apply_rep",
    href: "/study/apply-rep",
    label: "Apply as rep",
    icon: ShieldCheck,
    tint: "green",
  },
] as const;

const LOADING_BADGES: MoreBadgesPayload["badges"] = {
  ai_plan: { subtitle: "Loading...", badge: null },
  qa_forum: { subtitle: "Loading...", badge: null },
  gpa: { subtitle: "Loading...", badge: null },
  leaderboard: { subtitle: "Loading...", badge: null },
  tutors: { subtitle: "Loading...", badge: null },
  apply_rep: { subtitle: "Loading...", badge: null, hidden: false },
};

const FALLBACK_BADGES: MoreBadgesPayload["badges"] = {
  ai_plan: { subtitle: "Build a week-by-week schedule", badge: null },
  qa_forum: { subtitle: "Ask your coursemates", badge: null },
  gpa: { subtitle: "Track grades across semesters", badge: null },
  leaderboard: { subtitle: "Climb the ranks", badge: null },
  tutors: { subtitle: "Book 1:1 help", badge: null },
  apply_rep: { subtitle: "Upload for your department", badge: null, hidden: false },
};

const TINT_STYLES: Record<TintName, string> = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  coral: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  pink: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300",
  purple: "bg-[#EEEDFE] text-[#5B35D5] dark:bg-[#5B35D5]/15 dark:text-indigo-200",
  green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
};

function badgeClassName(badge: MoreBadge) {
  if (!badge) return "";
  if (badge.tone === "count") {
    return "bg-[#EEEDFE] text-[#3B24A8] dark:bg-[#5B35D5]/15 dark:text-indigo-200";
  }

  if (badge.label === "Pending") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  }

  return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400";
}

export default function QuickMoreSheet({ open, onClose }: QuickMoreSheetProps) {
  const dragStartY = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const { userId } = useStudyPrefs();
  const badgeState = useMoreBadges(open);

  const closeSheet = useCallback(() => {
    setDragOffset(0);
    setIsDragging(false);
    dragStartY.current = null;
    onClose();
  }, [onClose]);

  const badges =
    badgeState.status === "success"
      ? badgeState.data.badges
      : badgeState.status === "error"
      ? FALLBACK_BADGES
      : LOADING_BADGES;

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [closeSheet, open]);

  function handleTouchStart(event: React.TouchEvent) {
    dragStartY.current = event.touches[0].clientY;
    setIsDragging(true);
  }

  function handleTouchMove(event: React.TouchEvent) {
    if (!isDragging || dragStartY.current === null) return;
    const delta = event.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragOffset(delta);
  }

  function handleTouchEnd() {
    if (dragOffset > 120) closeSheet();
    else setDragOffset(0);
    setIsDragging(false);
    dragStartY.current = null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      inert={!open || undefined}
    >
      <div className="absolute inset-0 bg-black/60" onClick={closeSheet} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="More study actions"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: open ? `translateY(${dragOffset}px)` : "translateY(100%)",
          transition: isDragging
            ? "none"
            : open
            ? "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)"
            : "transform 0.25s ease-in",
          maxHeight: "85dvh",
        }}
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-[28px] border-t border-border bg-card shadow-2xl"
      >
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-2">
          <div>
            <p className="text-base font-extrabold tracking-tight text-foreground">
              More
            </p>
            <p className="text-xs text-muted-foreground">
              Pick up on what&apos;s new
            </p>
          </div>

          <button
            type="button"
            onClick={closeSheet}
            aria-label="Close More sheet"
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground",
              "transition-colors hover:bg-secondary hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="overflow-y-auto overscroll-contain px-4 pb-4 pt-1"
          style={{
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px) + 1rem)",
          }}
        >
          {GROUP_ORDER.map((group, index) => {
            const rows = ROW_DEFS.filter((row) => {
              if (row.group !== group) return false;
              if (row.key === "apply_rep" && badges.apply_rep.hidden) return false;
              return true;
            });

            if (rows.length === 0) return null;

            return (
              <section key={group} className={cn(index > 0 && "mt-4")}>
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </p>

                <div className="space-y-2">
                  {rows.map((row) => {
                    const rowBadgeState = badges[row.key];
                    const badge = rowBadgeState.badge;
                    const Icon = row.icon;

                    return (
                      <Link
                        key={row.href}
                        href={row.href}
                        onClick={() => {
                          track("study_home_more_item_tapped", {
                            item: row.key,
                            had_badge: Boolean(badge),
                            badge_label: badge?.label,
                            badge_tone: badge?.tone,
                          });

                          if (
                            userId &&
                            badge?.tone === "count" &&
                            (row.key === "qa_forum" || row.key === "leaderboard")
                          ) {
                            void supabase
                              .from("study_user_badge_state")
                              .upsert(
                                {
                                  user_id: userId,
                                  area: row.key,
                                  last_seen_at: new Date().toISOString(),
                                },
                                { onConflict: "user_id,area" }
                              )
                              .then(() => invalidateMoreBadges(), () => {});
                          }

                          closeSheet();
                        }}
                        className={cn(
                          "flex items-center gap-3.5 rounded-2xl border border-border/60 bg-background p-3.5 transition-all duration-150",
                          "hover:bg-secondary/50 hover:border-border",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                          "active:scale-[0.98]"
                        )}
                      >
                        <div
                          className={cn(
                            "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                            TINT_STYLES[row.tint]
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{row.label}</p>
                            {badge ? (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                  badgeClassName(badge)
                                )}
                              >
                                {badge.label}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {rowBadgeState.subtitle}
                          </p>
                        </div>

                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
