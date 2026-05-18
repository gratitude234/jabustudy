"use client";
// app/study/materials/upload/page.tsx
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  GraduationCap,
  Building2,
  FileText,
  Image as ImageIcon,
  Presentation,
  BookOpen,
  Hash,
  Info,
  X,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Users,
  FileQuestion,
  Calendar,
  Paperclip,
  RefreshCw,
  Flag,
  File as FileIcon,
} from "lucide-react";
import { Card, EmptyState } from "../../_components/StudyUI";

const DRAFT_KEY = "jabuStudy_uploadDraft";

// ─── Types ────────────────────────────────────────────────────────────────────

type Semester     = "first" | "second" | "summer";
type MaterialType = "past_question" | "handout" | "slides" | "note" | "timetable" | "other";
type Role         = "course_rep" | "dept_librarian";
type MeStatus     = "not_applied" | "pending" | "approved" | "rejected";

type CourseRow = {
  id: string;
  faculty_id: string | null;
  department_id: string | null;
  level: number;
  course_code: string;
  course_title: string | null;
  semester: Semester;
};

type RepMeResponse = {
  ok: boolean;
  status?: MeStatus;
  role?: Role | null;
  scope?: {
    faculty_id: string | null;
    department_id: string | null;
    levels: number[] | null;
    all_levels?: boolean;
  } | null;
  application?: {
    decision_reason?: string | null;
    note?: string | null;
    status?: string;
  } | null;
};

type UploadInitPayload = {
  bucket: string;
  path: string;
  token: string;
  material_id: string;
  auto_approved: boolean;
};

type UploadInitResponse =
  | ({ ok: true } & UploadInitPayload)
  | { ok: false; code?: string; message?: string; duplicate_of?: { id: string; title?: string; created_at?: string } | null };

type CreateCourseResponse =
  | { ok: true; course: CourseRow }
  | { ok: false; code?: string; error?: string };

type ParsedMeta = {
  courseCode?: string;
  materialType?: MaterialType;
  year?: number;
};

type FileEntry = {
  id: string;
  file: File;
  hash: string | null;
  hashing: boolean;
  parsed: ParsedMeta | null;
  title: string;
  materialType: MaterialType;
  pqYear: number | "";
  pqSession: string;
  expanded: boolean;
};

type QueueStatus = "queued" | "uploading" | "done" | "failed";

