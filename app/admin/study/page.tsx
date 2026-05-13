"use client";
// app/admin/study/page.tsx
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isIndexableMaterialPath } from "@/lib/studyMaterialIndexEligibility";
import { QuestionQualityClient } from "@/app/study-admin/question-quality/QuestionQualityClient";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Eye,
  Square,
  CheckSquare,
  Users,
  Flag,
  BookOpen,
  MessageSquareText,
  CalendarDays,
  Activity,
  ListChecks,
} from "lucide-react";

type Semester = "first" | "second" | "summer";
type MaterialType =
  | "past_question"
  | "handout"
  | "slides"
  | "note"
  | "timetable"
  | "other";

type CourseRow = {
  id: string;
  department: string;
  level: number;
  course_code: string;
  course_title: string | null;
  semester: Semester;
};

type MaterialRow = {
  id: string;
  title: string;
  material_type: MaterialType;
  session: string | null;
  file_url: string;
  file_path: string;
  created_at: string;
  approved?: boolean | null;
  index_status?: "pending" | "indexing" | "ready" | "failed" | "skipped" | null;
  indexed_at?: string | null;
  index_error?: string | null;
  study_courses: CourseRow;
  // Optional, if your table has it
  uploader_id?: string | null;
};

type TutorRow = Record<string, any> & { id: string };

type StudyReportRow = {
  id: string;
  material_id: string | null;
  tutor_id: string | null;
  question_id?: string | null;
  answer_id?: string | null;
  reason: string;
  details: string | null;
  reporter_email: string | null;
  status: string | null;
  created_at: string;
};

type StatusKey = "pending" | "approved" | "all";
type SortKey = "newest" | "oldest";

const BUCKET = "study-materials";
const DEFAULT_PER_PAGE = 20;

const TYPE_LABEL: Record<MaterialType, string> = {
  past_question: "Past Q",
  handout: "Handout",
  slides: "Slides",
  note: "Note",
  timetable: "Timetable",
  other: "Other",
};

function normalize(v: string) {
  return v.trim().replace(/\s+/g, " ");
}

function asInt(v: string | null, fallback: number) {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : fallback;
}

