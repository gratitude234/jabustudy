"use client";
// app/study/questions/QuestionsClient.tsx
import { cn, normalizeQuery, formatWhen, buildHref } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StudyTabs from "../_components/StudyTabs";
import { EmptyState } from "../_components/StudyUI";
import { getAuthedUserId, toggleSaved } from "@/lib/studySaved";
import { StudyPrefsProvider, useStudyPrefs } from "../_components/StudyPrefsContext";
import {
  ArrowRight, Bookmark, BookmarkCheck, CheckCircle2,
  ChevronDown, Loader2, MessageSquarePlus, MessagesSquare,
  Search, SlidersHorizontal, ThumbsUp, X, AlertTriangle,
} from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { SelectRow, ToggleRow } from "@/components/ui/study-filters";


type SortKey  = "newest" | "upvoted" | "answered" | "unanswered";
type LevelKey = "" | "100" | "200" | "300" | "400" | "500" | "600";

type QuestionRow = {
  id: string;
  title: string | null;
  body: string | null;
  course_code: string | null;
  level: string | null;
  created_at: string | null;
  answers_count: number | null;
  upvotes_count: number | null;
  solved: boolean | null;
};

const PAGE_SIZE = 14;

// ─── Question Card ─────────────────────────────────────────────────────────────
// Title-first. Left border encodes status at a glance. Whole card is the tap target.

function QuestionCard({ q, saved, saving, onToggleSave }: {
  q: QuestionRow; saved: boolean; saving: boolean; onToggleSave: () => void;
}) {
  const title      = (q.title ?? "Question").trim() || "Question";
  const code       = (q.course_code ?? "").trim().toUpperCase();
  const lvl        = (q.level ?? "").trim();
  const answers    = q.answers_count ?? 0;
  const upvotes    = q.upvotes_count ?? 0;
  const solved     = q.solved === true;
  const unanswered = answers === 0 && !solved;

  return (
    <Link
      href={`/study/questions/${encodeURIComponent(q.id)}`}
      className={cn(
        "group flex items-start gap-2 rounded-2xl border bg-background px-3 py-3 no-underline transition",
        "hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        solved
          ? "border-l-4 border-l-emerald-500"
          : unanswered
          ? "border-l-4 border-l-primary"
          : ""
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-foreground">{title}</p>
        {q.body && q.body.trim().length > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-brand leading-relaxed">{q.body.trim()}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {code && (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-brand">
              {code}
            </span>
          )}
          {lvl && (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-brand">
              {lvl}L
            </span>
          )}
          {solved ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "#EAF3DE", color: "#3B6D11" }}>
              <CheckCircle2 className="h-2.5 w-2.5" /> Solved
            </span>
          ) : unanswered ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "#FAEEDA", color: "#854F0B" }}>
              Unanswered
            </span>
          ) : (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-brand">
              {answers} answer{answers !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-brand">
            <ThumbsUp className="h-3 w-3" /> {upvotes}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-brand">
            <MessagesSquare className="h-3 w-3" /> {answers}
          </span>
          {q.created_at && (
            <span className="text-[10px] text-muted-brand">{formatWhen(q.created_at)}</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.preventDefault(); onToggleSave(); }}
        disabled={saving}
        aria-label={saved ? "Unsave" : "Save"}
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border bg-background transition",
          "hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          saving ? "opacity-60" : ""
        )}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
         saved  ? <BookmarkCheck className="h-3.5 w-3.5" /> :
                  <Bookmark className="h-3.5 w-3.5" />}
      </button>
    </Link>
  );
}

