"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function ExamChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Exam Sprint bypasses AppChrome, so the app's usual theme control in TopNav /
  // SidebarNav is out of reach here. Without this, a visitor carries whatever
  // theme they arrived with and cannot change it until they leave.
  const { resolvedTheme, setTheme } = useTheme();

  if (pathname.startsWith("/exam/attempt/")) {
    return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_right,rgba(91,53,213,0.16),transparent_36%),linear-gradient(to_bottom,#fafafa,#f4f4f5)] dark:bg-[radial-gradient(circle_at_top_right,rgba(124,92,255,0.18),transparent_36%),linear-gradient(to_bottom,#09090b,#18181b)]">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/exam" className="inline-flex items-center gap-2.5 no-underline">
            <Image src="/logo-icon.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
            <span>
              <span className="block text-sm font-black leading-none text-foreground">Exam Sprint</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">by JabuStudy</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-secondary"
              aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {resolvedTheme === "dark"
                ? <Sun className="h-4 w-4" aria-hidden="true" />
                : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
            <Link href="/study" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground no-underline hover:bg-secondary">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Study Hub
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-9">{children}</main>
    </div>
  );
}