function buildHref(path: string, params: Record<string, string | number | null | undefined>) {
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

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function indexStatusLabel(status: MaterialRow["index_status"]) {
  if (status === "ready") return "Indexed";
  if (status === "indexing") return "Indexing";
  if (status === "failed") return "Index failed";
  if (status === "skipped") return "Skipped";
  return "Not indexed";
}

function IndexStatusBadge({ row }: { row: MaterialRow }) {
  const status = row.index_status ?? "pending";
  const classes =
    status === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "indexing"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : status === "failed"
          ? "border-red-200 bg-red-50 text-red-700"
          : status === "skipped"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-zinc-200 bg-zinc-50 text-zinc-600";

  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold", classes)}
      title={row.index_error || (row.indexed_at ? `Indexed ${formatDate(row.indexed_at)}` : undefined)}
    >
      {status === "indexing" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {indexStatusLabel(status)}
    </span>
  );
}

function guessFileKind(url: string) {
  const u = (url || "").toLowerCase();
  if (u.includes(".pdf")) return "pdf";
  if (u.match(/\.(png|jpg|jpeg|webp)(\?|$)/)) return "image";
  if (u.includes(".pptx")) return "pptx";
  return "file";
}

function BannerBox({
  text,
  kind,
  onClose,
}: {
  text: string;
  kind: "error" | "success" | "info" | "warn";
  onClose: () => void;
}) {
  const tone =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : kind === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-zinc-200 bg-white text-zinc-700";

  const icon =
    kind === "success" ? (
      <Check className="h-4 w-4" />
    ) : kind === "error" || kind === "warn" ? (
      <ShieldCheck className="h-4 w-4" />
    ) : (
      <ShieldCheck className="h-4 w-4" />
    );

  return (
    <div className={cn("rounded-2xl border p-4 text-sm", tone)} role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5">{icon}</div>
          <p>{text}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1 hover:bg-black/5"
          aria-label="Close banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cn("fixed inset-0 z-50 transition", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        className={cn("absolute inset-0 bg-black/40 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-3xl border bg-white shadow-xl transition-transform",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <p className="text-base font-semibold text-zinc-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-zinc-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-auto p-4">{children}</div>
        {footer ? <div className="border-t p-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  body,
  dangerText,
  confirmText,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  dangerText?: string;
  confirmText: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-3xl border bg-white p-4 shadow-xl sm:inset-x-0 sm:mx-auto sm:max-w-lg sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-zinc-900">{title}</p>
            {dangerText ? <p className="mt-1 text-sm text-red-700">{dangerText}</p> : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-zinc-50"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 text-sm text-zinc-700">{body}</div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={!!loading}
            className={cn(
              "inline-flex flex-1 items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50",
              loading ? "opacity-70" : ""
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!!loading}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-700 bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600",
              loading ? "opacity-70" : ""
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStudyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const tab = (sp.get("tab") ?? "materials") as "materials" | "tutors" | "reports" | "practice" | "qa" | "quality";

  // URL state
  const page = asInt(sp.get("page"), 1);
  const perPage = asInt(sp.get("per"), DEFAULT_PER_PAGE);
  const status = (sp.get("status") ?? "pending") as StatusKey;
  const sort = (sp.get("sort") ?? "newest") as SortKey;

  const qParam = sp.get("q") ?? "";
  const typeParam = (sp.get("type") ?? "") as MaterialType | "";
  const sessionParam = sp.get("session") ?? "";
  const deptParam = sp.get("dept") ?? "";
  const levelParam = sp.get("level") ?? "";
  const codeParam = sp.get("code") ?? "";

  // UI state
  const [banner, setBanner] = useState<{ kind: "error" | "success" | "info" | "warn"; text: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MaterialRow[]>([]);
  const [total, setTotal] = useState(0);

  // Tutors tab state
  const [tutorsLoading, setTutorsLoading] = useState(false);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [tutorsTotal, setTutorsTotal] = useState(0);
  const [tutorsMutating, setTutorsMutating] = useState<Record<string, boolean>>({});

  // Practice (CBT) tab state
  const [setsLoading, setSetsLoading] = useState(false);
  const [sets, setSets] = useState<any[]>([]);
  const [setsTotal, setSetsTotal] = useState(0);
  const [setsMutating, setSetsMutating] = useState<Record<string, boolean>>({});

  // Reports tab state
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reports, setReports] = useState<StudyReportRow[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsMutating, setReportsMutating] = useState<Record<string, boolean>>({});

  // Q&A moderation tab state
  const [qaLoading, setQaLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionsTotal, setQuestionsTotal] = useState(0);
  const [qaMutating, setQaMutating] = useState<Record<string, boolean>>({});
  const [qaDrawerOpen, setQaDrawerOpen] = useState(false);
  const [qaSelectedQ, setQaSelectedQ] = useState<any | null>(null);
  const [qaAnswers, setQaAnswers] = useState<any[]>([]);
  const [qaAnswersLoading, setQaAnswersLoading] = useState(false);

  // per-row mutation tracking
  const [mutating, setMutating] = useState<Record<string, "approve" | "reject" | "reindex">>({});

  // selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // filter drawer (draft values)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [qDraft, setQDraft] = useState(qParam);
  const [typeDraft, setTypeDraft] = useState<MaterialType | "">(typeParam);
  const [sessionDraft, setSessionDraft] = useState(sessionParam);
  const [deptDraft, setDeptDraft] = useState(deptParam);
  const [levelDraft, setLevelDraft] = useState(levelParam);
  const [codeDraft, setCodeDraft] = useState(codeParam);
  const [statusDraft, setStatusDraft] = useState<StatusKey>(status);
  const [sortDraft, setSortDraft] = useState<SortKey>(sort);
  const [perDraft, setPerDraft] = useState(String(perPage));

  // preview drawer
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<MaterialRow | null>(null);

  // reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTargets, setRejectTargets] = useState<MaterialRow[]>([]);
  const [rejectBusy, setRejectBusy] = useState(false);

  // bulk approve busy
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkIndexBusy, setBulkIndexBusy] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / Math.max(1, perPage))), [total, perPage]);

  // Keep draft in sync with URL when opening drawer
  function openFilters() {
    setQDraft(qParam);
    setTypeDraft(typeParam);
    setSessionDraft(sessionParam);
    setDeptDraft(deptParam);
    setLevelDraft(levelParam);
    setCodeDraft(codeParam);
    setStatusDraft(status);
    setSortDraft(sort);
    setPerDraft(String(perPage));
    setFiltersOpen(true);
  }

  function applyFilters() {
    const nextPer = Math.max(5, Math.min(100, asInt(perDraft, DEFAULT_PER_PAGE)));
    router.replace(
      buildHref(pathname, {
        tab: tab !== "materials" ? tab : null,
        page: null,
        per: nextPer !== DEFAULT_PER_PAGE ? nextPer : null,
        status: statusDraft !== "pending" ? statusDraft : null,
        sort: sortDraft !== "newest" ? sortDraft : null,
        q: normalize(qDraft) || null,
        type: typeDraft || null,
        session: normalize(sessionDraft) || null,
        dept: normalize(deptDraft) || null,
        level: normalize(levelDraft) || null,
        code: normalize(codeDraft) || null,
      })
    );
    setFiltersOpen(false);
    setSelected({});
  }

  function clearFilters() {
    setQDraft("");
    setTypeDraft("");
    setSessionDraft("");
    setDeptDraft("");
    setLevelDraft("");
    setCodeDraft("");
    setStatusDraft("pending");
    setSortDraft("newest");
    setPerDraft(String(DEFAULT_PER_PAGE));
  }

  function clearAllUrl() {
    router.replace(buildHref(pathname, { tab: tab !== "materials" ? tab : null }));
    setSelected({});
  }

  function goPage(next: number) {
    router.replace(
      buildHref(pathname, {
        tab: tab !== "materials" ? tab : null,
        page: next !== 1 ? next : null,
        per: perPage !== DEFAULT_PER_PAGE ? perPage : null,
        status: status !== "pending" ? status : null,
        sort: sort !== "newest" ? sort : null,
        q: qParam || null,
        type: typeParam || null,
        session: sessionParam || null,
        dept: deptParam || null,
        level: levelParam || null,
        code: codeParam || null,
      })
    );
  }

  function toggleSelect(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const selectedCount = selectedIds.length;

  const allOnPageSelected = useMemo(() => {
    if (!items.length) return false;
    return items.every((m) => selected[m.id]);
  }, [items, selected]);

  function selectAllOnPage() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const m of items) next[m.id] = true;
      return next;
    });
  }

  function clearSelectionOnPage() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const m of items) delete next[m.id];
      return next;
    });
  }

  async function fetchPage() {
    if (tab !== "materials") return;
    setLoading(true);
    setBanner(null);

    const start = (page - 1) * perPage;
    const end = start + perPage - 1;

    // NOTE: This is still a client page; it assumes your RLS/admin checks are handled elsewhere.
    let q = supabase
      .from("study_materials")
      .select(
        `id, title, material_type, session, file_url, file_path, created_at, uploader_id, approved, index_status, indexed_at, index_error,
         study_courses:course_id!inner(id, department, level, course_code, course_title, semester)`,
        { count: "exact" }
      );

    // status filter
    if (status === "pending") q = q.eq("approved", false);
    else if (status === "approved") q = q.eq("approved", true);

    // basic filters
    if (typeParam) q = q.eq("material_type", typeParam);
    if (sessionParam) q = q.ilike("session", `%${sessionParam}%`);

    // title search (safe)
    if (qParam) q = q.ilike("title", `%${qParam}%`);

    // foreign-table filters (work when join is inner)
    if (deptParam) q = q.ilike("study_courses.department", `%${deptParam}%`);
    if (levelParam) q = q.eq("study_courses.level", Number(levelParam));
    if (codeParam) q = q.ilike("study_courses.course_code", `%${codeParam}%`);

    // sort
    q = q.order("created_at", { ascending: sort === "oldest" });

    // paginate
    q = q.range(start, end);

    const { data, error, count } = await q;

    if (error) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setBanner({ kind: "error", text: error.message ?? "Failed to load uploads." });
      return;
    }

    setItems((data ?? []) as any);
    setTotal(count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, perPage, status, sort, qParam, typeParam, sessionParam, deptParam, levelParam, codeParam]);

  function pickKey(obj: any, keys: string[]) {
    for (const k of keys) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return k;
    }
    return "";
  }

  async function fetchTutors() {
    if (tab !== "tutors") return;
    setTutorsLoading(true);
    setBanner(null);

    const start = (page - 1) * perPage;
    const end = start + perPage - 1;

    // Schema-safe: select("*"), then filter client-side by q
    let q = supabase.from("study_tutors").select("*", { count: "exact" });
    // best-effort order
    q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
    q = q.range(start, end);

    const res = await q;
    if (res.error) {
      setTutors([]);
      setTutorsTotal(0);
      setTutorsLoading(false);
      setBanner({
        kind: "error",
        text:
          res.error.message.includes("relation") || res.error.message.includes("does not exist")
            ? "study_tutors table is missing in Supabase. Create it, then tutors will appear here."
            : res.error.message,
      });
      return;
    }

    const list = ((res.data as any[]) ?? []) as TutorRow[];
    const qn = normalize(qParam).toLowerCase();
    const filtered = qn
      ? list.filter((t) => normalize(`${t?.name ?? ""} ${t?.full_name ?? ""} ${t?.headline ?? ""} ${t?.bio ?? ""} ${t?.department ?? ""} ${t?.faculty ?? ""} ${Array.isArray(t?.courses) ? t.courses.join(" ") : t?.courses ?? t?.course_codes ?? ""}`)
          .toLowerCase()
          .includes(qn))
      : list;

    setTutors(filtered);
    setTutorsTotal(res.count ?? filtered.length);
    setTutorsLoading(false);
  }

  useEffect(() => {
    fetchTutors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, perPage, qParam]);

  async function toggleTutorVerified(t: TutorRow) {
    const id = String(t?.id ?? "");
    if (!id || tutorsMutating[id]) return;

    const key = pickKey(t, ["verified", "is_verified", "approved"]);
    if (!key) {
      setBanner({ kind: "warn", text: "This tutor row has no verified column (verified / is_verified / approved)." });
      return;
    }

    const next = !Boolean(t?.[key]);
    setTutorsMutating((p) => ({ ...p, [id]: true }));
    setBanner(null);

    const resp = await fetch("/api/admin/study/tutors/set-flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, key, value: next }),
    });
    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setBanner({ kind: "error", text: json?.error ?? "Failed to update tutor." });
      setTutorsMutating((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      return;
    }

    setTutors((prev) => prev.map((x) => (String(x.id) === id ? { ...x, [key]: next } : x)));
    setTutorsMutating((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  async function fetchReports() {
    if (tab !== "reports") return;
    setReportsLoading(true);
    setBanner(null);

    const start = (page - 1) * perPage;
    const end = start + perPage - 1;

    let q = supabase.from("study_reports").select("*", { count: "exact" });
    q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
    if (qParam) {
      q = q.or(`reason.ilike.%${qParam}%,details.ilike.%${qParam}%,reporter_email.ilike.%${qParam}%`);
    }
    q = q.range(start, end);

    const res = await q;
    if (res.error) {
      setReports([]);
      setReportsTotal(0);
      setReportsLoading(false);
      setBanner({
        kind: "error",
        text:
          res.error.message.includes("relation") || res.error.message.includes("does not exist")
            ? "study_reports table is missing in Supabase. Create it, then reports will show here."
            : res.error.message,
      });
      return;
    }

    setReports(((res.data as any[]) ?? []) as any);
    setReportsTotal(res.count ?? 0);
    setReportsLoading(false);
  }

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, perPage, qParam]);

  async function fetchSets() {
    if (tab !== "practice") return;
    setSetsLoading(true);
    setBanner(null);

    const start = (page - 1) * perPage;
    const end = start + perPage - 1;

    // Defensive select: columns may vary across schemas.
    // If a column doesn't exist in your DB, Supabase will error and we show a helpful message.
    let q = supabase
      .from("study_quiz_sets")
      .select(
        "id,title,description,course_code,level,semester,published,time_limit_minutes,questions_count,created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, end);

    const qn = normalize(qParam);
    if (qn) {
      q = q.or(`title.ilike.%${qn}%,description.ilike.%${qn}%,course_code.ilike.%${qn}%`);
    }

    const res = await q;

    if (res.error) {
      setSets([]);
      setSetsTotal(0);
      setSetsLoading(false);
      const msg = res.error.message ?? "Failed to load CBT sets.";
      setBanner({
        kind: "error",
        text:
          msg.includes("relation") || msg.includes("does not exist")
            ? 'Missing table: "study_quiz_sets" in Supabase. Create it to manage CBT sets here.'
            : msg,
      });
      return;
    }

    setSets(((res.data as any[]) ?? []) as any);
    setSetsTotal(res.count ?? 0);
    setSetsLoading(false);
  }

  useEffect(() => {
    fetchSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, perPage, qParam]);

  async function toggleSetPublish(setId: string, nextPublished: boolean) {
    const id = String(setId || "");
    if (!id || setsMutating[id]) return;

    setSetsMutating((p) => ({ ...p, [id]: true }));
    setBanner(null);

    const resp = await fetch("/api/admin/study/quiz-sets/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, published: nextPublished }),
    });
    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setBanner({ kind: "error", text: json?.error ?? "Failed to update set." });
      setSetsMutating((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      return;
    }

    setSets((prev) => prev.map((s: any) => (String(s.id) === id ? { ...s, published: nextPublished } : s)));
    setSetsMutating((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  async function deleteSet(setId: string) {
    const id = String(setId || "");
    if (!id || setsMutating[id]) return;

    const ok = window.confirm("Delete this CBT set and all its questions? This cannot be undone.");
    if (!ok) return;

    setSetsMutating((p) => ({ ...p, [id]: true }));
    setBanner(null);

    try {
      const resp = await fetch("/api/admin/study/quiz-sets/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await resp.json().catch(() => null);

      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to delete set.");
      }

      setSets((prev) => prev.filter((s: any) => String(s.id) !== id));
      setSetsTotal((t) => Math.max(0, t - 1));
      setBanner({ kind: "success", text: "CBT set deleted." });
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message ?? "Failed to delete set." });
    } finally {
      setSetsMutating((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
    }
  }

  async function setReportStatus(id: string, status: "open" | "resolved") {
    if (!id || reportsMutating[id]) return;
    setReportsMutating((p) => ({ ...p, [id]: true }));
    setBanner(null);

    const resp = await fetch("/api/admin/study/reports/set-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setBanner({ kind: "error", text: json?.error ?? "Failed to update report." });
      setReportsMutating((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      return;
    }

    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    setReportsMutating((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  async function deleteReportTarget(r: StudyReportRow) {
    const id = r.id;
    if (!id || reportsMutating[id]) return;

    const kind = r.tutor_id
      ? "Tutor"
      : r.material_id
        ? "Material"
        : r.answer_id
          ? "Answer"
          : "Question";

    const ok = window.confirm(`Delete the reported ${kind.toLowerCase()} content? This cannot be undone.`);
    if (!ok) return;

    setReportsMutating((p) => ({ ...p, [id]: true }));
    setBanner(null);

    try {
      const resp = await fetch("/api/admin/study/reports/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await resp.json().catch(() => null);

      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to delete content.");
      }

      setReports((prev) => prev.filter((x) => x.id !== id));
      setReportsTotal((t) => Math.max(0, t - 1));
      setBanner({ kind: "success", text: `${kind} content deleted and report resolved.` });
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message ?? "Failed to delete content." });
    } finally {
      setReportsMutating((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
    }
  }

  async function approveOne(id: string) {
    if (mutating[id]) return;
    setMutating((prev) => ({ ...prev, [id]: "approve" }));
    setBanner(null);

    const resp = await fetch(`/api/admin/study/materials/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved: true }),
    });

    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setBanner({ kind: "error", text: json?.error ?? "Failed to approve." });
      setMutating((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      return;
    }

    if (status === "pending") {
      setItems((prev) => prev.filter((m) => m.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      setSelected((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    } else {
      await fetchPage();
    }

    setMutating((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setBanner({ kind: "success", text: "Approved." });
  }

  async function rejectOne(row: MaterialRow) {
    if (mutating[row.id]) return;
    setMutating((prev) => ({ ...prev, [row.id]: "reject" }));
    setBanner(null);

    const resp = await fetch(`/api/admin/study/materials/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });

    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setBanner({ kind: "error", text: json?.error ?? "Failed to reject." });
      setMutating((prev) => {
        const n = { ...prev };
        delete n[row.id];
        return n;
      });
      return;
    }

    // remove locally
    setItems((prev) => prev.filter((m) => m.id !== row.id));
    setTotal((t) => Math.max(0, t - 1));
    setSelected((prev) => {
      const n = { ...prev };
      delete n[row.id];
      return n;
    });

    setMutating((prev) => {
      const n = { ...prev };
      delete n[row.id];
      return n;
    });
    setBanner({ kind: "success", text: "Rejected (deleted)." });
  }

  async function approveBulk() {
    if (bulkBusy || selectedCount === 0) return;

    setBulkBusy(true);
    setBanner(null);

    const resp = await fetch("/api/admin/study/materials/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });

    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setBanner({ kind: "error", text: json?.error ?? "Bulk approve failed." });
      setBulkBusy(false);
      return;
    }

    if (status === "pending") {
      setItems((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
      setTotal((t) => Math.max(0, t - selectedCount));
    } else {
      await fetchPage();
    }

    setSelected({});
    setBulkBusy(false);
    setBanner({ kind: "success", text: `Approved ${selectedCount} item(s).` });
  }

  async function reindexOne(id: string) {
    if (!id || mutating[id]) return;
    setMutating((prev) => ({ ...prev, [id]: "reindex" }));
    setBanner(null);

    try {
      const resp = await fetch("/api/admin/study/materials/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await resp.json().catch(() => null);

      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error ?? "Reindex failed.");
      }

      await fetchPage();
      setBanner({ kind: "success", text: json.status === "ready" ? `Indexed ${json.chunks ?? 0} chunk(s).` : "Reindex completed." });
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message ?? "Reindex failed." });
    } finally {
      setMutating((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  async function reindexBulk() {
    if (bulkIndexBusy || selectedCount === 0) return;
    setBulkIndexBusy(true);
    setBanner(null);

    try {
      const resp = await fetch("/api/admin/study/materials/bulk-reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await resp.json().catch(() => null);

      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error ?? "Bulk reindex failed.");
      }

      setSelected({});
      await fetchPage();
      setBanner({ kind: "success", text: `Queued ${json.queued ?? 0} material(s) for indexing. ${json.skipped ?? 0} skipped.` });
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message ?? "Bulk reindex failed." });
    } finally {
      setBulkIndexBusy(false);
    }
  }

  function openRejectModalForSelected() {
    const targets = items.filter((m) => selected[m.id]);
    if (!targets.length) return;
    setRejectTargets(targets);
    setRejectOpen(true);
  }

  function openRejectModalForOne(row: MaterialRow) {
    setRejectTargets([row]);
    setRejectOpen(true);
  }

  async function confirmRejectModal() {
    if (rejectBusy) return;
    setRejectBusy(true);
    setBanner(null);

    // Process sequentially to keep storage deletes sane
    for (const r of rejectTargets) {
      // If row is already gone from current items, skip
      await rejectOne(r);
    }

    setRejectBusy(false);
    setRejectOpen(false);
    setRejectTargets([]);
  }

  function openPreview(row: MaterialRow) {
    setPreviewItem(row);
    setPreviewOpen(true);
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setBanner({ kind: "success", text: "Copied ID." });
    } catch {
      setBanner({ kind: "error", text: "Clipboard blocked by browser." });
    }
  }

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (qParam) n++;
    if (typeParam) n++;
    if (sessionParam) n++;
    if (deptParam) n++;
    if (levelParam) n++;
    if (codeParam) n++;
    if (status !== "pending") n++;
    if (sort !== "newest") n++;
    if (perPage !== DEFAULT_PER_PAGE) n++;
    return n;
  }, [qParam, typeParam, sessionParam, deptParam, levelParam, codeParam, status, sort, perPage]);

  
  // ----- Q&A moderation (Admin) -----
  async function fetchQuestions() {
    if (tab !== "qa") return;
    setQaLoading(true);
    setBanner(null);

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from("study_questions")
      .select("id,title,body,course_code,level,author_email,solved,answers_count,upvotes_count,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const q = normalize(qParam || "");
    if (q) {
      query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
    }
    const code = normalize(codeParam || "");
    if (code) {
      query = query.ilike("course_code", `%${code}%`);
    }

    const res = await query;
    if (res.error) {
      setQaLoading(false);
      setQuestions([]);
      setQuestionsTotal(0);
      setBanner({
        kind: "error",
        text: res.error.message.includes("relation") ? "study_questions table is missing in Supabase. Create it, then Q&A moderation will work." : res.error.message,
      });
      return;
    }

    setQuestions((res.data as any[]) ?? []);
    setQuestionsTotal(res.count ?? 0);
    setQaLoading(false);
  }

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, perPage, qParam, codeParam]);

  async function openAnswersDrawer(q: any) {
    setQaSelectedQ(q);
    setQaDrawerOpen(true);
    setQaAnswers([]);
    if (!q?.id) return;

    setQaAnswersLoading(true);
    const res = await supabase
      .from("study_answers")
      .select("id,body,author_email,is_accepted,created_at")
      .eq("question_id", q.id)
      .order("created_at", { ascending: true });

    if (res.error) {
      setBanner({ kind: "error", text: res.error.message.includes("relation") ? "study_answers table is missing in Supabase." : res.error.message });
      setQaAnswersLoading(false);
      return;
    }
    setQaAnswers((res.data as any[]) ?? []);
    setQaAnswersLoading(false);
  }

  async function adminDeleteQuestion(id: string) {
    if (!id || qaMutating[id]) return;
    setQaMutating((p) => ({ ...p, [id]: true }));
    setBanner(null);

    const resp = await fetch("/api/admin/study/questions/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setQaMutating((p) => ({ ...p, [id]: false }));
      setBanner({ kind: "error", text: json?.error ?? "Failed to delete question." });
      return;
    }

    setQaMutating((p) => ({ ...p, [id]: false }));
    setBanner({ kind: "success", text: "Question deleted." });
    if (qaSelectedQ?.id === id) {
      setQaDrawerOpen(false);
      setQaSelectedQ(null);
      setQaAnswers([]);
    }
    fetchQuestions();
  }

  async function adminDeleteAnswer(id: string) {
    if (!id || qaMutating[id]) return;
    setQaMutating((p) => ({ ...p, [id]: true }));
    setBanner(null);

    const resp = await fetch("/api/admin/study/answers/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setQaMutating((p) => ({ ...p, [id]: false }));
      setBanner({ kind: "error", text: json?.error ?? "Failed to delete answer." });
      return;
    }

    setQaMutating((p) => ({ ...p, [id]: false }));
    setBanner({ kind: "success", text: "Answer deleted." });
    if (qaSelectedQ?.id) openAnswersDrawer(qaSelectedQ);
    fetchQuestions();
  }

  async function adminToggleSolved(q: any) {
    if (!q?.id || qaMutating[q.id]) return;
    setQaMutating((p) => ({ ...p, [q.id]: true }));
    setBanner(null);

    const nextSolved = !q.solved;

    const resp = await fetch("/api/admin/study/questions/toggle-solved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: q.id, solved: nextSolved }),
    });
    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setQaMutating((p) => ({ ...p, [q.id]: false }));
      setBanner({ kind: "error", text: json?.error ?? "Failed to update question." });
      return;
    }

    setQaMutating((p) => ({ ...p, [q.id]: false }));
    setBanner({ kind: "success", text: nextSolved ? "Marked as solved." : "Marked as unsolved." });
    fetchQuestions();
    if (qaSelectedQ?.id === q.id) {
      setQaSelectedQ({ ...q, solved: nextSolved });
    }
  }

  async function adminAcceptAnswer(answerId: string) {
    const qid = qaSelectedQ?.id;
    if (!qid || !answerId || qaMutating[answerId]) return;
    setQaMutating((p) => ({ ...p, [answerId]: true }));
    setBanner(null);

    const resp = await fetch("/api/admin/study/answers/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: qid, answerId }),
    });
    const json = await resp.json().catch(() => null);

    if (!resp.ok || !json?.ok) {
      setQaMutating((p) => ({ ...p, [answerId]: false }));
      setBanner({ kind: "error", text: json?.error ?? "Failed to accept answer." });
      return;
    }

    setQaMutating((p) => ({ ...p, [answerId]: false }));
    setBanner({ kind: "success", text: "Accepted answer set." });
    if (qaSelectedQ) await openAnswersDrawer(qaSelectedQ);
    fetchQuestions();
  }

  // ----- Q&A tab UI -----
  if (tab === "qa") {
    const qTotalPages = Math.max(1, Math.ceil(questionsTotal / Math.max(1, perPage)));

    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">Study Admin</h1>
            <p className="mt-1 text-sm text-zinc-600">Moderate questions and answers.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/study/academic-calendar"
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold",
                "bg-white hover:bg-zinc-50"
              )}
            >
              <CalendarDays className="h-4 w-4" /> Academic Calendar
            </Link>

            <Link
              href="/admin/study/semester-health"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
              title="Run semester auto-detect + filtering checks"
            >
              <Activity className="h-4 w-4" /> Semester Health
            </Link>

            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: null, page: null }))}
              className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold", "bg-white hover:bg-zinc-50")}
            >
              <FileText className="h-4 w-4" /> Materials
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "tutors", page: null }))}
              className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold", "bg-white hover:bg-zinc-50")}
            >
              <Users className="h-4 w-4" /> Tutors
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "reports", page: null }))}
              className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold", "bg-white hover:bg-zinc-50")}
            >
              <Flag className="h-4 w-4" /> Reports
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "practice", page: null }))}
              className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold", "bg-white hover:bg-zinc-50")}
            >
              <BookOpen className="h-4 w-4" /> Practice
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: null }))}
              className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold", "border-zinc-900 bg-zinc-900 text-white")}
            >
              <MessageSquareText className="h-4 w-4" /> Q&amp;A
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "quality", page: null }))}
              className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold", "bg-white hover:bg-zinc-50")}
            >
              <ListChecks className="h-4 w-4" /> Question Quality
            </button>
          </div>
        </header>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-zinc-600">Search</label>
            <div className="mt-1 flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                value={qParam}
                onChange={(e) => router.replace(buildHref(pathname, { tab: "qa", page: null, q: normalize(e.target.value) || null, code: codeParam || null, per: perPage !== DEFAULT_PER_PAGE ? perPage : null }))}
                placeholder="Search questions…"
                className="w-full bg-transparent text-sm outline-none"
              />
              {qParam ? (
                <button type="button" onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: null, q: null, code: codeParam || null }))} className="rounded-xl p-1 hover:bg-black/5" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600">Course code (optional)</label>
            <div className="mt-1 flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
              <Filter className="h-4 w-4 text-zinc-500" />
              <input
                value={codeParam}
                onChange={(e) => router.replace(buildHref(pathname, { tab: "qa", page: null, q: qParam || null, code: normalize(e.target.value).toUpperCase() || null, per: perPage !== DEFAULT_PER_PAGE ? perPage : null }))}
                placeholder="e.g. GST101"
                className="w-full bg-transparent text-sm outline-none"
              />
              {codeParam ? (
                <button type="button" onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: null, q: qParam || null, code: null }))} className="rounded-xl p-1 hover:bg-black/5" aria-label="Clear course filter">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {banner ? <BannerBox kind={banner.kind} text={banner.text} onClose={() => setBanner(null)} /> : null}

        <div className="rounded-3xl border bg-white p-2 shadow-sm">
          {qaLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading questions…
            </div>
          ) : questions.length ? (
            <div className="divide-y">
              {questions.map((q) => {
                const busy = Boolean(qaMutating[q.id]);
                return (
                  <div key={q.id} className="p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">
                          {q.title}{" "}
                          {q.solved ? <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Solved</span> : null}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">
                          {q.course_code ? `${String(q.course_code).toUpperCase()} • ` : ""}
                          {q.level ? `${q.level} • ` : ""}
                          {formatDate(q.created_at)}
                          {q.author_email ? ` • ${q.author_email}` : ""}
                        </p>
                        <p className="mt-2 text-xs text-zinc-700">
                          {q.answers_count ?? 0} answers • {q.upvotes_count ?? 0} upvotes
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/study/questions/${q.id}`}
                          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
                        >
                          <ExternalLink className="h-4 w-4" /> Open
                        </Link>

                        <button
                          type="button"
                          onClick={() => openAnswersDrawer(q)}
                          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
                        >
                          <Eye className="h-4 w-4" /> Answers
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => adminToggleSolved(q)}
                          className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold", q.solved ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100", busy ? "opacity-70" : "")}
                        >
                          {q.solved ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                          {q.solved ? "Unsolve" : "Solve"}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => adminDeleteQuestion(q.id)}
                          className={cn("inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100", busy ? "opacity-70" : "")}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-zinc-600">No questions found.</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-600">
            Page <span className="font-semibold text-zinc-900">{page}</span> of{" "}
            <span className="font-semibold text-zinc-900">{qTotalPages}</span> •{" "}
            <span className="font-semibold text-zinc-900">{questionsTotal}</span> total
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: Math.max(1, page - 1), per: perPage !== DEFAULT_PER_PAGE ? perPage : null, q: qParam || null, code: codeParam || null }))}
              className={cn("inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50", page <= 1 ? "opacity-40" : "")}
            >
              <ArrowLeft className="h-4 w-4" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= qTotalPages}
              onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: Math.min(qTotalPages, page + 1), per: perPage !== DEFAULT_PER_PAGE ? perPage : null, q: qParam || null, code: codeParam || null }))}
              className={cn("inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50", page >= qTotalPages ? "opacity-40" : "")}
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Drawer
          open={qaDrawerOpen}
          title={qaSelectedQ ? `Answers (${qaSelectedQ.title ?? ""})` : "Answers"}
          onClose={() => {
            setQaDrawerOpen(false);
            setQaSelectedQ(null);
            setQaAnswers([]);
          }}
          footer={
            qaSelectedQ?.id ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/study/questions/${qaSelectedQ.id}`}
                  className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
                >
                  <ExternalLink className="h-4 w-4" /> Open in Study
                </Link>
                <button
                  type="button"
                  onClick={() => adminDeleteQuestion(qaSelectedQ.id)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" /> Delete question
                </button>
              </div>
            ) : null
          }
        >
          {qaAnswersLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading answers…
            </div>
          ) : qaAnswers.length ? (
            <div className="space-y-3">
              {qaAnswers.map((a) => {
                const busy = Boolean(qaMutating[a.id]);
                return (
                  <div key={a.id} className={cn("rounded-2xl border p-3", a.is_accepted ? "border-emerald-200 bg-emerald-50" : "bg-white")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-700">
                        {a.author_email ?? "Unknown"} • {formatDate(a.created_at)}
                        {a.is_accepted ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Accepted</span> : null}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => adminAcceptAnswer(a.id)}
                          className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold", a.is_accepted ? "border-zinc-200 bg-white hover:bg-zinc-50" : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100", busy ? "opacity-70" : "")}
                        >
                          <Check className="h-4 w-4" /> {a.is_accepted ? "Accepted" : "Accept"}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => adminDeleteAnswer(a.id)}
                          className={cn("inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100", busy ? "opacity-70" : "")}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Delete
                        </button>
                      </div>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{a.body}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-zinc-600">No answers for this question.</div>
          )}
        </Drawer>
      </main>
    );
  }

// ----- Practice (CBT) tab UI -----
  if (tab === "practice") {
    const setsPages = Math.max(1, Math.ceil(setsTotal / Math.max(1, perPage)));
    return (
      <div className="space-y-4 pb-28 md:pb-6">
        <header className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 no-underline hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: null, page: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Materials
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "tutors", page: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Tutors
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "reports", page: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Reports
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "practice", page: null }))}
              className="rounded-full border bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
            >
              CBT Sets
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Q&amp;A
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "quality", page: null }))}
              className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              <ListChecks className="h-4 w-4" /> Question Quality
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-zinc-50">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-zinc-900">Practice (CBT) manager</p>
                <p className="text-sm text-zinc-600">Create, edit and publish CBT sets.</p>
                <p className="mt-1 text-xs font-semibold text-zinc-600">
                  {setsLoading ? "Loading…" : `Showing ${sets.length} on this page • Total: ${setsTotal}`}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href="/admin/study/practice/new"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                + New set
              </Link>
              <button
                type="button"
                onClick={() => router.replace(buildHref(pathname, { tab: "practice", page: null, q: null }))}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
              >
                <X className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
            <Search className="h-5 w-5 text-zinc-500" />
            <input
              defaultValue={qParam}
              placeholder="Search set title or course code…"
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              inputMode="search"
              onChange={(e) => {
                const v = e.target.value;
                (window as any).__adminStudyQTimer && clearTimeout((window as any).__adminStudyQTimer);
                (window as any).__adminStudyQTimer = setTimeout(() => {
                  router.replace(buildHref(pathname, { tab: "practice", page: null, per: perPage !== DEFAULT_PER_PAGE ? perPage : null, q: normalize(v) || null }));
                }, 300);
              }}
            />
            {qParam ? (
              <button
                type="button"
                onClick={() => router.replace(buildHref(pathname, { tab: "practice", page: null, q: null }))}
                className="grid h-8 w-8 place-items-center rounded-xl hover:bg-zinc-50"
              >
                <X className="h-4 w-4 text-zinc-600" />
              </button>
            ) : null}
          </div>
        </header>

        {banner ? <BannerBox kind={banner.kind} text={banner.text} onClose={() => setBanner(null)} /> : null}

        <div className="rounded-3xl border bg-white shadow-sm">
          <div className="border-b p-4">
            <p className="text-sm font-semibold text-zinc-900">CBT Sets</p>
            <p className="mt-1 text-xs text-zinc-600">Publish sets to make them available in /study/practice</p>
          </div>

          {setsLoading ? (
            <div className="p-10 text-center text-sm text-zinc-600">Loading CBT sets…</div>
          ) : sets.length ? (
            <div className="divide-y">
              {sets.map((s: any) => {
                const busy = !!setsMutating[s.id];
                return (
                  <div key={s.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{s.title}</p>
                        <p className="mt-1 text-xs text-zinc-600">
                          {s.course_code ? `Course: ${s.course_code}` : "No course"}
                          {s.level ? ` • Level: ${s.level}` : ""}
                          {typeof s.time_limit_minutes === "number" ? ` • Time: ${s.time_limit_minutes} min` : ""}
                          {typeof s.questions_count === "number" ? ` • Questions: ${s.questions_count}` : ""}
                        </p>
                        {s.description ? <p className="mt-2 text-xs text-zinc-700">{s.description}</p> : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-1 text-[11px] font-semibold",
                            s.published ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-zinc-50 text-zinc-700"
                          )}
                        >
                          {s.published ? "Published" : "Draft"}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSetPublish(s.id, !s.published)}
                          disabled={busy}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50",
                            busy ? "opacity-60" : ""
                          )}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          {s.published ? "Unpublish" : "Publish"}
                        </button>
                        <Link
                          href={`/admin/study/practice/${s.id}`}
                          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
                        >
                          <Eye className="h-4 w-4" /> Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => deleteSet(s.id)}
                          disabled={busy}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50",
                            busy ? "opacity-60" : ""
                          )}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-zinc-600">No CBT sets yet. Create one.</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <ArrowLeft className="h-4 w-4" /> Prev
          </button>
          <p className="text-sm font-semibold text-zinc-700">Page {page} / {setsPages}</p>
          <button
            type="button"
            onClick={() => goPage(page + 1)}
            disabled={sets.length < perPage}
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ----- Tutors tab UI -----
  if (tab === "tutors") {
    return (
      <div className="space-y-4 pb-28 md:pb-6">
        <header className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 no-underline hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Materials
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "tutors" }))}
              className="rounded-full border bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Tutors
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "reports", page: null, q: qParam || null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Reports
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "practice", page: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              CBT Sets
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Q&amp;A
            </button>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-zinc-50">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-zinc-900">Tutors</p>
                <p className="text-sm text-zinc-600">Verify or unverify tutors shown on /study/tutors.</p>
                <p className="mt-1 text-xs font-semibold text-zinc-600">
                  {tutorsLoading ? "Loading…" : `Showing ${tutors.length} on this page • Total: ${tutorsTotal}`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
            <Search className="h-5 w-5 text-zinc-500" />
            <input
              defaultValue={qParam}
              placeholder="Search tutors…"
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              inputMode="search"
              onChange={(e) => {
                const v = e.target.value;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__adminStudyTutorQTimer && clearTimeout((window as any).__adminStudyTutorQTimer);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__adminStudyTutorQTimer = setTimeout(() => {
                  router.replace(buildHref(pathname, { tab: "tutors", page: null, per: perPage !== DEFAULT_PER_PAGE ? perPage : null, q: normalize(v) || null }));
                }, 250);
              }}
            />
            {qParam ? (
              <button
                type="button"
                onClick={() => router.replace(buildHref(pathname, { tab: "tutors", page: null, per: perPage !== DEFAULT_PER_PAGE ? perPage : null }))}
                className="rounded-xl p-1 hover:bg-black/5"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </header>

        {banner ? <BannerBox kind={banner.kind} text={banner.text} onClose={() => setBanner(null)} /> : null}

        <div className="rounded-3xl border bg-white p-2 shadow-sm">
          {tutorsLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading tutors…
            </div>
          ) : tutors.length ? (
            <div className="divide-y">
              {tutors.map((t) => {
                const name = normalize(String(t?.name ?? t?.full_name ?? t?.display_name ?? "Tutor"));
                const verifiedKey = pickKey(t, ["verified", "is_verified", "approved"]);
                const verified = verifiedKey ? Boolean(t?.[verifiedKey]) : false;
                const courses = Array.isArray(t?.courses)
                  ? t.courses.join(", ")
                  : normalize(String(t?.courses ?? t?.course_codes ?? t?.subjects ?? ""));
                return (
                  <div key={String(t.id)} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{courses || "(no courses listed)"}</p>
                      <p className="mt-1 text-[11px] font-semibold text-zinc-500">id: {String(t.id)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px] font-semibold",
                          verified ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-zinc-50 text-zinc-700"
                        )}
                      >
                        {verified ? "Verified" : "Unverified"}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleTutorVerified(t)}
                        disabled={tutorsMutating[String(t.id)]}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold",
                          verified ? "bg-white hover:bg-zinc-50" : "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800",
                          tutorsMutating[String(t.id)] ? "opacity-60" : ""
                        )}
                      >
                        {tutorsMutating[String(t.id)] ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {verified ? "Unverify" : "Verify"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-zinc-600">No tutors found.</div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <ArrowLeft className="h-4 w-4" /> Prev
          </button>
          <p className="text-sm font-semibold text-zinc-700">Page {page}</p>
          <button
            type="button"
            onClick={() => goPage(page + 1)}
            disabled={tutors.length < perPage}
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ----- Reports tab UI -----
  if (tab === "reports") {
    return (
      <div className="space-y-4 pb-28 md:pb-6">
        <header className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 no-underline hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Materials
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "tutors" }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Tutors
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "reports" }))}
              className="rounded-full border bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Reports
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "practice", page: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              CBT Sets
            </button>
            <button
              type="button"
              onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: null }))}
              className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Q&amp;A
            </button>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-zinc-50">
                <Flag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-zinc-900">Study reports</p>
                <p className="text-sm text-zinc-600">Review reports submitted from /study/report.</p>
                <p className="mt-1 text-xs font-semibold text-zinc-600">
                  {reportsLoading ? "Loading…" : `Showing ${reports.length} on this page • Total: ${reportsTotal}`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
            <Search className="h-5 w-5 text-zinc-500" />
            <input
              defaultValue={qParam}
              placeholder="Search reason / details / email…"
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              inputMode="search"
              onChange={(e) => {
                const v = e.target.value;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__adminStudyReportsQTimer && clearTimeout((window as any).__adminStudyReportsQTimer);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__adminStudyReportsQTimer = setTimeout(() => {
                  router.replace(buildHref(pathname, { tab: "reports", page: null, per: perPage !== DEFAULT_PER_PAGE ? perPage : null, q: normalize(v) || null }));
                }, 250);
              }}
            />
            {qParam ? (
              <button
                type="button"
                onClick={() => router.replace(buildHref(pathname, { tab: "reports", page: null, per: perPage !== DEFAULT_PER_PAGE ? perPage : null }))}
                className="rounded-xl p-1 hover:bg-black/5"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </header>

        {banner ? <BannerBox kind={banner.kind} text={banner.text} onClose={() => setBanner(null)} /> : null}

        <div className="rounded-3xl border bg-white p-2 shadow-sm">
          {reportsLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
            </div>
          ) : reports.length ? (
            <div className="divide-y">
              {reports.map((r) => {
                const busy = Boolean(reportsMutating[r.id]);
                const kind = r.tutor_id
                  ? "Tutor"
                  : r.material_id
                    ? "Material"
                    : r.answer_id
                      ? "Answer"
                      : "Question";

                const targetId =
                  r.tutor_id ?? r.material_id ?? r.answer_id ?? r.question_id ?? null;

                const targetHref = r.tutor_id
                  ? "/study/tutors"
                  : r.material_id
                    ? "/study/materials"
                    : r.answer_id
                      ? r.question_id
                        ? `/study/questions/${r.question_id}`
                        : "/study/questions"
                      : r.question_id
                        ? `/study/questions/${r.question_id}`
                        : "/study/questions";
                return (
                  <div key={r.id} className="p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">
                          {kind} report • <span className="text-zinc-500">{formatDate(r.created_at)}</span>
                        </p>
                        <p className="mt-1 text-sm text-zinc-800">{r.reason}</p>
                        {r.details ? <p className="mt-1 text-xs text-zinc-600">{r.details}</p> : null}
                        <p className="mt-2 text-[11px] font-semibold text-zinc-500">
                          {kind.toLowerCase()}_id: {targetId ?? "—"}
                          {r.reporter_email ? ` • from: ${r.reporter_email}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={targetHref}
                          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
                        >
                          <ExternalLink className="h-4 w-4" /> Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => deleteReportTarget(r)}
                          disabled={busy}
                          className={cn(
                            "inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100",
                            busy ? "opacity-60" : ""
                          )}
                          title="Delete the reported content and resolve the report"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Delete
                        </button>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-1 text-[11px] font-semibold",
                            (r.status ?? "open") === "resolved"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-amber-200 bg-amber-50 text-amber-900"
                          )}
                        >
                          {(r.status ?? "open") === "resolved" ? "Resolved" : "Open"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setReportStatus(r.id, (r.status ?? "open") === "resolved" ? "open" : "resolved")}
                          disabled={busy}
                          className={cn(
                            "inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50",
                            busy ? "opacity-60" : ""
                          )}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {(r.status ?? "open") === "resolved" ? "Re-open" : "Resolve"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-zinc-600">No reports yet.</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <ArrowLeft className="h-4 w-4" /> Prev
          </button>
          <p className="text-sm font-semibold text-zinc-700">Page {page}</p>
          <button
            type="button"
            onClick={() => goPage(page + 1)}
            disabled={reports.length < perPage}
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (tab === "quality") {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => router.replace(buildHref(pathname, { tab: null, page: null }))} className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50">Materials</button>
            <button type="button" onClick={() => router.replace(buildHref(pathname, { tab: "practice", page: null }))} className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50">CBT Sets</button>
            <button type="button" onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: null }))} className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50">Q&amp;A</button>
            <button type="button" onClick={() => router.replace(buildHref(pathname, { tab: "quality", page: null }))} className="inline-flex items-center gap-2 rounded-full border bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">
              <ListChecks className="h-4 w-4" /> Question Quality
            </button>
          </div>
        </div>
        <QuestionQualityClient
          apiPath="/api/admin/study/questions/quality"
          title="Question Quality"
          description="Inspect generated questions, source coverage, repeated fingerprints, and metadata health."
          tabValue="quality"
        />
      </main>
    );
  }

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <header className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 no-underline hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.replace(buildHref(pathname, { tab: null, page: null }))}
            className="rounded-full border bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Materials
          </button>
          <button
            type="button"
            onClick={() => router.replace(buildHref(pathname, { tab: "tutors", page: null }))}
            className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            Tutors
          </button>
          <button
            type="button"
            onClick={() => router.replace(buildHref(pathname, { tab: "reports", page: null }))}
            className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            Reports
          </button>
          <button
            type="button"
            onClick={() => router.replace(buildHref(pathname, { tab: "practice", page: null }))}
            className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            CBT Sets
          </button>
          <button
            type="button"
            onClick={() => router.replace(buildHref(pathname, { tab: "qa", page: null }))}
            className="rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            Q&amp;A
          </button>
          <button
            type="button"
            onClick={() => router.replace(buildHref(pathname, { tab: "quality", page: null }))}
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            <ListChecks className="h-4 w-4" /> Question Quality
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-zinc-50">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-900">Study uploads</p>
              <p className="text-sm text-zinc-600">Approve or reject uploaded materials.</p>
              <p className="mt-1 text-xs font-semibold text-zinc-600">
                {loading ? "Loading…" : `Showing ${items.length} on this page • Total: ${total}`}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={openFilters}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount ? (
                <span className="ml-1 rounded-full border bg-zinc-50 px-2 py-0.5 text-[11px] font-bold">
                  {activeFiltersCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={clearAllUrl}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Quick search (updates URL) */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
          <Search className="h-5 w-5 text-zinc-500" />
          <input
            defaultValue={qParam}
            placeholder="Search title (and apply filters for course fields)…"
            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            inputMode="search"
            onChange={(e) => {
              const v = e.target.value;
              // debounce replace
              // (simple inline debounce)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__adminStudyQTimer && clearTimeout((window as any).__adminStudyQTimer);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__adminStudyQTimer = setTimeout(() => {
                router.replace(
                  buildHref(pathname, {
                    tab: tab !== "materials" ? tab : null,
                    page: null,
                    per: perPage !== DEFAULT_PER_PAGE ? perPage : null,
                    status: status !== "pending" ? status : null,
                    sort: sort !== "newest" ? sort : null,
                    q: normalize(v) || null,
                    type: typeParam || null,
                    session: sessionParam || null,
                    dept: deptParam || null,
                    level: levelParam || null,
                    code: codeParam || null,
                  })
                );
                setSelected({});
              }, 300);
            }}
          />
          {qParam ? (
            <button
              type="button"
              onClick={() =>
                router.replace(
                  buildHref(pathname, {
                    page: null,
                    per: perPage !== DEFAULT_PER_PAGE ? perPage : null,
                    status: status !== "pending" ? status : null,
                    sort: sort !== "newest" ? sort : null,
                    q: null,
                    type: typeParam || null,
                    session: sessionParam || null,
                    dept: deptParam || null,
                    level: levelParam || null,
                    code: codeParam || null,
                  })
                )
              }
              className="grid h-8 w-8 place-items-center rounded-xl hover:bg-zinc-50"
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-zinc-600" />
            </button>
          ) : null}
        </div>
      </header>

      {banner ? (
        <BannerBox
          kind={banner.kind}
          text={banner.text}
          onClose={() => setBanner(null)}
        />
      ) : null}

      {/* Bulk bar */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allOnPageSelected ? clearSelectionOnPage : selectAllOnPage}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              {allOnPageSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allOnPageSelected ? "Unselect page" : "Select page"}
            </button>

            <span className="text-sm text-zinc-600">
              Selected: <span className="font-semibold text-zinc-900">{selectedCount}</span>
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={approveBulk}
              disabled={selectedCount === 0 || bulkBusy || bulkIndexBusy}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                selectedCount === 0 || bulkBusy || bulkIndexBusy
                  ? "cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500"
                  : "border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-600"
              )}
            >
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve selected
            </button>

            <button
              type="button"
              onClick={reindexBulk}
              disabled={selectedCount === 0 || bulkBusy || bulkIndexBusy}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                selectedCount === 0 || bulkBusy || bulkIndexBusy
                  ? "cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500"
                  : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              )}
            >
              {bulkIndexBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Index selected
            </button>

            <button
              type="button"
              onClick={openRejectModalForSelected}
              disabled={selectedCount === 0 || bulkBusy || bulkIndexBusy}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                selectedCount === 0 || bulkBusy || bulkIndexBusy
                  ? "cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500"
                  : "border border-red-700 bg-red-700 text-white hover:bg-red-600"
              )}
            >
              <Trash2 className="h-4 w-4" />
              Reject selected
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-3xl border bg-white p-5 text-sm text-zinc-600 inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border bg-white p-5">
          <p className="text-sm font-semibold text-zinc-900">No results</p>
          <p className="mt-1 text-sm text-zinc-600">
            Try clearing filters or switching status (Pending / Approved / All).
          </p>
          <button
            type="button"
            onClick={clearAllUrl}
            className="mt-3 inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const c = m.study_courses;
            const meta = `${c.department} • ${c.level}L • ${c.course_code}${c.course_title ? ` — ${c.course_title}` : ""} • ${c.semester.toUpperCase()}`;
            const busy = !!mutating[m.id];
            const selectedRow = !!selected[m.id];
            const canReindex = Boolean(m.approved) && isIndexableMaterialPath(m.file_path);
            const indexBusy = mutating[m.id] === "reindex" || m.index_status === "indexing";

            return (
              <div key={m.id} className="rounded-3xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelect(m.id)}
                      className="mt-0.5 grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-zinc-50"
                      aria-label="Select row"
                    >
                      {selectedRow ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900">{m.title}</p>
                      <p className="mt-1 text-xs text-zinc-600">{meta}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700">
                          {TYPE_LABEL[m.material_type]}
                        </span>
                        <IndexStatusBadge row={m} />
                        {m.session ? (
                          <span className="rounded-full border bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700">
                            {m.session}
                          </span>
                        ) : null}
                        <span className="rounded-full border bg-white px-2 py-1 text-[11px] font-medium text-zinc-700">
                          {formatDate(m.created_at)}
                        </span>

                        <button
                          type="button"
                          onClick={() => copyId(m.id)}
                          className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy ID
                        </button>

                        <a
                          href={`/api/study/materials/${m.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
                        >
                          View file <ExternalLink className="h-3.5 w-3.5" />
                        </a>

                        <button
                          type="button"
                          onClick={() => openPreview(m)}
                          className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                      </div>

                      {m.uploader_id ? (
                        <p className="mt-2 text-[11px] text-zinc-500">
                          Uploader: <span className="font-semibold">{m.uploader_id}</span>
                        </p>
                      ) : null}
                      {m.index_error ? (
                        <p className="mt-2 line-clamp-1 text-[11px] text-amber-700">Index note: {m.index_error}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => approveOne(m.id)}
                      disabled={busy || bulkBusy || bulkIndexBusy}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                        "border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-600",
                        busy || bulkBusy || bulkIndexBusy ? "opacity-70" : ""
                      )}
                    >
                      {mutating[m.id] === "approve" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Approve
                    </button>

                    {canReindex ? (
                      <button
                        type="button"
                        onClick={() => reindexOne(m.id)}
                        disabled={busy || bulkBusy || bulkIndexBusy || indexBusy}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                          "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                          busy || bulkBusy || bulkIndexBusy || indexBusy ? "opacity-70" : ""
                        )}
                      >
                        {indexBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Reindex
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openRejectModalForOne(m)}
                      disabled={busy || bulkBusy || bulkIndexBusy}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                        "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                        busy || bulkBusy || bulkIndexBusy ? "opacity-70" : ""
                      )}
                    >
                      <Trash2 className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          <footer className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-600">
              Page <span className="font-semibold text-zinc-900">{page}</span> of{" "}
              <span className="font-semibold text-zinc-900">{totalPages}</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goPage(page - 1)}
                disabled={page <= 1}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
                  page <= 1 ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-50"
                )}
              >
                <ArrowLeft className="h-4 w-4" /> Prev
              </button>

              <button
                type="button"
                onClick={() => goPage(page + 1)}
                disabled={page >= totalPages}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
                  page >= totalPages ? "cursor-not-allowed opacity-50" : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* Filters Drawer */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              <Check className="h-4 w-4" />
              Apply
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block rounded-2xl border bg-white p-3">
            <span className="text-xs font-semibold text-zinc-600">Status</span>
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value as StatusKey)}
              className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="all">All</option>
            </select>
          </label>

          <label className="block rounded-2xl border bg-white p-3">
            <span className="text-xs font-semibold text-zinc-600">Sort</span>
            <select
              value={sortDraft}
              onChange={(e) => setSortDraft(e.target.value as SortKey)}
              className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>

          <label className="block rounded-2xl border bg-white p-3">
            <span className="text-xs font-semibold text-zinc-600">Items per page</span>
            <select
              value={perDraft}
              onChange={(e) => setPerDraft(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>

          <label className="block rounded-2xl border bg-white p-3">
            <span className="text-xs font-semibold text-zinc-600">Title search</span>
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="e.g. CSC201 past questions"
              className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </label>

          <label className="block rounded-2xl border bg-white p-3">
            <span className="text-xs font-semibold text-zinc-600">Material type</span>
            <select
              value={typeDraft}
              onChange={(e) => setTypeDraft(e.target.value as any)}
              className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none"
            >
              <option value="">All types</option>
              {Object.keys(TYPE_LABEL).map((k) => (
                <option key={k} value={k}>
                  {TYPE_LABEL[k as MaterialType]}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block rounded-2xl border bg-white p-3">
              <span className="text-xs font-semibold text-zinc-600">Session</span>
              <input
                value={sessionDraft}
                onChange={(e) => setSessionDraft(e.target.value)}
                placeholder="e.g. 2024/2025"
                className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </label>

            <label className="block rounded-2xl border bg-white p-3">
              <span className="text-xs font-semibold text-zinc-600">Department</span>
              <input
                value={deptDraft}
                onChange={(e) => setDeptDraft(e.target.value)}
                placeholder="e.g. Computer Science"
                className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </label>

            <label className="block rounded-2xl border bg-white p-3">
              <span className="text-xs font-semibold text-zinc-600">Level</span>
              <input
                value={levelDraft}
                onChange={(e) => setLevelDraft(e.target.value)}
                placeholder="e.g. 200"
                inputMode="numeric"
                className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <p className="mt-1 text-[11px] text-zinc-500">Exact match (e.g. 100, 200…)</p>
            </label>

            <label className="block rounded-2xl border bg-white p-3">
              <span className="text-xs font-semibold text-zinc-600">Course code</span>
              <input
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value)}
                placeholder="e.g. GST101"
                className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <p className="mt-1 text-[11px] text-zinc-500">Matches course_code on the linked course</p>
            </label>
          </div>

          <div className="rounded-2xl border bg-zinc-50 p-3 text-sm text-zinc-700">
            Tip: Department/Level/Course Code filters depend on the linked{" "}
            <span className="font-semibold">study_courses</span> record.
          </div>
        </div>
      </Drawer>

      {/* Preview Drawer */}
      <Drawer
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewItem(null);
        }}
        title="Preview"
        footer={
          previewItem ? (
            <div className="flex gap-2">
              <a
                href={`/api/study/materials/${previewItem.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
              >
                <ExternalLink className="h-4 w-4" />
                Open file
              </a>
              <button
                type="button"
                onClick={() => approveOne(previewItem.id)}
                disabled={!!mutating[previewItem.id] || bulkBusy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-700 bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                {mutating[previewItem.id] === "approve" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve
              </button>
            </div>
          ) : null
        }
      >
        {!previewItem ? (
          <div className="rounded-2xl border bg-white p-4 text-sm text-zinc-600">No preview selected.</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-sm font-semibold text-zinc-900">{previewItem.title}</p>
              <p className="mt-1 text-xs text-zinc-600">
                {previewItem.study_courses.department} • {previewItem.study_courses.level}L •{" "}
                {previewItem.study_courses.course_code}
                {previewItem.study_courses.course_title ? ` — ${previewItem.study_courses.course_title}` : ""} •{" "}
                {previewItem.study_courses.semester.toUpperCase()}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700">
                  {TYPE_LABEL[previewItem.material_type]}
                </span>
                {previewItem.session ? (
                  <span className="rounded-full border bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700">
                    {previewItem.session}
                  </span>
                ) : null}
                <span className="rounded-full border bg-white px-2 py-1 text-[11px] font-medium text-zinc-700">
                  {formatDate(previewItem.created_at)}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border bg-white overflow-hidden">
              {guessFileKind(previewItem.file_url) === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewItem.file_url} alt="Preview" className="h-auto w-full" />
              ) : guessFileKind(previewItem.file_url) === "pdf" ? (
                <iframe
                  src={previewItem.file_url}
                  title="PDF preview"
                  className="h-[60vh] w-full"
                />
              ) : (
                <div className="p-4 text-sm text-zinc-600">
                  Preview not available for this file type. Use{" "}
                  <a
                    href={`/api/study/materials/${previewItem.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-zinc-900 underline"
                  >
                    Open file
                  </a>
                  .
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => openRejectModalForOne(previewItem)}
              disabled={!!mutating[previewItem.id] || bulkBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-700 bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Reject (delete)
            </button>
          </div>
        )}
      </Drawer>

      {/* Reject confirm modal (supports single + bulk) */}
      <ConfirmModal
        open={rejectOpen}
        title={rejectTargets.length > 1 ? `Reject ${rejectTargets.length} uploads?` : "Reject this upload?"}
        dangerText="Reject will delete the DB record and try to remove the file from storage."
        body={
          <div className="space-y-2">
            <p className="text-sm text-zinc-700">
              This action is not reversible.
            </p>
            <div className="rounded-2xl border bg-zinc-50 p-3">
              {rejectTargets.slice(0, 5).map((r) => (
                <div key={r.id} className="text-sm">
                  <span className="font-semibold text-zinc-900">{r.title}</span>{" "}
                  <span className="text-zinc-500">• {r.study_courses.course_code}</span>
                </div>
              ))}
              {rejectTargets.length > 5 ? (
                <p className="mt-2 text-xs text-zinc-500">…and {rejectTargets.length - 5} more</p>
              ) : null}
            </div>
          </div>
        }
        confirmText="Reject"
        loading={rejectBusy}
        onCancel={() => {
          if (rejectBusy) return;
          setRejectOpen(false);
          setRejectTargets([]);
        }}
        onConfirm={confirmRejectModal}
      />
    </div>
  );
}
