"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  ChevronDown,
  Clock,
  Filter,
  GraduationCap,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { track, trackHomeCta } from "@/lib/studyAnalytics";
import { cn } from "@/lib/utils";
import { EmptyState } from "./StudyUI";
import { useStudyPrefs } from "./StudyPrefsContext";

export type MaterialMini = {
  id: string;
  title: string | null;
  course_code: string | null;
  level: string | null;
  semester: string | null;
  material_type: string;
  downloads: number | null;
  created_at: string;
};

export type Chips = {
  level?: number;
  semester?: string;
  type?: string;
};

const WEAK_THRESHOLD = 0.6;
const MIN_ATTEMPTS = 2;

type WeakAreaMap = Map<string, number>;
type WeakAreaResult = {
  attemptsCount: number;
  weakAreas: WeakAreaMap;
};
type WeakAttemptRow = {
  score: number | null;
  total_questions: number | null;
  study_quiz_sets:
    | { course_code: string | null }
    | Array<{ course_code: string | null }>
    | null;
};

interface ForYouSectionProps {
  chips: Chips;
  setChips: Dispatch<SetStateAction<Chips>>;
  onClearFilters: () => void;
}

async function fetchWeakAreas(): Promise<WeakAreaResult> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { attemptsCount: 0, weakAreas: new Map() };

  const { data, error } = await supabase
    .from("study_practice_attempts")
    .select("score, total_questions, study_quiz_sets(course_code)")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .not("total_questions", "is", null)
    .gt("total_questions", 0)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data?.length) {
    return { attemptsCount: 0, weakAreas: new Map() };
  }

  const acc = new Map<string, { totalScore: number; totalQs: number; count: number }>();

  for (const row of data as WeakAttemptRow[]) {
    const joined = Array.isArray(row.study_quiz_sets)
      ? row.study_quiz_sets[0]
      : row.study_quiz_sets;
    const code = (joined?.course_code ?? "").toString().trim().toUpperCase();
    if (!code) continue;

    const score = Number(row.score ?? 0);
    const total = Number(row.total_questions ?? 0);
    if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0) continue;

    const current = acc.get(code) ?? { totalScore: 0, totalQs: 0, count: 0 };
    acc.set(code, {
      totalScore: current.totalScore + score,
      totalQs: current.totalQs + total,
      count: current.count + 1,
    });
  }

  const weakAreas = new Map<string, number>();
  for (const [code, { totalScore, totalQs, count }] of acc) {
    if (count < MIN_ATTEMPTS) continue;
    const accuracy = totalScore / totalQs;
    if (accuracy < WEAK_THRESHOLD) weakAreas.set(code, accuracy);
  }

  return { attemptsCount: data.length, weakAreas };
}

