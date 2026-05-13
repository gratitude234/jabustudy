// app/study/onboarding/OnboardingClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/studyAnalytics";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircleQuestion,
  School,
  Layers,
  Sparkles,
  X,
  Search,
  Zap,
  UploadCloud,
} from "lucide-react";
import { Card } from "../_components/StudyUI";
import { cn, normalizeStr as normalize, currentAcademicSessionFallback } from "@/lib/utils";

// Fetches the active academic session from the calendar table,
// falling back to a computed value so we never hardcode a year.
async function fetchCurrentSession(supabaseClient: typeof supabase): Promise<string> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Active session (today falls within its date range)
    const { data: active } = await supabaseClient
      .from("study_academic_calendar")
      .select("session")
      .lte("starts_on", today)
      .gte("ends_on", today)
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (active?.session) return String(active.session);

    // 2. Most recently ended session (we're in a holiday gap)
    const { data: recent } = await supabaseClient
      .from("study_academic_calendar")
      .select("session")
      .order("ends_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.session) return String(recent.session);
  } catch {
    // Fall through to computed default
  }

  // 3. Compute from current date — no hardcoded year needed
  return currentAcademicSessionFallback();
}

const SEMESTERS = [
  { value: "first", label: "1st Semester" },
  { value: "second", label: "2nd Semester" },
  { value: "summer", label: "Summer" },
];

type FacultyRow = { id: string; name: string; sort_order?: number | null };
type DeptRow = {
  id: string;
  faculty_id: string;
  name: string;
  sort_order?: number | null;
};

type Step = 1 | 2 | 3 | 4;



