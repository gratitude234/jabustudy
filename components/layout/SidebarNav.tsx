"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calculator,
  Home,
  MessageCircleQuestion,
  Moon,
  Sun,
  SunMoon,
  UploadCloud,
  UserRound,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  match: "exact" | "prefix";
};

const NAV_ITEMS: NavItem[] = [
  { href: "/study",          label: "Home",     icon: Home,                  match: "exact" },
  { href: "/study/library",  label: "Library",  icon: BookOpen,              match: "prefix" },
  { href: "/study/practice", label: "Practice", icon: Zap,                   match: "prefix" },
  { href: "/study/questions",label: "Q&A",      icon: MessageCircleQuestion, match: "prefix" },
  { href: "/study/me",       label: "Profile",  icon: UserRound,             match: "exact" },
];

const TOOL_ITEMS: NavItem[] = [
  { href: "/study/gpa", label: "GPA Tools", icon: Calculator, match: "prefix" },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/study/library" && /^\/study\/materials\/[^/]+$/.test(pathname)) return true;
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export default function SidebarNav() {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (!pathname.startsWith("/study") || pathname.startsWith("/study-admin")) return null;

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[220px] flex-col border-r border-border bg-card md:flex">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4 lg:h-16">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
        <Link href="/study" className="font-[family-name:var(--font-bricolage)] text-base font-extrabold text-foreground no-underline">
          Jabu Study
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1 px-3 pt-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm no-underline transition-colors",
                active
                  ? "bg-primary-light font-semibold text-primary-text"
                  : "font-medium text-muted-brand hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Tools section */}
      <div className="mt-4 border-t border-border px-3 pt-4">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-brand/70">
          Tools
        </p>
        <nav className="flex flex-col gap-1">
          {TOOL_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm no-underline transition-colors",
                  active
                    ? "bg-primary-light font-semibold text-primary-text"
                    : "font-medium text-muted-brand hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom actions */}
      <div className="mt-auto border-t border-border p-4 space-y-2">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
          aria-label={`Switch theme (currently ${theme})`}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-brand transition hover:bg-secondary/60 hover:text-foreground"
        >
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4 shrink-0" />
          ) : theme === "system" ? (
            <SunMoon className="h-4 w-4 shrink-0" />
          ) : (
            <Sun className="h-4 w-4 shrink-0" />
          )}
          <span>{theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System"}</span>
        </button>

        <Link
          href="/study/materials/upload"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white no-underline transition hover:opacity-90"
        >
          <UploadCloud className="h-4 w-4" />
          Upload material
        </Link>
      </div>
    </aside>
  );
}
