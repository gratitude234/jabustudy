// components/layout/MobileTopBar.tsx
"use client";

import Link from "next/link";
import { Search, Plus, X, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { usePostDraftBadge } from "@/hooks/usePostDraftBadge";

function buildNextUrl(pathname: string, sp: URLSearchParams, nextQ: string) {
  const copy = new URLSearchParams(sp.toString());
  const q = nextQ.trim();

  if (q) copy.set("q", q);
  else copy.delete("q");

  const qs = copy.toString();

  // ✅ On Home, redirect to /explore ONLY when user is searching
  if (pathname === "/") return q ? `/explore?q=${encodeURIComponent(q)}` : "/";

  // ✅ On Study routes, redirect to /study/library when searching
  if (pathname.startsWith("/study")) {
    if (pathname.startsWith("/study/library")) return qs ? `/study/library?${qs}` : "/study/library";
    return q ? `/study/library?q=${encodeURIComponent(q)}` : pathname;
  }

  return qs ? `${pathname}?${qs}` : pathname;
}

export default function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const hasPostDraft = usePostDraftBadge();

  const isConversationPage = /^\/inbox\/[^/]+$/.test(pathname);

  // True for any /study/* route
  const isStudyRoute = pathname.startsWith("/study");

  // True only when inside an active practice set session — NOT the practice home page.
  // Pattern: /study/practice/[setId] (has a segment after /practice/)
  const isPracticeSession = /^\/study\/practice\/[^/]+/.test(pathname);

  const showSearch =
    // Home has its own search bar in the hero — don't duplicate it here
    (pathname !== "/") &&
    (pathname.startsWith("/explore") || pathname.startsWith("/vendors") || pathname.startsWith("/study"));

  // ── All hooks must run unconditionally before any early return ──────────────
  const initialQ = useMemo(() => sp.get("q") ?? "", [sp]);
  const [q, setQ] = useState(initialQ);

  // keep input in sync when user navigates back/forward
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(initialQ);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialQ]);

  // ✅ debounced navigation (replace, not push)
  useEffect(() => {
    if (!showSearch) return;

    const t = setTimeout(() => {
      const nextUrl = buildNextUrl(pathname, new URLSearchParams(sp.toString()), q);

      if (pathname === "/") {
        const shouldBeExplore = q.trim().length > 0;
        if (!shouldBeExplore) return; // stay on "/" when not searching
      } else {
        const current = sp.toString();
        const nextSp = nextUrl.includes("?") ? nextUrl.split("?")[1] : "";
        if (current === nextSp) return;
      }

      router.replace(nextUrl);
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pathname, showSearch]);

  // ── Early return AFTER all hooks ────────────────────────────────────────────
  // Conversation pages are full-screen — they have their own header
  if (isConversationPage) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextUrl = buildNextUrl(pathname, new URLSearchParams(sp.toString()), q);
    router.push(nextUrl);
  }

  function clear() {
    setQ("");
    const nextUrl = buildNextUrl(pathname, new URLSearchParams(sp.toString()), "");
    router.replace(nextUrl);
  }

  return (
    <header className="md:hidden sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {isStudyRoute ? (
            <Link
              href="/study"
              className="inline-flex items-center gap-2 no-underline focus-visible:outline-none"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#5B35D5]" />
              <span className="font-bold text-lg text-foreground">Study Hub</span>
            </Link>
          ) : (
            <Link href="/" className="font-bold text-lg no-underline">
              Jabumarket
            </Link>
          )}

          <div className="flex items-center gap-2">
            <NotificationBell />
            {isStudyRoute ? (
              <Link
                href="/study/materials/upload"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-[#5B35D5]/20 bg-[#EEEDFE] px-3 py-1.5 no-underline",
                  "text-sm font-semibold text-[#5B35D5]",
                  "hover:bg-[#5B35D5]/10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
                )}
              >
                <UploadCloud className="h-4 w-4" />
                Upload
              </Link>
            ) : (
              <Link href="/post" className="btn-primary relative">
                <Plus className="h-4 w-4" />
                Post
                {hasPostDraft ? (
                  <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
                ) : null}
              </Link>
            )}
          </div>
        </div>

        {showSearch && !isPracticeSession && (
          <form onSubmit={onSubmit} className="mt-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={pathname.startsWith("/study") ? "Search materials, courses..." : "Search products & services..."}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />

              {/* ✅ Clear (shows only when typing) */}
              {q.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-md p-1 hover:bg-secondary"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </header>
  );
}