function Banner({
  tone = "info",
  title,
  description,
  onClose,
}: {
  tone?: "info" | "error" | "success";
  title: string;
  description?: string;
  onClose?: () => void;
}) {
  const toneCls =
    tone === "error"
      ? "border-rose-300/40 bg-rose-100/30 dark:bg-rose-950/20"
      : tone === "success"
      ? "border-emerald-300/40 bg-emerald-100/30 dark:bg-emerald-950/20"
      : "border-border bg-card";

  return (
    <div className={cn("rounded-3xl border p-4", toneCls)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-foreground">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ProgressPill({ step, total }: { step: number; total: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-extrabold text-foreground">
      Step {step} of {total}
    </div>
  );
}

/**
 * SearchSelect: mobile-friendly searchable picker (no extra libs)
 */
function SearchSelect({
  label,
  icon,
  placeholder,
  items,
  valueId,
  onChangeId,
  disabled,
  helper,
  emptyText = "No matches",
}: {
  label: string;
  icon?: React.ReactNode;
  placeholder: string;
  items: Array<{ id: string; label: string; meta?: string }>;
  valueId: string;
  onChangeId: (id: string) => void;
  disabled?: boolean;
  helper?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => items.find((x) => x.id === valueId) ?? null, [items, valueId]);

  const filtered = useMemo(() => {
    const needle = normalize(q).toLowerCase();
    if (!needle) return items.slice(0, 30);
    const ranked = items
      .map((x) => {
        const hay = `${x.label} ${x.meta ?? ""}`.toLowerCase();
        const score =
          hay.startsWith(needle) ? 0 : hay.includes(needle) ? 1 : 999; // simple rank
        return { x, score };
      })
      .filter((r) => r.score !== 999)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.x);
    return ranked.slice(0, 40);
  }, [items, q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    // keep input text aligned when selection changes
    if (selected && !q) {
      // no-op (we only update q when user types)
    }
  }, [selected, q]);

  return (
    <div ref={boxRef} className={cn("relative", disabled ? "opacity-70" : "")}>
      <label className="block text-xs font-extrabold text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "mt-1 flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          disabled ? "cursor-not-allowed" : "hover:bg-secondary/40"
        )}
        aria-label={`${label} picker`}
      >
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", selected ? "text-foreground" : "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </p>
          {selected?.meta ? <p className="mt-0.5 text-xs text-muted-foreground">{selected.meta}</p> : null}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {helper ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</p> : null}

      {open ? (
        <div className="absolute left-0 right-0 top-[86px] z-50 rounded-3xl border border-border bg-card p-3 shadow-xl">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full bg-transparent text-sm text-foreground outline-none"
              autoFocus
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="rounded-xl p-1 hover:bg-secondary/60"
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : null}
          </div>

          <div className="mt-2 max-h-[280px] overflow-auto pr-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm font-semibold text-muted-foreground">{emptyText}</p>
            ) : (
              <div className="grid gap-1">
                {filtered.map((it) => {
                  const active = it.id === valueId;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        onChangeId(it.id);
                        setOpen(false);
                        setQ("");
                      }}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-2 text-left",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        active ? "border-border bg-secondary" : "border-border/70 bg-background hover:bg-secondary/40"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-foreground">{it.label}</p>
                        {it.meta ? <p className="mt-0.5 text-xs text-muted-foreground">{it.meta}</p> : null}
                      </div>
                      {active ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQ("");
              }}
              className="rounded-2xl border border-border bg-background px-3 py-2 text-xs font-extrabold text-foreground hover:bg-secondary/50"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function OnboardingClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => {
    const raw = (sp.get("next") ?? "/study").trim();
    return raw.startsWith("/") ? raw : "/study";
  }, [sp]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Stepper
  const [step, setStep] = useState<Step>(1);

  // Official lists
  const [officialOk, setOfficialOk] = useState(true);
  const [faculties, setFaculties] = useState<FacultyRow[]>([]);
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  // Manual override
  const [manualMode, setManualMode] = useState(false);
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");

  // Level + semester + session (session loaded dynamically from academic calendar)
  const [level, setLevel] = useState<number | "">("");
  const [semester, setSemester] = useState<string>("");
  const [session, setSession] = useState<string>("");

  // Inline messages (no alert)
  const [banner, setBanner] = useState<{ tone: "info" | "error" | "success"; title: string; description?: string } | null>(
    null
  );

  const totalSteps = 3;

  // Step 4 (results screen) state
  const [step4Loading, setStep4Loading] = useState(false);
  const [step4Data, setStep4Data] = useState<{ materials: number | null; quizSets: number | null; questions: number | null } | null>(null);

  const facultyItems = useMemo(
    () => faculties.map((f) => ({ id: f.id, label: f.name })),
    [faculties]
  );

  const deptItems = useMemo(() => {
    return (departments ?? []).map((d) => ({
      id: d.id,
      label: (d.name || "Department").trim(),
    }));
  }, [departments]);

  const canContinueStep1 = useMemo(() => {
    if (manualMode) return normalize(faculty).length >= 2 && normalize(department).length >= 2;
    return !!facultyId && !!departmentId;
  }, [manualMode, faculty, department, facultyId, departmentId]);

  const canContinueStep2 = useMemo(() => {
    return typeof level === "number" && Number.isFinite(level) && !!semester;
  }, [level, semester]);

  const isValidAll = canContinueStep1 && canContinueStep2;

  // Boot: auth + official lists + prefs
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setBanner(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent("/study/onboarding")}`);
        return;
      }

      // Load faculties (official)
      const facRes = await supabase
        .from("study_faculties")
        .select("id,name,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (!mounted) return;

      if (facRes.error) {
        setOfficialOk(false);
        setFaculties([]);
        setBanner({
          tone: "error",
          title: "Couldn't load the faculty list",
          description: "Check your connection and reload, or use manual entry.",
        });
      } else if ((facRes.data ?? []).length === 0) {
        setOfficialOk(false);
        setFaculties([]);
        setBanner({
          tone: "info",
          title: "No faculties available yet",
          description: "Switch to manual entry to type your faculty and department.",
        });
      } else {
        setOfficialOk(true);
        setFaculties((facRes.data ?? []) as FacultyRow[]);
      }

      // Load the active academic session from the calendar table (no hardcoded year)
      const activeSession = await fetchCurrentSession(supabase);

      // Load existing prefs — canonical table only (legacy migrated via SQL migration)
      const normRes = await supabase
        .from("study_preferences")
        .select("faculty_id,department_id,level,semester,session")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const norm: any = !normRes.error ? normRes.data : null;
      const d: any = {
        ...(norm ?? {}),
        session: norm?.session ?? activeSession,
        semester: norm?.semester ?? "",
      };

      // Auto-detect semester from academic calendar.
      // If user has no semester yet, we fetch it from RPC using the current session.
      if (!d?.semester) {
        const sess = d.session as string;
        try {
          const { data: semRows } = await supabase.rpc("get_current_semester", { p_session: sess });
          const sem = Array.isArray(semRows) && semRows.length ? (semRows[0] as any)?.semester : null;
          if (sem) {
            d.semester = String(sem);
          } else {
            const { data: semRows2 } = await supabase.rpc("get_current_semester_fallback", { p_session: sess });
            const sem2 = Array.isArray(semRows2) && semRows2.length ? (semRows2[0] as any)?.semester : null;
            if (sem2) d.semester = String(sem2);
          }
          if (d.semester) {
            await supabase
              .from("study_preferences")
              .upsert(
                { user_id: user.id, semester: d.semester, session: sess, updated_at: new Date().toISOString() },
                { onConflict: "user_id" }
              );
          }
        } catch {
          // Ignore RPC errors; user can still pick manually.
        }
      }

      // Only consider onboarding done if the user picked from the official list (has IDs)
      const alreadyDone = !!(d?.level && d?.semester && d?.faculty_id && d?.department_id);
      if (alreadyDone) {
        router.replace(next);
        return;
      }

      // Prefill state from saved prefs
      if (d) {
        if (typeof d.faculty_id === "string") setFacultyId(d.faculty_id);
        if (typeof d.department_id === "string") setDepartmentId(d.department_id);
        if (typeof d.level === "number") setLevel(d.level);
        if (typeof d.semester === "string") setSemester(d.semester);
        if (typeof d.session === "string") setSession(d.session);
      }

      // Smart default step
      const step1Ready = typeof d?.faculty_id === "string" && typeof d?.department_id === "string";
      const step2Ready = typeof d?.level === "number" && typeof d?.semester === "string" && !!d?.semester;
      setStep(step2Ready ? 3 : step1Ready ? 2 : 1);

      setLoading(false);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router, next]);

  // Load departments when faculty changes (official mode)
  useEffect(() => {
    if (!officialOk) return;
    if (manualMode) return;

    if (!facultyId) {
      setDepartments([]);
      setDepartmentId("");
      return;
    }

    let mounted = true;
    (async () => {
      const res = await supabase
        .from("study_departments")
        .select("id,faculty_id,name,sort_order")
        .eq("faculty_id", facultyId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (!mounted) return;

      if (res.error) {
        setDepartments([]);
        setBanner({
          tone: "error",
          title: "Couldn't load departments",
          description: "Check your connection and reload, or switch to manual entry.",
        });
        return;
      }

      if ((res.data ?? []).length === 0) {
        setDepartments([]);
        setBanner({
          tone: "info",
          title: "No departments found for this faculty",
          description: "Switch to manual entry to type your department.",
        });
        return;
      }

      setDepartments((res.data ?? []) as DeptRow[]);
    })();

    return () => {
      mounted = false;
    };
  }, [officialOk, manualMode, facultyId]);

  function goNext() {
    setBanner(null);

    if (step === 1) {
      if (!canContinueStep1) {
        setBanner({
          tone: "error",
          title: "Complete your faculty and department",
          description: manualMode
            ? "Type at least 2 characters for both fields."
            : "Pick your faculty, then pick your department.",
        });
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!canContinueStep2) {
        setBanner({
          tone: "error",
          title: "Select your level and semester",
          description: "This helps us show the right practice sets and materials.",
        });
        return;
      }
      setStep(3);
      return;
    }
  }

  function goBack() {
    setBanner(null);
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  }

  function skip() {
    // Record the dismissal in localStorage so the nudge doesn't keep reappearing,
    // without writing an empty prefs row that would corrupt the "For You" section.
    try {
      localStorage.setItem("jabuStudy_skipOnboarding", "1");
    } catch {
      // ignore — private browsing may block localStorage
    }
    router.replace(next);
  }

  async function saveAll() {
    if (!isValidAll) {
      setBanner({
        tone: "error",
        title: "Almost there",
        description: "Please complete the required fields before saving.",
      });
      return;
    }

    setSaving(true);
    setBanner(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent("/study/onboarding")}`);
        return;
      }

      const selectedFaculty = manualMode
        ? normalize(faculty)
        : faculties.find((f) => f.id === facultyId)?.name ?? "";
      const selectedDeptRow = manualMode ? null : departments.find((d) => d.id === departmentId) ?? null;
      const selectedDepartment = manualMode
        ? normalize(department)
        : normalize(String(selectedDeptRow?.name || ""));

      // Build payload for study_preferences (the single canonical table)
      const prefsPayload: any = {
        user_id: user.id,
        level,
        semester,
        session,
        updated_at: new Date().toISOString(),
      };

      if (!manualMode) {
        prefsPayload.faculty_id = facultyId;
        prefsPayload.department_id = departmentId;
      }

      const { error } = await supabase.from("study_preferences").upsert(prefsPayload);
      if (error) throw error;

      // Clear browse/setup escape flags now that real prefs are saved.
      try {
        localStorage.removeItem("jabuStudy_skipOnboarding");
        localStorage.removeItem("jabuStudy_browseWithoutSetup");
      } catch {}

      router.replace("/study");
      router.refresh();
      return;

      // Transition to results screen (step 4) instead of immediate redirect
      setStep(4);
      setStep4Loading(true);

      try {
        // Fetch course IDs for the user's department+level to count materials
        let courseIds: string[] = [];
        if (departmentId && typeof level === "number") {
          const { data: courseRows } = await supabase
            .from("study_courses")
            .select("id")
            .eq("department_id", departmentId)
            .eq("level", level)
            .eq("status", "approved");
          courseIds = (courseRows ?? []).map((r: { id: string }) => r.id);
        }

        const [matsResult, setsResult, qsResult] = await Promise.allSettled([
          courseIds.length > 0
            ? supabase
                .from("study_materials")
                .select("id", { count: "exact", head: true })
                .eq("approved", true)
                .in("course_id", courseIds)
            : supabase
                .from("study_materials")
                .select("id", { count: "exact", head: true })
                .eq("approved", true)
                .limit(0),
          typeof level === "number"
            ? supabase
                .from("study_quiz_sets")
                .select("id", { count: "exact", head: true })
                .eq("published", true)
                .eq("level", level)
            : Promise.resolve({ count: 0, error: null }),
          typeof level === "number"
            ? supabase
                .from("study_questions")
                .select("id", { count: "exact", head: true })
                .eq("solved", false)
                .eq("level", String(level))
            : Promise.resolve({ count: 0, error: null }),
        ]);

        const countFrom = (result: PromiseSettledResult<{ count: number | null }>) =>
          result.status === "fulfilled" ? result.value.count ?? null : null;

        setStep4Data({
          materials: countFrom(matsResult as PromiseSettledResult<{ count: number | null }>),
          quizSets: countFrom(setsResult as PromiseSettledResult<{ count: number | null }>),
          questions: countFrom(qsResult as PromiseSettledResult<{ count: number | null }>),
        });
      } catch {
        setStep4Data({ materials: null, quizSets: null, questions: null });
      } finally {
        setStep4Loading(false);
      }

      router.refresh();
    } catch (e: any) {
      setBanner({
        tone: "error",
        title: "Couldn’t save your setup",
        description: e?.message ?? "Try again. If it keeps failing, you can skip for now.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 pb-28 md:pb-6">
        <Card className="rounded-3xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading setup…
          </div>
        </Card>
      </div>
    );
  }

  // Review strings
  const reviewFaculty = manualMode ? normalize(faculty) : faculties.find((f) => f.id === facultyId)?.name ?? "";
  const reviewDept = manualMode
    ? normalize(department)
    : normalize(String(departments.find((d) => d.id === departmentId)?.name || ""));

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      {/* Header */}
      <Card className="rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-extrabold tracking-tight text-foreground">Set up Jabu Study</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quick setup so we can show the right materials + practice sets for you. You can change this later.
            </p>
          </div>

          {step !== 4 && (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <ProgressPill step={step} total={totalSteps} />
              <button
                type="button"
                onClick={skip}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-extrabold text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Skip
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Banner */}
      {banner ? (
        <div className="mt-3">
          <Banner tone={banner.tone} title={banner.title} description={banner.description} onClose={() => setBanner(null)} />
        </div>
      ) : null}

      {/* Step content */}
      <div className="mt-3 space-y-3">
        {/* STEP 1 */}
        {step === 1 ? (
          <Card className="rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-foreground">Your faculty & department</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose from the official list, or type manually if yours isn’t listed.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBanner(null);
                  setManualMode((v) => !v);
                  // reset official picks if switching to manual and nothing is selected
                  if (!manualMode) {
                    setFaculty("");
                    setDepartment("");
                  }
                }}
                className="shrink-0 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-extrabold text-foreground hover:bg-secondary/50"
              >
                {manualMode ? "Use official list" : "Type manually"}
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {!manualMode ? (
                <>
                  <SearchSelect
                    label="Faculty"
                    icon={<School className="h-4 w-4" />}
                    placeholder="Pick your faculty"
                    items={facultyItems}
                    valueId={facultyId}
                    onChangeId={(id) => {
                      setFacultyId(id);
                      setDepartmentId("");
                      setDepartments([]);
                    }}
                    helper={officialOk ? "Search and pick. Departments load after selecting faculty." : "Official list unavailable"}
                  />

                  <SearchSelect
                    label="Department"
                    icon={<Building2 className="h-4 w-4" />}
                    placeholder={facultyId ? "Pick your department" : "Select faculty first"}
                    items={deptItems}
                    valueId={departmentId}
                    onChangeId={(id) => setDepartmentId(id)}
                    disabled={!facultyId}
                    helper={!facultyId ? "Choose faculty to unlock departments." : "Search and pick your department."}
                    emptyText={facultyId ? "No departments found. Try manual typing." : "Select faculty first."}
                  />

                  <div className="rounded-2xl border border-border bg-card p-3">
                    <p className="text-xs font-extrabold text-foreground">Can’t find your department?</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Switch to manual typing only if your department is missing. Official choices unlock full personalization.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="text-xs font-extrabold text-muted-foreground inline-flex items-center gap-2">
                      <School className="h-4 w-4" /> Faculty
                    </span>
                    <input
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                      placeholder="e.g. College of Health Sciences"
                      className={cn(
                        "mt-1 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground outline-none",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      )}
                      aria-label="Faculty"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-extrabold text-muted-foreground inline-flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Department
                    </span>
                    <input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Nursing"
                      className={cn(
                        "mt-1 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground outline-none",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      )}
                      aria-label="Department"
                    />
                  </label>

                  <div className="rounded-2xl border border-border bg-card p-3">
                    <p className="text-xs font-extrabold text-foreground">Tip</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Manual entries are saved, but full personalization starts after your department is added to the official list.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={skip}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground hover:bg-secondary/50"
              >
                Skip for now <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={!canContinueStep1}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold",
                  canContinueStep1
                    ? "bg-secondary text-foreground hover:opacity-90"
                    : "border border-border/60 bg-background text-muted-foreground opacity-60"
                )}
              >
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ) : null}

        {/* STEP 2 */}
        {step === 2 ? (
          <Card className="rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-foreground">Your level & semester</p>
                <p className="mt-1 text-sm text-muted-foreground">This helps us tailor what you see on Study Home.</p>
              </div>
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-extrabold text-muted-foreground inline-flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Level
                </span>
                <select
                  value={level === "" ? "" : String(level)}
                  onChange={(e) => setLevel(e.target.value ? Number(e.target.value) : "")}
                  className={cn(
                    "mt-1 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                  aria-label="Level"
                >
                  <option value="">Select level</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-extrabold text-muted-foreground">Semester</span>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className={cn(
                    "mt-1 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                  aria-label="Semester"
                >
                  <option value="">Select semester</option>
                  {SEMESTERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground hover:bg-secondary/50"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={!canContinueStep2}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold",
                  canContinueStep2
                    ? "bg-secondary text-foreground hover:opacity-90"
                    : "border border-border/60 bg-background text-muted-foreground opacity-60"
                )}
              >
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ) : null}

        {/* STEP 3 */}
        {step === 3 ? (
          <Card className="rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-foreground">Review</p>
                <p className="mt-1 text-sm text-muted-foreground">Confirm these details. You can change them later.</p>
              </div>
              <div className="rounded-2xl border border-border bg-background px-3 py-2 text-xs font-extrabold text-foreground">
                Ready
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="text-xs font-extrabold text-muted-foreground">Faculty</p>
                <p className="mt-1 text-sm font-extrabold text-foreground">{reviewFaculty || "—"}</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="text-xs font-extrabold text-muted-foreground">Department</p>
                <p className="mt-1 text-sm font-extrabold text-foreground">{reviewDept || "—"}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-xs font-extrabold text-muted-foreground">Level</p>
                  <p className="mt-1 text-sm font-extrabold text-foreground">{level || "—"}</p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-xs font-extrabold text-muted-foreground">Semester</p>
                  <p className="mt-1 text-sm font-extrabold text-foreground">
                    {SEMESTERS.find((s) => s.value === semester)?.label ?? "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="text-xs font-extrabold text-foreground">Why we ask</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  We use this to personalize Study Home, filter materials, and recommend relevant practice sets.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goBack}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-extrabold text-foreground hover:bg-secondary/50 disabled:opacity-60"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>

              <button
                type="button"
                onClick={saveAll}
                disabled={!isValidAll || saving}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold sm:w-auto",
                  isValidAll ? "bg-secondary text-foreground hover:opacity-90" : "border border-border/60 bg-background text-muted-foreground opacity-60"
                )}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Finish setup
              </button>
            </div>

            <div className="mt-3 text-center">
              <Link href={next} className="text-xs font-extrabold text-muted-foreground hover:text-foreground">
                Continue without saving
              </Link>
            </div>
          </Card>
        ) : null}

        {/* STEP 4 — Results screen */}
        {step === 4 ? (
          <Card className="rounded-3xl">
            {step4Loading ? (
              <div className="space-y-3">
                <div className="h-8 w-32 animate-pulse rounded-full bg-secondary" />
                <div className="h-5 w-48 animate-pulse rounded-full bg-secondary" />
                <div className="flex gap-2">
                  <div className="h-8 w-28 animate-pulse rounded-full bg-secondary" />
                  <div className="h-8 w-28 animate-pulse rounded-full bg-secondary" />
                  <div className="h-8 w-28 animate-pulse rounded-full bg-secondary" />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-extrabold text-foreground">You&apos;re in.</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reviewDept && `${reviewDept} · `}{typeof level === "number" ? `${level}L` : ""}{semester && ` · ${SEMESTERS.find((s) => s.value === semester)?.label ?? ""} Semester`}
                </p>

                {/* Stat chips */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
                    {step4Data?.materials != null ? step4Data.materials : "—"} materials available
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
                    {step4Data?.quizSets != null ? step4Data.quizSets : "—"} practice sets
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
                    {step4Data?.questions != null ? step4Data.questions : "—"} open questions
                  </span>
                </div>

                {/* Primary CTA — dynamic based on available content */}
                <div className="mt-6">
                  {(step4Data?.quizSets ?? 0) > 0 ? (
                    <button
                      type="button"
                      onClick={async () => {
                        track("study_onboarding_first_set_started");
                        try {
                          const response = await fetch("/api/study/first-set-pick", {
                            credentials: "same-origin",
                          });
                          const payload = await response.json();
                          if (payload?.ok && payload.set?.id) {
                            router.replace(`/study/practice/${encodeURIComponent(payload.set.id)}`);
                          } else {
                            router.replace("/study/practice");
                          }
                        } catch {
                          router.replace("/study/practice");
                        }
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl bg-secondary px-5 py-4 hover:opacity-90 transition"
                    >
                      <Zap className="h-5 w-5 text-foreground" />
                      <p className="text-sm font-extrabold text-foreground">Start your first set</p>
                    </button>
                  ) : (step4Data?.materials ?? 0) > 0 ? (
                    <Link
                      href="/study/library"
                      className="flex w-full items-center gap-3 rounded-2xl bg-secondary px-5 py-4 hover:opacity-90 transition"
                    >
                      <BookOpen className="h-5 w-5 text-foreground" />
                      <p className="text-sm font-extrabold text-foreground">
                        Browse materials ({step4Data!.materials} available)
                      </p>
                    </Link>
                  ) : (
                    <Link
                      href="/study"
                      className="flex w-full items-center gap-3 rounded-2xl bg-secondary px-5 py-4 hover:opacity-90 transition"
                    >
                      <BookOpen className="h-5 w-5 text-foreground" />
                      <p className="text-sm font-extrabold text-foreground">Explore Study Hub</p>
                    </Link>
                  )}
                </div>

                {/* Secondary CTAs */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href="/study/questions/ask"
                    className="flex flex-col gap-2 rounded-2xl border bg-background p-4 hover:bg-secondary/30 transition"
                  >
                    <MessageCircleQuestion className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-extrabold text-foreground">Ask a question</p>
                  </Link>
                  <Link
                    href="/study/materials/upload"
                    className="flex flex-col gap-2 rounded-2xl border bg-background p-4 hover:bg-secondary/30 transition"
                  >
                    <UploadCloud className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-extrabold text-foreground">Upload materials</p>
                  </Link>
                </div>

                <div className="mt-4 text-center">
                  <Link
                    href="/study"
                    onClick={() => track("study_onboarding_first_set_skipped")}
                    className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Go to Study Hub →
                  </Link>
                </div>
              </>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
