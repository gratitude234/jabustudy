import { ArrowUpRight, MessageCircle } from "lucide-react";

import { getExamSprintWhatsAppDestinationType } from "@/lib/examSprint/community";
import { cn } from "@/lib/utils";

export default function ExamCommunityCard({
  href,
  compact = false,
  className,
}: {
  href: string | null;
  compact?: boolean;
  className?: string;
}) {
  if (!href) return null;
  const destinationType = getExamSprintWhatsAppDestinationType(href);
  const isChannel = destinationType === "channel";

  return (
    <section
      className={cn(
        "rounded-2xl border border-emerald-200/70 bg-card dark:border-emerald-900/50",
        compact ? "p-3.5" : "p-4 sm:p-5",
        className,
      )}
      aria-label={isChannel ? "Exam Sprint WhatsApp channel" : "Exam Sprint WhatsApp community"}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">
            {isChannel ? "WhatsApp updates" : "Gratitude Builds community"}
          </p>
          <h2 className={cn("mt-0.5 font-extrabold leading-snug", compact ? "text-[13px]" : "text-sm")}>
            {compact
              ? "Exam Sprint updates on WhatsApp"
              : isChannel
                ? "Never miss an Exam Sprint update"
                : "Don’t miss new Exam Sprint updates"}
          </h2>
          <p className={cn("mt-1 text-muted-foreground", compact ? "text-[11px] leading-4" : "text-xs leading-5")}>
            {isChannel
              ? "New question banks, course availability, exam dates and important announcements from Gratitude Builds."
              : "New courses, question banks and important Exam Sprint updates — without interrupting your practice."}
          </p>
        </div>
      </div>

      <div className={cn("flex items-center", compact ? "mt-2.5 justify-between gap-3 pl-12" : "mt-3 gap-3 pl-12")}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[11px] font-extrabold text-white no-underline transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
            !compact && "min-h-10 px-3.5 text-xs",
          )}
        >
          {isChannel ? "Follow WhatsApp channel" : "Join WhatsApp community"} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        {!compact ? <span className="hidden text-[10px] text-muted-foreground sm:inline">Powered by Gratitude Builds</span> : null}
      </div>
    </section>
  );
}
