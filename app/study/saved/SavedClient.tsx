"use client";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  BookmarkCheck,
  BookOpen,
  ChevronDown,
  Clock,
  Loader2,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toggleSaved, getAuthedUserId } from "@/lib/studySaved";

import StudyTabs from "../_components/StudyTabs";
import { HistorySavedTabs } from "../_components/HistorySavedTabs";

type SavedRow = {
  id: string;
  item_type: "material" | "practice_set" | "question";
  material_id: string | null;
  practice_set_id: string | null;
  question_id: string | null;
  created_at: string | null;
};

type Material = {
  id: string;
  title: string | null;
  description: string | null;
  file_path: string | null;
  created_at: string | null;
  downloads: number | null;
};

type QuizSet = {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  level: string | null;
  created_at: string | null;
  time_limit_minutes: number | null;
  questions_count: number | null;
};

type Question = {
  id: string;
  title: string;
  body: string | null;
  course_code: string | null;
  level: string | null;
  created_at: string | null;
  answers_count: number | null;
  upvotes_count: number | null;
  solved: boolean | null;
};

type TabKey = "materials" | "practice" | "questions";
type SortKey = "saved_newest" | "saved_oldest";

const PAGE_SIZE = 18;

function normalizeQuery(v: string) {
  return v.trim().replace(/\s+/g, " ");
}

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function buildHref(path: string, params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    const s = String(v).trim();
    if (!s) return;
    sp.set(k, s);
  });
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}) {
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

function IconButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-2xl border border-border bg-background",
        "hover:bg-secondary/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled ? "opacity-60 cursor-not-allowed" : ""
      )}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground no-underline",
        "hover:opacity-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      {children}
    </Link>
  );
}

function GhostButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground no-underline",
        "hover:bg-secondary/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      {children}
    </Link>
  );
}