export function summarizeChips(chips: Chips, quickLevel: number): string | null {
  const parts: string[] = [];
  if (chips.level) parts.push(`${chips.level === quickLevel ? quickLevel : chips.level}L`);
  if (chips.semester === "first") parts.push("1st sem");
  if (chips.semester === "second") parts.push("2nd sem");
  if (chips.type === "past_question") parts.push("Past Qs");
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ForYouSection({
  chips,
  setChips,
  onClearFilters,
}: ForYouSectionProps) {
  const { prefs, isProfileComplete, courseIds, loading: prefsLoading } = useStudyPrefs();
  const quickLevel = prefs?.level ?? 100;
  const [items, setItems] = useState<MaterialMini[]>([]);
  const [fetching, setFetching] = useState(false);
  const [weakAreas, setWeakAreas] = useState<WeakAreaMap>(new Map());
  const [attemptsCount, setAttemptsCount] = useState<number | null>(null);
  const [weakLoading, setWeakLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<"for_you" | "popular">("for_you");

  useEffect(() => {
    let cancelled = false;

    fetchWeakAreas()
      .then(({ attemptsCount: nextAttemptsCount, weakAreas: nextWeakAreas }) => {
        if (cancelled) return;
        setAttemptsCount(nextAttemptsCount);
        setWeakAreas(nextWeakAreas);
        setWeakLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAttemptsCount(0);
        setWeakAreas(new Map());
        setWeakLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (prefsLoading || weakLoading || attemptsCount === null || !isProfileComplete || !prefs) return;
    const activePrefs = prefs;
    let cancelled = false;

    async function fetchForYou() {
      setFetching(true);

      if (courseIds.length === 0) {
        setItems([]);
        setFetching(false);
        return;
      }

      let query = supabase
        .from("study_materials")
        .select("id,title,course_code,level,semester,material_type,downloads,created_at")
        .eq("approved", true)
        .in("course_id", courseIds);

      if (activePrefs.department_id) {
        query = query.eq("department_id", activePrefs.department_id);
      } else if (activePrefs.department) {
        query = query.ilike("department", `%${activePrefs.department}%`);
      }

      if (!activePrefs.department_id) {
        if (activePrefs.faculty_id) query = query.eq("faculty_id", activePrefs.faculty_id);
        else if (activePrefs.faculty) query = query.ilike("faculty", `%${activePrefs.faculty}%`);
      }

      if (activePrefs.level) query = query.eq("level", String(activePrefs.level));
      if (chips.level) query = query.eq("level", String(chips.level));
      if (chips.semester) query = query.eq("semester", chips.semester);
      if (chips.type) query = query.eq("material_type", chips.type);

      if (attemptsCount === 0) {
        setMode("popular");
        query = query
          .order("downloads", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(4);
      } else {
        setMode("for_you");
        query = query.order("created_at", { ascending: false }).limit(12);
      }

      const { data, error } = await query;
      if (cancelled) return;

      setItems(!error ? ((data as MaterialMini[]) ?? []) : []);
      setFetching(false);
    }

    void fetchForYou();
    return () => {
      cancelled = true;
    };
  }, [
    attemptsCount,
    chips.level,
    chips.semester,
    chips.type,
    courseIds,
    isProfileComplete,
    prefs,
    prefsLoading,
    weakLoading,
  ]);

  const sortedItems = useMemo(() => {
    if (mode !== "for_you" || !weakAreas.size || !items.length) return items;

    return [...items].sort((a, b) => {
      const aWeak = weakAreas.has((a.course_code ?? "").toUpperCase());
      const bWeak = weakAreas.has((b.course_code ?? "").toUpperCase());
      if (aWeak && !bWeak) return -1;
      if (!aWeak && bWeak) return 1;
      return 0;
    });
  }, [items, mode, weakAreas]);

  const isBoostingActive =
    mode === "for_you" &&
    !weakLoading &&
    weakAreas.size > 0 &&
    sortedItems.some((item) => weakAreas.has((item.course_code ?? "").toUpperCase()));

  const summary = summarizeChips(chips, quickLevel);
  const hasChips = Boolean(summary);
  const loading = prefsLoading || weakLoading || fetching;

  if (prefsLoading || !isProfileComplete) return null;

  function toggleFiltersOpen() {
    setFiltersOpen((wasOpen) => {
      track("study_home_filter_opened", { was_open: wasOpen });
      return !wasOpen;
    });
  }

  function updateChips(updater: (previous: Chips) => Chips) {
    setChips((previous) => {
      const next = updater(previous);
      if (summarizeChips(next, quickLevel) === null) {
        setFiltersOpen(false);
      }
      return next;
    });
  }

  function handleToggleType() {
    updateChips((previous) => {
      const active = previous.type !== "past_question";
      track("study_home_filter_toggled", { chip: "past_question", active });
      return { ...previous, type: active ? "past_question" : undefined };
    });
  }

  function handleToggleFirstSemester() {
    updateChips((previous) => {
      const active = previous.semester !== "first";
      track("study_home_filter_toggled", { chip: "first", active });
      return { ...previous, semester: active ? "first" : undefined };
    });
  }

  function handleToggleSecondSemester() {
    updateChips((previous) => {
      const active = previous.semester !== "second";
      track("study_home_filter_toggled", { chip: "second", active });
      return { ...previous, semester: active ? "second" : undefined };
    });
  }

  function handleToggleLevel() {
    updateChips((previous) => {
      const active = previous.level !== quickLevel;
      track("study_home_filter_toggled", { chip: "level", active });
      return { ...previous, level: active ? quickLevel : undefined };
    });
  }

  const sectionTitle =
    mode === "popular"
      ? prefs?.department?.trim()
        ? `Popular in ${prefs.department.trim()}`
        : "Popular for you"
      : "For you";

  const sectionSubtitle =
    mode === "popular"
      ? "Trending with your classmates"
      : isBoostingActive
      ? "Weak-area courses boosted to the top - more practice = higher scores."
      : "Fresh uploads matching your preferences.";

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-extrabold text-foreground">{sectionTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{sectionSubtitle}</p>
          </div>

          <button
            type="button"
            onClick={toggleFiltersOpen}
            className={cn(
              "shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <Filter className="h-4 w-4" />
            {summary ?? "Filter"} <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
        </div>

        {filtersOpen ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleToggleType}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                chips.type === "past_question"
                  ? "border-[#5B35D5]/25 bg-[#EEEDFE] text-[#3B24A8]"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                PQ
              </span>
              Past Questions
            </button>
            <button
              type="button"
              onClick={handleToggleFirstSemester}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                chips.semester === "first"
                  ? "border-[#5B35D5]/25 bg-[#EEEDFE] text-[#3B24A8]"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Clock className="h-4 w-4" />
              1st Sem
            </button>
            <button
              type="button"
              onClick={handleToggleSecondSemester}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                chips.semester === "second"
                  ? "border-[#5B35D5]/25 bg-[#EEEDFE] text-[#3B24A8]"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Clock className="h-4 w-4" />
              2nd Sem
            </button>
            <button
              type="button"
              onClick={handleToggleLevel}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                chips.level === quickLevel
                  ? "border-[#5B35D5]/25 bg-[#EEEDFE] text-[#3B24A8]"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <GraduationCap className="h-4 w-4" />
              {quickLevel}L
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : sortedItems.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {sortedItems.map((material, index) => (
            <MaterialCard
              key={material.id}
              m={material}
              weakAccuracy={weakAreas.get((material.course_code ?? "").toUpperCase())}
              context="for-you"
              onClick={() =>
                trackHomeCta("for_you_card", {
                  material_id: material.id,
                  material_type: material.material_type,
                  position: index + 1,
                })
              }
            />
          ))}
        </div>
      ) : hasChips ? (
        <EmptyState
          variant="compact"
          title="No matches for these filters"
          description="Try clearing the filters above to see your recommendations."
          action={
            <button
              type="button"
              onClick={() => {
                onClearFilters();
                setFiltersOpen(false);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2",
                "text-sm font-semibold text-foreground hover:bg-secondary/50"
              )}
            >
              <X className="h-4 w-4" /> Clear filters
            </button>
          }
          icon={Filter}
        />
      ) : (
        <EmptyState
          variant="compact"
          title={mode === "popular" ? "No popular materials yet" : "No recommendations yet"}
          description={
            mode === "popular"
              ? "Check Materials or search for a course code."
              : "Check Materials or search for a course code."
          }
          action={
            <Link
              href="/study/library"
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2",
                "text-sm font-semibold text-foreground hover:bg-secondary/50"
              )}
            >
              Browse materials <ArrowRight className="h-4 w-4" />
            </Link>
          }
          icon={Bookmark}
        />
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}

export function Section({ title, subtitle, href, hrefLabel, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-extrabold text-foreground">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className={cn(
              "shrink-0 inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2",
              "text-sm font-semibold text-foreground hover:bg-secondary/50"
            )}
          >
            {hrefLabel ?? "See all"} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function MaterialCard({
  m,
  trending,
  weakAccuracy,
  context = "for-you",
  onClick,
}: {
  m: MaterialMini;
  trending?: boolean;
  weakAccuracy?: number;
  context?: "for-you" | "trending";
  onClick?: () => void;
}) {
  const [renderedAt] = useState(() => Date.now());
  const href = `/study/materials/${encodeURIComponent(m.id)}`;
  const isWeak = weakAccuracy !== undefined;
  const accuracyPct = isWeak ? Math.round(weakAccuracy * 100) : null;
  const isNew = renderedAt - new Date(m.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  const effectiveContext = trending ? "trending" : context;

  let rightElement: ReactNode;
  if (effectiveContext === "trending") {
    rightElement = (
      <div className="shrink-0 text-right">
        <p className="text-sm font-extrabold text-foreground">{m.downloads ?? 0}</p>
        <p className="text-[10px] text-muted-foreground">downloads</p>
      </div>
    );
  } else if (!isWeak) {
    rightElement = isNew ? (
      <span className="shrink-0 self-start rounded-full border border-[#5B35D5]/20 bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-semibold text-[#3B24A8] dark:text-indigo-300">
        New
      </span>
    ) : (
      <span className="shrink-0 self-start rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Dept. pick
      </span>
    );
  } else {
    rightElement = null;
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm hover:bg-secondary/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isWeak ? "border-amber-300/50 dark:border-amber-700/40" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-extrabold text-foreground">
            {(m.title ?? m.course_code ?? "Material").replace(/_/g, " ")}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {(m.course_code ? `${m.course_code} - ` : "") + (m.material_type ?? "material")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {m.level ? (
              <span className="rounded-full border border-border bg-background px-2 py-1">
                {m.level}
              </span>
            ) : null}
            {m.semester ? (
              <span className="rounded-full border border-border bg-background px-2 py-1">
                {m.semester}
              </span>
            ) : null}
            {isWeak ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50 px-2 py-1 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                Needs work - {accuracyPct}%
              </span>
            ) : null}
          </div>
        </div>
        {rightElement}
      </div>
    </Link>
  );
}

export function Skeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-muted" />
        <div className="h-6 w-20 rounded-full bg-muted" />
      </div>
    </div>
  );
}
