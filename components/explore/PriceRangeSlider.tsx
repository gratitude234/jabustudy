"use client";
// components/explore/PriceRangeSlider.tsx
//
// Dual-handle range slider for filtering listings by price.
// Preset chips let users jump to common ranges in one tap.
// Navigates immediately on handle release (mouseup / touchend).
// Falls through gracefully if router is unavailable.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Upper bound for the slider — anything above this reads as "₦300k+" */
const SLIDER_CEIL = 300_000;
const STEP = 1_000;

const PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Any",        min: null,    max: null    },
  { label: "< ₦5k",     min: 0,       max: 5_000   },
  { label: "₦5k–20k",   min: 5_000,   max: 20_000  },
  { label: "₦20k–50k",  min: 20_000,  max: 50_000  },
  { label: "₦50k–150k", min: 50_000,  max: 150_000 },
  { label: "₦150k+",    min: 150_000, max: null     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFull(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function toPercent(val: number) {
  return (Math.min(Math.max(val, 0), SLIDER_CEIL) / SLIDER_CEIL) * 100;
}

/** Append min_price / max_price to a base href, stripping them if at boundaries. */
function buildPriceHref(baseHref: string, min: number, max: number): string {
  // baseHref already has other filters — just splice in the price params
  const hasQuery = baseHref.includes("?");
  const [path, qs] = baseHref.split("?");
  const params = new URLSearchParams(qs ?? "");

  if (min > 0) params.set("min_price", String(min));
  else params.delete("min_price");

  if (max < SLIDER_CEIL) params.set("max_price", String(max));
  else params.delete("max_price");

  params.delete("page"); // reset to page 1 on filter change

  const newQs = params.toString();
  return newQs ? `${path}?${newQs}` : path;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PriceRangeSlider({
  currentMin,
  currentMax,
  baseHref,
}: {
  /** Current min_price from URL params (null = no lower bound) */
  currentMin: number | null;
  /** Current max_price from URL params (null = no upper bound) */
  currentMax: number | null;
  /** Explore href with min_price / max_price stripped — other filters preserved */
  baseHref: string;
}) {
  const router = useRouter();

  // Local slider state (updated while dragging; navigated on release)
  const [minVal, setMinVal] = useState(currentMin ?? 0);
  const [maxVal, setMaxVal] = useState(currentMax ?? SLIDER_CEIL);

  // Sync when URL params change from external navigation (back button, etc.)
  useEffect(() => {
    setMinVal(currentMin ?? 0);
    setMaxVal(currentMax ?? SLIDER_CEIL);
  }, [currentMin, currentMax]);

  const navigate = useCallback(
    (min: number, max: number) => {
      router.push(buildPriceHref(baseHref, min, max));
    },
    [baseHref, router]
  );

  function applyPreset(min: number | null, max: number | null) {
    const resolvedMin = min ?? 0;
    const resolvedMax = max ?? SLIDER_CEIL;
    setMinVal(resolvedMin);
    setMaxVal(resolvedMax);
    navigate(resolvedMin, resolvedMax);
  }

  // Detect which preset (if any) matches the current slider values
  const activePresetLabel = PRESETS.find((p) => {
    return (p.min ?? 0) === minVal && (p.max ?? SLIDER_CEIL) === maxVal;
  })?.label;

  const minPct = toPercent(minVal);
  const maxPct = toPercent(maxVal);

  const hasActiveFilter =
    (currentMin !== null && currentMin > 0) ||
    (currentMax !== null && currentMax < SLIDER_CEIL);

  return (
    <div className="space-y-3">
      {/* ── Preset chips ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const isActive = activePresetLabel === p.label;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.min, p.max)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── Dual-handle slider ──────────────────────────────────────────── */}
      <div className="space-y-2 pt-1">
        {/*
          Track + two stacked <input type="range"> elements.
          The inputs are positioned absolutely and made transparent so only
          their thumbs are interactive; a visual track + fill div sits beneath.
          pointer-events: none on the input element, all on the ::-webkit-slider-thumb.
        */}
        <style>{`
          .jm-range {
            -webkit-appearance: none;
            appearance: none;
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            pointer-events: none;
            margin: 0;
          }
          .jm-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            pointer-events: all;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #fff;
            border: 2px solid #18181b;
            box-shadow: 0 1px 3px rgba(0,0,0,0.18);
            cursor: grab;
            margin-top: -7px;
          }
          .jm-range::-webkit-slider-thumb:active { cursor: grabbing; }
          .jm-range::-webkit-slider-runnable-track {
            height: 4px;
            background: transparent;
          }
          .jm-range::-moz-range-thumb {
            pointer-events: all;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #fff;
            border: 2px solid #18181b;
            box-shadow: 0 1px 3px rgba(0,0,0,0.18);
            cursor: grab;
          }
          .jm-range::-moz-range-track { background: transparent; }
        `}</style>

        {/* Track container */}
        <div className="relative h-4 w-full" aria-hidden="true">
          {/* Background track */}
          <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-zinc-200" />

          {/* Filled range between handles */}
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-900"
            style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
          />

          {/* Min handle */}
          <input
            type="range"
            className="jm-range"
            min={0}
            max={SLIDER_CEIL}
            step={STEP}
            value={minVal}
            aria-label="Minimum price"
            onChange={(e) => {
              const v = Math.min(Number(e.target.value), maxVal - STEP);
              setMinVal(v);
            }}
            onMouseUp={() => navigate(minVal, maxVal)}
            onTouchEnd={() => navigate(minVal, maxVal)}
            style={{ zIndex: minVal >= SLIDER_CEIL - STEP ? 5 : 3 }}
          />

          {/* Max handle */}
          <input
            type="range"
            className="jm-range"
            min={0}
            max={SLIDER_CEIL}
            step={STEP}
            value={maxVal}
            aria-label="Maximum price"
            onChange={(e) => {
              const v = Math.max(Number(e.target.value), minVal + STEP);
              setMaxVal(v);
            }}
            onMouseUp={() => navigate(minVal, maxVal)}
            onTouchEnd={() => navigate(minVal, maxVal)}
            style={{ zIndex: 4 }}
          />
        </div>

        {/* Current value labels */}
        <div className="flex items-center justify-between text-xs">
          <span className={cn("font-medium", minVal > 0 ? "text-zinc-900" : "text-zinc-500")}>
            {minVal === 0 ? "₦0" : fmtFull(minVal)}
          </span>
          <span className={cn("font-medium", maxVal < SLIDER_CEIL ? "text-zinc-900" : "text-zinc-500")}>
            {maxVal >= SLIDER_CEIL ? "₦300k+" : fmtFull(maxVal)}
          </span>
        </div>
      </div>

      {/* Clear link — only shown when a non-default range is active */}
      {hasActiveFilter ? (
        <button
          type="button"
          onClick={() => applyPreset(null, null)}
          className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
        >
          Clear price range
        </button>
      ) : null}
    </div>
  );
}