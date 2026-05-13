// components/layout/TopNav.tsx
"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import NotificationBell from "@/components/notifications/NotificationBell";
import InboxNavIcon from "@/components/layout/InboxNavIcon";
import { useNavContext } from "@/contexts/NavContext";
import { usePostDraftBadge } from "@/hooks/usePostDraftBadge";

const links = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/food", label: "Food" },
];

function buildNextUrl(pathname: string, sp: URLSearchParams, nextQ: string) {
  const q = nextQ.trim();

  // ✅ Special routing rules:
  // - Home search goes to Explore
  if (pathname === "/") return q ? `/explore?q=${encodeURIComponent(q)}` : "/";

  // - Anywhere in /study: route search to /study/library
  if (pathname.startsWith("/study")) {
    // keep you on library if you’re already there
    if (pathname.startsWith("/study/library")) {
      const copy = new URLSearchParams(sp.toString());
      if (q) copy.set("q", q);
      else copy.delete("q");
      const qs = copy.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    }

    // otherwise: only send to library when the user is actually searching.
    // If the query is empty, DO NOT redirect away from the current /study page.
    // (TopNav is hidden on mobile but still runs its effects; forcing /study -> /study/library breaks the Study homepage.)
    return q ? `/study/library?q=${encodeURIComponent(q)}` : pathname;
  }

  // default: update q on current route
  const copy = new URLSearchParams(sp.toString());
  if (q) copy.set("q", q);
  else copy.delete("q");
  const qs = copy.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function currentUrl(pathname: string, sp: URLSearchParams) {
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const { isVendor } = useNavContext();
  const hasPostDraft = usePostDraftBadge();

  const showSearch =
    pathname === "/" ||
    pathname.startsWith("/explore") ||
    pathname.startsWith("/vendors") ||
    pathname.startsWith("/study");

  const initialQ = useMemo(() => sp.get("q") ?? "", [sp]);
  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(initialQ);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialQ]);

  // ✅ debounced replace
  useEffect(() => {
    if (!showSearch) return;

    const t = setTimeout(() => {
      const spCopy = new URLSearchParams(sp.toString());
      const nextUrl = buildNextUrl(pathname, spCopy, q);

      const cur = currentUrl(pathname, new URLSearchParams(sp.toString()));
      if (nextUrl === cur) return;

      router.replace(nextUrl);
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pathname, showSearch]);

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
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 lg:max-w-7xl lg:px-8 h-14 lg:h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold text-lg lg:text-xl no-underline">
          Jabumarket
        </Link>

        <nav className="flex items-center gap-5 lg:gap-7 text-sm">
          {links.map((l) => {
            const active = pathname === l.href;
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
          {isVendor && (
            <Link
              href="/vendor"
              className={
                pathname.startsWith('/vendor')
                  ? "font-semibold no-underline text-foreground"
                  : "text-muted-foreground hover:text-foreground no-underline"
              }
            >
              My Store
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {showSearch ? (
            <form onSubmit={onSubmit} className="hidden lg:block">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={
                    pathname.startsWith("/vendors")
                      ? "Search vendors..."
                      : pathname.startsWith("/study")
                        ? "Search materials..."
                        : "Search listings..."
                  }
                  className="w-64 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                />

                {/* ✅ Clear */}
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
          ) : null}

          <Link href="/post" className="btn-primary relative">
            Post Listing
            {hasPostDraft ? (
              <span className="absolute right-2 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
            ) : null}
          </Link>

          <InboxNavIcon />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
