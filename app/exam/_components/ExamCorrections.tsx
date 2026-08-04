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
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Answer review</p>
        <h2 id="corrections-heading" className="mt-0.5 text-2xl font-black tracking-tight">Understand every mark</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">Mistakes are shown first. Tap a question to reveal the correct answer and explanation.</p>
      </div>

      <div className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 overflow-x-auto border-y border-border bg-background/95 px-4 py-2.5 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:static sm:mx-0 sm:rounded-xl sm:border sm:bg-card sm:p-2" role="group" aria-label="Filter answer review">
        <div className="flex min-w-max gap-2">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setFilter(key); setExpandedId(null); setLimit(10); }}
              aria-pressed={filter === key}
              disabled={count === 0 && key !== "all"}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-35",
                filter === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-primary/10 hover:text-primary",
              )}
            >
              {label}<span className={cn("font-mono text-[10px]", filter === key ? "text-primary-foreground/75" : "text-muted-foreground")}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-extrabold">No mistakes here</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">You can still inspect the full paper and its explanations.</p>
          <button type="button" onClick={() => setFilter("all")} className="mt-4 min-h-11 rounded-xl bg-secondary px-4 text-sm font-extrabold text-primary">Review all answers</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {visible.map((item, index) => (
            <CorrectionRow
              key={item.id}
              item={item}
              separated={index > 0}
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

function CorrectionRow({ item, expanded, separated, onToggle }: { item: ExamCorrectionItem; expanded: boolean; separated: boolean; onToggle: () => void }) {
  const outcome = outcomeOf(item);
  const tone = {
    correct: { chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
    wrong: { chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
    skipped: { chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  }[outcome];
  const Icon = outcome === "correct" ? CheckCircle2 : outcome === "wrong" ? XCircle : AlertCircle;
  const label = outcome === "correct" ? "Correct" : outcome === "wrong" ? "Wrong" : "Skipped";

  return (
    <article className={cn(separated && "border-t border-border")}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-h-[4.75rem] w-full items-start gap-3 p-4 text-left transition hover:bg-secondary/40 sm:p-5">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone.chip)}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Question {item.position}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide", tone.chip)}>{label}</span>
            {item.flagged ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><Flag className="h-2.5 w-2.5" aria-hidden="true" /> Flagged</span> : null}
          </span>
          <span className={cn("mt-1.5 block text-sm font-bold leading-6", !expanded && "line-clamp-2")}>{item.prompt}</span>
          {item.sourceTopic ? <span className="mt-1 block truncate text-[10px] font-semibold text-muted-foreground">Topic: {item.sourceTopic}</span> : null}
        </span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="border-t border-border bg-secondary/20 px-4 pb-5 pt-4 sm:px-5">
          <div className="space-y-2">
            {item.options.map((option, index) => {
              const isCorrect = option.id === item.correctOptionId;
              const isSelected = option.id === item.selectedOptionId;
              return (
                <div key={option.id} className={cn("flex min-h-12 items-start gap-3 rounded-xl border px-3 py-3 text-sm", isCorrect ? "border-emerald-300/50 bg-emerald-100/45 dark:bg-emerald-950/25" : isSelected ? "border-rose-300/50 bg-rose-100/45 dark:bg-rose-950/25" : "border-border bg-card")}>
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs font-black", isCorrect ? "border-emerald-400/40 bg-emerald-600 text-white" : isSelected ? "border-rose-400/40 bg-rose-600 text-white" : "border-border bg-background")}>{String.fromCharCode(65 + index)}</span>
                  <span className={cn("min-w-0 flex-1 pt-0.5 font-semibold", !isCorrect && !isSelected && "text-muted-foreground")}>{option.text}</span>
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5">{isSelected ? <span className="text-[9px] font-black uppercase text-muted-foreground">Your answer</span> : null}{isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" /> : isSelected ? <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-300" aria-hidden="true" /> : null}</span>
                </div>
              );
            })}
          </div>
          {outcome === "skipped" ? <p className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300"><AlertCircle className="h-4 w-4" aria-hidden="true" /> This question was left unanswered.</p> : null}
          <div className="mt-4 border-l-4 border-primary pl-3"><p className="text-[10px] font-black uppercase tracking-wide text-primary">Why this is correct</p><p className="mt-1.5 text-sm leading-6">{item.explanation || "Review this answer with your course material."}</p></div>
        </div>
      ) : null}
    </article>
  );
}
