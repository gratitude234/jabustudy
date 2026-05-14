"use client";

import Link from "next/link";
import { Search, UploadCloud, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import NotificationBell from "@/components/notifications/NotificationBell";

function buildNextUrl(pathname: string, sp: URLSearchParams, nextQ: string) {
  const copy = new URLSearchParams(sp.toString());
  const q = nextQ.trim();

  if (q) copy.set("q", q);
  else copy.delete("q");

  const qs = copy.toString();
  if (pathname.startsWith("/study/library")) return qs ? `/study/library?${qs}` : "/study/library";
  return q ? `/study/library?q=${encodeURIComponent(q)}` : pathname;
}

export default function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const isPracticeSession = /^\/study\/practice\/[^/]+/.test(pathname);
  const showSearch = pathname.startsWith("/study") && !isPracticeSession;

  const initialQ = useMemo(() => sp.get("q") ?? "", [sp]);
  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(initialQ);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialQ]);

  useEffect(() => {
    if (!showSearch) return;

    const t = setTimeout(() => {
      const nextUrl = buildNextUrl(pathname, new URLSearchParams(sp.toString()), q);
      const current = sp.toString();
      const nextSp = nextUrl.includes("?") ? nextUrl.split("?")[1] : "";
      if (current === nextSp) return;
      router.replace(nextUrl);
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pathname, showSearch]);

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
          <Link href="/study" className="inline-flex items-center gap-2 no-underline focus-visible:outline-none">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#5B35D5]" />
            <span className="font-bold text-lg text-foreground">Jabu Study</span>
          </Link>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link
              href="/study/materials/upload"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#5B35D5]/20 bg-[#EEEDFE] px-3 py-1.5 text-sm font-semibold text-[#5B35D5] no-underline hover:bg-[#5B35D5]/10"
            >
              <UploadCloud className="h-4 w-4" />
              Upload
            </Link>
          </div>
        </div>

        {showSearch && (
          <form onSubmit={onSubmit} className="mt-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search materials, courses..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
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
