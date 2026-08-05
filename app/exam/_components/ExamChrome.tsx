"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function ExamChrome({
  children,
  examOnlyMode = false,
}: {
  children: React.ReactNode;
  examOnlyMode?: boolean;
}) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  if (pathname.startsWith("/exam/attempt/")) {
    return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-[#f8f7fc] dark:bg-[#0d0a18]">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-[3.75rem] w-full max-w-5xl items-center justify-between px-4 md:px-6">
          <Link href="/exam" className="inline-flex items-center gap-2.5 no-underline">
            <Image src="/logo-icon.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" priority />
            <span>
              <span className="block text-sm font-black leading-none text-foreground">Exam Sprint</span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">by JabuStudy</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-foreground transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {resolvedTheme === "dark"
                ? <Sun className="h-4 w-4" aria-hidden="true" />
                : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
            {!examOnlyMode ? (
              <Link href="/study" aria-label="Back to Study Hub" className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-[11px] font-bold text-foreground no-underline transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary sm:px-3 sm:text-xs">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Study Hub</span>
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-4 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