function Toast({ text, actionLabel, onAction, onClose }: {
  text: string; actionLabel?: string; onAction?: () => void; onClose: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">{text}</p>
          <div className="flex items-center gap-2">
            {actionLabel && onAction && (
              <button type="button" onClick={onAction}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/50">
                {actionLabel}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-background">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionsInner() {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();
  const { prefs, isProfileComplete, courseCodes, scopeLabel } = useStudyPrefs();

  const qParam        = sp.get("q") ?? "";
  const courseParam   = sp.get("course") ?? "";
  const levelParam    = (sp.get("level") ?? "") as LevelKey;
  const unsolvedParam = sp.get("unsolved") === "1";
  const sortParam     = (sp.get("sort") ?? "newest") as SortKey;
  const personalizedOff = sp.get("personalized") === "0";

  const autoAppliedRef = useRef(false);
  const [autoFilteredLevel, setAutoFilteredLevel] = useState<string | null>(null);

  useEffect(() => {
    if (autoAppliedRef.current) return;
    autoAppliedRef.current = true;
    if (!personalizedOff && !levelParam && prefs?.level) {
      const lvl = String(prefs.level);
      setAutoFilteredLevel(lvl);
      router.replace(buildHref(pathname, {
        q: qParam || null, course: courseParam || null, level: lvl,
        unsolved: unsolvedParam ? 1 : null, sort: sortParam !== "newest" ? sortParam : null,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, personalizedOff]);

  const [q,          setQ]          = useState(qParam);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftLevel,    setDraftLevel]    = useState<LevelKey>(levelParam);
  const [draftUnsolved, setDraftUnsolved] = useState(unsolvedParam);
  const [draftSort,     setDraftSort]     = useState<SortKey>(sortParam);

  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err,         setErr]         = useState<string | null>(null);
  const [items,       setItems]       = useState<QuestionRow[]>([]);
  const [total,       setTotal]       = useState(0);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(1);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast,    setToast]    = useState<{ text: string; undo?: () => void } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => setQ(qParam), [qParam]);

  // Debounce. Auto-detect course code pattern so one search input handles both.
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const raw         = normalizeQuery(q);
    const isCourseCode = /^[A-Za-z]{2,6}\s*[0-9]{2,4}$/.test(raw);
    const qNorm        = isCourseCode ? "" : raw;
    const cNorm        = isCourseCode ? raw.toUpperCase().replace(/\s+/g, " ") : normalizeQuery(courseParam).toUpperCase();

    if (qNorm === normalizeQuery(qParam) && cNorm === normalizeQuery(courseParam).toUpperCase()) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      router.replace(buildHref(pathname, {
        q: qNorm || null, course: cNorm || null, level: levelParam || null,
        unsolved: unsolvedParam ? 1 : null, sort: sortParam !== "newest" ? sortParam : null,
        personalized: personalizedOff ? "0" : null,
      }));
    }, 350);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [q, qParam, courseParam, router, pathname, levelParam, unsolvedParam, sortParam, personalizedOff]);

  function applyFilters() {
    router.replace(buildHref(pathname, {
      q: normalizeQuery(q) || null, course: normalizeQuery(courseParam).toUpperCase() || null,
      level: draftLevel || null, unsolved: draftUnsolved ? 1 : null,
      sort: draftSort !== "newest" ? draftSort : null,
      personalized: personalizedOff ? "0" : null,
    }));
    setDrawerOpen(false);
  }

  function clearAll() { setQ(""); router.replace(personalizedOff ? `${pathname}?personalized=0` : pathname); }

  function setQuickFilter(key: "unsolved" | "sort", value: string) {
    const base = { q: qParam || null, course: courseParam || null, level: levelParam || null, personalized: personalizedOff ? "0" : null };
    if (key === "unsolved") {
      router.replace(buildHref(pathname, { ...base, unsolved: value === "1" ? 1 : null, sort: sortParam !== "newest" ? sortParam : null }));
    } else {
      router.replace(buildHref(pathname, { ...base, unsolved: unsolvedParam ? 1 : null, sort: value !== "newest" ? value : null }));
    }
  }

  const hasAnyFilters = Boolean(
    normalizeQuery(qParam) || normalizeQuery(courseParam) || levelParam ||
    unsolvedParam || (sortParam && sortParam !== "newest")
  );

  const filtersKey = useMemo(() =>
    [normalizeQuery(qParam).toLowerCase(), normalizeQuery(courseParam).toUpperCase(),
     levelParam, String(unsolvedParam), sortParam, personalizedOff ? "p0" : "p1", courseCodes.join(",")].join("|"),
    [qParam, courseParam, levelParam, unsolvedParam, sortParam, personalizedOff, courseCodes]
  );

  useEffect(() => { setPage(1); setItems([]); setTotal(0); setHasMore(false); setErr(null); }, [filtersKey]);

  async function fetchSavedForVisible(questionIds: string[]) {
    try {
      const userId = await getAuthedUserId();
      if (!userId || questionIds.length === 0) return;
      const { data, error } = await supabase
        .from("study_saved_items").select("question_id")
        .eq("user_id", userId).eq("item_type", "question").in("question_id", questionIds);
      if (error) return;
      const set = new Set<string>();
      (data as any[])?.forEach((r) => { if (r?.question_id) set.add(String(r.question_id)); });
      setSavedIds(set);
    } catch { /* silent */ }
  }

  async function fetchPage(nextPage: number) {
    const isFirst = nextPage === 1;
    if (isFirst) { setLoading(true); setErr(null); } else setLoadingMore(true);

    try {
      let query = supabase
        .from("study_questions")
        .select("id,title,body,course_code,level,created_at,answers_count,upvotes_count,solved", { count: "exact" });

      const qNorm = normalizeQuery(qParam);
      if (qNorm) query = query.or(`title.ilike.%${qNorm}%,body.ilike.%${qNorm}%`);
      const cNorm = normalizeQuery(courseParam).toUpperCase();
      if (cNorm) query = query.eq("course_code", cNorm);
      else if (!personalizedOff && isProfileComplete && courseCodes.length > 0) query = query.in("course_code", courseCodes);
      if (levelParam) query = query.eq("level", levelParam);
      else if (!personalizedOff && isProfileComplete && prefs?.level) query = query.eq("level", String(prefs.level));
      if (unsolvedParam) query = query.or("solved.is.null,solved.eq.false");

      if      (sortParam === "upvoted")    query = query.order("upvotes_count", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      else if (sortParam === "answered")   query = query.order("answers_count", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      else if (sortParam === "unanswered") query = query.order("answers_count", { ascending: true,  nullsFirst: true  }).order("created_at", { ascending: false });
      else                                query = query.order("created_at", { ascending: false });

      const from = (nextPage - 1) * PAGE_SIZE;
      const res  = await query.range(from, from + PAGE_SIZE - 1);

      if (res.error) {
        setErr(res.error.message || "Could not load questions.");
        if (isFirst) { setItems([]); setTotal(0); setHasMore(false); }
        return;
      }

      const rows       = ((res.data as any[]) ?? []).filter(Boolean) as QuestionRow[];
      const totalCount = res.count ?? 0;
      setTotal(totalCount);
      setItems((prev) => {
        if (isFirst) return rows;
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const r of rows) if (!seen.has(r.id)) merged.push(r);
        return merged;
      });
      setHasMore((nextPage - 1) * PAGE_SIZE + rows.length < totalCount);
      const visibleIds = (isFirst ? rows : [...items, ...rows]).map((x) => x.id);
      await fetchSavedForVisible(Array.from(new Set(visibleIds)));
    } catch (e: any) {
      setErr(e?.message ?? "Could not load questions.");
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  async function onToggleSave(questionId: string) {
    const wasSaved = savedIds.has(questionId);
    setSavingId(questionId);
    setSavedIds((prev) => { const n = new Set(prev); wasSaved ? n.delete(questionId) : n.add(questionId); return n; });
    try {
      await toggleSaved({ itemType: "question", questionId });
      setToast({
        text: wasSaved ? "Removed from Saved" : "Saved",
        undo: async () => {
          try {
            setSavedIds((prev) => { const n = new Set(prev); wasSaved ? n.add(questionId) : n.delete(questionId); return n; });
            await toggleSaved({ itemType: "question", questionId });
          } catch { await fetchSavedForVisible(items.map((x) => x.id)); }
        },
      });
    } catch (e: any) {
      setSavedIds((prev) => { const n = new Set(prev); wasSaved ? n.add(questionId) : n.delete(questionId); return n; });
      setToast({ text: e?.message ?? "Could not update." });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <StudyTabs />

      {!isProfileComplete && (
        <Link href="/study/onboarding"
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-light px-4 py-3 text-sm font-semibold text-primary-text no-underline hover:bg-primary/10 dark:border-primary/30 dark:bg-primary/10 dark:text-indigo-200">
          <span>Set your department to see questions from your courses.</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      {isProfileComplete && !personalizedOff ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-light px-4 py-3 text-sm text-primary-text dark:border-primary/30 dark:bg-primary/10 dark:text-indigo-200">
          <span className="min-w-0">Showing questions for {scopeLabel ?? "your courses"}.</span>
          <Link
            href="/study/questions?personalized=0"
            className="shrink-0 text-xs font-bold underline underline-offset-2"
          >
            Browse all questions
          </Link>
        </div>
      ) : personalizedOff ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-brand">
          <span>Browsing all Study questions.</span>
          <Link href="/study/questions" className="shrink-0 text-xs font-bold text-primary underline underline-offset-2">
            Back to my courses
          </Link>
        </div>
      ) : null}

      {/* Page header */}
      <div>
        <h1 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold tracking-tight text-foreground">Q&amp;A Forum</h1>
        <p className="mt-0.5 text-xs text-muted-brand">
          {total > 0 ? `${total} question${total !== 1 ? "s" : ""} · ask, answer, learn` : "Ask, answer, learn with your peers"}
        </p>
      </div>

      {/* Merged search bar — detects course code pattern automatically */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-brand" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search or enter course code (e.g. GST101)…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
        />
        {q && (
          <button type="button" onClick={() => setQ("")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border bg-background hover:bg-secondary/50">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => { setDraftLevel(levelParam); setDraftUnsolved(unsolvedParam); setDraftSort(sortParam); setDrawerOpen(true); }}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/50",
            hasAnyFilters ? "border-foreground bg-secondary" : "border-border bg-background"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </button>
      </div>

      {/* Visible quick-filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          { key: "all",        label: "All" },
          { key: "unanswered", label: "Unanswered" },
          { key: "newest",     label: "Newest" },
          { key: "upvoted",    label: "Most upvoted" },
          { key: "answered",   label: "Most answered" },
        ].map(({ key, label }) => {
          const isActive =
            key === "all"        ? !unsolvedParam && sortParam === "newest" :
            key === "unanswered" ? unsolvedParam :
            key === "newest"     ? sortParam === "newest" && !unsolvedParam :
                                   sortParam === key;
          return (
            <button
              key={key} type="button"
              onClick={() => {
                if (key === "all")        { clearAll(); return; }
                if (key === "unanswered") { setQuickFilter("unsolved", isActive ? "0" : "1"); return; }
                setQuickFilter("sort", isActive ? "newest" : key);
              }}
              className={cn(
                "flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary/25 bg-primary-light text-primary-text"
                  : "border-border bg-background text-muted-brand hover:text-foreground hover:bg-secondary/40"
              )}
            >
              {label}
            </button>
          );
        })}

        {(["100","200","300","400","500","600"] as LevelKey[]).filter(Boolean).map((lvl) => {
          const active = levelParam === lvl;
          return (
            <button key={lvl} type="button"
              onClick={() => router.replace(buildHref(pathname, {
                q: qParam || null, course: courseParam || null, level: active ? null : lvl,
                unsolved: unsolvedParam ? 1 : null, sort: sortParam !== "newest" ? sortParam : null,
              }))}
              className={cn(
                "flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary/25 bg-primary-light text-primary-text" : "border-border bg-background text-muted-brand hover:text-foreground hover:bg-secondary/40"
              )}
            >
              {lvl}L
            </button>
          );
        })}
      </div>

      {/* Auto-filter notice */}
      {autoFilteredLevel && levelParam === autoFilteredLevel && (
        <div className="flex items-center gap-2 text-xs text-muted-brand">
          <span>Filtered to <span className="font-medium text-foreground">Level {autoFilteredLevel}</span></span>
          <button type="button" onClick={() => {
            setAutoFilteredLevel(null);
            router.replace(buildHref(pathname, {
              q: qParam || null, course: courseParam || null, level: null,
              unsolved: unsolvedParam ? 1 : null, sort: sortParam !== "newest" ? sortParam : null,
            }));
          }} className="underline underline-offset-2 hover:text-foreground">
            Show all
          </button>
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">Couldn't load questions</p>
          <p className="mt-1 text-xs text-muted-brand">{err}</p>
          <button type="button" onClick={() => fetchPage(1)}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:opacity-90">
            Try again <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border bg-background p-4">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
              <div className="mt-3 h-3 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="No questions found"
          description={hasAnyFilters ? "Try clearing filters or a different search." : "Be the first to ask something."}
          action={
            <Link href="/study/questions/ask"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white no-underline">
              <MessageSquarePlus className="h-4 w-4" /> Ask a question
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((qq) => (
              <QuestionCard key={qq.id} q={qq}
                saved={savedIds.has(qq.id)} saving={savingId === qq.id}
                onToggleSave={() => onToggleSave(qq.id)} />
            ))}
          </div>
          <div className="flex justify-center pt-2">
            {hasMore ? (
              <button type="button"
                onClick={async () => { const next = page + 1; setPage(next); await fetchPage(next); }}
                disabled={loadingMore}
                className={cn("inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground hover:bg-secondary/50", loadingMore ? "opacity-60" : "")}>
                {loadingMore ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</> : <>Load more <ChevronDown className="h-4 w-4" /></>}
              </button>
            ) : (
              <p className="text-sm text-muted-brand">You've reached the end.</p>
            )}
          </div>
        </>
      )}

      {/* Filters drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filters"
        footer={
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => { setDraftLevel(""); setDraftUnsolved(false); setDraftSort("newest"); }}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/50">
              Reset
            </button>
            <button type="button" onClick={applyFilters}
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white">
              Apply
            </button>
          </div>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectRow label="Sort" value={draftSort} onChange={(v) => setDraftSort(v as SortKey)}
            options={[
              { value: "newest",     label: "Newest" },
              { value: "upvoted",    label: "Most upvoted" },
              { value: "answered",   label: "Most answered" },
              { value: "unanswered", label: "Unanswered first" },
            ]}
          />
          <SelectRow label="Level" value={draftLevel} onChange={(v) => setDraftLevel(v as LevelKey)}
            options={[
              { value: "",    label: "All levels" },
              { value: "100", label: "100L" }, { value: "200", label: "200L" },
              { value: "300", label: "300L" }, { value: "400", label: "400L" },
              { value: "500", label: "500L" }, { value: "600", label: "600L" },
            ]}
          />
        </div>
        <div className="mt-3">
          <ToggleRow label="Unsolved only" desc="Show questions that are not yet resolved."
            checked={draftUnsolved} onChange={setDraftUnsolved} />
        </div>
      </Drawer>

      {/* Floating Ask FAB — always accessible while scrolling */}
      <Link
        href="/study/questions/ask"
        className={cn(
          "fixed bottom-24 right-4 z-40 flex items-center justify-center rounded-full no-underline",
          "bg-primary text-white shadow-lg shadow-primary/30",
          "hover:opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "md:bottom-8 md:right-8"
        )}
        style={{ width: 52, height: 52 }}
        aria-label="Ask a question"
        title="Ask a question"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </Link>

      {toast && (
        <Toast text={toast.text} actionLabel={toast.undo ? "Undo" : undefined}
          onAction={toast.undo} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default function QuestionsClient() {
  return <StudyPrefsProvider><QuestionsInner /></StudyPrefsProvider>;
}
