"use client";

import { cn } from "@/lib/utils";

/**
 * Shared filter UI primitives for Study Hub filter drawers.
 *
 * Replaces copy-pasted implementations in:
 *   - app/study/history/HistoryClient.tsx   (Chip, SelectRow, ToggleRow)
 *   - app/study/questions/QuestionsClient.tsx (Chip, SelectRow, ToggleRow, IconButton)
 *
 * Usage:
 *   import { FilterChip, SelectRow, ToggleRow, IconButton } from "@/components/ui/study-filters";
 */

// ── FilterChip ────────────────────────────────────────────────────────────────

interface FilterChipProps {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  /** Native tooltip shown on hover */
  title?: string;
}

/**
 * Pill-shaped toggle chip used in filter bars and drawers.
 * Renders as an active (filled) or inactive (ghost) button.
 */
export function FilterChip({ active, children, onClick, title }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-border bg-secondary text-foreground"
          : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ── SelectRow ─────────────────────────────────────────────────────────────────

interface SelectRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  /**
   * Label for the empty/"all" option.
   * Defaults to "All". Pass `null` to omit the empty option entirely
   * (use this when the first option in `options` acts as the default).
   */
  placeholder?: string | null;
}

/**
 * A labelled `<select>` inside a rounded card, used inside filter drawers.
 */
export function SelectRow({ label, value, onChange, options, placeholder = "All" }: SelectRowProps) {
  return (
    <label className="block rounded-2xl border border-border bg-background p-3">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm text-foreground outline-none"
      >
        {placeholder !== null && (
          <option value="">{placeholder}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── ToggleRow ─────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  /** Optional sub-label shown below the main label */
  desc?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * A full-width toggle button styled as a card row, used inside filter drawers.
 * Shows a filled dot indicator when checked.
 */
export function ToggleRow({ label, desc, checked, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl border p-3 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked
          ? "border-border bg-secondary text-foreground"
          : "border-border/60 bg-background hover:bg-secondary/50"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {desc && (
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        )}
      </div>

      {/* Dot indicator */}
      <div
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
          checked ? "border-border" : "border-border/60"
        )}
      >
        {checked && (
          <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
        )}
      </div>
    </button>
  );
}

// ── IconButton ────────────────────────────────────────────────────────────────

interface IconButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  /** Accessible label (use when there is no visible text) */
  "aria-label"?: string;
  children: React.ReactNode;
}

/**
 * Square icon-only button with a rounded border.
 * Used for pagination arrows, close buttons, and action icons inside drawers.
 */
export function IconButton({
  onClick,
  disabled,
  title,
  "aria-label": ariaLabel,
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-2xl border border-border bg-background",
        "hover:bg-secondary/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      {children}
    </button>
  );
}