"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const RULES = [
  { label: "Accepted answer", pts: "+10 pts" },
  { label: "Answer posted",   pts: "+2 pts" },
  { label: "Question asked",  pts: "+1 pt"  },
  { label: "Question upvote", pts: "+1 pt"  },
  { label: "Answer upvote",   pts: "+2 pts" },
  { label: "Practice correct", pts: "+1 pt" },
  { label: "Written grade 7/10+", pts: "+1 pt" },
  { label: "Written grade 9/10+", pts: "+2 pts" },
  { label: "Practice complete", pts: "+3 pts" },
];

export function HowPointsWork() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-2xl border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 focus-visible:outline-none"
      >
        How points work
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-9 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            {RULES.map((r, i) => (
              <div
                key={r.label}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 text-xs",
                  i > 0 && "border-t border-border/60"
                )}
              >
                <span className="text-muted-brand">{r.label}</span>
                <span className="font-semibold text-foreground">{r.pts}</span>
              </div>
            ))}
            <div className="border-t border-border/60 px-3 py-2 text-[10px] leading-snug text-muted-brand">
              Written grades are awarded on submit and share the daily practice cap.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