function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const first = root.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      first?.focus?.();
    }, 50);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panelRef}
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-t-3xl border border-border bg-card shadow-xl transition-transform",
          open ? "translate-y-0" : "translate-y-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <IconButton onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
        {footer ? <div className="border-t border-border p-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-background p-3">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm text-foreground outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toast({
  text,
  actionLabel,
  onAction,
  onClose,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{text}</p>
          <div className="flex items-center gap-2">
            {actionLabel && onAction ? (
              <button
                type="button"
                onClick={onAction}
                className={cn(
                  "rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground",
                  "hover:bg-secondary/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                )}
              >
                {actionLabel}
              </button>
            ) : null}
            <IconButton onClick={onClose} title="Dismiss">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SavedClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // URL state
  const tabParam = (sp.get("tab") ?? "materials") as TabKey;
  const qParam = sp.get("q") ?? "";
  const sortParam = (sp.get("sort") ?? "saved_newest") as SortKey;

  const [tab, setTab] = useState<TabKey>(tabParam);
  const [q, setQ] = useState(qParam);
  const [sort, setSort] = useState<SortKey>(sortParam);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftSort, setDraftSort] = useState<SortKey>(sortParam);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [materialsById, setMaterialsById] = useState<Record<string, Material>>({});
  const [setsById, setSetsById] = useState<Record<string, QuizSet>>({});
  const [questionsById, setQuestionsById] = useState<Record<string, Question>>({});

  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // toast + undo
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // keep local state in sync when URL changes
  useEffect(() => setTab(tabParam), [tabParam]);
  useEffect(() => setQ(qParam), [qParam]);
  useEffect(() => setSort(sortParam), [sortParam]);

  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const qNorm = normalizeQuery(q);
    if (qNorm === normalizeQuery(qParam)) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      router.replace(
        buildHref(pathname, {
          tab,
          q: qNorm || null,
          sort: sort !== "saved_newest" ? sort : null,
        })
      );
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, qParam, router, pathname, tab, sort]);

  function setTabUrl(next: TabKey) {
    router.replace(
      buildHref(pathname, {
        tab: next,
        q: normalizeQuery(q) || null,
        sort: sort !== "saved_newest" ? sort : null,
      })
    );
  }

  function openFilters() {
    setDraftSort(sort);
    setDrawerOpen(true);
  }

  function applyFilters() {
    router.replace(
      buildHref(pathname, {
        tab,
        q: normalizeQuery(q) || null,
        sort: draftSort !== "saved_newest" ? draftSort : null,
      })
    );
    setDrawerOpen(false);
  }

  function clearAll() {
    setQ("");
    router.replace(buildHref(pathname, { tab }));
  }

  const counts = useMemo(() => {
    let m = 0,
      p = 0,
      qq = 0;
    for (const r of saved) {
      if (r.item_type === "material") m++;
      if (r.item_type === "practice_set") p++;
      if (r.item_type === "question") qq++;
    }
    return { m, p, q: qq };
  }, [saved]);

  async function fetchDetailsFor(rows: SavedRow[]) {
    const materialIds = Array.from(
      new Set(
        rows
          .filter((r) => r.item_type === "material" && r.material_id)
          .map((r) => String(r.material_id))
          .filter((id) => !(id in materialsById))
      )
    );

    const setIds = Array.from(
      new Set(
        rows
          .filter((r) => r.item_type === "practice_set" && r.practice_set_id)
          .map((r) => String(r.practice_set_id))
          .filter((id) => !(id in setsById))
      )
    );

    const questionIds = Array.from(
      new Set(
        rows
          .filter((r) => r.item_type === "question" && r.question_id)
          .map((r) => String(r.question_id))
          .filter((id) => !(id in questionsById))
      )
    );

    // Materials
    if (materialIds.length) {
      const { data, error } = await supabase
        .from("study_materials")
        .select("id,title,description,file_path,created_at,downloads")
        .in("id", materialIds);

      if (!error) {
        setMaterialsById((prev) => {
          const next = { ...prev };
          (data as any[] | null)?.forEach((m) => {
            next[String(m.id)] = m as Material;
          });
          return next;
        });
      }
    }

    // Practice sets
    if (setIds.length) {
      const { data, error } = await supabase
        .from("study_quiz_sets")
        .select("id,title,description,course_code,level,created_at,time_limit_minutes,questions_count")
        .in("id", setIds);

      if (!error) {
        setSetsById((prev) => {
          const next = { ...prev };
          (data as any[] | null)?.forEach((s) => {
            next[String(s.id)] = s as QuizSet;
          });
          return next;
        });
      }
    }

    // Questions
    if (questionIds.length) {
      const { data, error } = await supabase
        .from("study_questions")
        .select("id,title,body,course_code,level,created_at,answers_count,upvotes_count,solved")
        .in("id", questionIds);

      if (!error) {
        setQuestionsById((prev) => {
          const next = { ...prev };
          (data as any[] | null)?.forEach((q) => {
            next[String(q.id)] = q as Question;
          });
          return next;
        });
      }
    }
  }

  async function loadPage(nextPage: number, opts?: { reset?: boolean }) {
    const reset = opts?.reset ?? false;

    if (reset) {
      setLoading(true);
      setErr(null);
      setPage(1);
      setSaved([]);
      setTotalCount(0);
      setHasMore(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const userId = await getAuthedUserId();
      if (!userId) {
        router.replace(`/login?next=${encodeURIComponent("/study/saved")}`);
        return;
      }

      const from = (nextPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Saved sorting is based on saved date (created_at)
      const ascending = sort === "saved_oldest";

      const { data: savedRows, error: savedErr, count } = await supabase
        .from("study_saved_items")
        .select("id,item_type,material_id,practice_set_id,question_id,created_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending })
        .range(from, to);

      if (savedErr) throw savedErr;

      const rows = ((savedRows as any) ?? []) as SavedRow[];
      const total = count ?? 0;

      setTotalCount(total);

      setSaved((prev) => {
        if (reset || nextPage === 1) return rows;
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const r of rows) if (!seen.has(r.id)) merged.push(r);
        return merged;
      });

      await fetchDetailsFor(rows);

      const loaded = from + rows.length;
      setHasMore(loaded < total);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load saved items");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // reset load when tab/sort changes (still loads saved rows once; filtering is client-side)
  useEffect(() => {
    loadPage(1, { reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  // initial load
  useEffect(() => {
    loadPage(1, { reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeItem(row: SavedRow) {
    setSavingId(row.id);

    // Keep a snapshot for undo
    const snapshot = row;
    const prevSaved = saved;

    // Optimistic remove
    setSaved((prev) => prev.filter((x) => x.id !== row.id));

    try {
      if (row.item_type === "material" && row.material_id) {
        await toggleSaved({ itemType: "material", materialId: row.material_id });
      } else if (row.item_type === "practice_set" && row.practice_set_id) {
        await toggleSaved({ itemType: "practice_set", practiceSetId: row.practice_set_id });
      } else if (row.item_type === "question" && row.question_id) {
        await toggleSaved({ itemType: "question", questionId: row.question_id });
      }

      setToast({
        text: "Removed from Saved",
        undo: async () => {
          try {
            // Restore UI immediately
            setSaved((prev) => [snapshot, ...prev]);

            // Re-save in DB
            if (snapshot.item_type === "material" && snapshot.material_id) {
              await toggleSaved({ itemType: "material", materialId: snapshot.material_id });
            } else if (snapshot.item_type === "practice_set" && snapshot.practice_set_id) {
              await toggleSaved({ itemType: "practice_set", practiceSetId: snapshot.practice_set_id });
            } else if (snapshot.item_type === "question" && snapshot.question_id) {
              await toggleSaved({ itemType: "question", questionId: snapshot.question_id });
            }
          } catch {
            // If undo fails, re-sync
            await loadPage(1, { reset: true });
          }
        },
      });
    } catch (e: any) {
      // Revert UI
      setSaved(prevSaved);
      setToast({ text: e?.message ?? "Could not remove. Try again." });
    } finally {
      setSavingId(null);
    }
  }

  const visible = useMemo(() => {
    const qNorm = normalizeQuery(qParam).toLowerCase();

    const base =
      tab === "materials"
        ? saved.filter((r) => r.item_type === "material")
        : tab === "practice"
        ? saved.filter((r) => r.item_type === "practice_set")
        : saved.filter((r) => r.item_type === "question");

    // search within loaded details
    if (!qNorm) return base;

    return base.filter((row) => {
      if (row.item_type === "material" && row.material_id) {
        const m = materialsById[row.material_id];
        const hay = `${m?.title ?? ""} ${m?.description ?? ""}`.toLowerCase();
        return hay.includes(qNorm);
      }
      if (row.item_type === "practice_set" && row.practice_set_id) {
        const s = setsById[row.practice_set_id];
        const hay = `${s?.title ?? ""} ${s?.description ?? ""} ${s?.course_code ?? ""}`.toLowerCase();
        return hay.includes(qNorm);
      }
      if (row.item_type === "question" && row.question_id) {
        const qq = questionsById[row.question_id];
        const hay = `${qq?.title ?? ""} ${qq?.body ?? ""} ${qq?.course_code ?? ""}`.toLowerCase();
        return hay.includes(qNorm);
      }
      return false;
    });
  }, [saved, tab, qParam, materialsById, setsById, questionsById]);

  const showingFrom = totalCount === 0 ? 0 : 1;
  const showingTo = Math.min(totalCount, saved.length);
  const hasAnyFilters = Boolean(qParam || (sortParam && sortParam !== "saved_newest"));

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <StudyTabs />
      <HistorySavedTabs active="saved" />

      {/* Top bar (matches StudyHome style, no max-width shrink) */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground",
            "hover:bg-secondary/50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <span className="inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground">
          <BookmarkCheck className="h-4 w-4" />
          Saved
        </span>
      </div>

      {/* Header card */}
      <div className="rounded-3xl border border-border bg-background p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">Saved</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you saved — materials, practice sets, and questions.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground">
              <Clock className="h-4 w-4" />
              {sort === "saved_newest" ? "Newest saved" : "Oldest saved"}
            </span>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search saved items…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />

          {q ? (
            <IconButton onClick={() => setQ("")} title="Clear search">
              <X className="h-4 w-4" />
            </IconButton>
          ) : null}

          <button
            type="button"
            onClick={openFilters}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground",
              "hover:bg-secondary/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </div>

        {/* Tabs (URL synced) */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Chip active={tab === "materials"} onClick={() => setTabUrl("materials")}>
            <BookOpen className="h-4 w-4" /> Materials ({counts.m})
          </Chip>
          <Chip active={tab === "practice"} onClick={() => setTabUrl("practice")}>
            <Sparkles className="h-4 w-4" /> Practice ({counts.p})
          </Chip>
          <Chip active={tab === "questions"} onClick={() => setTabUrl("questions")}>
            <MessageSquare className="h-4 w-4" /> Questions ({counts.q})
          </Chip>

          <span className="ml-auto hidden sm:inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold text-muted-foreground">
            Showing {showingFrom}–{showingTo} of {totalCount}
          </span>
        </div>

        {/* Active filters */}
        {hasAnyFilters ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Showing <span className="text-foreground">{showingFrom}</span>–<span className="text-foreground">{showingTo}</span> of{" "}
              <span className="text-foreground">{totalCount}</span>
            </p>
            <button
              type="button"
              onClick={clearAll}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold",
                "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: Save items from <span className="font-semibold">Library</span>, <span className="font-semibold">Practice</span>, and{" "}
            <span className="font-semibold">Questions</span>.
          </p>
        )}
      </div>

      {/* States */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-border bg-background p-4">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
              <div className="mt-4 h-10 w-full rounded-2xl bg-muted" />
            </div>
          ))}
        </div>
      ) : err ? (
        <div className="rounded-3xl border border-border bg-background p-6">
          <p className="text-sm font-semibold text-foreground">Couldn’t load saved items</p>
          <p className="mt-1 text-sm text-muted-foreground">{err}</p>
          <button
            type="button"
            onClick={() => loadPage(1, { reset: true })}
            className={cn(
              "mt-3 inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground",
              "hover:opacity-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            Retry <ChevronDown className="h-4 w-4 rotate-180" />
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-border bg-background p-6 text-center">
          <p className="text-base font-semibold text-foreground">Nothing saved yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Save items you want to revisit quickly — they’ll show up here.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <PrimaryButton href="/study/library">Browse library</PrimaryButton>
            <GhostButton href="/study/practice">Practice mode</GhostButton>
            <GhostButton href="/study/questions">Ask questions</GhostButton>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((row) => {
              // MATERIAL
              if (row.item_type === "material") {
                const m = row.material_id ? materialsById[row.material_id] : null;

                return (
                  <div key={row.id} className="rounded-3xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{m?.title ?? "Material"}</p>
                        {m?.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
                        ) : null}
                        <p className="mt-2 text-xs font-semibold text-muted-foreground">
                          Saved {formatWhen(row.created_at)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(row)}
                        disabled={savingId === row.id}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground",
                          "hover:bg-secondary/50",
                          savingId === row.id ? "opacity-70 cursor-not-allowed" : "",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        )}
                      >
                        {savingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <GhostButton href="/study/library">Library</GhostButton>
                      {m?.file_path ? (
                        <a
                          href={`/api/study/materials/${m.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground no-underline",
                            "hover:opacity-90",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          )}
                        >
                          Open file
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              }

              // PRACTICE SET
              if (row.item_type === "practice_set") {
                const s = row.practice_set_id ? setsById[row.practice_set_id] : null;

                return (
                  <div key={row.id} className="rounded-3xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{s?.title ?? "Practice set"}</p>
                        {s?.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                          {s?.course_code ? (
                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground">
                              {String(s.course_code).toUpperCase()}
                            </span>
                          ) : null}
                          <span>Saved {formatWhen(row.created_at)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(row)}
                        disabled={savingId === row.id}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground",
                          "hover:bg-secondary/50",
                          savingId === row.id ? "opacity-70 cursor-not-allowed" : "",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        )}
                      >
                        {savingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <GhostButton href="/study/practice">Practice</GhostButton>
                      {row.practice_set_id ? (
                        <PrimaryButton href={`/study/practice/${encodeURIComponent(row.practice_set_id)}`}>
                          Start
                        </PrimaryButton>
                      ) : null}
                    </div>
                  </div>
                );
              }

              // QUESTION
              const qq = row.question_id ? questionsById[row.question_id] : null;
              return (
                <div key={row.id} className="rounded-3xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">{qq?.title ?? "Question"}</p>
                      {qq?.body ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{qq.body}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                        {qq?.course_code ? (
                          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground">
                            {String(qq.course_code).toUpperCase()}
                          </span>
                        ) : null}
                        <span>Saved {formatWhen(row.created_at)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(row)}
                      disabled={savingId === row.id}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground",
                        "hover:bg-secondary/50",
                        savingId === row.id ? "opacity-70 cursor-not-allowed" : "",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      )}
                    >
                      {savingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <GhostButton href="/study/questions">Questions</GhostButton>
                    {row.question_id ? (
                      <PrimaryButton href={`/study/questions/${encodeURIComponent(row.question_id)}`}>
                        Open
                      </PrimaryButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          <div className="flex justify-center pt-2">
            {hasMore ? (
              <button
                type="button"
                onClick={async () => {
                  const next = page + 1;
                  setPage(next);
                  await loadPage(next);
                }}
                disabled={loadingMore}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground",
                  "hover:bg-secondary/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  loadingMore ? "opacity-70 cursor-not-allowed" : ""
                )}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </>
                ) : (
                  <>
                    Load more <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">You’ve reached the end.</p>
            )}
          </div>
        </>
      )}

      {/* Filters drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraftSort("saved_newest")}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground",
                "hover:bg-secondary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              )}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground",
                "hover:opacity-90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              )}
            >
              Apply
            </button>
          </div>
        }
      >
        <SelectRow
          label="Sort"
          value={draftSort}
          onChange={(v) => setDraftSort(v as SortKey)}
          options={[
            { value: "saved_newest", label: "Newest saved" },
            { value: "saved_oldest", label: "Oldest saved" },
          ]}
        />

        <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            Search updates automatically. Sorting applies when you tap <span className="font-semibold">Apply</span>.
          </p>
        </div>
      </Drawer>

      {/* Toast */}
      {toast ? (
        <Toast
          text={toast.text}
          actionLabel={toast.undo ? "Undo" : undefined}
          onAction={toast.undo}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