type QueueEntry = {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  error?: string;
  retryPayload?: UploadInitPayload;
  courseId: string;
  title: string;
  materialType: MaterialType;
  semester: Semester;
  pqYear: number | "";
  pqSession: string;
  description: string;
  hash: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MATERIAL_TYPES: Array<{
  key: MaterialType;
  label: string;
  icon: any;
  hint: string;
  accept: string[];
}> = [
  { key: "past_question", label: "Past question", icon: FileQuestion, hint: "Needs year", accept: ["application/pdf", "image/*"] },
  { key: "handout",       label: "Handout",        icon: FileText,    hint: "PDF",        accept: ["application/pdf"] },
  { key: "slides",        label: "Slides",          icon: Presentation,hint: "PDF",        accept: ["application/pdf"] },
  { key: "note",          label: "Lecture note",    icon: BookOpen,    hint: "PDF",        accept: ["application/pdf"] },
  { key: "timetable",     label: "Timetable",       icon: Calendar,    hint: "PDF / img",  accept: ["application/pdf", "image/*"] },
  { key: "other",         label: "Other",            icon: Paperclip,   hint: "PDF / img",  accept: ["application/pdf", "image/*"] },
];

const LEVEL_LABEL = (n: number) => `${n}L`;

const ACCEPT_STR = [
  "application/pdf",
  "image/*",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
].join(",");

// ─── Utilities ────────────────────────────────────────────────────────────────

async function sha256(file: File): Promise<string> {
  const buf     = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function friendlyError(code?: string, message?: string) {
  if (code === "NO_SESSION")              return "Please log in to continue.";
  if (code === "NOT_STUDY_MODERATOR" || code === "NOT_APPROVED") return "You don't have upload access yet.";
  if (code === "REP_SCOPE_MISCONFIGURED") return "Your upload scope isn't set up. Contact admin.";
  if (code === "DUPLICATE_FOUND")         return "This looks like a duplicate of an existing upload.";
  return message || "Something went wrong. Please try again.";
}

function normalizeCourseCode(input: string) {
  const raw = input.trim().toUpperCase().replace(/\s+/g, " ");
  const m = raw.match(/^([A-Z]{2,6})\s*([0-9]{2,4}[A-Z]?)$/);
  if (m) return `${m[1]} ${m[2]}`;
  return raw;
}

function fmtBytes(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Smart filename parser (Change 5) ─────────────────────────────────────────

function parseFilename(filename: string): ParsedMeta {
  const result: ParsedMeta = {};

  // Course code: e.g. CSC201, CSC 201, BIO301
  const courseMatch = filename.match(/\b([A-Za-z]{2,6})\s*([0-9]{2,4}[A-Za-z]?)\b/);
  if (courseMatch) {
    result.courseCode = `${courseMatch[1].toUpperCase()} ${courseMatch[2].toUpperCase()}`;
  }

  // Material type keyword map
  if (/\b(pq|past[_. ]?q(uestion)?|pastq|exam|test)\b/i.test(filename)) {
    result.materialType = "past_question";
  } else if (/\b(note|notes|lec|lecture)\b/i.test(filename)) {
    result.materialType = "note";
  } else if (/\b(slide|slides|ppt)\b/i.test(filename)) {
    result.materialType = "slides";
  } else if (/\b(handout|hand[_.]?out)\b/i.test(filename)) {
    result.materialType = "handout";
  } else if (/\b(timetable|tt)\b/i.test(filename)) {
    result.materialType = "timetable";
  }

  // Year: 20XX
  const yearMatch = filename.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    result.year = parseInt(yearMatch[1], 10);
  }

  return result;
}

function getFileIcon(mime: string) {
  if (mime.includes("pdf")) return <FileText className="h-5 w-5 text-rose-500" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-sky-500" />;
  if (mime.includes("presentation") || mime.includes("powerpoint")) return <Presentation className="h-5 w-5 text-orange-500" />;
  if (mime.includes("word") || mime.includes("document")) return <FileText className="h-5 w-5 text-blue-500" />;
  return <FileIcon className="h-5 w-5 text-zinc-500" />;
}

// Concurrency-limited runner (cap = 3)
async function runConcurrent<T>(tasks: Array<() => Promise<T>>, cap: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(cap, tasks.length) }, () => worker()));
  return results;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UploadMaterialsPage() {
  const router = useRouter();

  // Wizard: 1=files, 2=course, 3=details, "queue"=queue view
  const [step, setStep] = useState<1 | 2 | 3 | "queue">(1);

  // Auth + rep status
  const [loading,  setLoading]  = useState(true);
  const [userId,   setUserId]   = useState<string | null>(null);
  const [me,       setMe]       = useState<RepMeResponse | null>(null);
  const [repDeptName, setRepDeptName] = useState<string | null>(null);

  const isRep       = me?.ok && me.status === "approved" && !!me.scope?.department_id && !!me.role;
  const role: Role | null = (me?.role as Role) ?? null;
  const departmentId  = me?.scope?.department_id ?? null;
  const allowedLevels = me?.scope?.levels ?? null;

  // Student scope from study_preferences (populated in auth effect)
  const [scopedDeptId,    setScopedDeptId]    = useState<string>("");
  const [scopedFacultyId, setScopedFacultyId] = useState<string>("");
  const [scopedLevel,     setScopedLevel]     = useState<number | null>(null);

  // Courses
  const [courses,        setCourses]        = useState<CourseRow[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [q,              setQ]              = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [recentCourseIds,  setRecentCourseIds]  = useState<string[]>([]);

  // Create course modal
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [reqCode,     setReqCode]     = useState("");
  const [reqTitle,    setReqTitle]    = useState("");
  const [reqLevel,    setReqLevel]    = useState<number>(0);
  const [reqSemester, setReqSemester] = useState<Semester>("first");
  const [reqLoading,  setReqLoading]  = useState(false);

  // Global fields
  const [semester,    setSemester]    = useState<Semester>("first");
  const [description, setDescription] = useState("");

  // Multi-file state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files,      setFiles]      = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [autoFillBanner, setAutoFillBanner] = useState(false);

  // Upload queue
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  // Banner
  const [banner, setBanner] = useState<{ type: "error" | "success" | "info" | "warning"; text: string } | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );
  const allUploadsDone = queue.length > 0 && queue.every((e) => e.status === "done");

  const scopeBadge = useMemo(() => {
    if (!isRep) return null;
    if (role === "dept_librarian") return "Dept scoped · All levels";
    const lvls = Array.isArray(allowedLevels) && allowedLevels.length
      ? allowedLevels.map(LEVEL_LABEL).join(", ") : "—";
    return `Dept scoped · ${lvls}`;
  }, [isRep, role, allowedLevels]);

  // ── Load auth + rep status ─────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setBanner(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          router.replace("/login?next=%2Fstudy%2Fmaterials%2Fupload");
          return;
        }
        const uid = auth.user.id;
        const [meRes, prefsRes] = await Promise.all([
          fetch("/api/study/rep-applications/me").then((r) => r.json() as Promise<RepMeResponse>),
          supabase.from("study_preferences").select("department_id,faculty_id,level").eq("user_id", uid).maybeSingle(),
        ]);
        if (!mounted) return;
        setMe(meRes);
        const prefsData = !prefsRes.error ? prefsRes.data : null;
        if (prefsData) {
          setScopedDeptId(String((prefsData as any)?.department_id ?? "").trim());
          setScopedFacultyId(String((prefsData as any)?.faculty_id ?? "").trim());
          const lv = (prefsData as any)?.level;
          setScopedLevel(typeof lv === "number" ? lv : null);
        }
        // Set userId last so the course-loading effect fires after prefs are known
        if (mounted) setUserId(uid);

        // Restore draft
        try {
          const raw = window.localStorage.getItem(DRAFT_KEY);
          if (raw) {
            const draft = JSON.parse(raw);
            if (draft.courseId) setSelectedCourseId(draft.courseId);
            if (draft.q) setQ(draft.q);
            if (draft.semester) setSemester(draft.semester);
            if (draft.description) setDescription(draft.description);
          }
        } catch {}
      } catch (e: any) {
        if (!mounted) return;
        setBanner({ type: "error", text: e?.message || "Failed to load." });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    let mounted = true;
    setRepDeptName(null);
    if (!isRep || !departmentId) return () => { mounted = false; };

    void (async () => {
      try {
        const { data } = await supabase
          .from("study_departments")
          .select("name")
          .eq("id", departmentId)
          .maybeSingle();
        if (mounted) setRepDeptName(data?.name ?? null);
      } catch {}
    })();

    return () => { mounted = false; };
  }, [isRep, departmentId]);

  // ── Load recent courses ────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined"
        ? window.localStorage.getItem("jabuStudy_recentCourseIds") : null;
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr))
          setRecentCourseIds(arr.filter((x) => typeof x === "string").slice(0, 8));
      }
    } catch {}
  }, []);

  // ── Load courses ───────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!userId) return;
      setCoursesLoading(true);
      try {
        let query = supabase
          .from("study_courses")
          .select("id, faculty_id, department_id, level, course_code, course_title, semester")
          .order("level")
          .order("course_code");

        if (isRep && departmentId) {
          query = query.eq("department_id", departmentId);
          if (role === "course_rep") {
            const lvls = Array.isArray(allowedLevels) ? allowedLevels : [];
            if (lvls.length) query = query.in("level", lvls);
          }
        } else if (scopedDeptId) {
          // Regular student scoped to their own department + level from prefs
          query = query.eq("department_id", scopedDeptId);
          if (scopedLevel) query = query.eq("level", scopedLevel);
        } else {
          // No prefs set — cap the list so we don't load 3000+ courses
          query = query.limit(200);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!mounted) return;
        setCourses((data as any) || []);
      } catch (e: any) {
        if (!mounted) return;
        setBanner({ type: "error", text: e?.message || "Failed to load courses." });
      } finally {
        if (mounted) setCoursesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [userId, isRep, departmentId, role, allowedLevels, scopedDeptId, scopedLevel]);

  // ── Save draft ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
        courseId: selectedCourseId, q, semester, description,
      }));
    } catch {}
  }, [userId, selectedCourseId, q, semester, description]);

  // ── Clear draft when all uploads complete ─────────────────────────────────

  useEffect(() => {
    if (queue.length > 0 && queue.every((e) => e.status === "done")) {
      try { window.localStorage.removeItem(DRAFT_KEY); } catch {}
    }
  }, [queue]);

  function resetUpload() {
    setFiles([]);
    setQueue([]);
    setSelectedCourseId("");
    setQ("");
    setDescription("");
    setAutoFillBanner(false);
    setStep(1);
    try { window.localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredCourses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      if (!recentCourseIds.length) return courses;
      const set    = new Set(recentCourseIds);
      const recent = recentCourseIds
        .map((id) => courses.find((c) => c.id === id))
        .filter(Boolean) as CourseRow[];
      const rest = courses.filter((c) => !set.has(c.id));
      return [...recent, ...rest];
    }
    return courses.filter((c) => {
      const hay = `${c.course_code} ${c.course_title ?? ""} ${c.level} ${c.semester}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [courses, q, recentCourseIds]);

  const filesWithErrors = useMemo(() =>
    files.filter((f) => {
      if (f.materialType === "past_question") {
        if (!f.pqYear || typeof f.pqYear !== "number") return true;
        if (!f.pqSession || !f.pqSession.includes("/")) return true;
      }
      return false;
    }),
  [files]);

  const canSubmitStep3 = files.length > 0 && filesWithErrors.length === 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  function materialTitleSuggestion(course: CourseRow | null, type: MaterialType) {
    if (!course) return "";
    const base      = `${course.course_code}${course.course_title ? ` — ${course.course_title}` : ""}`;
    const typeLabel = MATERIAL_TYPES.find((x) => x.key === type)?.label ?? "Material";
    return `${base} (${typeLabel})`;
  }

  function openCreateCourse(prefill?: { code?: string }) {
    const guess = normalizeCourseCode(prefill?.code ?? q.trim());
    if (guess) setReqCode(guess);
    const lvls = Array.isArray(allowedLevels) ? allowedLevels : [];
    setReqLevel(isRep && role === "course_rep" ? (lvls?.[0] ?? 100) : 100);
    setReqSemester(semester);
    setReqTitle("");
    setShowCreateCourse(true);
  }

  function saveRecentCourse(id: string) {
    setRecentCourseIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 8);
      try { window.localStorage.setItem("jabuStudy_recentCourseIds", JSON.stringify(next)); }
      catch {}
      return next;
    });
  }

  function updateFile(id: string, updates: Partial<FileEntry>) {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, ...updates } : f));
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function addFiles(newFiles: File[]) {
    const entries: FileEntry[] = newFiles.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      hash: null,
      hashing: true,
      parsed: null,
      title: "",
      materialType: "other" as MaterialType,
      pqYear: "" as const,
      pqSession: "",
      expanded: false,
    }));

    setFiles((prev) => [...prev, ...entries]);

    const tasks = entries.map((entry) => async (): Promise<ParsedMeta> => {
      const parsed = parseFilename(entry.file.name);
      let hash: string | null = null;
      try { hash = await sha256(entry.file); } catch {}

      const typeLabel = parsed.materialType
        ? MATERIAL_TYPES.find((x) => x.key === parsed.materialType)?.label ?? ""
        : "";
      const suggestedTitle = parsed.courseCode
        ? `${parsed.courseCode}${typeLabel ? ` (${typeLabel})` : ""}`
        : entry.file.name.replace(/\.[^.]+$/, "");

      setFiles((prev) => prev.map((fe) => {
        if (fe.id !== entry.id) return fe;
        return {
          ...fe,
          hash,
          hashing: false,
          parsed,
          title: suggestedTitle,
          materialType: parsed.materialType ?? "other",
          pqYear: (parsed.materialType === "past_question" && parsed.year) ? parsed.year : "",
        };
      }));

      return parsed;
    });

    runConcurrent(tasks, 3).then((results) => {
      const anyFilled = results.some((r) => r.courseCode || r.materialType || r.year);
      if (anyFilled) setAutoFillBanner(true);

      const firstWithCode = results.find((r) => r.courseCode);
      if (firstWithCode?.courseCode) {
        const code = firstWithCode.courseCode;
        setQ(code);
        const matched = courses.filter(
          (c) => c.course_code.replace(/\s+/g, " ").toUpperCase() === code.toUpperCase()
        );
        if (matched.length === 1) {
          const c = matched[0];
          // Only auto-select if the course is within the user's scope
          const inScope = isRep
            ? (!departmentId || c.department_id === departmentId)
            : (!scopedDeptId || c.department_id === scopedDeptId);
          if (inScope) {
            setSelectedCourseId(c.id);
            saveRecentCourse(c.id);
          }
        } else if (matched.length > 1) {
          // Multiple matches across departments — pre-fill search but let user pick
          setBanner({ type: "warning", text: `Found multiple courses for "${code}" — please select the right one below.` });
        }
      }
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) addFiles(dropped);
  }

  async function flagCourse() {
    if (!q.trim()) return;
    const code = normalizeCourseCode(q.trim());
    setBanner(null);
    try {
      const res = await fetch("/api/study/course-requests/student", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ course_code: code, course_title: null, note: null }),
      });
      const data = await res.json();
      if (data?.already_pending) {
        setBanner({ type: "info", text: "Already flagged — check back soon." });
      } else if (data?.ok) {
        setBanner({ type: "success", text: "Flagged — your rep has been notified." });
      } else {
        setBanner({ type: "error", text: data?.error || "Failed to flag course." });
      }
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message || "Failed to flag." });
    }
  }

  async function submitCreateCourse() {
    if (reqLoading) return;
    const code = normalizeCourseCode(reqCode);
    if (!code) { setBanner({ type: "error", text: "Enter a course code." }); return; }
    if (!reqLevel) { setBanner({ type: "error", text: "Select a level." }); return; }
    if (isRep && role === "course_rep" && Array.isArray(allowedLevels) && allowedLevels.length) {
      if (!allowedLevels.includes(reqLevel)) {
        setBanner({ type: "error", text: "You can only create courses for your assigned level(s)." });
        return;
      }
    }
    setReqLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setBanner({ type: "error", text: "Please log in to create a course." });
        return;
      }

      const res = await fetch("/api/study-admin/courses", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          course_code: code, course_title: reqTitle.trim() || null,
          level: reqLevel, semester: reqSemester,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as CreateCourseResponse;
      if (!res.ok || !data?.ok) {
        const msg = (data as any)?.code === "COURSE_EXISTS"
          ? "That course already exists. Try searching again."
          : (data as any)?.error || "Failed to create course.";
        setBanner({ type: "error", text: msg });
        return;
      }
      const created = (data as any)?.course as CourseRow | undefined;
      if (created?.id) {
        setCourses((prev) => {
          const exists = prev.some((c) => c.id === created.id);
          const next   = exists ? prev : [created, ...prev];
          return next.slice().sort((a, b) => (a.level - b.level) || a.course_code.localeCompare(b.course_code));
        });
        setSelectedCourseId(created.id);
        setQ(created.course_code);
        saveRecentCourse(created.id);
      }
      setBanner({ type: "success", text: "Course created — continue your upload below." });
      setShowCreateCourse(false);
      setReqCode("");
      setReqTitle("");
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message || "Failed to create course." });
    } finally {
      setReqLoading(false);
    }
  }

  // ── Upload single file (used in queue) ─────────────────────────────────────

  async function uploadSingleFile(qEntry: QueueEntry, initPayloadOverride?: UploadInitPayload) {
    const updateQ = (updates: Partial<QueueEntry>) =>
      setQueue((prev) => prev.map((e) => e.id === qEntry.id ? { ...e, ...updates } : e));

    try {
      updateQ({ status: "uploading", progress: 0 });
      let payload = initPayloadOverride;

      if (!payload) {
        const initRes = await fetch("/api/study/materials/upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            course_id:          qEntry.courseId,
            material_type:      qEntry.materialType,
            title:              qEntry.title,
            description:        qEntry.description.trim() || null,
            past_question_year: qEntry.materialType === "past_question" ? qEntry.pqYear : null,
            session:            qEntry.materialType === "past_question" ? qEntry.pqSession.trim() : null,
            file_name:          qEntry.file.name,
            file_size:          qEntry.file.size,
            mime_type:          qEntry.file.type,
            file_hash:          qEntry.hash,
          }),
        }).then((r) => r.json() as Promise<UploadInitResponse>);

        if (!initRes.ok) {
          throw new Error(friendlyError(initRes.code, initRes.message));
        }

        payload = {
          bucket:        initRes.bucket,
          path:          initRes.path,
          token:         initRes.token,
          material_id:   initRes.material_id,
          auto_approved: initRes.auto_approved,
        };
        // Store payload immediately for retry
        updateQ({ retryPayload: payload });
      }

      const { bucket, path, token, material_id } = payload;

      const { error: uploadErr } = await (supabase.storage.from(bucket) as any).uploadToSignedUrl(
        path, token, qEntry.file,
        {
          onUploadProgress: (progress: { loaded: number; total: number }) => {
            if (progress.total > 0)
              updateQ({ progress: Math.round((progress.loaded / progress.total) * 100) });
          },
        }
      );
      if (uploadErr) throw new Error((uploadErr as any).message || "File upload failed.");

      // Complete
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const bearer = sessionData.session?.access_token;
        await fetch("/api/study/materials/upload/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
          body: JSON.stringify({ material_id }),
        });
      } catch {}

      updateQ({ status: "done", progress: 100, retryPayload: undefined });
    } catch (e: any) {
      updateQ({ status: "failed", error: e?.message || "Upload failed." });
    }
  }

  async function startUpload() {
    if (!selectedCourse) return;

    const queueEntries: QueueEntry[] = files.map((f) => ({
      id: f.id,
      file: f.file,
      status: "queued" as QueueStatus,
      progress: 0,
      courseId: selectedCourse.id,
      title: f.title.trim() || materialTitleSuggestion(selectedCourse, f.materialType),
      materialType: f.materialType,
      semester: selectedCourse.semester,
      pqYear: f.pqYear,
      pqSession: f.pqSession,
      description,
      hash: f.hash,
    }));

    setQueue((prev) => [...prev, ...queueEntries]);
    setStep("queue");

    // Process serially
    for (const entry of queueEntries) {
      await uploadSingleFile(entry);
    }
  }

  async function retryQueueEntry(id: string) {
    const entry = queue.find((e) => e.id === id);
    if (!entry) return;
    setQueue((prev) => prev.map((e) => e.id === id ? { ...e, status: "uploading", error: undefined, progress: 0 } : e));
    await uploadSingleFile(entry, entry.retryPayload);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-28 md:pb-6">

      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/study/library"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Link
            href="/study/materials/my"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/50"
          >
            My uploads
          </Link>
        </div>

        {isRep ? (
          <div className="hidden items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs text-muted-brand sm:flex">
            {role === "dept_librarian" ? <Building2 className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
            <span className="font-medium">{role === "dept_librarian" ? "Dept librarian" : "Course rep"}</span>
            <span className="opacity-40">·</span>
            <span className="truncate">{scopeBadge}</span>
          </div>
        ) : userId ? (
          <div className="hidden items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs text-muted-brand sm:flex">
            <Users className="h-4 w-4" />
            <span>Student upload</span>
          </div>
        ) : null}
      </div>

      {/* Page header */}
      <div>
        <h1 className="font-[family-name:var(--font-bricolage)] text-lg font-medium text-foreground">Upload materials</h1>
        <p className="mt-1 text-sm text-muted-brand">
          Anyone can contribute — uploads go to a review queue before going live.
        </p>
      </div>

      {/* Loading / auth gate */}
      {loading ? (
        <Card className="rounded-3xl">
          <div className="flex items-center gap-2 text-sm text-muted-brand">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        </Card>
      ) : !userId ? (
        <Card className="rounded-3xl">
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Sign in to upload"
            description="You need to be logged in to contribute materials."
            action={
              <Link
                href="/login?next=%2Fstudy%2Fmaterials%2Fupload"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white"
              >
                Sign in
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {isRep && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3",
                "border border-primary/30 bg-primary-light",
                "dark:border-primary/40 dark:bg-primary/10"
              )}
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary dark:text-indigo-300" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-primary-text dark:text-indigo-200">
                  Uploading as: {role === "dept_librarian" ? "Dept Librarian" : "Course Rep"}
                </p>
                <p className="mt-0.5 text-xs text-primary/70 dark:text-indigo-300">
                  {repDeptName ?? "Your department"}
                  {role === "course_rep" && allowedLevels?.length
                    ? ` · ${allowedLevels.map((l) => `${l}L`).join(", ")}`
                    : " · All levels"}{" "}
                  — uploads auto-approved
                </p>
              </div>
            </div>
          )}

          {/* Banner */}
          {banner && (
            <div
              className={cn(
                "rounded-2xl border p-4",
                banner.type === "success" && "border-emerald-300/40 bg-emerald-100/30 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200",
                banner.type === "error"   && "border-rose-300/40 bg-rose-100/30 text-rose-900 dark:bg-rose-950/20 dark:text-rose-200",
                banner.type === "info"    && "border-amber-300/40 bg-amber-100/30 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200",
                banner.type === "warning" && "border-amber-300/40 bg-amber-100/30 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
              )}
            >
              <div className="flex items-start gap-2">
                {banner.type === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                {banner.type === "error"   && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                {(banner.type === "info" || banner.type === "warning") && <Info className="mt-0.5 h-4 w-4 shrink-0" />}
                <p className="min-w-0 text-sm">{banner.text}</p>
              </div>
            </div>
          )}

          {/* Wizard step indicator */}
          {step !== "queue" && (
            <div className="flex items-center gap-1 text-xs text-muted-brand">
              {([1, 2, 3] as const).map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  {i > 0 && <span className="opacity-30">›</span>}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5",
                      step === s
                        ? "font-semibold text-foreground"
                        : "opacity-50"
                    )}
                  >
                    {s === 1 ? "Files" : s === 2 ? "Course" : "Details"}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* ── Step 1: Files ─────────────────────────────────────────────── */}
          {step === 1 && (
            <section className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-brand">
                Step 1 — Select files
              </p>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STR}
                capture="environment"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (picked.length) addFiles(picked);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition",
                  isDragging ? "border-primary bg-secondary/50" : "border-border bg-background hover:bg-secondary/30"
                )}
              >
                <UploadCloud
                  className={cn("mx-auto h-8 w-8 mb-3", isDragging ? "text-primary" : "text-muted-brand")}
                />
                <p className="text-sm font-medium text-foreground">Drop files here</p>
                <p className="mt-1 text-xs text-muted-brand">or tap to browse · multiple files allowed</p>
                <div className="mt-4 inline-block rounded-2xl border border-border bg-background px-4 py-2 text-xs font-medium text-foreground">
                  Choose files
                </div>
                <p className="mt-3 text-[10px] text-muted-brand">
                  PDF, images, Office docs · Max 50 MB each
                </p>
              </div>

              {/* Auto-fill banner */}
              {autoFillBanner && (
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-primary-light px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs text-primary-text">Auto-filled from filename</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoFillBanner(false)}
                    className="rounded-lg p-1 hover:bg-black/5"
                  >
                    <X className="h-3.5 w-3.5 text-primary-text" />
                  </button>
                </div>
              )}

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2.5"
                    >
                      <div className="shrink-0">{getFileIcon(f.file.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{f.file.name}</p>
                        <p className="text-xs text-muted-brand">
                          {fmtBytes(f.file.size)}
                          {f.hashing
                            ? " · Computing hash…"
                            : f.hash
                            ? ` · SHA-256: ${f.hash.slice(0, 12)}…`
                            : ""}
                        </p>
                      </div>
                      {f.hashing && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-brand" />}
                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border bg-background hover:bg-secondary/50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Desktop continue */}
              <div className="hidden justify-end sm:flex">
                <button
                  type="button"
                  disabled={files.length === 0}
                  onClick={() => setStep(2)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium transition",
                    files.length > 0 ? "bg-primary text-white" : "bg-secondary text-muted-brand"
                  )}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {/* Sticky (mobile) */}
              <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur sm:hidden">
                <button
                  type="button"
                  disabled={files.length === 0}
                  onClick={() => setStep(2)}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition",
                    files.length > 0 ? "bg-primary text-white" : "bg-secondary text-muted-brand"
                  )}
                >
                  {files.length === 0
                    ? "Add files to continue"
                    : `Continue with ${files.length} file${files.length === 1 ? "" : "s"} →`
                  }
                </button>
              </div>
            </section>
          )}

          {/* ── Step 2: Course ─────────────────────────────────────────────── */}
          {step === 2 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-brand">
                  Step 2 — Select course
                </p>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-muted-brand hover:text-foreground"
                >
                  ← Back
                </button>
              </div>

              <p className="text-xs text-muted-brand">
                This course applies to all {files.length} file{files.length === 1 ? "" : "s"}. You can override per file on the next step.
              </p>

              {/* No-prefs nudge for regular students */}
              {!isRep && !scopedDeptId && !coursesLoading && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-300/40 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Showing a limited course list.{" "}
                    <Link href="/study/onboarding" className="font-semibold underline">
                      Set your department
                    </Link>{" "}
                    in Study settings to see only your courses.
                  </span>
                </div>
              )}

              {/* Search row */}
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-brand" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search course code or title…"
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
                  />
                  {coursesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-brand" />}
                </div>
                {isRep && (
                  <button
                    type="button"
                    onClick={() => openCreateCourse({ code: q })}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-primary px-3 py-2 text-sm font-medium text-white"
                  >
                    <Plus className="h-4 w-4" /> Create
                  </button>
                )}
              </div>

              {/* Selected course chip */}
              {selectedCourse && (
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary bg-primary-light px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary-text">
                      {selectedCourse.course_code}
                    </p>
                    <p className="truncate text-xs text-primary/70">
                      {selectedCourse.course_title ?? "—"} · {LEVEL_LABEL(selectedCourse.level)} · {selectedCourse.semester}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCourseId("")}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-primary/30 bg-background px-2 py-1 text-xs text-primary-text"
                  >
                    Change <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Course list */}
              {!selectedCourse && (
                <div className="rounded-2xl border border-border bg-background overflow-hidden">
                  {filteredCourses.length === 0 && q.trim() ? (
                    <div className="p-4">
                      {isRep ? (
                        <>
                          <p className="text-sm font-medium text-foreground">No matching courses found</p>
                          <p className="mt-1 text-xs text-muted-brand">
                            Create the course (within your scope) and upload immediately.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openCreateCourse({ code: q })}
                              className="rounded-2xl bg-primary px-3 py-2 text-xs font-medium text-white"
                            >
                              Create course
                            </button>
                            <Link
                              href="/study/library"
                              className="rounded-2xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground no-underline hover:bg-secondary/50"
                            >
                              Browse materials
                            </Link>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            {normalizeCourseCode(q)} isn't in the catalog yet.
                          </p>
                          <p className="mt-1 text-xs text-muted-brand">
                            Your course rep can add it — tap below to flag it.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={flagCourse}
                              className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-3 py-2 text-xs font-medium text-white"
                            >
                              <Flag className="h-3.5 w-3.5" /> Flag this course →
                            </button>
                            <Link
                              href="/study/library"
                              className="rounded-2xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground no-underline hover:bg-secondary/50"
                            >
                              Browse materials
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                  ) : filteredCourses.length === 0 ? null : (
                    <div className="divide-y divide-border max-h-72 overflow-auto">
                      {filteredCourses.map((c) => {
                        const active = c.id === selectedCourseId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(c.id);
                              setSemester(c.semester);
                              saveRecentCourse(c.id);
                              setFiles((prev) => prev.map((f) => ({
                                ...f,
                                title: f.title || materialTitleSuggestion(c, f.materialType),
                              })));
                            }}
                            className={cn(
                              "w-full px-4 py-3 text-left transition hover:bg-secondary/40",
                              active ? "bg-secondary" : "bg-background"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{c.course_code}</p>
                                <p className="truncate text-xs text-muted-brand">{c.course_title ?? "—"}</p>
                              </div>
                              <span className="shrink-0 text-xs text-muted-brand">
                                {LEVEL_LABEL(c.level)} · {c.semester}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Desktop continue */}
              <div className="hidden justify-end sm:flex">
                <button
                  type="button"
                  disabled={!selectedCourse}
                  onClick={() => setStep(3)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium transition",
                    selectedCourse ? "bg-primary text-white" : "bg-secondary text-muted-brand"
                  )}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {/* Sticky (mobile) */}
              <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur sm:hidden">
                <button
                  type="button"
                  disabled={!selectedCourse}
                  onClick={() => setStep(3)}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition",
                    selectedCourse ? "bg-primary text-white" : "bg-secondary text-muted-brand"
                  )}
                >
                  {!selectedCourse ? "Select a course to continue" : "Continue →"}
                </button>
              </div>
            </section>
          )}

          {/* ── Step 3: Details ───────────────────────────────────────────── */}
          {step === 3 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-brand">
                  Step 3 — File details
                </p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-muted-brand hover:text-foreground"
                >
                  ← Back
                </button>
              </div>

              {/* Global notes */}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-brand">
                  Notes <span className="font-normal opacity-60">(optional — applies to all files)</span>
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Lecturer name, which section it covers…"
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-brand"
                />
              </label>

              {/* Per-file rows */}
              <div className="space-y-2">
                {files.map((f) => {
                  const hasError = f.materialType === "past_question" && (
                    !f.pqYear || typeof f.pqYear !== "number" ||
                    !f.pqSession || !f.pqSession.includes("/")
                  );
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "rounded-2xl border overflow-hidden",
                        hasError ? "border-amber-400" : "border-border"
                      )}
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-background">
                        <div className="shrink-0">{getFileIcon(f.file.type)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{f.file.name}</p>
                          <p className="text-xs text-muted-brand">
                            {MATERIAL_TYPES.find((x) => x.key === f.materialType)?.label ?? f.materialType}
                            {hasError && (
                              <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                Needs info
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateFile(f.id, { expanded: !f.expanded })}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border bg-background hover:bg-secondary/50"
                        >
                          {f.expanded
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />
                          }
                        </button>
                      </div>

                      {/* Expanded details */}
                      {f.expanded && (
                        <div className="border-t border-border bg-secondary/20 p-3 space-y-3">
                          <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-muted-brand">Title</span>
                            <input
                              value={f.title}
                              onChange={(e) => updateFile(f.id, { title: e.target.value })}
                              placeholder="Auto-filled — you can edit"
                              className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-brand focus:border-border/80"
                            />
                          </label>

                          <div>
                            <span className="text-xs font-medium text-muted-brand">Material type</span>
                            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                              {MATERIAL_TYPES.map((t) => {
                                const active = t.key === f.materialType;
                                const Icon   = t.icon;
                                return (
                                  <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => updateFile(f.id, {
                                      materialType: t.key,
                                      pqYear: t.key !== "past_question" ? "" : f.pqYear,
                                    })}
                                    className={cn(
                                      "flex flex-col items-center rounded-xl border py-2 px-1 text-center transition",
                                      active ? "border-primary bg-primary-light" : "border-border bg-background"
                                    )}
                                  >
                                    <Icon
                                      className={cn("h-3.5 w-3.5 mb-1", active ? "text-primary" : "text-muted-brand")}
                                    />
                                    <span
                                      className={cn("text-[10px] font-medium leading-tight", active ? "text-primary-text" : "text-foreground")}
                                    >
                                      {t.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {f.materialType === "past_question" && (
                            <div className="grid grid-cols-2 gap-3">
                              <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-muted-brand">Year</span>
                                <input
                                  inputMode="numeric"
                                  value={f.pqYear}
                                  onChange={(e) => updateFile(f.id, { pqYear: e.target.value ? Number(e.target.value) : "" })}
                                  placeholder="e.g. 2021"
                                  className={cn(
                                    "w-full rounded-2xl border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-brand",
                                    !f.pqYear ? "border-amber-400" : "border-border"
                                  )}
                                />
                              </label>
                              <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-muted-brand">Session</span>
                                <input
                                  value={f.pqSession}
                                  onChange={(e) => updateFile(f.id, { pqSession: e.target.value })}
                                  placeholder="2022/2023"
                                  className={cn(
                                    "w-full rounded-2xl border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-brand",
                                    !f.pqSession.includes("/") ? "border-amber-400" : "border-border"
                                  )}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Review queue notice */}
              <div className="flex items-start gap-2.5 rounded-2xl bg-primary-light p-3">
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                  i
                </div>
                <p className="text-xs leading-relaxed text-primary-text">
                  Your upload goes to a review queue.{" "}
                  {isRep
                    ? "As a rep your uploads are auto-approved."
                    : "You'll be notified when it's approved or if there's an issue."
                  }
                </p>
              </div>

              {/* Desktop submit */}
              <div className="hidden justify-end sm:flex">
                <button
                  type="button"
                  disabled={!canSubmitStep3}
                  onClick={startUpload}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-medium transition",
                    canSubmitStep3 ? "bg-primary text-white" : "bg-secondary text-muted-brand"
                  )}
                >
                  <UploadCloud className="h-4 w-4" />
                  Submit {files.length} upload{files.length === 1 ? "" : "s"}
                </button>
              </div>

              {/* Sticky (mobile) */}
              <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur sm:hidden">
                <button
                  type="button"
                  disabled={!canSubmitStep3}
                  onClick={startUpload}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition",
                    canSubmitStep3 ? "bg-primary text-white" : "bg-secondary text-muted-brand"
                  )}
                >
                  <UploadCloud className="h-4 w-4" />
                  {filesWithErrors.length > 0
                    ? `Fix ${filesWithErrors.length} file${filesWithErrors.length === 1 ? "" : "s"} to continue`
                    : `Submit ${files.length} upload${files.length === 1 ? "" : "s"}`
                  }
                </button>
              </div>
            </section>
          )}

          {/* ── Queue view ─────────────────────────────────────────────────── */}
          {step === "queue" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-brand">
                  Upload queue
                </p>
                <button
                  type="button"
                  onClick={resetUpload}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add more files
                </button>
              </div>

              {allUploadsDone && (
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3.5",
                    isRep
                      ? "border border-primary/30 bg-primary-light dark:border-primary/40 dark:bg-primary/10"
                      : "border border-emerald-300/50 bg-emerald-50 dark:border-emerald-700/40 dark:bg-emerald-950/20"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isRep ? "text-primary dark:text-indigo-300" : "text-emerald-600 dark:text-emerald-400"
                      )}
                    />
                    <p
                      className={cn(
                        "text-sm font-extrabold",
                        isRep ? "text-primary-text dark:text-indigo-200" : "text-emerald-900 dark:text-emerald-200"
                      )}
                    >
                      {isRep
                        ? `${queue.length} file${queue.length !== 1 ? "s" : ""} are live`
                        : `${queue.length} file${queue.length !== 1 ? "s" : ""} uploaded successfully`}
                    </p>
                  </div>

                  <p
                    className={cn(
                      "mb-3 text-xs leading-relaxed",
                      isRep ? "text-primary/70 dark:text-indigo-300" : "text-emerald-800/80 dark:text-emerald-300"
                    )}
                  >
                    {isRep
                      ? "As a course rep, your uploads are auto-approved and visible to students immediately."
                      : `Your material${queue.length !== 1 ? "s are" : " is"} in the review queue. You'll be notified once approved — usually within 24 hours.`}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {selectedCourse && (
                      <Link
                        href={`/study/courses/${encodeURIComponent(selectedCourse.course_code)}`}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold text-white no-underline",
                          isRep
                            ? "bg-primary hover:opacity-90"
                            : "bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                        )}
                      >
                        View {selectedCourse.course_code}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={resetUpload}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold",
                        isRep
                          ? "border-primary/30 bg-white/70 text-primary-text hover:bg-white dark:border-primary/40 dark:bg-primary/10 dark:text-indigo-300"
                          : "border-emerald-300/60 bg-white/70 text-emerald-800 hover:bg-white dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                      )}
                    >
                      {isRep ? "Upload more" : "Upload another"}
                    </button>
                  </div>
                </div>
              )}

              {/* Summary metric cards */}
              {(() => {
                const done      = queue.filter((e) => e.status === "done").length;
                const uploading = queue.filter((e) => e.status === "uploading").length;
                const queued    = queue.filter((e) => e.status === "queued").length;
                const failed    = queue.filter((e) => e.status === "failed").length;
                return (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Done",      value: done,      textClass: "text-emerald-600" },
                      { label: "Uploading", value: uploading, textClass: "text-primary"     },
                      { label: "Queued",    value: queued,    textClass: "text-zinc-500"    },
                      { label: "Failed",    value: failed,    textClass: "text-rose-600"    },
                    ].map(({ label, value, textClass }) => (
                      <div key={label} className="rounded-2xl border border-border bg-background p-3 text-center">
                        <p className={cn("text-lg font-semibold", textClass)}>{value}</p>
                        <p className="text-[10px] text-muted-brand">{label}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Queue rows */}
              <div className="space-y-2">
                {queue.map((qEntry) => (
                  <div key={qEntry.id} className="rounded-2xl border border-border bg-background p-3">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">{getFileIcon(qEntry.file.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{qEntry.file.name}</p>
                        <p className="truncate text-xs text-muted-brand">{qEntry.title}</p>
                      </div>
                      <div className="shrink-0">
                        {qEntry.status === "queued" && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                            Queued
                          </span>
                        )}
                        {qEntry.status === "uploading" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-medium text-primary-text">
                            <Loader2 className="h-3 w-3 animate-spin" /> Uploading
                          </span>
                        )}
                        {qEntry.status === "done" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> Done
                          </span>
                        )}
                        {qEntry.status === "failed" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                            <AlertTriangle className="h-3 w-3" /> Failed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {(qEntry.status === "uploading" || qEntry.status === "done") && (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              qEntry.status === "done" ? "bg-emerald-600" : "bg-primary"
                            )}
                            style={{ width: `${qEntry.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error + retry button */}
                    {qEntry.status === "failed" && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs text-rose-700 dark:text-rose-400">
                          {qEntry.error}
                        </p>
                        <button
                          type="button"
                          onClick={() => retryQueueEntry(qEntry.id)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                        >
                          <RefreshCw className="h-3 w-3" /> Retry upload
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Create course modal ─────────────────────────────────────────── */}
          {showCreateCourse && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
              onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreateCourse(false); }}
            >
              <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-background">
                <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Create a course</p>
                    <p className="mt-0.5 text-xs text-muted-brand">
                      {isRep && role === "course_rep"
                        ? "Only within your department and assigned level(s)."
                        : "Visible to all students once created."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateCourse(false)}
                    className="rounded-xl p-2 text-muted-brand hover:bg-secondary/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-muted-brand">Course code</span>
                      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
                        <Hash className="h-4 w-4 text-muted-brand" />
                        <input
                          value={reqCode}
                          onChange={(e) => setReqCode(e.target.value)}
                          onBlur={() => setReqCode((v) => normalizeCourseCode(v))}
                          placeholder="e.g. CSC 201"
                          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
                        />
                      </div>
                      <p className="text-[11px] text-muted-brand">Auto-formatted to "CSC 201".</p>
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-muted-brand">Semester</span>
                      <select
                        value={reqSemester}
                        onChange={(e) => setReqSemester(e.target.value as Semester)}
                        className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                      >
                        <option value="first">First</option>
                        <option value="second">Second</option>
                        <option value="summer">Summer</option>
                      </select>
                    </label>

                    <label className="block space-y-1.5 sm:col-span-2">
                      <span className="text-xs font-medium text-muted-brand">Course title (optional)</span>
                      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
                        <BookOpen className="h-4 w-4 text-muted-brand" />
                        <input
                          value={reqTitle}
                          onChange={(e) => setReqTitle(e.target.value)}
                          placeholder="e.g. Data Structures"
                          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
                        />
                      </div>
                    </label>

                    <label className="block space-y-1.5 sm:col-span-2">
                      <span className="text-xs font-medium text-muted-brand">Level</span>
                      {isRep && role === "course_rep" && Array.isArray(allowedLevels) && allowedLevels.length === 1 ? (
                        <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/50 px-3 py-2 text-sm">
                          <span className="font-medium text-foreground">{LEVEL_LABEL(allowedLevels[0])}</span>
                          <span className="text-xs text-muted-brand">Locked</span>
                        </div>
                      ) : (
                        <select
                          value={reqLevel || ""}
                          onChange={(e) => setReqLevel(Number(e.target.value))}
                          className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                        >
                          <option value="" disabled>Select level</option>
                          {(isRep && role === "course_rep"
                            ? Array.isArray(allowedLevels) ? allowedLevels : []
                            : [100, 200, 300, 400, 500, 600, 700, 800, 900]
                          ).map((lvl) => (
                            <option key={lvl} value={lvl}>{LEVEL_LABEL(lvl)}</option>
                          ))}
                        </select>
                      )}
                    </label>
                  </div>

                  <div className="flex items-start gap-2 rounded-2xl bg-primary-light p-3 text-xs text-primary-text">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Use official codes (e.g. <strong>CSC 201</strong>). Prevents duplicates and makes search easy.
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCreateCourse(false)}
                      className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitCreateCourse}
                      disabled={reqLoading}
                      className={cn(
                        "inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-white",
                        reqLoading ? "opacity-60" : ""
                      )}
                    >
                      {reqLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create course
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
