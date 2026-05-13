"use client";

// app/study/search/page.tsx

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  GraduationCap,
  Loader2,
  MessageCircleQuestion,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

type MaterialHit = {
  id: string;
  title: string | null;
  material_type: string | null;
  downloads: number | null;
  created_at: string | null;
  course_code: string | null;
  level: number | null;
  semester: string | null;
};

type CourseHit = {
  id: string;
  course_code: string;
  course_title: string | null;
  level: number | null;
  semester: string | null;
  faculty: string | null;
  department: string | null;
};

type QuestionHit = {
  id: string;
  title: string | null;
  upvotes_count: number | null;
  answers_count: number | null;
  created_at: string | null;
  course_code: string | null;
};

type QuizSetHit = {
  id: string;
  title: string | null;
  course_code: string | null;
  level: number | null;
  semester: string | null;
  questions_count: number | null;
  created_at: string | null;
};

type Results = {
  materials: MaterialHit[];
  courses: CourseHit[];
  questions: QuestionHit[];
  quizSets: QuizSetHit[];
};

type TabKey = "all" | "materials" | "courses" | "questions" | "quizSets";

// ─── Helpers ───────────────────────────────────────────────────────────────

function pill(text: string) {
  return (
    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {text}
    </span>
  );
}

function typeLabel(t: string | null) {
  if (!t) return "File";
  const m: Record<string, string> = {
    past_question: "Past Question",
    handout: "Handout",
    slide: "Slides",
    note: "Notes",
    textbook: "Textbook",
    other: "Other",
  };
  return m[t] ?? t;
}

// ─── Tab bar ───────────────────────────────────────────────────────────────

