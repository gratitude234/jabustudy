"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Flag, SlidersHorizontal, XCircle } from "lucide-react";
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

type Filter = "all" | "wrong" | "skipped" | "flagged";

/** Skipped is its own outcome: leaving a question blank is a pacing problem, not a knowledge gap. */
function outcomeOf(item: ExamCorrectionItem) {
  if (!item.selectedOptionId) return "skipped" as const;
  return item.correct ? ("correct" as const) : ("wrong" as const);
}

const EMPTY_STATE: Record<Exclude<Filter, "all">, { title: string; body: string }> = {
  wrong: { title: "No wrong answers", body: "Every question you attempted was correct." },
  skipped: { title: "Nothing skipped", body: "You reached every question before time ran out." },
  flagged: { title: "Nothing flagged", body: "You did not flag any question for review during this attempt." },
};

export default function ExamCorrections({ items }: { items: ExamCorrectionItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [topic, setTopic] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

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
    return { all: items.length, wrong, skipped, flagged };
  }, [items]);

  // Topics ranked by how much they cost you — skipped questions count too, since
  // running out of time on one topic is still a signal about that topic.
  const topics = useMemo(() => {
    const missed = new Map<string, number>();
    for (const item of items) {
      if (outcomeOf(item) === "correct" || !item.sourceTopic) continue;
      missed.set(item.sourceTopic, (missed.get(item.sourceTopic) ?? 0) + 1);
    }
    return [...missed.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [items]);

  const visible = useMemo(() => items.filter((item) => {
    if (topic && item.sourceTopic !== topic) return false;
    if (filter === "wrong") return outcomeOf(item) === "wrong";
    if (filter === "skipped") return outcomeOf(item) === "skipped";
    if (filter === "flagged") return item.flagged;
    return true;
  }), [items, filter, topic]);

  const tabs: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "wrong", label: "Wrong", count: counts.wrong },
    { key: "skipped", label: "Skipped", count: counts.skipped },
    { key: "flagged", label: "Flagged", count: counts.flagged },
  ];

  const allExpanded = visible.length > 0
    && visible.every((item) => overrides[item.id] ?? outcomeOf(item) !== "correct");

  function toggleAll() {
    const next = { ...overrides };
    for (const item of visible) next[item.id] = !allExpanded;
    setOverrides(next);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Corrections</p>
        <h2 className="text-2xl font-black tracking-tight">Review every question</h2>
      </div>

      {topics.length > 0 ? (
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Topics that cost you marks</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {topics.map(({ name, count }) => {
              const active = topic === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTopic(active ? null : name)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-amber-300/50 bg-amber-100/40 text-amber-900 hover:border-amber-400 dark:bg-amber-950/25 dark:text-amber-300",
                  )}
                >
                  {name} · {count}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {topic ? "Showing this topic only. Tap it again to clear." : "Tap a topic to see just those questions."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter corrections">
          {tabs.map(({ key, label, count }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={active}
                disabled={count === 0 && key !== "all"}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground hover:bg-secondary",
                )}
              >
                {label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                  active ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground",
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {visible.length > 0 ? (
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs font-bold text-primary hover:underline sm:self-auto"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 text-lg font-extrabold">
            {topic ? "Nothing here for this topic" : EMPTY_STATE[filter as Exclude<Filter, "all">].title}
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            {topic
              ? "Clear the topic filter or pick a different tab."
              : EMPTY_STATE[filter as Exclude<Filter, "all">].body}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <CorrectionCard
              key={item.id}
              item={item}
              expanded={overrides[item.id] ?? outcomeOf(item) !== "correct"}
              onToggle={() => setOverrides((current) => ({
                ...current,
                [item.id]: !(current[item.id] ?? outcomeOf(item) !== "correct"),
              }))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CorrectionCard({
  item,
  expanded,
  onToggle,
}: {
  item: ExamCorrectionItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const outcome = outcomeOf(item);
  const tone = {
    correct: { ring: "border-emerald-300/50 dark:border-emerald-800/50", chip: "bg-emerald-100/60 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
    wrong: { ring: "border-rose-300/50 dark:border-rose-800/50", chip: "bg-rose-100/60 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
    skipped: { ring: "border-amber-300/50 dark:border-amber-800/50", chip: "bg-amber-100/60 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" },
  }[outcome];

  const Icon = outcome === "correct" ? CheckCircle2 : outcome === "wrong" ? XCircle : AlertCircle;
  const label = outcome === "correct" ? "Correct" : outcome === "wrong" ? "Wrong" : "Skipped";

  return (
    <article className={cn("overflow-hidden rounded-3xl border bg-card shadow-sm transition", tone.ring)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-secondary/50 md:p-5"
      >
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-2xl", tone.chip)}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Question {item.position}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", tone.chip)}>
              {label}
            </span>
            {item.flagged ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                <Flag className="h-3 w-3" /> Flagged
              </span>
            ) : null}
            {item.sourceTopic ? (
              <span className="truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                {item.sourceTopic}
              </span>
            ) : null}
          </span>
          <span className={cn("mt-1.5 block font-bold leading-7", !expanded && "line-clamp-2")}>
            {item.prompt}
          </span>
        </span>
        <ChevronDown
          className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div className="border-t border-border px-4 pb-4 pt-4 md:px-5 md:pb-5">
          <div className="space-y-2">
            {item.options.map((option, index) => {
              const isCorrect = option.id === item.correctOptionId;
              const isSelected = option.id === item.selectedOptionId;
              return (
                <div
                  key={option.id}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm",
                    isCorrect
                      ? "border-emerald-300/50 bg-emerald-100/40 dark:bg-emerald-950/25"
                      : isSelected
                        ? "border-rose-300/50 bg-rose-100/40 dark:bg-rose-950/25"
                        : "border-border bg-background",
                  )}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-border bg-card text-xs font-black">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className={cn("pt-0.5 font-semibold", !isCorrect && !isSelected && "text-muted-foreground")}>
                    {option.text}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-2 pt-0.5">
                    {isSelected ? (
                      <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">You</span>
                    ) : null}
                    {isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : isSelected ? (
                      <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          {outcome === "skipped" ? (
            <p className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" /> You ran out of time or moved past this one.
            </p>
          ) : null}

          <div className="mt-4 rounded-2xl bg-secondary p-4">
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Explanation</p>
            <p className="mt-2 text-sm leading-6">
              {item.explanation || "Review this answer with your course material."}
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
