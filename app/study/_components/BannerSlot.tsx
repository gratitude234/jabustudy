"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import {
  trackHomeBannerActioned,
  trackHomeBannerDismissed,
  trackHomeBannerViewed,
} from "@/lib/studyAnalytics";
import { cn } from "@/lib/utils";
import SetupNudge from "./SetupNudge";

export type ActiveBanner =
  | { kind: "exam_urgent"; daysLeft: number; semester: string }
  | { kind: "setup_nudge" }
  | {
      kind: "semester_mismatch";
      suggested: string;
      current: string | null;
      session: string;
    }
  | { kind: "exam_soon"; daysLeft: number; semester: string };

export type BannerSlotProps = {
  examCountdown: { daysLeft: number; semester: string } | null;
  hasPrefs: boolean;
  nudgeDismissed: boolean;
  semesterPrompt: {
    show: boolean;
    suggested: string | null;
    current: string | null;
    session: string | null;
  };
  switchingSemester: boolean;
  onDismissSemester: (session: string, suggested: string) => void;
  onApplySemester: () => void;
  onDismissSetupNudge: () => void;
};

export function resolveActiveBanner(props: BannerSlotProps): ActiveBanner | null {
  const { examCountdown, hasPrefs, nudgeDismissed, semesterPrompt } = props;

  if (examCountdown && examCountdown.daysLeft <= 7) {
    return {
      kind: "exam_urgent",
      daysLeft: examCountdown.daysLeft,
      semester: examCountdown.semester,
    };
  }

  if (!hasPrefs && !nudgeDismissed) {
    return { kind: "setup_nudge" };
  }

  if (
    semesterPrompt.show &&
    semesterPrompt.suggested &&
    semesterPrompt.session
  ) {
    return {
      kind: "semester_mismatch",
      suggested: semesterPrompt.suggested,
      current: semesterPrompt.current,
      session: semesterPrompt.session,
    };
  }

  if (
    examCountdown &&
    examCountdown.daysLeft >= 8 &&
    examCountdown.daysLeft <= 21
  ) {
    return {
      kind: "exam_soon",
      daysLeft: examCountdown.daysLeft,
      semester: examCountdown.semester,
    };
  }

  return null;
}

function markBannerSessionFlag(flag: string) {
  if (typeof window === "undefined") return false;
  window.__studyAnalyticsFlags ??= {};
  if (window.__studyAnalyticsFlags[flag]) return false;
  window.__studyAnalyticsFlags[flag] = true;
  return true;
}

export default function BannerSlot(props: BannerSlotProps) {
  const active = resolveActiveBanner(props);

  useEffect(() => {
    if (!active) return;
    if (!markBannerSessionFlag(`study_home_banner_viewed:${active.kind}`)) return;

    trackHomeBannerViewed(active.kind, {
      days_left: "daysLeft" in active ? active.daysLeft : undefined,
    });
  }, [active]);

  if (!active) return null;

  return (
    <div>
      {active.kind === "setup_nudge" ? (
        <SetupNudge
          onAction={() => trackHomeBannerActioned("setup_nudge")}
          onDismiss={() => {
            trackHomeBannerDismissed("setup_nudge");
            props.onDismissSetupNudge();
          }}
        />
      ) : active.kind === "semester_mismatch" ? (
        <div className="sticky top-[49px] z-20 -mx-4 flex items-center justify-between gap-3 border-b border-amber-200/60 bg-amber-50 px-4 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/40">
          <p className="text-xs font-semibold leading-snug text-amber-900 dark:text-amber-200">
            {active.suggested === "first"
              ? "It looks like it's First Semester."
              : active.suggested === "second"
              ? "It looks like it's Second Semester."
              : "It looks like it's Summer."}
            <span className="ml-1 font-normal opacity-80">
              {active.current
                ? `Switch from "${active.current}" to "${active.suggested}" for better results?`
                : `Set semester to "${active.suggested}" for better results?`}
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => {
                trackHomeBannerActioned("semester_mismatch");
                props.onApplySemester();
              }}
              disabled={props.switchingSemester}
              className="text-xs font-bold text-amber-900 underline underline-offset-2 disabled:opacity-50 dark:text-amber-200"
            >
              {props.switchingSemester ? "Switching…" : "Switch"}
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                trackHomeBannerDismissed("semester_mismatch");
                props.onDismissSemester(active.session, active.suggested);
              }}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <Link
          href="/study/practice"
          onClick={() =>
            trackHomeBannerActioned(active.kind, { days_left: active.daysLeft })
          }
          className={cn(
            "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 no-underline",
            active.kind === "exam_urgent"
              ? "border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/30"
              : "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30"
          )}
        >
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-extrabold",
                active.kind === "exam_urgent"
                  ? "text-red-900 dark:text-red-200"
                  : "text-amber-900 dark:text-amber-200"
              )}
            >
              {active.daysLeft <= 1
                ? "Exams start tomorrow!"
                : `Finals in ${active.daysLeft} days`}
            </p>
            <p
              className={cn(
                "text-xs",
                active.kind === "exam_urgent"
                  ? "text-red-700 dark:text-red-300"
                  : "text-amber-700 dark:text-amber-300"
              )}
            >
              Practice now to be ready — tap to start.
            </p>
          </div>
          <ArrowRight
            className={cn(
              "h-4 w-4 shrink-0",
              active.kind === "exam_urgent" ? "text-red-700" : "text-amber-700"
            )}
          />
        </Link>
      )}
    </div>
  );
}
