"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Called when the user dismisses the drawer (backdrop click, Escape key, close button) */
  onClose: () => void;
  /** Accessible label shown in the header and used as aria-label */
  title: string;
  /** Main scrollable content */
  children: React.ReactNode;
  /** Optional sticky footer (e.g. apply/reset buttons) */
  footer?: React.ReactNode;
}

/**
 * Shared bottom-sheet Drawer.
 *
 * Replaces the copy-pasted Drawer implementations in:
 *   - app/study/history/HistoryClient.tsx
 *   - app/study/questions/QuestionsClient.tsx
 *
 * Features:
 *   - Smooth slide-up / fade transition
 *   - Locks body scroll while open
 *   - Closes on Escape key
 *   - Auto-focuses the first interactive element inside the panel
 *   - Full aria-modal semantics
 */
export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Close on Escape
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    // Focus first interactive element inside the panel
    const focusTimer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        )
        ?.focus();
    }, 50);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  return (
    // Outer overlay — fades in/out
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-200",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel — slides up/down */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl border border-border bg-card shadow-xl",
          "transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 shrink-0">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-2xl border border-border bg-background",
              "text-muted-foreground hover:bg-secondary/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {children}
        </div>

        {/* Optional footer */}
        {footer && (
          <div className="shrink-0 border-t border-border px-4 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}