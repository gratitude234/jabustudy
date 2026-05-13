"use client";

/**
 * Thin progress bar for the Explore page.
 *
 * Problem: there's a ~100-300ms gap between the user tapping a filter link
 * and Next.js showing loading.tsx. During that gap the page looks frozen.
 *
 * Solution: listen for clicks on any <a> tag inside the explore layout.
 * The moment one fires we show an indeterminate progress bar at the top.
 * When useSearchParams() reports a new value (navigation settled) we hide it.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";

export default function ExploreNavProgress() {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const searchParams = useSearchParams();
  const pathname = usePathname();

  // When either changes, navigation is complete — hide bar.
  useEffect(() => {
    setVisible(false);
    setWidth(0);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [searchParams, pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      // Only trigger for explore filter navigations (same-page URL changes).
      if (!href.startsWith("/explore")) return;

      // Ignore right-click / modifier-key combos (those open new tabs).
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;

      startProgress();
    }

    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function startProgress() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    setVisible(true);
    setWidth(0);

    // Animate from 0 → 85% quickly, then crawl — gives "loading" feel without knowing real duration.
    let current = 0;
    function tick() {
      current = current < 30 ? current + 4
               : current < 60 ? current + 2
               : current < 80 ? current + 0.8
               : current < 85 ? current + 0.2
               : current; // stall at 85% until navigation completes
      setWidth(current);
      if (current < 85) {
        timerRef.current = setTimeout(() => {
          rafRef.current = requestAnimationFrame(tick);
        }, 30);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 h-[3px] w-full"
    >
      <div
        className="h-full bg-zinc-900 transition-[width] duration-75 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}