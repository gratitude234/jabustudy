"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type LeaderRow = {
  user_id: string;
  email: string;
  questions: number;
  question_upvotes: number;
  answers: number;
  accepted: number;
  practice_points: number;
  practice_days: number;
  points: number;
};

const POINT_RULES: Array<{ key: keyof LeaderRow; label: string; multiplier: number }> = [
  { key: "accepted",         label: "Accepted answers", multiplier: 5 },
  { key: "answers",          label: "Answers posted",   multiplier: 2 },
  { key: "questions",        label: "Questions asked",  multiplier: 1 },
  { key: "question_upvotes", label: "Upvotes received", multiplier: 1 },
  { key: "practice_points",  label: "Practice pts",     multiplier: 1 },
];

export function PointsBreakdown({ row }: { row: LeaderRow }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 text-[11px] font-semibold text-muted-foreground select-none",
          "hover:text-foreground transition-colors focus-visible:outline-none"
        )}
      >
        <Star className="h-3 w-3" />
        {open ? "Hide breakdown" : "Show breakdown"}
      </button>

      {open && (
        <>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {POINT_RULES.map(({ key, label, multiplier }) => {
              const count = row[key] as number;
              const earned = count * multiplier;
              return (
                <div
                  key={key}
                  className="rounded-xl border border-border bg-background px-2.5 py-2"
                >
                  <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-sm font-extrabold text-foreground">
                    {count}
                    <span className="ml-1 text-[10px] font-semibold text-muted-foreground">
                      ×{multiplier}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">= {earned} pts</p>
                </div>
              );
            })}
          </div>

          {row.practice_days > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              🔥 Practiced on {row.practice_days} day{row.practice_days !== 1 ? "s" : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
