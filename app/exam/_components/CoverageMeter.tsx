import { cn } from "@/lib/utils";

/**
 * Shared bank-coverage readout. Both the course page and the result page describe
 * the same idea, so the wording lives here once rather than drifting between them.
 */
export default function CoverageMeter({
  delivered,
  bankTotal,
  complete,
  label = "Bank coverage",
  className,
  compact = false,
  showDescription = true,
}: {
  delivered: number;
  bankTotal: number;
  complete: boolean;
  label?: string;
  className?: string;
  compact?: boolean;
  showDescription?: boolean;
}) {
  const percent = bankTotal > 0 ? Math.round((delivered / bankTotal) * 100) : 0;
  const remaining = Math.max(0, bankTotal - delivered);

  return (
    <div className={cn(!compact && "rounded-2xl bg-secondary p-3", className)}>
      <div className={cn("flex items-center justify-between gap-3 font-bold", compact ? "text-[11px]" : "text-xs")}>
        <span>{label}: {delivered} of {bankTotal}</span>
        <span className="text-muted-foreground tabular-nums">{percent}%</span>
      </div>
      <div
        className={cn("mt-2 overflow-hidden rounded-full", compact ? "h-1.5 bg-secondary" : "h-2 bg-background")}
        role="img"
        aria-label={`${percent}% of this question bank covered`}
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      {showDescription ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {complete
            ? "Full bank covered. Your next mock focuses on unanswered, missed, flagged and older questions."
            : `${remaining} unseen question${remaining === 1 ? "" : "s"} remaining.`}
        </p>
      ) : null}
    </div>
  );
}
