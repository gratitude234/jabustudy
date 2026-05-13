"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getRecentSearches(): string[] {
  try {
    return (JSON.parse(localStorage.getItem("jm_recent_searches") ?? "[]") as string[]).slice(0, 4);
  } catch {
    return [];
  }
}

export function addRecentSearch(q: string) {
  try {
    const prev = getRecentSearches().filter((s) => s !== q);
    localStorage.setItem("jm_recent_searches", JSON.stringify([q, ...prev].slice(0, 6)));
  } catch {}
}

type ActiveFilters = {
  q?: string;
  type?: string;
  category?: string;
  condition?: string;
  sort?: string;
  sold?: string;
  inactive?: string;
  negotiable?: string;
  min_price?: string;
  max_price?: string;
};

function buildExploreHref(params: ActiveFilters & { q?: string }) {
  const sp = new URLSearchParams();
  const q = (params.q ?? "").trim();
  const type = (params.type ?? "all").trim();
  const category = (params.category ?? "all").trim();
  const sort = (params.sort ?? "smart").trim();
  if (q) sp.set("q", q);
  if (type && type !== "all") sp.set("type", type);
  if (category && category !== "all") sp.set("category", category);
  if (sort && sort !== "smart") sp.set("sort", sort);
  if (params.condition) sp.set("condition", params.condition);
  if (params.sold === "1") sp.set("sold", "1");
  if (params.inactive === "1") sp.set("inactive", "1");
  if (params.negotiable === "1") sp.set("negotiable", "1");
  if (params.min_price) sp.set("min_price", params.min_price);
  if (params.max_price) sp.set("max_price", params.max_price);
  const qs = sp.toString();
  return `/explore${qs ? `?${qs}` : ""}`;
}

export default function RecentSearchesBar({
  q,
  activeFilters,
}: {
  q: string;
  activeFilters: ActiveFilters;
}) {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (q) {
      addRecentSearch(q);
    } else {
      setRecent(getRecentSearches());
    }
  }, [q]);

  if (q || recent.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-400">Recent:</span>
      {recent.map((s) => (
        <Link
          key={s}
          href={buildExploreHref({ ...activeFilters, q: s })}
          className="rounded-full border bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 no-underline"
        >
          {s}
        </Link>
      ))}
    </div>
  );
}