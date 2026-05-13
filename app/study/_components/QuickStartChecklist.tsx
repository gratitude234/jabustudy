"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/studyAnalytics";
import { cn } from "@/lib/utils";

type QuickStartChecklistProps = {
  userId: string;
  hasPrefs: boolean;
};

type ChecklistCta =
  | "checklist_setup"
  | "checklist_first_set"
  | "checklist_material";

type FirstSetPickResponse = {
  ok: true;
  set: { id: string } | null;
};

type StepState = "done" | "active" | "upcoming";

function StepCircle({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F6E56] text-white">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (state === "active") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 rounded-full border-2 border-[#5B35D5] bg-[#CECBF6]/50" />
    );
  }

  return (
    <span className="inline-flex h-6 w-6 shrink-0 rounded-full border border-border" />
  );
}

export default function QuickStartChecklist({
  userId,
  hasPrefs,
}: QuickStartChecklistProps) {
  const router = useRouter();
  const viewedRef = useRef(false);
  const [bookmarkCount, setBookmarkCount] = useState<number>(0);
  const [bookmarksResolved, setBookmarksResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBookmarks() {
      try {
        const { count } = await supabase
          .from("study_saved_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("item_type", "material");

        if (!cancelled) setBookmarkCount(count ?? 0);
      } catch {
        if (!cancelled) setBookmarkCount(0);
      } finally {
        if (!cancelled) setBookmarksResolved(true);
      }
    }

    void loadBookmarks();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const bookmarksDone = bookmarkCount > 0;
  const stepsDone = (hasPrefs ? 1 : 0) + (bookmarksDone ? 1 : 0);

  useEffect(() => {
    if (!bookmarksResolved || viewedRef.current) return;
    viewedRef.current = true;
    track("study_home_quickstart_viewed", { steps_done: stepsDone });
  }, [bookmarksResolved, stepsDone]);

  const firstIncompleteIndex = useMemo(() => {
    if (!hasPrefs) return 0;
    if (!bookmarksDone) return 1;
    return 1;
  }, [bookmarksDone, hasPrefs]);

  async function handleFirstSetClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    track("study_home_day_one_cta_tapped", { cta: "checklist_first_set" });

    try {
      const response = await fetch("/api/study/first-set-pick", {
        credentials: "same-origin",
      });
      const payload = (await response.json()) as FirstSetPickResponse | { ok: false };
      if (payload && "ok" in payload && payload.ok && payload.set?.id) {
        router.push(`/study/practice/${encodeURIComponent(payload.set.id)}`);
        return;
      }
    } catch {
      // fall back below
    }

    router.push("/study/practice");
  }

  const steps: Array<{
    key: ChecklistCta;
    label: string;
    done: boolean;
    href?: string;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void | Promise<void>;
  }> = [
    {
      key: "checklist_setup",
      label: "Set up your department & level",
      done: hasPrefs,
      href: "/study/onboarding",
    },
    {
      key: "checklist_first_set",
      label: "Try your first practice set",
      done: false,
      href: "/study/practice",
      onClick: handleFirstSetClick,
    },
    {
      key: "checklist_material",
      label: "Bookmark or upload a material",
      done: bookmarksDone,
      href: "/study/library",
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-extrabold text-foreground">Quick start</p>
          <p className="text-xs text-muted-foreground">{stepsDone} of 3 done</p>
        </div>
      </div>

      <div className="divide-y divide-border">
        {steps.map((step, index) => {
          const state: StepState = step.done
            ? "done"
            : index === firstIncompleteIndex
            ? "active"
            : "upcoming";

          const content = (
            <>
              <StepCircle state={state} />
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  state === "done"
                    ? "line-through text-muted-foreground"
                    : state === "active"
                    ? "font-extrabold text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {state === "active" ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : null}
            </>
          );

          if (step.done || !step.href) {
            return (
              <div key={step.key} className="flex items-center gap-3 px-4 py-3">
                {content}
              </div>
            );
          }

          return (
            <Link
              key={step.key}
              href={step.href}
              onClick={(e) => {
                if (step.key === "checklist_setup") {
                  track("study_home_day_one_cta_tapped", { cta: "checklist_setup" });
                } else if (step.key === "checklist_material") {
                  track("study_home_day_one_cta_tapped", { cta: "checklist_material" });
                }

                void step.onClick?.(e);
              }}
              className="flex items-center gap-3 px-4 py-3 no-underline transition hover:bg-secondary/20"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
