"use client";
// app/study/courses/[code]/page.tsx

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  MessageCircle,
  Sparkles,
  UploadCloud,
  Zap,
} from "lucide-react";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type MaterialType = "past_question" | "handout" | "slides" | "note" | "timetable" | "other" | string;

type Course = {
  id: string;
  course_code: string;
  course_title: string | null;
  level: number | null;
  study_departments?: {
    id: string;
    name: string;
    faculty_id: string;
    study_faculties?: { id: string; name: string } | null;
  } | null;
};

type Material = {
  id: string;
  title: string | null;
  description: string | null;
  file_path: string | null;
  level: string | null;
  semester: string | null;
  session: string | null;
  created_at: string | null;
  downloads: number | null;
  material_type: MaterialType | null;
};

type SourceMaterial = {
  id: string;
  title: string | null;
  material_type: string | null;
};

type PracticeSet = {
  id: string;
  title: string | null;
  description: string | null;
  course_code: string | null;
  level: string | null;
  time_limit_minutes: number | null;
  questions_count: number | null;
  created_at: string | null;
  source: string | null;
  source_material_ids: SourceMaterial[] | null;
};

type QuestionRow = {
  id: string;
  title: string;
  course_code: string | null;
  level: string | null;
  created_at: string | null;
  answers_count: number | null;
  upvotes_count: number | null;
  solved: boolean | null;
};

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function norm(v: string) {
  return v.trim().replace(/\s+/g, " ");
}

function timeAgoShort(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  past_question: { label: "Past Q",  color: "text-primary-text", bg: "bg-primary-light" },
  note:          { label: "Note",    color: "text-[#3B6D11]", bg: "bg-[#EAF3DE]" },
  handout:       { label: "Handout", color: "text-[#3B6D11]", bg: "bg-[#EAF3DE]" },
  slides:        { label: "Slides",  color: "text-[#0C447C]", bg: "bg-[#E6F1FB]" },
  timetable:     { label: "Timetable", color: "text-[#633806]", bg: "bg-[#FAEEDA]" },
  other:         { label: "File",    color: "text-muted-brand", bg: "bg-secondary" },
};

function typeMeta(t: string | null) {
  return TYPE_META[t ?? "other"] ?? TYPE_META.other;
}

const TYPE_ORDER = ["past_question", "note", "handout", "slides", "timetable", "other"];

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MaterialCard({ m, courseCode }: { m: Material; courseCode: string }) {
  const title = norm(String(m.title ?? "Untitled material"));
  const meta = typeMeta(m.material_type ?? "other");
  const href = m.file_path ? `/study/materials/${m.id}?from=${encodeURIComponent(courseCode)}` : "#";
  const unavailable = href === "#";

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 no-underline transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        unavailable ? "pointer-events-none opacity-50" : "hover:bg-secondary/40 active:scale-[0.99]"
      )}
    >
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm", meta.bg, meta.color)}>
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-brand">
          {[meta.label, m.level ? `${m.level}L` : null, m.semester ? `${m.semester} sem` : null]
            .filter(Boolean).join(" / ")}
        </p>
      </div>
      {typeof m.downloads === "number" && m.downloads > 0 && (
        <p className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-brand">
          <Download className="h-3.5 w-3.5" />
          {m.downloads}
        </p>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-brand" />
    </Link>
  );
}

