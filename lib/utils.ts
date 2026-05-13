import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ---------------------------------------------------------------------------
// Tailwind class merging (replaces local cn() in every Study file)
// ---------------------------------------------------------------------------
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// String helpers (replaces normalize() / normalizeQuery() duplicated across
// StudyHomeClient, MaterialsClient, OnboardingClient, QuestionsClient, etc.)
// ---------------------------------------------------------------------------

/** Trim + collapse internal whitespace. Safe for search terms and display. */
export function normalizeStr(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

/** Alias kept for backwards compat with files that used `normalizeQuery`. */
export const normalizeQuery = normalizeStr;

/**
 * Strips characters that cause unexpected LIKE behaviour in Supabase ilike
 * queries: %, _, backslash, quotes, brackets.
 */
export function safeSearchTerm(v: string): string {
  return normalizeStr(v)
    .replace(/[,%*()[\]{}]/g, " ")
    .replace(/["'`]/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// URL helpers (replaces buildHref() duplicated in MaterialsClient,
// QuestionsClient, PracticeHomeClient, etc.)
// ---------------------------------------------------------------------------

/**
 * Build a URL with only non-empty params.
 *
 * @example
 * buildHref("/study/materials", { q: "BCH 201", level: null })
 * // → "/study/materials?q=BCH+201"
 */
export function buildHref(
  path: string,
  params: Record<string, string | number | null | undefined>
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

// ---------------------------------------------------------------------------
// Date / time helpers (replaces formatWhen() / timeAgo() duplicated across
// MaterialsClient, PracticeHomeClient, QuestionsClient, LibraryClient, and
// the homepage)
// ---------------------------------------------------------------------------

/**
 * Relative time string.  Returns "" for null/invalid input.
 *
 * @example
 * timeAgo("2024-01-01T00:00:00Z") // "3d ago" / "just now" / etc.
 */
export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Alias — some files used `formatWhen`; keep it so we can swap lazily. */
export const formatWhen = timeAgo;

// ---------------------------------------------------------------------------
// Practice engine helpers (moved from usePracticeEngine.ts — Step 2.5)
// ---------------------------------------------------------------------------

/**
 * Trim + collapse whitespace. Alias of normalizeStr kept so practice engine
 * files can import `normalize` without renaming every call site.
 */
export const normalize = normalizeStr;

/**
 * Format milliseconds as MM:SS clock string.
 * @example msToClock(90_000) → "01:30"
 */
export function msToClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

type RecentItem = {
  id: string;
  title: string;
  course_code?: string;
  when?: string;
  href?: string;
};

/**
 * Push an item to the "jabuStudyRecent" localStorage list (max 12, deduped by id).
 * No-ops safely in SSR or if localStorage is unavailable.
 */
export function safePushRecent(item: RecentItem): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("jabuStudyRecent");
    const prev = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    const next = [item, ...(Array.isArray(prev) ? prev : [])]
      .filter(Boolean)
      .filter((x, i, arr) => arr.findIndex((y) => y?.id === x?.id) === i)
      .slice(0, 12);
    window.localStorage.setItem("jabuStudyRecent", JSON.stringify(next));
  } catch {
    // ignore — localStorage may be blocked
  }
}

// ---------------------------------------------------------------------------
// Number / currency helpers (replaces formatNaira() on the homepage,
// explore page, listing detail page, etc.)
// ---------------------------------------------------------------------------

/** Format a number as Nigerian Naira. Handles null / non-finite gracefully. */
export function formatNaira(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

// ---------------------------------------------------------------------------
// Number coercion helper (replaces asInt() in MaterialsClient, PracticeHomeClient)
// ---------------------------------------------------------------------------

/** Parse a string to an integer, returning `fallback` if invalid. */
export function asInt(v: string | null | undefined, fallback: number): number {
  const n = Number(v ?? "");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Clamp a number between min and max. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Academic session helper
// ---------------------------------------------------------------------------

/**
 * Compute a sensible Nigerian academic session string (e.g. "2025/2026")
 * from the current date.  Nigerian academic year typically starts in Sept/Oct.
 *
 * This is used as a runtime fallback when the academic calendar table is
 * unavailable — replacing every hardcoded `"2025/2026"` string in the codebase.
 */
// ---------------------------------------------------------------------------
// Study-specific color and format helpers (Task 1 — consolidated from client files)
// ---------------------------------------------------------------------------

/** Score percentage → accent color (for rings, text, bars) */
export function pctToColor(pct: number): string {
  if (pct >= 70) return "#1D9E75";   // teal  — mastered
  if (pct >= 60) return "#378ADD";   // blue  — good
  if (pct >= 50) return "#BA7517";   // amber — passing
  if (pct >= 45) return "#E8762A";   // orange-amber — borderline
  return "#A32D2D";                  // red   — needs work
}

/** Score percentage → background fill color (for cards, pills) */
export function pctToBg(pct: number): string {
  if (pct >= 70) return "#EAF3DE";
  if (pct >= 50) return "#FAEEDA";
  return "#FCEBEB";
}

/** Duration in seconds → human-readable string */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";
  const m = Math.floor(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

/** Score / total → percentage string with % symbol */
export function fmtPct(score: number, total: number): string {
  if (!total) return "—";
  return `${Math.round((score / total) * 100)}%`;
}

export function currentAcademicSessionFallback(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  // New session starts from ~September
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}