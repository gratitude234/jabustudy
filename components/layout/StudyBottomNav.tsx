"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Home,
  MessageCircleQuestion,
  UserRound,
  Zap,
} from "lucide-react";

type StudyNavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  match: "exact" | "prefix";
};

const STUDY_NAV_ITEMS: StudyNavItem[] = [
  { href: "/study", label: "Study", icon: Home, match: "exact" },
  { href: "/study/library", label: "Library", icon: BookOpen, match: "prefix" },
  { href: "/study/practice", label: "Practice", icon: Zap, match: "prefix" },
  { href: "/study/questions", label: "Q&A", icon: MessageCircleQuestion, match: "prefix" },
  { href: "/study/me", label: "Me", icon: UserRound, match: "exact" },
];

function isActive(pathname: string, item: StudyNavItem) {
  if (item.href === "/study/library" && /^\/study\/materials\/[^/]+$/.test(pathname)) {
    return true;
  }

  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function isImmersiveStudyRoute(pathname: string) {
  return (
    /^\/study\/materials\/upload/.test(pathname) ||
    /^\/study\/history\/[^/]+$/.test(pathname) ||
    /^\/study\/practice\/[^/]+$/.test(pathname) ||
    /^\/study\/questions\/[^/]+$/.test(pathname)
  );
}

export default function StudyBottomNav() {
  const pathname = usePathname();

  if (!pathname.startsWith("/study")) return null;
  if (isImmersiveStudyRoute(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#5B35D5]/15 bg-background/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden [[data-hide-nav=true]_&]:hidden">
      <div className="mx-auto max-w-6xl px-2">
        <div className="grid h-14 grid-cols-5">
          {STUDY_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center justify-center gap-1 text-xs no-underline transition-colors",
                  active ? "font-semibold text-[#5B35D5]" : "text-muted-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-7 w-9 place-items-center rounded-full transition-colors",
                    active ? "bg-[#EEEDFE]" : "bg-transparent",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