function PracticeSetCard({ s }: { s: PracticeSet }) {
  const isAiCourse = s.source === "ai_course";
  const sources: SourceMaterial[] = Array.isArray(s.source_material_ids)
    ? s.source_material_ids
    : [];

  return (
    <Link
      href={`/study/practice/${encodeURIComponent(String(s.id))}`}
      className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3 no-underline transition hover:bg-secondary/30 active:scale-[0.99]"
    >
      <div className={cn(
        "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
        isAiCourse ? "bg-primary" : "bg-primary-light"
      )}>
        <Sparkles className={cn("h-4 w-4", isAiCourse ? "text-white" : "text-primary")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {norm(String(s.title ?? "Practice set"))}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {typeof s.questions_count === "number" && (
            <span className="text-xs text-muted-brand">{s.questions_count} questions</span>
          )}
          {typeof s.time_limit_minutes === "number" && (
            <span className="text-xs text-muted-brand">/ {s.time_limit_minutes} min</span>
          )}
          {s.level && <span className="text-xs text-muted-brand">/ {s.level}L</span>}
        </div>
        {isAiCourse && sources.length > 0 && (
          <p className="mt-1 text-[11px] text-primary/70 leading-snug">
            From:{" "}
            {sources
              .map((src) => src.title ?? "material")
              .join(", ")
              .slice(0, 80)}
            {sources.map((s) => s.title ?? "").join(", ").length > 80 ? "..." : ""}
          </p>
        )}
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-brand" />
    </Link>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted-brand">{title}</p>
      {action}
    </div>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function CourseHubPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const rawCode = Array.isArray((params as any)?.code) ? (params as any).code[0] : (params as any)?.code;
  const code = norm(decodeURIComponent(String(rawCode ?? ""))).toUpperCase();

  const [course, setCourse]         = useState<Course | null>(null);
  const [materials, setMaterials]   = useState<Material[]>([]);
  const [practiceSets, setPracticeSets] = useState<PracticeSet[]>([]);
  const [questions, setQuestions]   = useState<QuestionRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [showAllMaterials, setShowAllMaterials] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      if (!code) { setError("Invalid course code."); setLoading(false); return; }

      const cRes = await supabase
        .from("study_courses")
        .select("id,course_code,course_title,level,department_id,study_departments:department_id(id,name,faculty_id,study_faculties:faculty_id(id,name))")
        .eq("course_code", code)
        .maybeSingle();

      if (!mounted) return;
      if (cRes.error) { setError(cRes.error.message); setLoading(false); return; }
      if (!cRes.data) { setCourse(null); setLoading(false); return; }

      const courseRow = cRes.data as any as Course;
      setCourse(courseRow);

      const [mRes, pRes, qRes] = await Promise.all([
        supabase
          .from("study_materials")
          .select("id,title,description,file_path,level,session,semester,created_at,downloads,material_type")
          .eq("approved", true)
          .eq("upload_status", "live")
          .eq("course_id", courseRow.id)
          .order("downloads", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(250),

        supabase
          .from("study_quiz_sets")
          .select("id,title,description,course_code,level,time_limit_minutes,questions_count,created_at,source,source_material_ids")
          .eq("published", true)
          .eq("visibility", "public")
          .ilike("course_code", `${code}%`)
          .order("created_at", { ascending: false })
          .limit(8)
          .then(async (res) => {
            // Fall back to query without new columns if migration hasn't been run yet
            if (res.error?.message?.includes("does not exist")) {
              return supabase
                .from("study_quiz_sets")
                .select("id,title,description,course_code,level,time_limit_minutes,questions_count,created_at")
                .eq("published", true)
                .eq("visibility", "public")
                .ilike("course_code", `${code}%`)
                .order("created_at", { ascending: false })
                .limit(8);
            }
            return res;
          }),

        supabase
          .from("study_questions")
          .select("id,title,course_code,level,created_at,answers_count,upvotes_count,solved")
          .ilike("course_code", `${code}%`)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (!mounted) return;
      setMaterials(mRes.error ? [] : ((mRes.data as any[]) ?? []).filter(Boolean));
      setPracticeSets(pRes.error ? [] : ((pRes.data as any[]) ?? []).filter(Boolean) as PracticeSet[]);
      setQuestions(qRes.error ? [] : ((qRes.data as any[]) ?? []).filter(Boolean) as QuestionRow[]);
      setLoading(false);
    }
    run();
    return () => { mounted = false; };
  }, [code]);

  const dept    = course?.study_departments?.name ?? "";
  const faculty = course?.study_departments?.study_faculties?.name ?? "";

  const availableLevels = useMemo(() => {
    const s = new Set<string>();
    materials.forEach((m) => { const lv = norm(String(m.level ?? "")); if (lv) s.add(lv); });
    return Array.from(s).sort((a, b) => Number(a) - Number(b));
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => levelFilter === "all" || norm(String(m.level ?? "")) === levelFilter);
  }, [materials, levelFilter]);

  const pastQuestions = useMemo(
    () => filteredMaterials.filter((m) => m.material_type === "past_question"),
    [filteredMaterials]
  );

  const otherMaterials = useMemo(
    () => filteredMaterials.filter((m) => m.material_type !== "past_question"),
    [filteredMaterials]
  );

  const topPracticeHref = practiceSets[0]?.id
    ? `/study/practice/${encodeURIComponent(String(practiceSets[0].id))}`
    : `/study/practice?course=${encodeURIComponent(code)}`;

  // Smart primary CTA
  const primaryCta = useMemo(() => {
    if (practiceSets.length > 0) return "practice";
    if (materials.length > 0) return "browse";
    return "upload";
  }, [practiceSets, materials]);

  if (loading) {
    return (
      <div className="space-y-3 pb-28">
        <div className="h-48 animate-pulse rounded-3xl bg-primary/20" />
        <div className="h-24 animate-pulse rounded-3xl bg-secondary/60" />
        <div className="h-32 animate-pulse rounded-3xl bg-secondary/60" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-28 md:pb-8">

      {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="bg-primary px-5 pt-5 pb-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <Link
              href={`/study/materials/upload?course_code=${encodeURIComponent(code)}`}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white no-underline hover:bg-white/25"
            >
              <UploadCloud className="h-3.5 w-3.5" /> Upload
            </Link>
          </div>

          <h1 className="font-[family-name:var(--font-bricolage)] text-3xl font-extrabold tracking-tight text-white leading-none">{code}</h1>
          {course?.course_title && (
            <p className="mt-1.5 text-sm font-semibold text-white/75 leading-snug">{norm(course.course_title)}</p>
          )}
          {(dept || faculty) && (
            <p className="mt-0.5 text-xs text-white/50">{[dept, faculty].filter(Boolean).join(" / ")}</p>
          )}

          {/* Contextual stats â€” only show non-zero */}
          {!loading && course && (materials.length > 0 || practiceSets.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {materials.length > 0 && (
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {materials.length} material{materials.length !== 1 ? "s" : ""}
                </span>
              )}
              {practiceSets.length > 0 && (
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {practiceSets.length} practice set{practiceSets.length !== 1 ? "s" : ""}
                </span>
              )}
              {questions.length > 0 && (
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {questions.length} Q&amp;A
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="m-4 rounded-2xl border border-rose-300/40 bg-rose-100/30 p-4 text-sm text-foreground">{error}</div>
        )}

        {!error && !course && !loading && (
          <div className="p-5 text-center space-y-2">
            <p className="font-extrabold text-foreground">Course not found</p>
            <p className="text-sm text-muted-brand">No course matches "{code}".</p>
            <Link
              href={`/study/library?q=${encodeURIComponent(code)}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-sm font-extrabold text-foreground no-underline"
            >
              Search library <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {course && (
        <>
          {/* â”€â”€ Primary session CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <p className="text-sm font-extrabold text-foreground">Start studying</p>
            </div>

            {primaryCta === "practice" && (
              <Link
                href={topPracticeHref}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3.5 no-underline transition hover:opacity-90 active:scale-[0.98]"
              >
                <div>
                  <p className="text-sm font-extrabold text-white">
                    {norm(String(practiceSets[0].title ?? "Practice set"))}
                  </p>
                  <p className="mt-0.5 text-xs text-white/70">
                    {[
                      practiceSets[0].questions_count ? `${practiceSets[0].questions_count} questions` : null,
                      practiceSets[0].time_limit_minutes ? `${practiceSets[0].time_limit_minutes} min` : null,
                    ].filter(Boolean).join(" / ")}
                  </p>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-white/80" />
              </Link>
            )}

            {primaryCta === "browse" && (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-foreground">Browse materials below</p>
                <p className="mt-0.5 text-xs text-muted-brand">No practice sets yet. Use materials to revise.</p>
              </div>
            )}

            {primaryCta === "upload" && (
              <Link
                href={`/study/materials/upload?course_code=${encodeURIComponent(code)}`}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3.5 no-underline transition hover:bg-primary/10"
              >
                <div>
                  <p className="text-sm font-extrabold text-primary">Be the first to upload</p>
                  <p className="mt-0.5 text-xs text-muted-brand">Add past questions, notes, or slides for {code}.</p>
                </div>
                <UploadCloud className="h-5 w-5 shrink-0 text-primary" />
              </Link>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-2">
              <Link
                href={`/study/practice?course=${encodeURIComponent(code)}`}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-2.5 text-center no-underline transition hover:bg-secondary/40"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-foreground leading-tight">Practice</span>
              </Link>
              <Link
                href={`/study/questions/ask?course=${encodeURIComponent(code)}`}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-2.5 text-center no-underline transition hover:bg-secondary/40"
              >
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-foreground leading-tight">Ask AI</span>
              </Link>
              <Link
                href={`/study/materials/upload?course_code=${encodeURIComponent(code)}`}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-2.5 text-center no-underline transition hover:bg-secondary/40"
              >
                <UploadCloud className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-foreground leading-tight">Upload</span>
              </Link>
            </div>
          </div>

          {/* â”€â”€ Level filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {availableLevels.length > 1 && (
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] py-0.5">
              {(["all", ...availableLevels] as string[]).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevelFilter(lv)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    levelFilter === lv
                      ? "border-primary/30 bg-primary-light text-primary-text"
                      : "border-border/60 bg-background text-muted-brand hover:bg-secondary/50"
                  )}
                >
                  {lv === "all" ? "All levels" : `${lv}L`}
                </button>
              ))}
            </div>
          )}

          {/* â”€â”€ Past Questions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {pastQuestions.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <SectionHeader
                title="Past Questions"
                action={
                  pastQuestions.length > 4 ? (
                    <Link
                      href={`/study/library?type=past_question&q=${encodeURIComponent(code)}`}
                      className="text-xs font-semibold text-primary no-underline"
                    >
                      See all {pastQuestions.length}
                    </Link>
                  ) : undefined
                }
              />
              <div className="space-y-2">
                {pastQuestions.slice(0, 4).map((m) => (
                  <MaterialCard key={m.id} m={m} courseCode={code} />
                ))}
              </div>
            </div>
          )}

          {/* â”€â”€ Practice Sets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <SectionHeader
              title="Practice Sets"
              action={
                practiceSets.length > 3 ? (
                  <Link
                    href={`/study/practice?course=${encodeURIComponent(code)}`}
                    className="text-xs font-semibold text-primary no-underline"
                  >
                    See all
                  </Link>
                ) : undefined
              }
            />

            {practiceSets.length > 0 ? (
              <div className="space-y-2">
                {practiceSets.slice(0, 3).map((s) => (
                  <PracticeSetCard key={s.id} s={s} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                <p className="text-sm font-semibold text-primary-text">No practice sets yet</p>
                <p className="mt-0.5 text-xs text-primary/70">
                  Use the materials below to revise, or upload more course files for this class.
                </p>
              </div>
            )}
          </div>

          {/* â”€â”€ Other Materials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {otherMaterials.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <SectionHeader title="Materials" />

              <div className="space-y-4">
                {(() => {
                  const otherGrouped = new Map<string, Material[]>();
                  for (const m of otherMaterials) {
                    const key = String(m.material_type ?? "other");
                    if (!otherGrouped.has(key)) otherGrouped.set(key, []);
                    otherGrouped.get(key)!.push(m);
                  }
                  const entries = Array.from(otherGrouped.entries()).sort((a, b) => {
                    const ia = TYPE_ORDER.indexOf(a[0]);
                    const ib = TYPE_ORDER.indexOf(b[0]);
                    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                  });

                  const visibleEntries = showAllMaterials ? entries : entries.slice(0, 2);
                  const totalOther = otherMaterials.length;

                  return (
                    <>
                      {visibleEntries.map(([type, list]) => {
                        const meta = typeMeta(type);
                        return (
                          <div key={type}>
                            <p className="mb-2 text-xs font-semibold text-muted-brand uppercase tracking-wide">
                              {meta.label === "File" ? "Other" : `${meta.label}s`}
                            </p>
                            <div className="space-y-2">
                              {list.slice(0, 4).map((m) => (
                                <MaterialCard key={m.id} m={m} courseCode={code} />
                              ))}
                              {list.length > 4 && (
                                <Link
                                  href={`/study/library?type=${encodeURIComponent(type)}&q=${encodeURIComponent(code)}`}
                                  className="block text-center text-xs font-semibold text-primary no-underline py-1"
                                >
                                  +{list.length - 4} more
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {!showAllMaterials && entries.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setShowAllMaterials(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-brand transition hover:bg-secondary/40"
                        >
                          Show all {totalOther} materials <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Empty â€” no materials at all */}
          {materials.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
                <BookOpen className="h-5 w-5 text-muted-brand" />
              </div>
              <p className="font-extrabold text-foreground">No materials yet</p>
              <p className="mt-1 text-sm text-muted-brand">Be the first to share notes, slides or past questions for {code}.</p>
              <Link
                href={`/study/materials/upload?course_code=${encodeURIComponent(code)}`}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-extrabold text-white no-underline transition hover:opacity-90"
              >
                <UploadCloud className="h-4 w-4" /> Upload material
              </Link>
            </div>
          )}

          {/* â”€â”€ Q&A â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <p className="text-sm font-extrabold text-foreground">Q&amp;A</p>
              </div>
              {questions.length > 0 && (
                <Link
                  href={`/study/questions?course=${encodeURIComponent(code)}`}
                  className="text-xs font-semibold text-primary no-underline"
                >
                    See all
                </Link>
              )}
            </div>

            {questions.length > 0 ? (
              <div className="space-y-2 mb-3">
                {questions.slice(0, 3).map((q) => {
                  const solved = q.solved === true;
                  const unanswered = (q.answers_count ?? 0) === 0 && !solved;
                  return (
                    <Link
                      key={q.id}
                      href={`/study/questions/${encodeURIComponent(String(q.id))}`}
                      className="flex items-start gap-3 rounded-2xl border border-border bg-background px-3 py-3 no-underline transition hover:bg-secondary/30"
                    >
                      <div className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        solved ? "bg-emerald-500" : unanswered ? "bg-amber-400" : "bg-primary"
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground leading-snug truncate">
                          {norm(String(q.title ?? "Question"))}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-brand">
                          {solved ? "Solved" : unanswered ? "Unanswered" : `${q.answers_count} answer${q.answers_count !== 1 ? "s" : ""}`}
                          {q.created_at ? ` / ${timeAgoShort(q.created_at)}` : ""}
                        </p>
                      </div>
                      {solved && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-brand mb-3">No questions yet. Ask the first one.</p>
            )}

            <Link
              href={`/study/questions/ask?course=${encodeURIComponent(code)}`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary no-underline transition hover:bg-primary/10"
            >
              <MessageCircle className="h-4 w-4" /> Ask a question about {code}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
