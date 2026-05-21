"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight,
  Search,
  X,
  UploadCloud,
  FileText,
  Clock,
  SlidersHorizontal,
  CheckCircle2,
  Star,
  Bookmark,
  BookmarkCheck,
  SortAsc,
  SortDesc,
  TrendingUp,
} from "lucide-react";

import { getAuthedUserId, toggleSaved } from "@/lib/studySaved";
import { cn, formatWhen, normalizeQuery, safeSearchTerm, buildHref, asInt, clamp } from "@/lib/utils";
import StudyTabs from "../_components/StudyTabs";
import { Card, EmptyState, SkeletonCard } from "../_components/StudyUI";
import { RequestCourseModal } from "../_components/RequestCourseModal";

type SortKey = "newest" | "oldest" | "downloads_desc" | "downloads_asc";

type MaterialTypeKey =
  | "all"
  | "past_question"
  | "handout"
  | "note"
  | "slides"
  | "timetable"
  | "other";

type Course = {
  id: string;
  faculty: string;
  department: string;
  level: number;
  semester: string;
  course_code: string;
  course_title: string | null;
  faculty_id?: string | null;
  department_id?: string | null;
};

type FastLaneCourse = {
  id: string;
  course_code: string;
  course_title: string | null;
  materialCount: number;
};

type MaterialRow = {
  id: string;
  title: string | null;
  description: string | null;
  file_path: string | null;
  session: string | null;
  approved: boolean | null;
  created_at: string | null;
  downloads: number | null;
  up_votes: number | null;
  course_id: string | null;

  material_type?: string | null;
  featured?: boolean | null;
  verified?: boolean | null;
  ai_summary?: string | null;

  study_courses?: {
    id: string;
    faculty: string;
    department: string;
    level: number;
    semester: string;
    course_code: string;
    course_title: string | null;
  } | null;
};

const LEVELS = ["100", "200", "300", "400", "500"] as const;
const SEMESTERS = ["1st", "2nd", "summer"] as const;

function mapSemesterParamToDb(v: string) {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "1st" || s === "first") return "first";
  if (s === "2nd" || s === "second") return "second";
  if (s === "summer") return "summer";
  return "";
}

function mapMaterialTypeToDb(v: MaterialTypeKey) {
  if (v === "all") return "";
  return v;
}

const MATERIAL_TYPES: Array<{ key: MaterialTypeKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "past_question", label: "Past Q" },
  { key: "handout", label: "Handout" },
  { key: "note", label: "Lecture note" },
  { key: "slides", label: "Slides" },
  { key: "timetable", label: "Timetable" },
  { key: "other", label: "Other" },
];

const SORTS: Array<{ key: SortKey; label: string; icon: React.ReactNode }> = [
  { key: "newest", label: "Newest", icon: <SortDesc className="h-4 w-4" /> },
  { key: "oldest", label: "Oldest", icon: <SortAsc className="h-4 w-4" /> },
  { key: "downloads_desc", label: "Most downloaded", icon: <SortDesc className="h-4 w-4" /> },
  { key: "downloads_asc", label: "Least downloaded", icon: <SortAsc className="h-4 w-4" /> },
];

