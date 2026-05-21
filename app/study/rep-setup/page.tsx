"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Plus, Loader2, ChevronDown, GraduationCap } from "lucide-react";
import { StudyPrefsProvider, useStudyPrefs } from "@/app/study/_components/StudyPrefsContext";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  course_code: string;
  course_title: string | null;
  level: number;
  semester: string;
};

type AddState = {
  code: string;
  title: string;
  semester: "first" | "second" | "summer";
  saving: boolean;
  error: string | null;
};

const SEMESTERS: { value: "first" | "second" | "summer"; label: string }[] = [
  { value: "first", label: "1st Semester" },
  { value: "second", label: "2nd Semester" },
  { value: "summer", label: "Summer" },
];

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function RepSetupPage() {
  return (
    <StudyPrefsProvider>
      <RepSetupInner />
    </StudyPrefsProvider>
  );
}

// ─── Inner (needs context) ────────────────────────────────────────────────────

function RepSetupInner() {
  const router = useRouter();
  const { rep, loading: ctxLoading } = useStudyPrefs();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Per-level add-course form state
  const [addStates, setAddStates] = useState<Record<number, AddState>>({});

  const levels = rep.scope?.levels ?? [];

  // Load existing courses for this rep's scope
  useEffect(() => {
    if (ctxLoading || rep.loading) return;
    fetch("/api/study/rep-setup/courses", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setCourses(json.courses ?? []);
      })
      .finally(() => setLoadingCourses(false));
  }, [ctxLoading, rep.loading]);

  // Initialise add-form state for each level
  useEffect(() => {
    const initial: Record<number, AddState> = {};
    for (const lvl of levels) {
      initial[lvl] = { code: "", title: "", semester: "first", saving: false, error: null };
    }
    setAddStates(initial);
  }, [levels.join(",")]);

  function updateField(level: number, field: keyof AddState, value: string) {
    setAddStates((prev) => ({
      ...prev,
      [level]: { ...prev[level], [field]: value },
    }));
  }

  async function addCourse(level: number) {
    const s = addStates[level];
    if (!s || !s.code.trim()) return;

    setAddStates((prev) => ({ ...prev, [level]: { ...prev[level], saving: true, error: null } }));

    const res = await fetch("/api/study/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_code: s.code, course_title: s.title || null, level, semester: s.semester }),
    });
    const json = await res.json();

    if (!json.ok) {
      setAddStates((prev) => ({
        ...prev,
        [level]: { ...prev[level], saving: false, error: json.error ?? "Failed to add course." },
      }));
      return;
    }

    setCourses((prev) => [...prev, json.course]);
    setAddStates((prev) => ({
      ...prev,
      [level]: { code: "", title: "", semester: "first", saving: false, error: null },
    }));
  }

  async function handleComplete() {
    setCompleting(true);
    setCompleteError(null);

    const res = await fetch("/api/study/rep-setup/complete", { method: "POST" });
    const json = await res.json();

    if (!json.ok) {
      setCompleteError(json.error ?? "Something went wrong.");
      setCompleting(false);
      return;
    }

    router.replace("/study");
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const coursesByLevel: Record<number, Course[]> = {};
  for (const c of courses) {
    if (!coursesByLevel[c.level]) coursesByLevel[c.level] = [];
    coursesByLevel[c.level].push(c);
  }

  const missingLevels = levels.filter((l) => !(coursesByLevel[l]?.length > 0));
  const allDone = missingLevels.length === 0 && levels.length > 0;

  if (ctxLoading || rep.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 pb-28 md:pb-10">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-950">
          <GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Set up your department's courses</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            As a course rep, add all courses your department offers before your classmates can start uploading materials
            or practicing. At least one course per level is required.
          </p>
        </div>
      </div>

      {/* Progress pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {levels.map((lvl) => {
          const done = (coursesByLevel[lvl]?.length ?? 0) > 0;
          return (
            <span
              key={lvl}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                done
                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {done && <CheckCircle2 className="h-3.5 w-3.5" />}
              {lvl} Level
            </span>
          );
        })}
      </div>

      {/* Per-level sections */}
      {loadingCourses ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {levels.map((lvl) => (
            <LevelSection
              key={lvl}
              level={lvl}
              courses={coursesByLevel[lvl] ?? []}
              addState={addStates[lvl] ?? { code: "", title: "", semester: "first", saving: false, error: null }}
              onField={(field, val) => updateField(lvl, field as keyof AddState, val)}
              onAdd={() => addCourse(lvl)}
            />
          ))}
        </div>
      )}

      {/* Finish button */}
      <div className="mt-8 border-t border-border pt-6">
        {completeError && (
          <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {completeError}
          </p>
        )}
        <button
          onClick={handleComplete}
          disabled={!allDone || completing}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all",
            allDone
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          {completing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Finishing…
            </>
          ) : allDone ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Finish Setup
            </>
          ) : (
            `Add courses for ${missingLevels.map((l) => `${l} Level`).join(", ")} to continue`
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Per-level section ────────────────────────────────────────────────────────

type LevelSectionProps = {
  level: number;
  courses: Course[];
  addState: AddState;
  onField: (field: string, value: string) => void;
  onAdd: () => void;
};

function LevelSection({ level, courses, addState, onField, onAdd }: LevelSectionProps) {
  const codeRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onAdd();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-purple-500" />
          {level} Level
        </h2>
        <span className="text-xs text-muted-foreground">
          {courses.length} {courses.length === 1 ? "course" : "courses"} added
        </span>
      </div>

      {/* Course list */}
      {courses.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {courses.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-1.5 text-xs"
            >
              <span className="font-mono font-medium text-foreground">{c.course_code}</span>
              <span className="ml-2 truncate text-muted-foreground">{c.course_title ?? ""}</span>
              <span className="ml-auto shrink-0 pl-2 capitalize text-muted-foreground">{c.semester}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:grid-cols-[120px_1fr_auto_auto]">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Course Code</label>
          <input
            ref={codeRef}
            type="text"
            value={addState.code}
            onChange={(e) => onField("code", e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. CSC 201"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div className="hidden sm:block">
          <label className="mb-1 block text-xs text-muted-foreground">Title (optional)</label>
          <input
            type="text"
            value={addState.title}
            onChange={(e) => onField("title", e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Course title"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Semester</label>
          <div className="relative">
            <select
              value={addState.semester}
              onChange={(e) => onField("semester", e.target.value)}
              className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-7 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            >
              {SEMESTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        <button
          onClick={onAdd}
          disabled={!addState.code.trim() || addState.saving}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-xl transition-colors",
            addState.code.trim()
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "bg-muted text-muted-foreground"
          )}
        >
          {addState.saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {addState.error && (
        <p className="mt-2 text-xs text-destructive">{addState.error}</p>
      )}
    </div>
  );
}
