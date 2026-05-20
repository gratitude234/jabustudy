"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Home,
  MessageCircleQuestion,
  UserRound,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { StudyPrefsProvider, useStudyPrefs } from "./StudyPrefsContext";

export type ContributorStatus =
  | "not_applied"
  | "pending"
  | "approved"
  | "rejected";

type Tab = {
  href: string;
  label: string;
  icon: ReactNode;
  match: "exact" | "prefix";
};

function isActive(pathname: string, tab: Pick<Tab, "href" | "match">) {
  if (tab.href === "/study/library" && /^\/study\/materials\/[^/]+$/.test(pathname)) {
    return true;
  }

  if (tab.match === "exact") return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(tab.href + "/");
}

function useStudyOnboardingBanner() {
  const { loading, isProfileComplete } = useStudyPrefs();
  return { shouldShowBanner: !loading && !isProfileComplete };
}

function StudyOnboardingBannerInner() {
  const { shouldShowBanner } = useStudyOnboardingBanner();
  if (!shouldShowBanner) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] px-4 py-3 dark:border-[#5B35D5]/30 dark:bg-[#5B35D5]/10">
      <p className="text-sm font-medium text-[#3B24A8] dark:text-indigo-200">
        Complete your study profile to get personalised content.
      </p>
      <Link
        href="/study/onboarding"
        className="shrink-0 rounded-xl bg-[#5B35D5] px-3 py-1.5 text-xs font-semibold text-white no-underline hover:bg-[#4526B8]"
      >
        Set up
      </Link>
    </div>
  );
}

function StudyOnboardingBanner() {
  return (
    <StudyPrefsProvider>
      <StudyOnboardingBannerInner />
    </StudyPrefsProvider>
  );
}

const DESKTOP_TABS: Tab[] = [
  {
    href: "/study",
    label: "Study",
    icon: <Home className="h-3.5 w-3.5" />,
    match: "exact",
  },
  {
    href: "/study/library",
    label: "Library",
    icon: <BookOpen className="h-3.5 w-3.5" />,
    match: "prefix",
  },
  {
    href: "/study/practice",
    label: "Practice",
    icon: <Zap className="h-3.5 w-3.5" />,
    match: "prefix",
  },
  {
    href: "/study/questions",
    label: "Q&A",
    icon: <MessageCircleQuestion className="h-3.5 w-3.5" />,
    match: "prefix",
  },
  {
    href: "/study/me",
    label: "Me",
    icon: <UserRound className="h-3.5 w-3.5" />,
    match: "exact",
  },
];

export default function StudyTabs({
  contributorStatus,
}: {
  contributorStatus?: ContributorStatus;
}) {
  void contributorStatus;
  const pathname = usePathname();

  return (
    <>
      <StudyOnboardingBanner />
      <nav
        aria-label="Study navigation"
        className="hidden"
      >
        <div className="px-2 py-2 md:px-4">
          <div className="items-center gap-1 md:flex">
            {DESKTOP_TABS.map((tab) => {
              const active = isActive(pathname, tab);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-all",
                    "leading-none select-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    active
                      ? "border-[#5B35D5]/30 bg-[#EEEDFE] text-[#5B35D5]"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
