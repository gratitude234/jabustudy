"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SortKey = "newest" | "price_asc" | "price_desc";

export default function ExploreSort() {
  const router = useRouter();
  const sp = useSearchParams();

  const sort = (sp.get("sort") as SortKey) || "newest";

  const nextBase = useMemo(() => {
    const copy = new URLSearchParams(sp.toString());
    return copy;
  }, [sp]);

  function setSort(next: SortKey) {
    const copy = new URLSearchParams(nextBase.toString());
    if (next === "newest") copy.delete("sort");
    else copy.set("sort", next);

    const qs = copy.toString();
    router.push(qs ? `/explore?${qs}` : "/explore");
  }

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
        className="rounded-xl border bg-white px-3 py-2 text-sm"
      >
        <option value="newest">Newest</option>
        <option value="price_asc">Price: Low → High</option>
        <option value="price_desc">Price: High → Low</option>
      </select>
    </label>
  );
}
