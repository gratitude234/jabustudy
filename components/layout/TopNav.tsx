"use client";

import Link from "next/link";
import { Search, UploadCloud, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import NotificationBell from "@/components/notifications/NotificationBell";

const links = [
  { href: "/study", label: "Home" },
  { href: "/study/library", label: "Library" },
  { href: "/study/practice", label: "Practice" },
  { href: "/study/questions", label: "Q&A" },
];

function buildNextUrl(pathname: string, sp: URLSearchParams, nextQ: string) {
  const q = nextQ.trim();

  if (pathname.startsWith("/study/library")) {
    const copy = new URLSearchParams(sp.toString());
    if (q) copy.set("q", q);
    else copy.delete("q");
    const qs = copy.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return q ? `/study/library?q=${encodeURIComponent(q)}` : pathname;
}

function currentUrl(pathname: string, sp: URLSearchParams) {
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const initialQ = useMemo(() => sp.get("q") ?? "", [sp]);
  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(initialQ);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      const nextUrl = buildNextUrl(pathname, new URLSearchParams(sp.toString()), q);
      const cur = currentUrl(pathname, new URLSearchParams(sp.toString()));
      if (nextUrl === cur) return;
      router.replace(nextUrl);
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pathname]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextUrl = buildNextUrl(pathname, new URLSearchParams(sp.toString()), q);
    const cur = currentUrl(pathname, new URLSearchParams(sp.toString()));
    if (nextUrl === cur) return;
    router.push(nextUrl);
  }

  function clear() {
    setQ("");
    const nextUrl = buildNextUrl(pathname, new URLSearchParams(sp.toString()), "");
    router.replace(nextUrl);
  }

  return (
    <header className="hidden md:block border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6 lg:h-16 lg:max-w-7xl lg:px-8">
        <Link href="/study" className="font-bold text-lg lg:text-xl no-underline">
          Jabu Study
        </Link>

        <nav className="flex items-center gap-5 text-sm lg:gap-7">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/study" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  active
                    ? "font-semibold no-underline text-foreground"
                    : "text-muted-foreground hover:text-foreground no-underline"
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <form onSubmit={onSubmit} className="hidden lg:block">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search materials..."
                className="w-64 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
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

          <Link href="/study/materials/upload" className="btn-primary">
            <UploadCloud className="h-4 w-4" />
            Upload
          </Link>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