function Chip({
  active,
  children,
  onClick,
  className,
  title,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
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
          : "border-border/60 bg-background text-muted-brand hover:bg-secondary/50 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl border p-3 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "border-border bg-secondary text-foreground" : "border-border/60 bg-background hover:bg-secondary/50"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {desc ? <p className="mt-0.5 text-xs text-muted-brand">{desc}</p> : null}
      </div>
      <div
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
          checked ? "border-border bg-background" : "border-border/60 bg-background"
        )}
      >
        {checked ? <CheckCircle2 className="h-4 w-4 text-foreground" /> : null}
      </div>
    </button>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-background p-3">
      <span className="text-xs font-semibold text-muted-brand">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm text-foreground outline-none"
      >
        <option value="">{placeholder ?? "All"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextRow({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-background p-3">
      <span className="text-xs font-semibold text-muted-brand">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
      />
      {hint ? <p className="mt-1 text-xs text-muted-brand">{hint}</p> : null}
    </label>
  );
}

/** Drawer: scroll lock + ESC close + first focus */
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
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-2xl border border-border bg-background",
              "hover:bg-secondary/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>

        {footer ? <div className="border-t border-border p-4">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Preview modal: PDF/image inline, others open new tab */
function PreviewModal({
  open,
  onClose,
  title,
  url,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
  kind: "pdf" | "image" | "other";
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] transition-opacity",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          "absolute left-1/2 top-1/2 w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2",
          "rounded-3xl border border-border bg-card shadow-2xl"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Preview"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-xs text-muted-brand">Preview</p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold",
                "text-foreground hover:bg-secondary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              )}
            >
              <ArrowRight className="h-4 w-4" />
              Open
            </a>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-2xl border border-border bg-background",
                "hover:bg-secondary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              )}
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-3">
          <div className="h-[70vh] w-full overflow-hidden rounded-2xl border border-border bg-background">
            {kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={title} className="h-full w-full object-contain" />
            ) : kind === "pdf" ? (
              <iframe title="PDF preview" src={url} className="h-full w-full" />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <p className="text-sm font-semibold text-foreground">Preview not available</p>
                  <p className="mt-1 text-sm text-muted-brand">
                    Tap &quot;Open&quot; to view this file in a new tab.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function detectFileKind(m: MaterialRow): "pdf" | "image" | "other" {
  const src = (m.file_path ?? "").toLowerCase();
  if (src.includes(".pdf")) return "pdf";
  if (src.match(/\.(png|jpg|jpeg|webp|gif)/)) return "image";
  return "other";
}

function MaterialCard({
  m, saved, saving, onToggleSave,
}: {
  m: MaterialRow; saved: boolean; saving: boolean; onToggleSave: () => void;
}) {
  const title = (m.title ?? "Untitled material").trim() || "Untitled material";
  const courseCode = (m.study_courses?.course_code ?? "").toString().trim();
  const kind = detectFileKind(m);
  const isVerified = !!m.verified;
  const isFeatured = !!m.featured;
  const dlCount = m.downloads ?? 0;
  const isPopular = dlCount > 50;

  const typeStyle: Record<string, { border: string; iconBg: string; iconText: string; abbr: string }> = {
    past_question: { border: "border-l-[3px] border-l-primary rounded-l-none rounded-r-3xl", iconBg: "bg-primary-light", iconText: "text-primary", abbr: "PQ" },
    handout: { border: "border-l-[3px] border-l-[#1D9E75] rounded-l-none rounded-r-3xl", iconBg: "bg-[#E1F5EE]", iconText: "text-[#1D9E75]", abbr: "H" },
    note: { border: "border-l-[3px] border-l-[#378ADD] rounded-l-none rounded-r-3xl", iconBg: "bg-[#E6F1FB]", iconText: "text-[#185FA5]", abbr: "N" },
    slides: { border: "border-l-[3px] border-l-[#D85A30] rounded-l-none rounded-r-3xl", iconBg: "bg-[#FAECE7]", iconText: "text-[#993C1D]", abbr: "S" },
    timetable: { border: "border-l-[3px] border-l-[#888780] rounded-l-none rounded-r-3xl", iconBg: "bg-secondary", iconText: "text-muted-brand", abbr: "T" },
    other: { border: "border-l-[3px] border-l-[#888780] rounded-l-none rounded-r-3xl", iconBg: "bg-secondary", iconText: "text-muted-brand", abbr: "F" },
  };
  const ts = typeStyle[m.material_type ?? ""] ?? { border: "rounded-3xl", iconBg: "bg-secondary", iconText: "text-muted-brand", abbr: "?" };

  const fileLabel =
    kind === "pdf" ? "PDF"
    : kind === "image" ? "IMG"
    : (m.file_path ?? "").toLowerCase().match(/\.(ppt|pptx)/) ? "PPT"
    : "FILE";

  const metaParts = [
    m.study_courses?.level ? `${m.study_courses.level}L` : "",
    m.study_courses?.semester ? m.study_courses.semester : "",
    m.session ? String(m.session) : "",
  ].filter(Boolean);
  const metaLine = [courseCode, ...metaParts].filter(Boolean).join(" · ");

  return (
    <div className={cn("overflow-hidden border border-border bg-card shadow-sm transition hover:border-border hover:shadow-md", ts.border)}>
      <Link href={`/study/materials/${m.id}`} className="block p-4 no-underline">
        <div className="flex items-start gap-3">
          <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border/60", ts.iconBg)}>
            <span className={cn("text-[11px] font-extrabold leading-none", ts.iconText)}>{ts.abbr}</span>
            <span className="mt-0.5 font-mono text-[8px] font-medium text-muted-brand">{fileLabel}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{title}</p>
            {metaLine && <p className="mt-1 text-xs text-muted-brand">{metaLine}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {courseCode && (
                <Link
                  href={`/study/courses/${encodeURIComponent(courseCode)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full border border-primary/25 bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary-text no-underline hover:bg-primary/15 transition"
                >
                  {courseCode}
                </Link>
              )}
              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-brand">
                {dlCount.toLocaleString("en-NG")} downloads
              </span>
              {isPopular && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">Popular</span>
              )}
              {isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-teal-300/50 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 dark:border-teal-700/40 dark:bg-teal-950/30 dark:text-teal-300">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              )}
              {isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
                  <Star className="h-3 w-3" /> Featured
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-light text-primary" aria-hidden>
              <ArrowRight className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
              disabled={saving}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-xl border transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                saved ? "border-primary/30 bg-primary-light text-primary" : "border-border bg-background text-muted-brand hover:bg-secondary/50",
                saving ? "opacity-70" : ""
              )}
              aria-label={saved ? "Unsave material" : "Save material"}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-brand">
        <span>{formatWhen(m.created_at)}</span>
        {(m.up_votes ?? 0) > 0 && (
          <><span>·</span><span className="text-emerald-700 dark:text-emerald-400">👍 {m.up_votes} found helpful</span></>
        )}
      </div>
    </div>
  );
}

export default function MaterialsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // ✅ IMPORTANT: this page must match StudyHomeClient width
  // We DO NOT use max-w containers here, and we keep spacing consistent: `space-y-4 pb-28`
  // Layout padding should be handled by your shared layout; we only use `-mx-4` where needed.

  // URL params
  const qParam = sp.get("q") ?? "";
  const levelParam = sp.get("level") ?? "";
  const semesterParam = sp.get("semester") ?? "";
  const facultyParam = sp.get("faculty") ?? "";
  const facultyIdParam = sp.get("faculty_id") ?? "";
  const deptParam = sp.get("dept") ?? "";
  const deptIdParam = sp.get("dept_id") ?? "";
  const courseParam = sp.get("course") ?? "";
  const sessionParam = sp.get("session") ?? "";
  const verifiedParam = sp.get("verified") ?? "";
  const featuredParam = sp.get("featured") ?? "";
  const personalizedParam = sp.get("personalized") ?? "1";
  const typeParam = (sp.get("type") ?? "all") as MaterialTypeKey;
  const sortParam = (sp.get("sort") ?? "newest") as SortKey;

  // Scope toggle: mine vs all
  const mineParam = sp.get("mine") ?? "";
  const mineExplicitOn = mineParam === "1";
  const mineExplicitOff = mineParam === "0";

  const verifiedOnly = verifiedParam === "1";
  const featuredOnly = featuredParam === "1";
  const personalizedOff = personalizedParam === "0";

  // Local input state
  const [q, setQ] = useState(qParam);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Drawer draft states
  const [draftLevel, setDraftLevel] = useState(levelParam);
  const [draftSemester, setDraftSemester] = useState(semesterParam);
  const [draftFaculty, setDraftFaculty] = useState(facultyParam);
  const [draftFacultyId, setDraftFacultyId] = useState(facultyIdParam);
  const [draftDept, setDraftDept] = useState(deptParam);
  const [draftDeptId, setDraftDeptId] = useState(deptIdParam);
  const [draftCourse, setDraftCourse] = useState(courseParam);
  const [draftSession, setDraftSession] = useState(sessionParam);
  const [draftType, setDraftType] = useState<MaterialTypeKey>(typeParam);
  const [draftSort, setDraftSort] = useState<SortKey>(sortParam);
  const [draftVerified, setDraftVerified] = useState(verifiedOnly);
  const [draftFeatured, setDraftFeatured] = useState(featuredOnly);
  const [draftMine, setDraftMine] = useState(false);

  // Options
  const [courses, setCourses] = useState<Course[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  // Materials
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schemaHint, setSchemaHint] = useState<string | null>(null);

  // Pagination: "Load more" (mobile-first)
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Personalization
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [myBadge, setMyBadge] = useState<string | null>(null);
  const [scopeDept, setScopeDept] = useState<string>("");
  const [scopeDeptId, setScopeDeptId] = useState<string>("");
  const [scopeLevel, setScopeLevel] = useState<number | null>(null);
  const [scopeSemesterDb, setScopeSemesterDb] = useState<string>("");
  const [fastLaneLoading, setFastLaneLoading] = useState(false);
  const [fastLaneCourses, setFastLaneCourses] = useState<FastLaneCourse[]>([]);

  // Rep / contributor status — determines Upload vs Contribute UI
  const [repStatus, setRepStatus] = useState<
    "not_applied" | "pending" | "approved" | "rejected" | null
  >(null);

  // Saved
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [previewKind, setPreviewKind] = useState<"pdf" | "image" | "other">("other");

  // Request course modal
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  // Effective scope:
  // - mine=1 => always mine
  // - mine=0 => always all
  // - no mine param => wait for prefs; if we have a badge, default to mine
  const mineOnly = useMemo(() => {
    if (mineExplicitOn) return true;
    if (mineExplicitOff) return false;
    if (!prefsLoaded) return false;
    return myBadge ? true : false;
  }, [mineExplicitOn, mineExplicitOff, prefsLoaded, myBadge]);

  const filtersKey = useMemo(() => {
    return [
      safeSearchTerm(qParam),
      levelParam,
      semesterParam,
      facultyParam,
      facultyIdParam,
      deptParam,
      deptIdParam,
      courseParam,
      sessionParam,
      typeParam,
      sortParam,
      verifiedOnly ? "v1" : "v0",
      featuredOnly ? "f1" : "f0",
      mineOnly ? "m1" : mineExplicitOff ? "m0x" : "m0",
      personalizedOff ? "p0" : "p1",
    ].join("|");
  }, [
    qParam,
    levelParam,
    semesterParam,
    facultyParam,
    facultyIdParam,
    deptParam,
    deptIdParam,
    courseParam,
    sessionParam,
    typeParam,
    sortParam,
    verifiedOnly,
    featuredOnly,
    mineOnly,
    mineExplicitOff,
    personalizedOff,
  ]);

  // Reset list when filters change
  useEffect(() => {
    setPage(1);
    setMaterials([]);
    setHasMore(false);
    setLoading(true);
  }, [filtersKey]);

  // Load saved ids for current list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userId = await getAuthedUserId();
        if (!userId) {
          if (!cancelled) setSavedIds(new Set());
          return;
        }
        const ids = materials.map((m) => m.id).filter(Boolean);
        if (ids.length === 0) {
          if (!cancelled) setSavedIds(new Set());
          return;
        }

        const { data, error } = await supabase
          .from("study_saved_items")
          .select("material_id")
          .eq("user_id", userId)
          .eq("item_type", "material")
          .in("material_id", ids);

        if (error) throw error;

        const next = new Set<string>();
        (data ?? []).forEach((r: any) => {
          if (r?.material_id) next.add(String(r.material_id));
        });

        if (!cancelled) setSavedIds(next);
      } catch {
        if (!cancelled) setSavedIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [materials]);

  async function onToggleMaterialSave(materialId: string) {
    setSavingId(materialId);
    const wasSaved = savedIds.has(materialId);

    setSavedIds((prev) => {
      const n = new Set(prev);
      if (n.has(materialId)) n.delete(materialId);
      else n.add(materialId);
      return n;
    });

    try {
      await toggleSaved({ itemType: "material", materialId });
      setToast(wasSaved ? "Removed from Saved" : "Saved");
    } catch (e: any) {
      setSavedIds((prev) => {
        const n = new Set(prev);
        if (n.has(materialId)) n.delete(materialId);
        else n.add(materialId);
        return n;
      });
      setToast(e?.message ?? "Could not save. Try again.");
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => setQ(qParam), [qParam]);

  // Load user scope badge + rep status — parallel, single auth check.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user ?? null;
        if (!user) {
          if (mounted) {
            setPrefsLoaded(true);
            setMyBadge(null);
          }
          return;
        }

        // Run prefs + rep status in parallel
        const [prefsRes, repRes] = await Promise.all([
          supabase
            .from("study_preferences")
            .select("level, semester, department_id, department:study_departments(name)")
            .eq("user_id", user.id)
            .maybeSingle(),
          fetch("/api/study/rep-applications/me", { cache: "no-store" })
            .then((r) => r.json())
            .catch(() => null),
        ]);

        const prefsData = !prefsRes.error ? prefsRes.data : null;

        let deptName = "";
        let level: number | null = null;
        let semester = "";

        let deptId = "";
        if (prefsData) {
          level = (prefsData as any)?.level ?? null;
          semester = String((prefsData as any)?.semester ?? "").trim();
          deptName = String((prefsData as any)?.department?.name ?? "").trim();
          deptId = String((prefsData as any)?.department_id ?? "").trim();
        }

        const badgeParts: string[] = [];
        if (deptName) badgeParts.push(deptName);
        if (typeof level === "number" && Number.isFinite(level)) badgeParts.push(`${level}L`);
        if (semester) badgeParts.push(semester.toLowerCase() === "first" ? "1st" : semester.toLowerCase() === "second" ? "2nd" : semester);

        if (mounted) {
          setMyBadge(badgeParts.length ? badgeParts.join(" • ") : null);
          setScopeDept(deptName);
          setScopeDeptId(deptId);
          setScopeLevel(typeof level === "number" && Number.isFinite(level) ? level : null);
          setScopeSemesterDb(mapSemesterParamToDb(semester));
          setPrefsLoaded(true);

          // Set rep status from API response
          if (repRes?.ok) {
            setRepStatus(repRes.status ?? "not_applied");
          } else {
            setRepStatus("not_applied");
          }
        }
      } catch {
        if (mounted) {
          setPrefsLoaded(true);
          setMyBadge(null);
          setRepStatus("not_applied");
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // After prefs load, scope the default view to the student's dept+level (mine=0, show all).
  useEffect(() => {
    if (!prefsLoaded) return;
    if (mineParam || personalizedOff) return;
    // Only redirect if we actually have a dept_id to scope by and it isn't already in the URL.
    if (!scopeDeptId || deptIdParam) return;

    const href = buildHref(pathname, {
      q: normalizeQuery(q) || null,
      level: levelParam || (scopeLevel ? String(scopeLevel) : null),
      semester: semesterParam || null,
      faculty: facultyParam || null,
      faculty_id: facultyIdParam || null,
      dept: deptParam || scopeDept || null,
      dept_id: scopeDeptId,
      course: courseParam || null,
      session: sessionParam || null,
      type: typeParam !== "all" ? typeParam : null,
      sort: sortParam !== "newest" ? sortParam : null,
      verified: verifiedOnly ? "1" : null,
      featured: featuredOnly ? "1" : null,
      mine: "0",
    });

    router.replace(href, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded, personalizedOff]);

  const hasFastLanePrefs = Boolean(scopeLevel || scopeDeptId || scopeDept);

  useEffect(() => {
    if (!prefsLoaded) return;
    if (!hasFastLanePrefs) {
      setFastLaneCourses([]);
      setFastLaneLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setFastLaneLoading(true);
      try {
        let courseQuery = supabase
          .from("study_courses")
          .select("id,course_code,course_title")
          .eq("status", "approved")
          .order("course_code", { ascending: true })
          .limit(8);

        if (typeof scopeLevel === "number" && Number.isFinite(scopeLevel)) {
          courseQuery = courseQuery.eq("level", scopeLevel);
        }

        if (scopeDeptId) {
          courseQuery = courseQuery.eq("department_id", scopeDeptId);
        } else if (scopeDept) {
          courseQuery = courseQuery.ilike("department", `%${scopeDept}%`);
        }

        const { data: courseData, error: courseError } = await courseQuery;
        if (cancelled || courseError || !Array.isArray(courseData) || courseData.length === 0) {
          if (!cancelled) setFastLaneCourses([]);
          return;
        }

        const nextCourses = await Promise.all(
          (courseData as Array<Pick<FastLaneCourse, "id" | "course_code" | "course_title">>).map(
            async (course) => {
              const { count } = await supabase
                .from("study_materials")
                .select("id", { count: "exact", head: true })
                .eq("course_id", course.id)
                .eq("approved", true);

              return {
                ...course,
                materialCount: count ?? 0,
              };
            }
          )
        );

        if (!cancelled) setFastLaneCourses(nextCourses);
      } catch {
        if (!cancelled) setFastLaneCourses([]);
      } finally {
        if (!cancelled) setFastLaneLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasFastLanePrefs, prefsLoaded, scopeDept, scopeDeptId, scopeLevel]);

  // Load filter options
  useEffect(() => {
    let mounted = true;
    (async () => {
      setOptionsLoading(true);
      let q = supabase
        .from("study_courses")
        .select("id,faculty,department,level,semester,course_code,course_title,faculty_id,department_id")
        .order("course_code", { ascending: true })
        .limit(3000);

      // When in "My materials", keep dropdowns scoped too (best-effort).
      if (mineOnly) {
        if (scopeDeptId) q = q.eq("department_id", scopeDeptId);
        if (typeof scopeLevel === "number" && Number.isFinite(scopeLevel)) q = q.eq("level", scopeLevel);
        if (scopeSemesterDb) q = q.eq("semester", scopeSemesterDb);
      }

      const cRes = await q;

      if (!mounted) return;

      if (cRes.error) {
        setCourses([]);
        setOptionsLoading(false);
        return;
      }

      setCourses((cRes.data as any[])?.filter(Boolean) ?? []);
      setOptionsLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [mineOnly, scopeDeptId, scopeLevel, scopeSemesterDb]);

  const facultyOptions = useMemo(() => {
    const map = new Map<string, string>(); // faculty_id -> name
    for (const c of courses) {
      const id = (c.faculty_id ?? "").toString().trim();
      const name = (c.faculty ?? "").toString().trim();
      if (id && name && !map.has(id)) map.set(id, name);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name }));
  }, [courses]);

  const deptOptions = useMemo(() => {
    const map = new Map<string, string>(); // department_id -> name
    for (const c of courses) {
      if (draftFacultyId ? c.faculty_id !== draftFacultyId : (draftFaculty && c.faculty !== draftFaculty)) continue;
      const id = (c.department_id ?? "").toString().trim();
      const name = (c.department ?? "").toString().trim();
      if (id && name && !map.has(id)) map.set(id, name);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name }));
  }, [courses, draftFaculty, draftFacultyId]);

  const courseOptions = useMemo(() => {
    const filtered = courses.filter((c) => {
      if (draftFacultyId ? c.faculty_id !== draftFacultyId : (draftFaculty && c.faculty !== draftFaculty)) return false;
      if (draftDeptId ? c.department_id !== draftDeptId : (draftDept && c.department !== draftDept)) return false;
      if (draftLevel && String(c.level) !== String(draftLevel)) return false;
      return true;
    });

    const sorted = filtered
      .slice()
      .sort((a, b) => (a.course_code ?? "").localeCompare(b.course_code ?? ""));

    return sorted.map((c) => ({
      value: c.course_code,
      label: `${c.course_code} — ${(c.course_title ?? "").toString().trim()}`.trim(),
    }));
  }, [courses, draftDept, draftDeptId, draftFaculty, draftFacultyId, draftLevel]);

  // Fetch materials (paged, supports load more)
  async function fetchPage(nextPage: number) {
    const isFirst = nextPage === 1;

    if (isFirst) {
      setLoading(true);
      setLoadError(null);
      setSchemaHint(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const url = new URL("/api/study/materials", window.location.origin);
      url.searchParams.set("page", String(nextPage));
      url.searchParams.set("page_size", String(PAGE_SIZE));

      const qNorm = normalizeQuery(qParam);
      if (qNorm) url.searchParams.set("q", qNorm);
      if (levelParam) url.searchParams.set("level", String(levelParam));
      if (semesterParam) url.searchParams.set("semester", String(semesterParam));
      if (facultyIdParam) url.searchParams.set("faculty_id", facultyIdParam);
      else if (facultyParam) url.searchParams.set("faculty", String(facultyParam));
      if (deptIdParam) url.searchParams.set("dept_id", deptIdParam);
      else if (deptParam) url.searchParams.set("dept", String(deptParam));
      if (courseParam) url.searchParams.set("course", String(courseParam));
      if (sessionParam.trim()) url.searchParams.set("session", sessionParam.trim());
      if (typeParam && typeParam !== "all") url.searchParams.set("type", String(typeParam));
      if (verifiedOnly) url.searchParams.set("verified", "1");
      if (featuredOnly) url.searchParams.set("featured", "1");
      if (sortParam) url.searchParams.set("sort", String(sortParam));
      if (mineOnly) url.searchParams.set("mine", "1");
      if (personalizedOff) url.searchParams.set("personalized", "0");

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        const msg = json?.error || "Unknown error";
        setLoadError(msg);
        if (json?.schemaHint) setSchemaHint(String(json.schemaHint));
        if (isFirst) {
          setMaterials([]);
          setTotal(0);
        }
        return;
      }

      const totalCount = Number(json?.total ?? 0);
      setTotal(Number.isFinite(totalCount) ? totalCount : 0);

      const newRows = ((json?.items as any[]) ?? []).filter(Boolean) as MaterialRow[];

      setMaterials((prev) => {
        if (isFirst) return newRows;
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const row of newRows) if (!seen.has(row.id)) merged.push(row);
        return merged;
      });

      const loadedSoFar = (isFirst ? 0 : (nextPage - 1) * PAGE_SIZE) + newRows.length;
      setHasMore(loadedSoFar < totalCount);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Initial fetch for current filters
  useEffect(() => {
    // If the user didn't explicitly set mine=0/1 yet, wait for prefs to load so we don't
    // briefly show "All materials" and then snap to "My materials".
    if (!mineParam && !prefsLoaded) return;
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  // Debounce search -> URL update
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const qNorm = normalizeQuery(q);
    if (qNorm === normalizeQuery(qParam)) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      router.replace(
        buildHref(pathname, {
          q: qNorm || null,
          level: levelParam || null,
          semester: semesterParam || null,
          faculty: facultyParam || null,
          faculty_id: facultyIdParam || null,
          dept: deptParam || null,
          dept_id: deptIdParam || null,
          course: courseParam || null,
          session: sessionParam || null,
          type: typeParam !== "all" ? typeParam : null,
          sort: sortParam !== "newest" ? sortParam : null,
          verified: verifiedOnly ? "1" : null,
          featured: featuredOnly ? "1" : null,
          mine: mineParam ? mineParam : null,
          personalized: personalizedOff ? "0" : null,
        })
      );
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [
    q,
    qParam,
    router,
    pathname,
    levelParam,
    semesterParam,
    facultyParam,
    facultyIdParam,
    deptParam,
    deptIdParam,
    courseParam,
    sessionParam,
    typeParam,
    sortParam,
    verifiedOnly,
    featuredOnly,
    mineOnly,
    mineParam,
    personalizedOff,
  ]);

  function openFilters() {
    setDraftLevel(levelParam);
    setDraftSemester(semesterParam);
    setDraftFaculty(facultyParam);
    setDraftFacultyId(facultyIdParam);
    setDraftDept(deptParam);
    setDraftDeptId(deptIdParam);
    setDraftCourse(courseParam);
    setDraftSession(sessionParam);
    setDraftType(typeParam);
    setDraftSort(sortParam);
    setDraftVerified(verifiedOnly);
    setDraftFeatured(featuredOnly);
    setDraftMine(mineOnly);
    setDrawerOpen(true);
  }

  function applyFilters() {
    router.replace(
      buildHref(pathname, {
        q: normalizeQuery(q) || null,
        level: draftLevel || null,
        semester: draftSemester || null,
        faculty: draftFaculty || null,
        faculty_id: draftFacultyId || null,
        dept: draftDept || null,
        dept_id: draftDeptId || null,
        course: draftCourse || null,
        session: draftSession.trim() || null,
        type: draftType !== "all" ? draftType : null,
        sort: draftSort !== "newest" ? draftSort : null,
        verified: draftVerified ? "1" : null,
        featured: draftFeatured ? "1" : null,
        mine: draftMine ? "1" : mineOnly || mineExplicitOff ? "0" : null,
        personalized: personalizedOff ? "0" : null,
      })
    );
    setDrawerOpen(false);
  }

  function clearAll() {
    setQ("");
    router.replace(
      buildHref(pathname, {
        mine: mineOnly ? "0" : (mineParam || null),
        personalized: personalizedOff ? "0" : null,
      })
    );
  }

  async function bumpDownloads(materialId: string) {
    setMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? { ...m, downloads: (m.downloads ?? 0) + 1 } : m))
    );
  }

  const hasAnyFilters = Boolean(
    qParam ||
      levelParam ||
      semesterParam ||
      facultyParam ||
      facultyIdParam ||
      deptParam ||
      deptIdParam ||
      courseParam ||
      sessionParam ||
      (typeParam && typeParam !== "all") ||
      verifiedOnly ||
      featuredOnly ||
      (sortParam && sortParam !== "newest") ||
      mineOnly
  );

  const showingFrom = total === 0 ? 0 : 1;
  const showingTo = Math.min(total, materials.length);

  const activeTypeLabel = MATERIAL_TYPES.find((t) => t.key === typeParam)?.label ?? "All";

  const courseChips = useMemo(() => {
    if (hasFastLanePrefs && fastLaneCourses.length > 0) {
      return fastLaneCourses.slice(0, 8).map((course) => ({
        id: course.id,
        code: course.course_code,
        title: course.course_title,
        count: course.materialCount,
      }));
    }

    const filtered = courses.filter((course) => {
      if (scopeDeptId && course.department_id !== scopeDeptId) return false;
      if (!scopeDeptId && scopeDept && course.department !== scopeDept) return false;
      if (typeof scopeLevel === "number" && Number.isFinite(scopeLevel) && course.level !== scopeLevel) return false;
      if (scopeSemesterDb && mapSemesterParamToDb(course.semester) !== scopeSemesterDb) return false;
      return true;
    });

    const visibleCourses = hasFastLanePrefs ? filtered : filtered.length ? filtered : courses;

    const map = new Map<string, { id: string; code: string; title: string | null; count?: number }>();
    for (const course of visibleCourses) {
      const code = (course.course_code ?? "").toString().trim().toUpperCase();
      if (!code || map.has(code)) continue;
      map.set(code, {
        id: course.id,
        code,
        title: course.course_title,
      });
    }

    return Array.from(map.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .slice(0, 8);
  }, [courses, fastLaneCourses, hasFastLanePrefs, scopeDept, scopeDeptId, scopeLevel, scopeSemesterDb]);

  async function onPreviewMaterial(m: MaterialRow) {
    const res = await fetch(`/api/study/materials/${m.id}/download?preview=1`);
    const json = res.ok ? await res.json() : null;
    const href: string = json?.url ?? "";
    if (!href) {
      setToast("No file URL found");
      return;
    }
    const kind = detectFileKind(m);
    if (kind === "other") {
      window.open(href, "_blank", "noreferrer");
      bumpDownloads(m.id);
      setToast("Opened file");
      return;
    }
    setPreviewTitle((m.title ?? "Material").trim() || "Material");
    setPreviewUrl(href);
    setPreviewKind(kind);
    setPreviewOpen(true);
    bumpDownloads(m.id);
  }

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <StudyTabs contributorStatus={repStatus ?? undefined} />

      {prefsLoaded && scopeDept && !personalizedOff ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-light px-4 py-3 text-sm text-primary-text dark:border-primary/30 dark:bg-primary/10 dark:text-indigo-200">
          <span className="min-w-0">
            Showing your {myBadge ?? "academic"} materials first.
          </span>
          <Link
            href={buildHref(pathname, {
              q: qParam || null,
              type: typeParam !== "all" ? typeParam : null,
              sort: sortParam !== "newest" ? sortParam : null,
              personalized: "0",
              mine: "0",
            })}
            className="shrink-0 text-xs font-bold underline underline-offset-2"
          >
            Browse all
          </Link>
        </div>
      ) : personalizedOff ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-brand">
          <span>Browsing all Study materials.</span>
          <Link href="/study/library" className="shrink-0 text-xs font-bold text-primary underline underline-offset-2">
            Back to my scope
          </Link>
        </div>
      ) : null}

      {/* M-7: Onboarding nudge — shown when user has no department prefs set and hasn't dismissed it */}
      {prefsLoaded && !scopeDept && typeof window !== "undefined" && !window.localStorage.getItem("jabuStudy_skipOnboarding") && (
        <Link
          href="/study/onboarding"
          className={cn(
            'flex items-center justify-between gap-3 rounded-2xl border border-border',
            'bg-secondary/40 px-4 py-2.5 text-sm text-muted-brand hover:bg-secondary/60 no-underline'
          )}
        >
          <span>
            <strong className="text-foreground">Tip:</strong>{' '}
            Set your department to see only your courses.
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-brand" />
        </Link>
      )}

      <Card className="rounded-3xl border bg-background/85 p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-brand" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search materials..."
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background hover:bg-secondary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={openFilters}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground",
              "hover:bg-secondary/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </div>

        {hasAnyFilters ? (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={clearAll}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold",
                "text-muted-brand hover:bg-secondary/50 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <X className="h-3 w-3" />
              Clear all
            </button>

            {courseParam ? (
              <button
                type="button"
                onClick={() => router.replace(buildHref(pathname, {
                  q: qParam || null,
                  level: levelParam || null,
                  semester: semesterParam || null,
                  faculty: facultyParam || null,
                  faculty_id: facultyIdParam || null,
                  dept: deptParam || null,
                  dept_id: deptIdParam || null,
                  course: null,
                  session: sessionParam || null,
                  type: typeParam !== "all" ? typeParam : null,
                  sort: sortParam !== "newest" ? sortParam : null,
                  verified: verifiedOnly ? "1" : null,
                  featured: featuredOnly ? "1" : null,
                  mine: mineParam || null,
                }))}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light px-3 py-1.5 text-xs font-medium text-primary-text transition hover:bg-primary/10 focus-visible:outline-none"
              >
                {courseParam} <span className="text-primary">x</span>
              </button>
            ) : null}

            {typeParam !== "all" ? (
              <button
                type="button"
                onClick={() => router.replace(buildHref(pathname, {
                  q: qParam || null,
                  level: levelParam || null,
                  semester: semesterParam || null,
                  faculty: facultyParam || null,
                  faculty_id: facultyIdParam || null,
                  dept: deptParam || null,
                  dept_id: deptIdParam || null,
                  course: courseParam || null,
                  session: sessionParam || null,
                  type: null,
                  sort: sortParam !== "newest" ? sortParam : null,
                  verified: verifiedOnly ? "1" : null,
                  featured: featuredOnly ? "1" : null,
                  mine: mineParam || null,
                }))}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light px-3 py-1.5 text-xs font-medium text-primary-text transition hover:bg-primary/10 focus-visible:outline-none"
              >
                {activeTypeLabel} <span className="text-primary">x</span>
              </button>
            ) : null}

            {sortParam !== "newest" || levelParam || semesterParam || deptParam || deptIdParam || sessionParam || verifiedOnly || featuredOnly || mineOnly ? (
              <button
                type="button"
                onClick={openFilters}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-brand hover:bg-secondary/50 hover:text-foreground"
              >
                Advanced filters
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-brand">
            Tip: Try <span className="font-semibold">GST101</span> or &quot;past question&quot;.
          </p>
        )}
      </Card>

      {fastLaneLoading || courseChips.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold text-foreground">
              {hasFastLanePrefs ? "My courses" : "Courses"}
            </p>
            {courseParam ? (
              <button
                type="button"
                onClick={() => router.replace(buildHref(pathname, {
                  q: qParam || null,
                  level: levelParam || null,
                  semester: semesterParam || null,
                  faculty: facultyParam || null,
                  faculty_id: facultyIdParam || null,
                  dept: deptParam || null,
                  dept_id: deptIdParam || null,
                  course: null,
                  session: sessionParam || null,
                  type: typeParam !== "all" ? typeParam : null,
                  sort: sortParam !== "newest" ? sortParam : null,
                  verified: verifiedOnly ? "1" : null,
                  featured: featuredOnly ? "1" : null,
                  mine: mineParam || null,
                }))}
                className="text-xs font-bold text-primary hover:underline dark:text-indigo-300"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {fastLaneLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex shrink-0 animate-pulse rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <div className="h-3 w-16 rounded bg-muted" />
                      <div className="mt-2 h-2.5 w-20 rounded bg-muted" />
                    </div>
                  </div>
                ))
              : courseChips.map((course) => {
                  const active = courseParam.toUpperCase() === course.code.toUpperCase();
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => router.replace(buildHref(pathname, {
                        q: qParam || null,
                        level: levelParam || null,
                        semester: semesterParam || null,
                        faculty: facultyParam || null,
                        faculty_id: facultyIdParam || null,
                        dept: deptParam || null,
                        dept_id: deptIdParam || null,
                        course: active ? null : course.code,
                        session: sessionParam || null,
                        type: typeParam !== "all" ? typeParam : null,
                        sort: sortParam !== "newest" ? sortParam : null,
                        verified: verifiedOnly ? "1" : null,
                        featured: featuredOnly ? "1" : null,
                        mine: mineParam || null,
                      }))}
                      className={cn(
                        "flex shrink-0 rounded-2xl border px-3 py-2 text-left transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        active
                          ? "border-primary/25 bg-primary-light text-primary-text"
                          : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary-light dark:hover:border-primary/40 dark:hover:bg-primary/10"
                      )}
                    >
                      <div className="max-w-36">
                        <p className="truncate text-[12px] font-extrabold">{course.code}</p>
                        <p className="mt-1 truncate text-[10px] text-muted-brand">
                          {typeof course.count === "number"
                            ? `${course.count} material${course.count === 1 ? "" : "s"}`
                            : course.title || "Course materials"}
                        </p>
                      </div>
                    </button>
                  );
                })}
          </div>
        </div>
      ) : null}

      {fastLaneLoading ? (
        <div className="hidden space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold text-foreground">My courses</p>
            <span className="text-xs font-bold text-primary dark:text-indigo-300">All →</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex shrink-0 animate-pulse rounded-2xl border border-border bg-card px-3 py-2"
              >
                <div>
                  <div className="h-3 w-16 rounded bg-muted" />
                  <div className="mt-2 h-2.5 w-20 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : hasFastLanePrefs && fastLaneCourses.length > 0 ? (
        <div className="hidden space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold text-foreground">My courses</p>
            <Link
              href="/study/library"
              className="text-xs font-bold text-primary hover:underline dark:text-indigo-300"
            >
              All →
            </Link>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {fastLaneCourses.map((course) => (
              <Link
                key={course.id}
                href={`/study/courses/${encodeURIComponent(course.course_code)}`}
                className={cn(
                  "flex shrink-0 rounded-2xl border px-3 py-2 text-left no-underline transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "border-border bg-card hover:border-primary/30 hover:bg-primary-light dark:hover:border-primary/40 dark:hover:bg-primary/10"
                )}
              >
                <div>
                  <p className="text-[12px] font-extrabold text-foreground">{course.course_code}</p>
                  <p className="mt-1 text-[10px] text-muted-brand">
                    {course.materialCount} material{course.materialCount === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* ✅ Sticky search/filter: keep full width like Study Home */}
      <div className="hidden">
        <Card className="rounded-3xl border bg-background/85 backdrop-blur">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-brand" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search materials…"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
            />
            {q ? (
              <button type="button" onClick={() => setQ("")}
                className={cn("grid h-9 w-9 place-items-center rounded-xl border border-border bg-background hover:bg-secondary/50","focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2")}
                aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button type="button" onClick={openFilters}
              className={cn("inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground","hover:bg-secondary/50","focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2")}>
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
            {/* Sort toggle — cycles between newest and downloads_desc */}
            <button type="button"
              onClick={() => {
                const next = sortParam === "downloads_desc" ? "newest" : "downloads_desc";
                router.replace(buildHref(pathname, {
                  q: qParam || null, level: levelParam || null, semester: semesterParam || null,
                  faculty: facultyParam || null, faculty_id: facultyIdParam || null,
                  dept: deptParam || null, dept_id: deptIdParam || null, course: courseParam || null,
                  session: sessionParam || null, type: typeParam !== "all" ? typeParam : null,
                  sort: next !== "newest" ? next : null,
                  verified: verifiedOnly ? "1" : null, featured: featuredOnly ? "1" : null,
                  mine: mineParam || null,
                }));
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                sortParam === "downloads_desc"
                  ? "border-primary/25 bg-primary-light text-primary-text"
                  : "border-border bg-background text-muted-brand hover:bg-secondary/50 hover:text-foreground"
              )}>
              {sortParam === "downloads_desc" ? <TrendingUp className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {sortParam === "downloads_desc" ? "Popular" : "Newest"}
            </button>
          </div>

          {hasAnyFilters ? (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
              {/* Clear all — first in the row */}
              <button
                type="button"
                onClick={clearAll}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold",
                  "text-muted-brand hover:bg-secondary/50 hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <X className="h-3 w-3" />
                Clear all
              </button>

              {(deptParam || deptIdParam) ? (
                <button type="button" onClick={() => router.replace(buildHref(pathname, {
                    q: qParam || null, level: levelParam || null, semester: semesterParam || null,
                    faculty: facultyParam || null, faculty_id: facultyIdParam || null,
                    dept: null, dept_id: null, course: courseParam || null,
                    session: sessionParam || null, type: typeParam !== "all" ? typeParam : null,
                    sort: sortParam !== "newest" ? sortParam : null,
                    verified: verifiedOnly ? "1" : null, featured: featuredOnly ? "1" : null,
                    mine: mineParam || null,
                  }))}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light px-3 py-1.5 text-xs font-medium text-primary-text transition hover:bg-primary/10 focus-visible:outline-none">
                  {deptParam || scopeDept || "Department"} <span className="text-primary">×</span>
                </button>
              ) : null}

              {typeParam !== "all" ? (
                <button type="button" onClick={() => router.replace(buildHref(pathname, {
                    q: qParam || null, level: levelParam || null, semester: semesterParam || null,
                    faculty: facultyParam || null, faculty_id: facultyIdParam || null,
                    dept: deptParam || null, dept_id: deptIdParam || null, course: courseParam || null,
                    session: sessionParam || null, type: null,
                    sort: sortParam !== "newest" ? sortParam : null,
                    verified: verifiedOnly ? "1" : null, featured: featuredOnly ? "1" : null,
                  }))}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light px-3 py-1.5 text-xs font-medium text-primary-text transition hover:bg-primary/10 focus-visible:outline-none">
                  {activeTypeLabel} <span className="text-primary">×</span>
                </button>
              ) : null}

              {levelParam ? (
                <button type="button" onClick={() => router.replace(buildHref(pathname, {
                    q: qParam || null, level: null, semester: semesterParam || null,
                    faculty: facultyParam || null, faculty_id: facultyIdParam || null,
                    dept: deptParam || null, dept_id: deptIdParam || null, course: courseParam || null,
                    session: sessionParam || null, type: typeParam !== "all" ? typeParam : null,
                    sort: sortParam !== "newest" ? sortParam : null,
                    verified: verifiedOnly ? "1" : null, featured: featuredOnly ? "1" : null,
                  }))}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light px-3 py-1.5 text-xs font-medium text-primary-text transition hover:bg-primary/10 focus-visible:outline-none">
                  {levelParam}L <span className="text-primary">×</span>
                </button>
              ) : null}

              {courseParam ? (
                <button
                  type="button"
                  onClick={() => router.replace(buildHref(pathname, {
                    q: qParam || null, level: levelParam || null, semester: semesterParam || null,
                    faculty: facultyParam || null, faculty_id: facultyIdParam || null,
                    dept: deptParam || null, dept_id: deptIdParam || null, course: null,
                    session: sessionParam || null, type: typeParam !== "all" ? typeParam : null,
                    sort: sortParam !== "newest" ? sortParam : null,
                    verified: verifiedOnly ? "1" : null, featured: featuredOnly ? "1" : null,
                  }))}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light px-3 py-1.5 text-xs font-medium text-primary-text transition hover:bg-primary/10 focus-visible:outline-none">
                  {courseParam} <span className="text-primary">×</span>
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-brand">
              Tip: Try <span className="font-semibold">GST101</span> or &quot;past question&quot;.
            </p>
          )}
        </Card>
      </div>

      {/* Quick-access type filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { key: "all", label: "All" },
            { key: "past_question", label: "Past Q" },
            { key: "handout", label: "Handout" },
            { key: "note", label: "Lecture Note" },
            { key: "slides", label: "Slides" },
          ] as const
        ).map(({ key, label }) => {
          const active = typeParam === key;
          return (
            <button key={key} type="button"
              onClick={() => router.replace(buildHref(pathname, {
                q: qParam || null, level: levelParam || null, semester: semesterParam || null,
                faculty: facultyParam || null, faculty_id: facultyIdParam || null,
                dept: deptParam || null, dept_id: deptIdParam || null, course: courseParam || null,
                session: sessionParam || null, type: key !== "all" ? key : null,
                sort: sortParam !== "newest" ? sortParam : null,
                verified: verifiedOnly ? "1" : null, featured: featuredOnly ? "1" : null,
                mine: mineParam || null,
              }))}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-primary/25 bg-primary-light text-primary-text"
                  : "border-border/60 bg-background text-muted-brand hover:bg-secondary/50 hover:text-foreground"
              )}
            >{label}</button>
          );
        })}
        <button type="button" onClick={openFilters}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-2 text-sm font-semibold text-muted-brand transition",
            "hover:bg-secondary/50 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}>More</button>
      </div>

      {/* Error */}
      {loadError ? (
        <div className="rounded-3xl border border-border bg-background p-4">
          <p className="text-sm font-semibold text-foreground">Couldn’t load materials</p>
          <p className="mt-1 text-sm text-muted-brand">{loadError}</p>
          {schemaHint ? (
            <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-brand">{schemaHint}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* List */}
      <div className="grid gap-3 sm:grid-cols-2">
        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} className="rounded-3xl" />
            ))}
          </>
        ) : materials.length === 0 ? (
          <div className="sm:col-span-2">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title={
                courseParam
                  ? `No materials for ${courseParam} yet`
                  : (levelParam || deptParam)
                  ? "No materials found"
                  : "No materials yet"
              }
              description={
                courseParam
                  ? "Help us grow — request it and we’ll notify you when content is available."
                  : (levelParam || deptParam)
                  ? "Try adjusting your filters, or upload the first one."
                  : (prefsLoaded && !!scopeDept)
                  ? "Nothing here yet. Request a course and we’ll notify you when materials are uploaded."
                  : "Be the first to upload study materials for your department."
              }
              action={
                <div className="flex flex-wrap gap-2">
                  {(courseParam || (prefsLoaded && !!scopeDept)) ? (
                    <button
                      type="button"
                      onClick={() => setRequestModalOpen(true)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-foreground",
                        "hover:opacity-90",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      )}
                    >
                      {courseParam ? "Request this course" : "Request a course →"}
                    </button>
                  ) : null}
                  <Link
                    href="/study/materials/upload"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground no-underline",
                      "hover:bg-secondary/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  >
                    <UploadCloud className="h-4 w-4" />
                    Upload a material
                  </Link>
                </div>
              }
            />
          </div>
        ) : (
          materials.map((m) => (
            <MaterialCard
              key={m.id}
              m={m}
              saved={savedIds.has(m.id)}
              saving={savingId === m.id}
              onToggleSave={() => onToggleMaterialSave(m.id)}
            />
          ))
        )}
      </div>

      {/* ✅ Load more (mobile-first) */}
      {!loading && materials.length > 0 ? (
        <div className="flex justify-center">
          {hasMore ? (
            <button
              type="button"
              onClick={async () => {
                const next = page + 1;
                setPage(next);
                await fetchPage(next);
              }}
              disabled={loadingMore}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground",
                "hover:bg-secondary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                loadingMore ? "opacity-70" : ""
              )}
            >
              {loadingMore ? "Loading…" : "Load more"}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <p className="text-sm font-semibold text-muted-brand">You’ve reached the end.</p>
          )}
        </div>
      ) : null}

      {/* Filters drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftLevel("");
                setDraftSemester("");
                setDraftFaculty("");
                setDraftFacultyId("");
                setDraftDept("");
                setDraftDeptId("");
                setDraftCourse("");
                setDraftSession("");
                setDraftType("all");
                setDraftSort("newest");
                setDraftVerified(false);
                setDraftFeatured(false);
                setDraftMine(false);
              }}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground",
                "hover:bg-secondary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              )}
            >
              Clear
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
        <div className="rounded-3xl border border-border bg-background p-3">
          <p className="text-sm font-semibold text-foreground">Sort</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setDraftSort(s.key)}
                className={cn(
                  "inline-flex items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  draftSort === s.key
                    ? "border-border bg-secondary text-foreground"
                    : "border-border/60 bg-background text-foreground hover:bg-secondary/50"
                )}
              >
                <span className="inline-flex items-center gap-2">
                  {s.icon}
                  {s.label}
                </span>
                {draftSort === s.key ? <span className="text-xs font-semibold">Selected</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-3xl border border-border bg-background p-3">
          <p className="text-sm font-semibold text-foreground">Type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MATERIAL_TYPES.map((t) => (
              <Chip key={t.key} active={draftType === t.key} onClick={() => setDraftType(t.key)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <SelectRow
            label="Level"
            value={draftLevel}
            onChange={setDraftLevel}
            options={LEVELS.map((l) => ({ value: l, label: `${l}L` }))}
            placeholder="All levels"
          />
          <SelectRow
            label="Semester"
            value={draftSemester}
            onChange={setDraftSemester}
            options={SEMESTERS.map((s) => ({ value: s, label: s }))}
            placeholder="All semesters"
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ToggleRow label="My materials only" desc="Use your Study Hub profile scope" checked={draftMine} onChange={setDraftMine} />
          <ToggleRow label="Verified only" desc="Show only verified materials" checked={draftVerified} onChange={setDraftVerified} />
          <ToggleRow label="Featured only" desc="Show highlighted materials" checked={draftFeatured} onChange={setDraftFeatured} />
        </div>

        <div className="mt-3 grid gap-2">
          <TextRow
            label="Session / Year"
            value={draftSession}
            onChange={setDraftSession}
            placeholder="e.g., 2022/2023"
            hint="Optional. Useful for past questions."
          />
        </div>

        <div className="mt-3 grid gap-2">
          <SelectRow
            label="Faculty"
            value={draftFacultyId}
            onChange={(v) => {
              setDraftFacultyId(v);
              const found = courses.find((c) => c.faculty_id === v);
              setDraftFaculty(found ? found.faculty : "");
              setDraftDeptId("");
              setDraftDept("");
              setDraftCourse("");
            }}
            placeholder={optionsLoading ? "Loading…" : "All faculties"}
            options={facultyOptions}
          />

          <SelectRow
            label="Department"
            value={draftDeptId}
            onChange={(v) => {
              setDraftDeptId(v);
              const found = courses.find((c) => c.department_id === v);
              setDraftDept(found ? found.department : "");
              setDraftCourse("");
            }}
            placeholder={optionsLoading ? "Loading…" : draftFacultyId ? "All depts in faculty" : "All departments"}
            options={deptOptions}
          />

          <SelectRow
            label="Course"
            value={draftCourse}
            onChange={setDraftCourse}
            placeholder={optionsLoading ? "Loading…" : "All courses"}
            options={courseOptions}
          />
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-brand">
            Filters apply when you tap <span className="font-semibold">Apply</span>. Search updates automatically.
          </p>
        </div>
      </Drawer>

      {/* Preview modal */}
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewTitle}
        url={previewUrl}
        kind={previewKind}
      />

      {/* Request course modal */}
      <RequestCourseModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        initialCourseCode={courseParam}
      />

      {/* Toast */}
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-lg"
          >
            {toast}
          </div>
        </div>
      ) : null}

      {/* Upload FAB */}
      <Link
        href="/study/materials/upload"
        className={cn(
          "fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full no-underline",
          "bg-primary text-white shadow-lg",
          "hover:opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "md:bottom-8 md:right-8"
        )}
        aria-label="Upload a material"
        title="Upload a material"
      >
        <UploadCloud className="h-6 w-6" />
      </Link>
    </div>
  );
}
