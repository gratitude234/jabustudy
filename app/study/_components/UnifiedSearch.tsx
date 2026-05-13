"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Loader2,
  MessageCircleQuestion,
  Search,
  Zap,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, safeSearchTerm } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type SuggestionKind = "material" | "course" | "practice" | "question";

type Suggestion = {
  kind: SuggestionKind;
  id: string;
  label: string;
  sub: string;
  href: string;
};

// ── Icon / label per kind ─────────────────────────────────────────────────────

const KIND_ICON: Record<SuggestionKind, React.ReactNode> = {
  material: <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />,
  course:   <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />,
  practice: <Zap className="h-4 w-4 shrink-0 text-muted-foreground" />,
  question: <MessageCircleQuestion className="h-4 w-4 shrink-0 text-muted-foreground" />,
};

const KIND_LABEL: Record<SuggestionKind, string> = {
  material: "Material",
  course:   "Course",
  practice: "Practice",
  question: "Q&A",
};

// ── Fetcher ───────────────────────────────────────────────────────────────────

const PER_KIND = 3;

async function fetchSuggestions(raw: string): Promise<Suggestion[]> {
  const q = safeSearchTerm(raw);
  if (!q) return [];

  const p = `%${q}%`;

  const [matRes, courseRes, practiceRes, questionRes] = await Promise.allSettled([
    supabase
      .from("study_materials")
      .select("id,title,course_code,material_type")
      .eq("approved", true)
      .or(`title.ilike.${p},course_code.ilike.${p}`)
      .order("downloads", { ascending: false })
      .limit(PER_KIND),

    supabase
      .from("study_courses")
      .select("id,course_code,course_title,level")
      .eq("status", "approved")
      .or(`course_code.ilike.${p},course_title.ilike.${p}`)
      .order("created_at", { ascending: false })
      .limit(PER_KIND),

    supabase
      .from("study_quiz_sets")
      .select("id,title,course_code")
      .eq("published", true)
      .or(`title.ilike.${p},course_code.ilike.${p}`)
      .order("created_at", { ascending: false })
      .limit(PER_KIND),

    supabase
      .from("study_questions")
      .select("id,title,course_code")
      .or(`title.ilike.${p},course_code.ilike.${p}`)
      .order("created_at", { ascending: false })
      .limit(PER_KIND),
  ]);

  const out: Suggestion[] = [];

  if (matRes.status === "fulfilled" && !matRes.value.error) {
    for (const m of matRes.value.data ?? []) {
      out.push({
        kind: "material",
        id: m.id,
        label: m.title ?? m.course_code ?? "Material",
        sub: [m.course_code, m.material_type].filter(Boolean).join(" · "),
        href: `/study/materials/${encodeURIComponent(m.id)}`,
      });
    }
  }

  if (courseRes.status === "fulfilled" && !courseRes.value.error) {
    for (const c of courseRes.value.data ?? []) {
      out.push({
        kind: "course",
        id: c.id,
        label: c.course_code,
        sub: [c.course_title, c.level ? `${c.level}L` : null].filter(Boolean).join(" · "),
        href: `/study/courses/${encodeURIComponent(c.course_code)}`,
      });
    }
  }

  if (practiceRes.status === "fulfilled" && !practiceRes.value.error) {
    for (const p of practiceRes.value.data ?? []) {
      out.push({
        kind: "practice",
        id: p.id,
        label: p.title ?? "Practice set",
        sub: p.course_code ?? "",
        href: `/study/practice/${encodeURIComponent(p.id)}`,
      });
    }
  }

  if (questionRes.status === "fulfilled" && !questionRes.value.error) {
    for (const q of questionRes.value.data ?? []) {
      out.push({
        kind: "question",
        id: q.id,
        label: q.title ?? "Question",
        sub: q.course_code ?? "",
        href: `/study/questions/${encodeURIComponent(q.id)}`,
      });
    }
  }

  return out;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface UnifiedSearchProps {
  value?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
  onChange?: (query: string) => void;
  onClear?: () => void;
  loading?: boolean;
  className?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  /** Set true on a dedicated search page — disables the dropdown */
  noDropdown?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UnifiedSearch({
  value,
  placeholder = "Search courses, materials, questions…",
  onSearch,
  onChange,
  onClear,
  loading = false,
  className,
  debounceMs = 300,
  autoFocus = false,
  noDropdown = false,
}: UnifiedSearchProps) {
  const router = useRouter();
  const listboxId = useId();

  const [internalValue, setInternalValue] = useState(value ?? "");
  const displayValue = value !== undefined ? value : internalValue;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [fetching, setFetching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Autocomplete fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (noDropdown || !displayValue.trim()) {
      setSuggestions([]);
      setOpen(false);
      setFetching(false);
      return;
    }

    setFetching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const items = await fetchSuggestions(displayValue);
        setSuggestions(items);
        setOpen(items.length > 0);
        setActiveIdx(-1);
      } catch {
        // ignore
      } finally {
        setFetching(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [displayValue, debounceMs, noDropdown]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // ── Input handlers ────────────────────────────────────────────────────────
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      if (value === undefined) setInternalValue(q);
      onChange?.(q);
      if (onSearch) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onSearch(q.trim()), debounceMs);
      }
    },
    [value, onChange, onSearch, debounceMs]
  );

  const handleClear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value === undefined) setInternalValue("");
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
    onChange?.("");
    onSearch?.("");
    onClear?.();
    inputRef.current?.focus();
  }, [value, onChange, onSearch, onClear]);

  function commitSearch() {
    const q = displayValue.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/study/search?q=${encodeURIComponent(q)}`);
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (open) { setOpen(false); setActiveIdx(-1); }
        else handleClear();
        return;
      }

      if (!open || suggestions.length === 0) {
        if (e.key === "Enter") commitSearch();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIdx >= 0) {
          router.push(suggestions[activeIdx].href);
          setOpen(false);
        } else {
          commitSearch();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, suggestions, activeIdx, handleClear, displayValue]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Input */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 shadow-sm transition-shadow",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
        )}
      >
        {loading || fetching ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={activeIdx >= 0 ? `${listboxId}-${activeIdx}` : undefined}
          aria-label={placeholder}
          className={cn(
            "w-full bg-transparent text-sm text-foreground outline-none",
            "placeholder:text-muted-foreground",
            "[&::-webkit-search-cancel-button]:hidden"
          )}
        />

        {displayValue ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-xl hover:bg-secondary/60 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className={cn(
            "absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden",
            "rounded-2xl border border-border bg-card shadow-lg"
          )}
        >
          <ul className="max-h-72 overflow-y-auto py-1">
            {suggestions.map((s, i) => (
              <li
                key={`${s.kind}-${s.id}`}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={i === activeIdx}
              >
                <Link
                  href={s.href}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    i === activeIdx
                      ? "bg-secondary text-foreground"
                      : "text-foreground hover:bg-secondary/50"
                  )}
                >
                  {KIND_ICON[s.kind]}

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.label}</span>
                    {s.sub ? (
                      <span className="block truncate text-xs text-muted-foreground">{s.sub}</span>
                    ) : null}
                  </span>

                  <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {KIND_LABEL[s.kind]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Full-search footer */}
          <div className="border-t border-border px-4 py-2.5">
            <button
              type="button"
              onClick={commitSearch}
              className="flex w-full items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" />
              Search for &ldquo;{displayValue.trim()}&rdquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}