function TabBar({
  active,
  counts,
  onChange,
}: {
  active: TabKey;
  counts: Record<TabKey, number>;
  onChange: (t: TabKey) => void;
}) {
  const tabs: Array<{ k: TabKey; label: string; icon: React.ReactNode }> = [
    { k: "all", label: "All", icon: <Sparkles className="h-3.5 w-3.5" /> },
    {
      k: "materials",
      label: "Materials",
      icon: <BookOpen className="h-3.5 w-3.5" />,
    },
    {
      k: "courses",
      label: "Courses",
      icon: <GraduationCap className="h-3.5 w-3.5" />,
    },
    {
      k: "questions",
      label: "Q&A",
      icon: <MessageCircleQuestion className="h-3.5 w-3.5" />,
    },
    {
      k: "quizSets",
      label: "Practice",
      icon: <Zap className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map(({ k, label, icon }) => {
        const n = counts[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active === k
                ? "border-border bg-secondary text-foreground"
                : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            {icon}
            {label}
            {n > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active === k
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {n}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ─── Result sections ────────────────────────────────────────────────────────

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-extrabold text-foreground">{title}</p>
      <span className="text-xs text-muted-foreground">{count} found</span>
    </div>
  );
}

function MaterialResults({ items }: { items: MaterialHit[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <SectionHead title="Materials" count={items.length} />
      {items.map((m) => (
        <Link
          key={m.id}
          href={`/study/materials/${encodeURIComponent(m.id)}`}
          className={cn(
            "flex items-start gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-secondary/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {m.title ?? m.course_code ?? "Untitled"}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {m.course_code ? pill(m.course_code.toUpperCase()) : null}
              {m.level ? pill(`${m.level}L`) : null}
              {m.material_type ? pill(typeLabel(m.material_type)) : null}
              {m.downloads != null ? pill(`${m.downloads} ↓`) : null}
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}

function CourseResults({ items }: { items: CourseHit[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <SectionHead title="Courses" count={items.length} />
      {items.map((c) => (
        <Link
          key={c.id}
          href={`/study/library?q=${encodeURIComponent(c.course_code)}`}
          className={cn(
            "flex items-start gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-secondary/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {c.course_code}{" "}
              {c.course_title ? (
                <span className="font-normal text-muted-foreground">
                  — {c.course_title}
                </span>
              ) : null}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {c.level ? pill(`${c.level}L`) : null}
              {c.semester ? pill(c.semester) : null}
              {c.department ? pill(c.department) : null}
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}

function QuestionResults({ items }: { items: QuestionHit[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <SectionHead title="Q&A" count={items.length} />
      {items.map((q) => (
        <Link
          key={q.id}
          href={`/study/questions/${encodeURIComponent(q.id)}`}
          className={cn(
            "flex items-start gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-secondary/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <MessageCircleQuestion className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold text-foreground">
              {q.title ?? "Untitled question"}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {q.course_code ? pill(q.course_code.toUpperCase()) : null}
              {q.answers_count != null
                ? pill(`${q.answers_count} answers`)
                : null}
              {q.upvotes_count != null
                ? pill(`${q.upvotes_count} ↑`)
                : null}
              {q.created_at ? (
                <span className="text-[11px] text-muted-foreground">
                  {timeAgo(q.created_at)}
                </span>
              ) : null}
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}

function QuizSetResults({ items }: { items: QuizSetHit[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <SectionHead title="Practice sets" count={items.length} />
      {items.map((s) => (
        <Link
          key={s.id}
          href={`/study/practice/${encodeURIComponent(s.id)}`}
          className={cn(
            "flex items-start gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-secondary/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <Zap className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {s.title ?? "Untitled set"}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {s.course_code ? pill(s.course_code.toUpperCase()) : null}
              {s.level ? pill(`${s.level}L`) : null}
              {s.questions_count != null
                ? pill(`${s.questions_count} questions`)
                : null}
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}

// ─── Main search client ────────────────────────────────────────────────────

function SearchClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const qParam = sp.get("q") ?? "";

  const [query, setQuery] = useState(qParam);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync query to URL
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      router.replace("/study/search");
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      router.replace(`/study/search?q=${encodeURIComponent(trimmed)}`);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, router]);

  // Fetch results when qParam changes
  useEffect(() => {
    if (!qParam.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    fetch(`/api/study/search?q=${encodeURIComponent(qParam)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setResults(d as Results);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [qParam]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const total =
    (results?.materials.length ?? 0) +
    (results?.courses.length ?? 0) +
    (results?.questions.length ?? 0) +
    (results?.quizSets.length ?? 0);

  const counts: Record<TabKey, number> = useMemo(
    () => ({
      all: total,
      materials: results?.materials.length ?? 0,
      courses: results?.courses.length ?? 0,
      questions: results?.questions.length ?? 0,
      quizSets: results?.quizSets.length ?? 0,
    }),
    [results, total]
  );

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      {/* Nav */}
      <div className="flex items-center gap-3">
        <Link
          href="/study"
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2",
            "text-sm font-semibold text-foreground no-underline hover:bg-secondary/50"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        {/* Search input */}
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Materials, courses, Q&A, practice sets…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-secondary"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Tabs — only shown when we have results */}
      {results && qParam ? (
        <TabBar active={tab} counts={counts} onChange={setTab} />
      ) : null}

      {/* No query state */}
      {!qParam && !loading ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-base font-extrabold text-foreground">
            Search everything
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Search across materials, courses, Q&amp;A questions, and practice
            sets — all at once.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["BCH 201", "Anatomy", "Past Questions", "Biochemistry"].map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                >
                  {s}
                </button>
              )
            )}
          </div>
        </div>
      ) : null}

      {/* Empty results */}
      {qParam && !loading && results && total === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold text-foreground">
            No results for &ldquo;{qParam}&rdquo;
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a shorter query, a course code, or a topic keyword.
          </p>
        </div>
      ) : null}

      {/* Results */}
      {results && total > 0 ? (
        <div className="space-y-5">
          {(tab === "all" || tab === "materials") && (
            <MaterialResults items={results.materials} />
          )}
          {(tab === "all" || tab === "courses") && (
            <CourseResults items={results.courses} />
          )}
          {(tab === "all" || tab === "questions") && (
            <QuestionResults items={results.questions} />
          )}
          {(tab === "all" || tab === "quizSets") && (
            <QuizSetResults items={results.quizSets} />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Page export ────────────────────────────────────────────────────────────

export default function StudySearchPage() {
  return (
    <Suspense>
      <SearchClient />
    </Suspense>
  );
}
