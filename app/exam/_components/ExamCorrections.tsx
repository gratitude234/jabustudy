"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Flag, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExamCorrectionItem = {
  id: string;
  position: number;
  prompt: string;
  options: { id: string; text: string }[];
  selectedOptionId: string | null;
  correctOptionId: string;
  correct: boolean;
  flagged: boolean;
  explanation: string;
  sourceTopic: string | null;
};

type Filter = "mistakes" | "all" | "wrong" | "skipped" | "flagged";

function outcomeOf(item: ExamCorrectionItem) {
  if (!item.selectedOptionId) return "skipped" as const;
  return item.correct ? ("correct" as const) : ("wrong" as const);
}

export default function ExamCorrections({ items }: { items: ExamCorrectionItem[] }) {
  const [filter, setFilter] = useState<Filter>("mistakes");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);

  const counts = useMemo(() => {
    let wrong = 0;
    let skipped = 0;
    let flagged = 0;
    for (const item of items) {
      const outcome = outcomeOf(item);
      if (outcome === "wrong") wrong += 1;
      if (outcome === "skipped") skipped += 1;
      if (item.flagged) flagged += 1;
    }
    return { all: items.length, mistakes: wrong + skipped, wrong, skipped, flagged };
  }, [items]);

  const filtered = useMemo(() => items.filter((item) => {
    const outcome = outcomeOf(item);
    if (filter === "mistakes") return outcome !== "correct";
    if (filter === "wrong") return outcome === "wrong";
    if (filter === "skipped") return outcome === "skipped";
    if (filter === "flagged") return item.flagged;
    return true;
  }), [filter, items]);

  const visible = filtered.slice(0, limit);
  const remaining = Math.max(0, filtered.length - visible.length);
  const tabs: Array<{ key: Filter; label: string; count: number }> = [
    { key: "mistakes", label: "Mistakes", count: counts.mistakes },
    { key: "all", label: "All", count: counts.all },
    { key: "wrong", label: "Wrong", count: counts.wrong },
    { key: "skipped", label: "Skipped", count: counts.skipped },
    { key: "flagged", label: "Flagged", count: counts.flagged },
  ];

  return (
    <section id="corrections" className="scroll-mt-24 space-y-4" aria-labelledby="corrections-heading">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Corrections</p>
        <h2 id="corrections-heading" className="mt-1 text-2xl font-black tracking-tight">Review the paper</h2>
        <p className="mt-1 text-sm text-muted-foreground">Mistakes appear first. Open a question to see its answer and explanation.</p>
      </div>

      <div className="sticky top-16 z-20 -mx-4 overflow-x-auto border-y border-border bg-background/95 px-4 py-2.5 backdrop-blur-xl sm:static sm:mx-0 sm:rounded-xl sm:border sm:bg-card sm:p-2" role="group" aria-label="Filter corrections">
        <div className="flex min-w-max gap-2">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setFilter(key); setExpandedId(null); setLimit(10); }}
              aria-pressed={filter === key}
              disabled={count === 0 && key !== "all"}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40",
                filter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-secondary",
              )}
            >
              {label}<span className={cn("rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", filter === key ? "bg-white/20" : "bg-secondary text-muted-foreground")}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-extrabold">Nothing in this view</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">Choose another filter to continue reviewing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <CorrectionCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)}
            />
          ))}
        </div>
      )}

      {remaining > 0 ? (
        <button type="button" onClick={() => setLimit((value) => value + 10)} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-extrabold text-primary hover:bg-secondary">
          Show 10 more · {remaining} remaining
        </button>
      ) : filtered.length > 10 ? <p className="text-center text-xs font-semibold text-muted-foreground">All {filtered.length} questions in this view are shown.</p> : null}
    </section>
  );
}

function CorrectionCard({ item, expanded, onToggle }: { item: ExamCorrectionItem; expanded: boolean; onToggle: () => void }) {
  const outcome = outcomeOf(item);
  const tone = {
    correct: { ring: "border-emerald-300/50 dark:border-emerald-800/50", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
    wrong: { ring: "border-rose-300/50 dark:border-rose-800/50", chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
    skipped: { ring: "border-amber-300/50 dark:border-amber-800/50", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  }[outcome];
  const Icon = outcome === "correct" ? CheckCircle2 : outcome === "wrong" ? XCircle : AlertCircle;
  const label = outcome === "correct" ? "Correct" : outcome === "wrong" ? "Wrong" : "Skipped";

  return (
    <article className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", tone.ring)}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-h-16 w-full items-start gap-3 p-4 text-left hover:bg-secondary/50 sm:p-5">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone.chip)}><Icon className="h-5 w-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Question {item.position}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", tone.chip)}>{label}</span>
            {item.flagged ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><Flag className="h-3 w-3" /> Flagged</span> : null}
            {item.sourceTopic ? <span className="truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{item.sourceTopic}</span> : null}
          </span>
          <span className={cn("mt-1.5 block font-bold leading-7", !expanded && "line-clamp-2")}>{item.prompt}</span>
        </span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="border-t border-border px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <div className="space-y-2">
            {item.options.map((option, index) => {
              const isCorrect = option.id === item.correctOptionId;
              const isSelected = option.id === item.selectedOptionId;
              return (
                <div key={option.id} className={cn("flex min-h-12 items-start gap-3 rounded-xl border px-3 py-3 text-sm", isCorrect ? "border-emerald-300/50 bg-emerald-100/40 dark:bg-emerald-950/25" : isSelected ? "border-rose-300/50 bg-rose-100/40 dark:bg-rose-950/25" : "border-border bg-background")}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border bg-card text-xs font-black">{String.fromCharCode(65 + index)}</span>
                  <span className={cn("min-w-0 flex-1 pt-0.5 font-semibold", !isCorrect && !isSelected && "text-muted-foreground")}>{option.text}</span>
                  <span className="flex shrink-0 items-center gap-2 pt-0.5">{isSelected ? <span className="text-[10px] font-black uppercase text-muted-foreground">You</span> : null}{isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : isSelected ? <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-300" /> : null}</span>
                </div>
              );
            })}
          </div>
          {outcome === "skipped" ? <p className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300"><AlertCircle className="h-4 w-4" /> This question was left unanswered.</p> : null}
          <div className="mt-4 rounded-xl bg-secondary p-4"><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Explanation</p><p className="mt-2 text-sm leading-6">{item.explanation || "Review this answer with your course material."}</p></div>
        </div>
      ) : null}
    </article>
  );
}
