"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Plus, Loader2, GraduationCap, XCircle } from "lucide-react";
import { StudyPrefsProvider, useStudyPrefs } from "@/app/study/_components/StudyPrefsContext";
import { Drawer } from "@/components/ui/Drawer";
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
  { value: "first", label: "1st Sem" },
  { value: "second", label: "2nd Sem" },
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
  const { rep, prefs, loading: ctxLoading } = useStudyPrefs();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [addStates, setAddStates] = useState<Record<number, AddState>>({});

  const levels = rep.scope?.levels ?? [];

  useEffect(() => {
    if (ctxLoading || rep.loading) return;
    fetch("/api/study/rep-setup/courses", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => { if (json.ok) setCourses(json.courses ?? []); })
      .finally(() => setLoadingCourses(false));
  }, [ctxLoading, rep.loading]);

  const defaultSemester = (prefs?.semester as AddState["semester"] | undefined) ?? "first";

  useEffect(() => {
    const initial: Record<number, AddState> = {};
    for (const lvl of levels) {
      initial[lvl] = { code: "", title: "", semester: defaultSemester, saving: false, error: null };
    }
    setAddStates(initial);
  }, [levels.join(","), defaultSemester]);

  function updateField(level: number, field: keyof AddState, value: string) {
    setAddStates((prev) => ({ ...prev, [level]: { ...prev[level], [field]: value } }));
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
      [level]: { code: "", title: "", semester: defaultSemester, saving: false, error: null },
    }));
  }

  async function handleConfirmedComplete() {
    setCompleting(true);
    setCompleteError(null);

    const res = await fetch("/api/study/rep-setup/complete", { method: "POST" });
    const json = await res.json();

    if (!json.ok) {
      setCompleteError(json.error ?? "Something went wrong.");
      setCompleting(false);
      setConfirmOpen(false);
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

  const completedLevels = levels.filter((l) => (coursesByLevel[l]?.length ?? 0) > 0).length;
  const missingLevels = levels.filter((l) => !(coursesByLevel[l]?.length > 0));
  const allDone = missingLevels.length === 0 && levels.length > 0;
  const pct = levels.length > 0 ? (completedLevels / levels.length) * 100 : 0;

  if (ctxLoading || rep.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-32 md:pb-12">

      {/* ── Header ── */}
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">Course Setup</h1>
            <p className="text-xs text-muted-foreground">
              Add at least one course per level so your classmates can upload materials &amp; practise.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{completedLevels} of {levels.length} levels done</span>
            {allDone && (
              <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> All set!
              </span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                allDone ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Level pills ── */}
      <div className="mb-5 flex flex-wrap gap-2">
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
              {done
                ? <CheckCircle2 className="h-3 w-3" />
                : <span className="h-3 w-3 rounded-full border border-current opacity-50" />}
              {lvl} Level
            </span>
          );
        })}
      </div>

      {/* ── Per-level sections ── */}
      {loadingCourses ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {levels.map((lvl) => (
            <LevelSection
              key={lvl}
              level={lvl}
              courses={coursesByLevel[lvl] ?? []}
              addState={addStates[lvl] ?? { code: "", title: "", semester: defaultSemester, saving: false, error: null }}
              onField={(field, val) => updateField(lvl, field as keyof AddState, val)}
              onAdd={() => addCourse(lvl)}
            />
          ))}
        </div>
      )}

      {/* ── Finish ── */}
      <div className="mt-8 border-t border-border pt-6 space-y-3">
        {completeError && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {completeError}
          </p>
        )}

        {!allDone && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-destructive">Still needed before you can finish:</p>
            {missingLevels.map((lvl) => (
              <div key={lvl} className="flex items-center gap-2 text-xs text-destructive/80">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {lvl} Level — add at least 1 course
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => allDone && setConfirmOpen(true)}
          disabled={!allDone}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-semibold transition-all",
            allDone
              ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] shadow-sm"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          {allDone ? "Finish Setup" : "Complete all levels to continue"}
        </button>
      </div>

      {/* ── Confirmation drawer ── */}
      <Drawer
        open={confirmOpen}
        onClose={() => !completing && setConfirmOpen(false)}
        title="Ready to finish?"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={completing}
              className="flex-1 rounded-2xl border border-border bg-background py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              Go back
            </button>
            <button
              onClick={handleConfirmedComplete}
              disabled={completing}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {completing ? "Finishing…" : "Yes, finish setup"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Once you finish, your classmates can start uploading materials and practising. Here's what you've set up:
          </p>

          {levels.map((lvl) => {
            const lvlCourses = coursesByLevel[lvl] ?? [];
            return (
              <div key={lvl}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {lvl} Level — {lvlCourses.length} course{lvlCourses.length === 1 ? "" : "s"}
                </p>
                <div className="space-y-1.5">
                  {lvlCourses.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
                      <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary shrink-0">
                        {c.course_code}
                      </span>
                      <span className="flex-1 truncate text-xs text-foreground">{c.course_title ?? "—"}</span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                        {c.semester}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Drawer>
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
  const done = courses.length > 0;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onAdd();
  }

  return (
    <div className={cn(
      "rounded-2xl border bg-card shadow-sm overflow-hidden transition-colors",
      done ? "border-green-200 dark:border-green-900" : "border-border"
    )}>
      {/* Card header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        done
          ? "bg-green-50 border-green-100 dark:bg-green-950/40 dark:border-green-900"
          : "border-border"
      )}>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className={cn("h-4 w-4", done ? "text-green-600 dark:text-green-400" : "text-primary")} />
          {level} Level
        </h2>
        <span className={cn(
          "text-xs font-medium",
          done ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        )}>
          {done
            ? `${courses.length} course${courses.length === 1 ? "" : "s"} added ✓`
            : "No courses yet"}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Course list */}
        {courses.length > 0 && (
          <div className="space-y-2">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-3 py-2.5">
                <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary shrink-0">
                  {c.course_code}
                </span>
                <span className="flex-1 truncate text-xs text-foreground">{c.course_title ?? ""}</span>
                <span className="shrink-0 rounded-full bg-background border border-border px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                  {c.semester === "first" ? "1st" : c.semester === "second" ? "2nd" : "Sum"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Add form ── */}
        <div className="space-y-2.5">
          {/* Course Code */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Course Code</label>
            <input
              ref={codeRef}
              type="text"
              value={addState.code}
              onChange={(e) => onField("code", e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. CSC 201"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Course Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Course Title <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              type="text"
              value={addState.title}
              onChange={(e) => onField("title", e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Anatomy of Thorax, Abdomen and Pelvis"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Semester pill selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Semester</label>
            <div className="flex gap-2">
              {SEMESTERS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onField("semester", s.value)}
                  className={cn(
                    "flex-1 rounded-xl py-2.5 text-xs font-medium transition-all",
                    addState.semester === s.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add button */}
          <button
            onClick={onAdd}
            disabled={!addState.code.trim() || addState.saving}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
              addState.code.trim()
                ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            )}
          >
            {addState.saving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
              : <><Plus className="h-4 w-4" /> Add Course</>}
          </button>
        </div>

        {addState.error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {addState.error}
          </p>
        )}
      </div>
    </div>
  );
}
