"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";

export default function ExamChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/exam/attempt/")) {
    return <div className="min-h-dvh bg-zinc-950 text-zinc-50">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_right,rgba(91,53,213,0.16),transparent_36%),linear-gradient(to_bottom,#fafafa,#f4f4f5)] dark:bg-[radial-gradient(circle_at_top_right,rgba(124,92,255,0.18),transparent_36%),linear-gradient(to_bottom,#09090b,#18181b)]">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/exam" className="inline-flex items-center gap-2.5 no-underline">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-black leading-none text-foreground">Exam Sprint</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">by JabuStudy</span>
            </span>
          </Link>
          <Link href="/study" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground no-underline hover:bg-secondary">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Study Hub
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-9">{children}</main>
    </div>
  );
}
