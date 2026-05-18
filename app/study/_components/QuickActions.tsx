"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { track, trackHomeCta } from "@/lib/studyAnalytics";
import { cn } from "@/lib/utils";
import QuickMoreSheet from "./QuickMoreSheet";

interface QuickActionsProps {
  repStatus?: "not_applied" | "pending" | "approved" | "rejected" | null;
}

type QuickActionLinkTile = {
  href: string;
  label: string;
  sublabel: string;
  icon: typeof Sparkles;
  primary: boolean;
  isNew: boolean;
};

type QuickActionMoreTile = {
  label: string;
  sublabel: string;
  icon: typeof MoreHorizontal;
  primary: false;
  isNew: false;
  isMore: true;
};

const TILES: readonly (QuickActionLinkTile | QuickActionMoreTile)[] = [
  {
    href: "/study/library",
    label: "PDF → Qs",
    sublabel: "AI-generated",
    icon: Sparkles,
    primary: true,
    isNew: true,
  },
  {
    href: "/study/library",
    label: "Library",
    sublabel: "Notes & past Qs",
    icon: BookOpen,
    primary: false,
    isNew: false,
  },
  {
    label: "More",
    sublabel: "GPA, Q&A, plan",
    icon: MoreHorizontal,
    primary: false,
    isNew: false,
    isMore: true,
  },
] as const;

export function QuickActions(props: QuickActionsProps = {}) {
  void props.repStatus;
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {TILES.map((tile, index) =>
          "isMore" in tile ? (
            <button
              key={tile.label}
              type="button"
              onClick={() => {
                track("study_home_more_opened");
                setMoreOpen(true);
              }}
              className={cn(
                "flex flex-col gap-3 rounded-3xl p-4 text-left transition active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "border border-border bg-card text-foreground shadow-sm hover:bg-secondary/20"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light dark:bg-primary/15">
                <tile.icon className="h-5 w-5 text-primary dark:text-indigo-200" />
              </div>

              <div className="space-y-1">
                <p className="text-[12px] font-extrabold leading-tight text-foreground">
                  {tile.label}
                </p>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  {tile.sublabel}
                </p>
              </div>
            </button>
          ) : (
            <Link
              key={tile.label}
              href={tile.href}
              onClick={() =>
                trackHomeCta("quick_action", {
                  action_label: tile.label,
                  action_href: tile.href,
                  position: index + 1,
                })
              }
              className={cn(
                "flex flex-col gap-3 rounded-3xl p-4 no-underline transition active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                tile.primary
                  ? "bg-primary text-white hover:opacity-90"
                  : "border border-border bg-card text-foreground shadow-sm hover:bg-secondary/20"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  tile.primary ? "bg-white/20" : "bg-primary-light dark:bg-primary/15"
                )}
              >
                <tile.icon
                  className={cn(
                    "h-5 w-5",
                    tile.primary ? "text-white" : "text-primary dark:text-indigo-200"
                  )}
                />
              </div>

              <div className="space-y-1">
                <p
                  className={cn(
                    "text-[12px] font-extrabold leading-tight",
                    tile.primary ? "text-white" : "text-foreground"
                  )}
                >
                  {tile.label}
                </p>

                {tile.isNew ? (
                  <span className="w-fit rounded-md bg-primary-light px-1.5 py-0.5 text-[9px] font-bold text-primary-text dark:bg-white/20 dark:text-white">
                    NEW
                  </span>
                ) : null}

                <p
                  className={cn(
                    "text-[10px] leading-tight",
                    tile.primary ? "text-white/70" : "text-muted-foreground"
                  )}
                >
                  {tile.sublabel}
                </p>
              </div>
            </Link>
          )
        )}
      </div>

      <QuickMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
