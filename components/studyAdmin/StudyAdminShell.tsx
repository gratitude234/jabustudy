"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck, FileText, Inbox, LayoutDashboard, UserCheck2,
  Upload, History, BookOpen, ListChecks, ArrowLeft, FileInput as ImportIcon,
  Banknote, Zap, Users,
} from "lucide-react";
import type React from "react";

const NAV_ITEMS = [
  { href: "/study-admin",                    label: "Dashboard",  icon: LayoutDashboard },
  { href: "/study-admin/users",              label: "Users",      icon: Users },
  { href: "/study-admin/materials",          label: "Materials",  icon: FileText },
  { href: "/study-admin/requests",           label: "Requests",   icon: Inbox },
  { href: "/study-admin/rep-applications",   label: "Rep Apps",   icon: UserCheck2 },
  { href: "/study-admin/upload",             label: "Upload",     icon: Upload },
  { href: "/study-admin/history",            label: "History",    icon: History },
  { href: "/study-admin/courses",            label: "Courses",    icon: BookOpen },
  { href: "/study-admin/billing",            label: "Billing",    icon: Banknote },
  { href: "/study-admin/quiz-sets",           label: "Quiz Sets",  icon: Zap },
  { href: "/study-admin/question-quality",   label: "Quality",    icon: ListChecks },
  { href: "/study-admin/import",             label: "Import",     icon: ImportIcon },
];

// ─── Desktop sidebar nav item ─────────────────────────────────────────────────

function SideNavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/study-admin" && pathname.startsWith(href + "/"));
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <span className={cn("h-4 w-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

// ─── Mobile nav chip ──────────────────────────────────────────────────────────

function MobileNavChip({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/study-admin" && pathname.startsWith(href + "/"));
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="h-3.5 w-3.5 shrink-0">{icon}</span>
      {label}
    </Link>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function StudyAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-card sticky top-0 h-dvh">
        {/* Brand */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-foreground">Study Admin</p>
            <p className="text-[10px] text-muted-foreground">Moderation panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <SideNavItem key={href} href={href} label={label} icon={<Icon className="h-4 w-4" />} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-3">
          <Link
            href="/study"
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back to Study
          </Link>
        </div>
      </aside>

      {/* ── Right column ── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Mobile header */}
        <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold text-foreground">Study Admin</p>
            </div>
            <Link
              href="/study"
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Study
            </Link>
          </div>

          {/* Scrollable nav chips */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <MobileNavChip key={href} href={href} label={label} icon={<Icon className="h-3.5 w-3.5" />} />
            ))}
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 md:px-6 md:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
