"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type ActiveView = "history" | "saved";

export function HistorySavedTabs({ active }: { active: ActiveView }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/study/history"
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all leading-none select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          active === "history"
            ? "border-[#5B35D5]/30 bg-[#EEEDFE] text-[#5B35D5]"
            : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        )}
      >
        History
      </Link>
      <Link
        href="/study/saved"
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all leading-none select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          active === "saved"
            ? "border-[#5B35D5]/30 bg-[#EEEDFE] text-[#5B35D5]"
            : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        )}
      >
        Saved
      </Link>
    </div>
  );
}
