"use client";
// components/studyAdmin/StudyAdminShell.tsx
import { cn } from "@/lib/utils";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, FileText, Inbox, LayoutDashboard, UserCheck2, Upload, History, BookOpen, ListChecks } from "lucide-react";
import type React from "react";

function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition",
        active ? "bg-black text-white" : "text-zinc-700 hover:bg-black/5"
      )}
    >
      <span className={cn("h-4 w-4", active ? "text-white" : "text-zinc-600")}>{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

export default function StudyAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-black text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Study Admin</p>
              <p className="text-xs text-zinc-500">Moderate uploads & course requests</p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 sm:flex">
            <NavItem href="/study-admin" label="Dashboard" icon={<LayoutDashboard className="h-4 w-4" />} />
            <NavItem href="/study-admin/materials" label="Materials" icon={<FileText className="h-4 w-4" />} />
            <NavItem href="/study-admin/requests" label="Requests" icon={<Inbox className="h-4 w-4" />} />
            <NavItem
              href="/study-admin/rep-applications"
              label="Rep Apps"
              icon={<UserCheck2 className="h-4 w-4" />}
            />
            <NavItem href="/study-admin/upload" label="Upload Materials" icon={<Upload className="h-4 w-4" />} />
            <NavItem href="/study-admin/history" label="History" icon={<History className="h-4 w-4" />} />
            <NavItem href="/study-admin/courses" label="Courses" icon={<BookOpen className="h-4 w-4" />} />
            <NavItem href="/study-admin/question-quality" label="Question Quality" icon={<ListChecks className="h-4 w-4" />} />
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/study"
              className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-black/5"
            >
              Back to Study
            </Link>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
            <NavItem href="/study-admin" label="Dashboard" icon={<LayoutDashboard className="h-4 w-4" />} />
            <NavItem href="/study-admin/materials" label="Materials" icon={<FileText className="h-4 w-4" />} />
            <NavItem href="/study-admin/requests" label="Requests" icon={<Inbox className="h-4 w-4" />} />
            <NavItem
              href="/study-admin/rep-applications"
              label="Rep Apps"
              icon={<UserCheck2 className="h-4 w-4" />}
            />
            <NavItem href="/study-admin/upload" label="Upload" icon={<Upload className="h-4 w-4" />} />
            <NavItem href="/study-admin/history" label="History" icon={<History className="h-4 w-4" />} />
            <NavItem href="/study-admin/courses" label="Courses" icon={<BookOpen className="h-4 w-4" />} />
            <NavItem href="/study-admin/question-quality" label="Quality" icon={<ListChecks className="h-4 w-4" />} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
