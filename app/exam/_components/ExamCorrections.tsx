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

type Filter = "mistakes" | "flagged" | "all";
const PAGE_SIZE = 6;

function outcomeOf(item: ExamCorrectionItem) {
  if (!item.selectedOptionId) return "skipped" as const;
  return item.correct ? ("correct" as const) : ("wrong" as const);
}

export default function ExamCorrections({ items }: { items: ExamCorrectionItem[] }) {
  const [filter, setFilter] = useState<Filter>("mistakes");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const counts = useMemo(() => {
    let mistakes = 0;
    let flagged = 0;
    for (const item of items) {
      if (outcomeOf(item) !== "correct") mistakes += 1;
      if (item.flagged) flagged += 1;
    }
    return { all: items.length, mistakes, flagged };
  }, [items]);

  const filtered = useMemo(() => items.filter((item) => {
    if (filter === "mistakes") return outcomeOf(item) !== "correct";
    if (filter === "flagged") return item.flagged;
    return true;
  }), [filter, items]);

  const visible = filtered.slice(0, limit);
  const remaining = Math.max(0, filtered.length - visible.length);
  const tabs: Array<{ key: Filter; label: string; count: number }> = [
    { key: "mistakes", label: "Mistakes", count: counts.mistakes },
    { key: "flagged", label: "Flagged", count: counts.flagged },
    { key: "all", label: "All", count: counts.all },
  ];

  return (
    <section id="corrections" className="scroll-mt-24 space-y-3" aria-labelledby="corrections-heading">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Answer review</p>
        <h2 id="corrections-heading" className="mt-0.5 text-xl font-black tracking-tight">Review your answers</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">Open a question to see the correct answer and explanation.</p>
      </div>

      <div className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-1 bg-[#f8f7fc]/95 px-1 py-2 backdrop-blur-xl dark:bg-[#0d0a18]/95">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1" role="group" aria-label="Filter answer review">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setFilter(key); setExpandedId(null); setLimit(PAGE_SIZE); }}
              aria-pressed={filter === key}
              disabled={count === 0 && key !== "all"}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-35 sm:text-xs",
                filter === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}<span className="font-mono text-[10px] opacity-65">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-emerald-50 p-6 text-center dark:bg-emerald-950/20">
          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" aria-hidden="true" />
          <h3 className="mt-3 text-base font-extrabold">Nothing to review here</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">You can still inspect every answer and explanation.</p>
          <button type="button" onClick={() => setFilter("all")} className="mt-3 min-h-10 rounded-lg px-3 text-sm font-extrabold text-primary hover:bg-primary/10">Review all answers</button>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {visible.map((item) => (
            <CorrectionRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)}
            />
          ))}
        </div>
      )}

      {remaining > 0 ? (
        <button type="button" onClick={() => setLimit((value) => value + PAGE_SIZE)} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-extrabold text-primary hover:bg-secondary">
          Show {Math.min(PAGE_SIZE, remaining)} more · {remaining} remaining
        </button>
      ) : filtered.length > PAGE_SIZE ? <p className="text-center text-xs font-semibold text-muted-foreground">All {filtered.length} questions in this view are shown.</p> : null}
    </section>
  );
}

function CorrectionRow({ item, expanded, onToggle }: { item: ExamCorrectionItem; expanded: boolean; onToggle: () => void }) {
  const outcome = outcomeOf(item);
  const tone = {
    correct: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      text: "text-emerald-700 dark:text-emerald-300",
    },
    wrong: {
      icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      text: "text-rose-700 dark:text-rose-300",
    },
    skipped: {
      icon: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      text: "text-amber-800 dark:text-amber-300",
    },
  }[outcome];
  const Icon = outcome === "correct" ? CheckCircle2 : outcome === "wrong" ? XCircle : AlertCircle;
  const label = outcome === "correct" ? "Correct" : outcome === "wrong" ? "Wrong" : "Skipped";

  return (
    <article>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-h-[4.25rem] w-full items-start gap-3 p-3.5 text-left transition hover:bg-secondary/35 sm:p-4">
        <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", tone.icon)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold">
            <span className="shrink-0 text-foreground/65">Question {item.position}</span>
            {item.sourceTopic ? <><span aria-hidden="true" className="text-border">·</span><span className="truncate text-muted-foreground">{item.sourceTopic}</span></> : null}
          </span>
          <span className={cn("mt-1 block text-[13px] font-semibold leading-5", !expanded && "line-clamp-2")}>{item.prompt}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className={cn("text-[9px] font-bold", tone.text)}>{label}</span>
          {item.flagged ? <Flag className="mt-1 h-3.5 w-3.5 text-amber-600" aria-label="Flagged" /> : null}
          <ChevronDown className={cn("mt-0.5 h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-border bg-secondary/15 px-3.5 pb-4 pt-3.5 sm:px-4">
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {item.options.map((option, index) => {
              const isCorrect = option.id === item.correctOptionId;
              const isSelected = option.id === item.selectedOptionId;
              return (
                <div key={option.id} className={cn("flex min-h-12 items-start gap-3 px-3 py-3 text-sm", isCorrect ? "bg-emerald-50 dark:bg-emerald-950/20" : isSelected ? "bg-rose-50 dark:bg-rose-950/20" : "") }>
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black", isCorrect ? "bg-emerald-600 text-white" : isSelected ? "bg-rose-600 text-white" : "bg-secondary text-muted-foreground")}>{String.fromCharCode(65 + index)}</span>
                  <span className={cn("min-w-0 flex-1 pt-0.5 font-semibold", !isCorrect && !isSelected && "text-muted-foreground")}>{option.text}</span>
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    {isCorrect ? <span className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">Correct</span> : null}
                    {isSelected && !isCorrect ? <span className="text-[9px] font-black uppercase text-rose-700 dark:text-rose-300">Your answer</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
          {outcome === "skipped" ? <p className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300"><AlertCircle className="h-4 w-4" aria-hidden="true" /> You left this question unanswered.</p> : null}
          <div className="mt-3 rounded-xl bg-primary/[0.06] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-primary">Explanation</p>
            <p className="mt-1.5 text-sm leading-6">{item.explanation || "Review this answer with your course material."}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
