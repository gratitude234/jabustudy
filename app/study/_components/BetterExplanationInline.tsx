"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type BetterExplanationOptionKey = "A" | "B" | "C" | "D";

export type BetterExplanationStudyRef = {
  chunkId?: string;
  topic?: string;
  instruction?: string;
  quote?: string;
  page?: number;
} | null | undefined;

export type BetterExplanation = {
  simpleAnswer: string;
  whyCorrect: string;
  whyChosenIsWrong?: string;
  optionBreakdown?: Array<{ option: BetterExplanationOptionKey; reason: string }>;
  sourceAnchor?: string;
  memoryTip?: string;
  examTip?: string;
};

type AiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; explanation: BetterExplanation; cached: boolean }
  | { status: "error"; message: string };

type FeedbackState = "helpful" | "not-helpful" | null;

type BetterExplanationInlineProps = {
  questionId?: string;
  questionPrompt: string;
  options: Record<BetterExplanationOptionKey, string>;
  chosenOptionKey: BetterExplanationOptionKey;
  chosenOptionText?: string | null;
  correctOptionKey: BetterExplanationOptionKey;
  correctOptionText?: string | null;
  isCorrect: boolean;
  basicExplanation?: string | null;
  studyRef?: BetterExplanationStudyRef;
  sourceTopic?: string | null;
};

function hasSourceContext(studyRef: BetterExplanationStudyRef, sourceTopic?: string | null) {
  return Boolean(studyRef?.quote || studyRef?.topic || studyRef?.page || sourceTopic);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/15 bg-background/70 px-3 py-2.5 dark:border-primary/20 dark:bg-background/30">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary-text/75 dark:text-indigo-300">
        {title}
      </p>
      <div className="mt-1 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  );
}

function normalizeError(json: unknown) {
  if (json && typeof json === "object" && "error" in json && typeof (json as { error?: unknown }).error === "string") {
    return (json as { error: string }).error;
  }
  return "Something went wrong.";
}

export function BetterExplanationInline({
  questionId,
  questionPrompt,
  options,
  chosenOptionKey,
  chosenOptionText,
  correctOptionKey,
  correctOptionText,
  isCorrect,
  basicExplanation,
  studyRef,
  sourceTopic,
}: BetterExplanationInlineProps) {
  const [state, setState] = useState<AiState>({ status: "idle" });
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const sourceAvailable = hasSourceContext(studyRef, sourceTopic);

  async function fetchExplanation() {
    setState({ status: "loading" });
    setFeedback(null);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          questionPrompt,
          options,
          chosenOptionKey,
          chosenOptionText: chosenOptionText ?? options[chosenOptionKey],
          correctOptionKey,
          correctOptionText: correctOptionText ?? options[correctOptionKey],
          isCorrect,
          basicExplanation,
          studyRef,
          sourceTopic,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.explanation) {
        setState({ status: "error", message: normalizeError(json) });
      } else {
        setState({ status: "done", explanation: json.explanation, cached: Boolean(json.cached) });
      }
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    }
  }

  if (state.status === "idle") {
    return (
      <button
        type="button"
        onClick={fetchExplanation}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all",
          "border-primary/20 bg-primary-light hover:bg-primary-light/80",
          "dark:border-primary/30 dark:bg-primary/10 dark:hover:bg-primary/15",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-indigo-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-primary-text dark:text-indigo-300">Explain better</p>
          <p className="text-[11px] text-primary/70 dark:text-primary/60">Source-backed breakdown powered by Gemini</p>
        </div>
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
      </button>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-light px-3 py-3 dark:border-primary/30 dark:bg-primary/10">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
        <div>
          <p className="text-xs font-extrabold text-primary-text dark:text-indigo-300">Building explanation</p>
          <p className="text-[11px] text-primary/70">Gemini is breaking the answer down</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-200/60 bg-rose-50/60 px-3 py-2.5 dark:border-rose-800/40 dark:bg-rose-950/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-rose-700 dark:text-rose-400">Could not generate explanation</p>
            <p className="mt-0.5 text-[11px] text-rose-600/80 dark:text-rose-300/80">{state.message}</p>
          </div>
          <button
            type="button"
            onClick={fetchExplanation}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
            aria-label="Retry better explanation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const explanation = state.explanation;

  return (
    <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary-light px-3 py-3 dark:border-primary/30 dark:bg-primary/10">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-indigo-300">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-extrabold text-primary-text dark:text-indigo-300">Better explanation</p>
        <span className="ml-auto text-[10px] font-semibold text-primary/60">Gemini - {state.cached ? "cached" : "generated"}</span>
      </div>

      <Section title="Simple answer">{explanation.simpleAnswer}</Section>
      <Section title="Why the correct answer is right">{explanation.whyCorrect}</Section>

      {!isCorrect && explanation.whyChosenIsWrong ? (
        <Section title="Why your answer is wrong">{explanation.whyChosenIsWrong}</Section>
      ) : null}

      {sourceAvailable && explanation.sourceAnchor ? (
        <Section title="Source from material">
          {explanation.sourceAnchor}
          {studyRef?.page ? <span className="ml-1 text-xs text-muted-foreground">Page {studyRef.page}</span> : null}
        </Section>
      ) : null}

      {explanation.optionBreakdown?.length ? (
        <Section title="Option breakdown">
          <div className="space-y-1.5">
            {explanation.optionBreakdown.map((item) => (
              <p key={item.option}>
                <span className="font-semibold text-primary-text dark:text-indigo-300">{item.option}.</span>{" "}
                {item.reason}
              </p>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2">
        {explanation.memoryTip ? <Section title="Memory tip">{explanation.memoryTip}</Section> : null}
        {explanation.examTip ? <Section title="Exam tip">{explanation.examTip}</Section> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/15 pt-2">
        <p className="text-[10px] text-muted-foreground">AI can make mistakes. Cross-check with your material or lecturer.</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFeedback("helpful")}
            className={cn(
              "inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[11px] font-semibold transition",
              feedback === "helpful"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-border bg-background text-muted-brand hover:bg-secondary/50"
            )}
          >
            {feedback === "helpful" ? <Check className="h-3 w-3" /> : <ThumbsUp className="h-3 w-3" />}
            Helpful
          </button>
          <button
            type="button"
            onClick={() => setFeedback("not-helpful")}
            className={cn(
              "inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[11px] font-semibold transition",
              feedback === "not-helpful"
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-border bg-background text-muted-brand hover:bg-secondary/50"
            )}
          >
            {feedback === "not-helpful" ? <Check className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
            Not helpful
          </button>
        </div>
      </div>
    </div>
  );
}
