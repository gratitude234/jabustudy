"use client";

import { useState, useEffect, useRef } from "react";
import { SlidersHorizontal, X } from "lucide-react";

/**
 * Wraps the mobile filter panel in a real open/close state so:
 * - Tapping any filter link (which triggers a navigation) closes the sheet.
 * - There's an explicit close (×) button.
 * - No more "tap the button again to close" instructions.
 */
export default function MobileFilterSheet({
  children,
  hasActiveFilters,
}: {
  children: React.ReactNode;
  /** When true the trigger button shows a small indicator dot. */
  hasActiveFilters?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on any navigation (link click inside the sheet).
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Close if the click was on an anchor tag (filter links / reset).
      if (target.closest("a")) {
        setOpen(false);
      }
    }

    sheet.addEventListener("click", handleClick);
    return () => sheet.removeEventListener("click", handleClick);
  }, [open]);

  // Close on Escape key.
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent body scroll while sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="relative shrink-0">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative inline-flex h-[52px] items-center gap-2 rounded-2xl border bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">Filters</span>
        <span className="sm:hidden">Filter</span>
        {hasActiveFilters && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-black" />
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sheet panel */}
      {open && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-label="Filters"
          className="absolute right-0 z-40 mt-2 w-[min(92vw,560px)] overflow-hidden rounded-3xl border bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">Filters</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-full border bg-white text-zinc-700 hover:bg-zinc-50"
              aria-label="Close filters"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70svh] overflow-y-auto p-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}