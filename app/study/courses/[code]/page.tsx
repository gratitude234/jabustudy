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
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  Play,
  ShieldCheck,
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

type BankTopic = {
  title: string;
  description?: string | null;
  target?: number | null;
  generated?: number | null;
};

type BankMaterial = {
  id: string;
  material_id: string;
  position: number | null;
  status: string | null;
  topic_outline: BankTopic[] | null;
  generated_count: number | null;
  error_message: string | null;
  study_materials?: {
    id: string;
    title: string | null;
    material_type: string | null;
    file_path: string | null;
  } | null;
};

type BankState = {
  run: {
    id: string;
    course_id: string;
    course_code: string;
    quiz_set_id: string;
    status: "draft" | "ready" | "completed" | "failed" | string;
    batch_size: number | null;
    topic_target: number | null;
  };
  materials: BankMaterial[];
  questionsCount: number;
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

function isAiSupported(filePath: string | null) {
  if (!filePath) return false;
  return /\.(pdf|png|jpg|jpeg|webp|docx|pptx)$/i.test(filePath);
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  past_question: { label: "Past Q",  color: "text-[#3B24A8]", bg: "bg-[#EEEDFE]" },
  note:          { label: "Note",    color: "text-[#3B6D11]", bg: "bg-[#EAF3DE]" },
  handout:       { label: "Handout", color: "text-[#3B6D11]", bg: "bg-[#EAF3DE]" },
  slides:        { label: "Slides",  color: "text-[#0C447C]", bg: "bg-[#E6F1FB]" },
  timetable:     { label: "Timetable", color: "text-[#633806]", bg: "bg-[#FAEEDA]" },
  other:         { label: "File",    color: "text-muted-foreground", bg: "bg-secondary" },
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
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[meta.label, m.level ? `${m.level}L` : null, m.semester ? `${m.semester} sem` : null]
            .filter(Boolean).join(" Â· ")}
        </p>
      </div>
      {typeof m.downloads === "number" && m.downloads > 0 && (
        <p className="shrink-0 text-xs text-muted-foreground">â†“{m.downloads}</p>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function PracticeSetCard({ s }: { s: PracticeSet }) {
  const isAiCourse = s.source === "ai_course";
  const isOfficialAi = s.source === "rep_ai_bank";
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
        isAiCourse || isOfficialAi ? "bg-[#5B35D5]" : "bg-[#EEEDFE]"
      )}>
        <Sparkles className={cn("h-4 w-4", isAiCourse || isOfficialAi ? "text-white" : "text-[#5B35D5]")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {norm(String(s.title ?? "Practice set"))}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {isOfficialAi && (
            <span className="text-xs font-extrabold text-[#5B35D5]">Official AI-built</span>
          )}
          {typeof s.questions_count === "number" && (
            <span className="text-xs text-muted-foreground">{s.questions_count} questions</span>
          )}
          {typeof s.time_limit_minutes === "number" && (
            <span className="text-xs text-muted-foreground">Â· {s.time_limit_minutes} min</span>
          )}
          {s.level && <span className="text-xs text-muted-foreground">Â· {s.level}L</span>}
        </div>
        {isAiCourse && sources.length > 0 && (
          <p className="mt-1 text-[11px] text-[#5B35D5]/70 leading-snug">
            From:{" "}
            {sources
              .map((src) => src.title ?? "material")
              .join(", ")
              .slice(0, 80)}
            {sources.map((s) => s.title ?? "").join(", ").length > 80 ? "â€¦" : ""}
          </p>
        )}
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}

function bankMaterialTitle(row: BankMaterial) {
  const material = Array.isArray(row.study_materials)
    ? row.study_materials[0]
    : row.study_materials;
  return material?.title ?? "Untitled material";
}

function BankBuilderCard({
  bank,
  compatibleMaterials,
  selectedIds,
  setSelectedIds,
  busy,
  error,
  onStart,
  onGenerate,
  onPublish,
}: {
  bank: BankState | null;
  compatibleMaterials: Material[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onGenerate: () => void;
  onPublish: () => void;
}) {
  const ready = bank?.run.status === "ready";
  const hasBank = Boolean(bank?.run.id);

  return (
    <div className="rounded-3xl border border-[#5B35D5]/20 bg-[#5B35D5]/5 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#5B35D5]" />
            <p className="text-sm font-extrabold text-[#3B24A8]">Official question bank</p>
          </div>
          <p className="mt-1 text-xs leading-snug text-[#534AB7]">
            Build the rep-reviewed practice set that appears on the Practice page.
          </p>
        </div>
        {hasBank && (
          <span className="shrink-0 rounded-full border border-[#5B35D5]/20 bg-background px-2.5 py-1 text-[11px] font-extrabold text-[#3B24A8]">
            {bank?.questionsCount ?? 0} Q
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-rose-300/40 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}

      {!hasBank ? (
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            {compatibleMaterials.slice(0, 8).map((m) => {
              const checked = selectedIds.includes(m.id);
              const meta = typeMeta(m.material_type ?? "other");
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setSelectedIds(
                      checked ? selectedIds.filter((id) => id !== m.id) : [...selectedIds, m.id]
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border bg-background px-3 py-2.5 text-left transition",
                    checked ? "border-[#5B35D5]/30" : "border-border"
                  )}
                >
                  <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", meta.bg, meta.color)}>
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{m.title ?? "Untitled material"}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.label}</p>
                  </div>
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                      checked ? "border-[#5B35D5] bg-[#5B35D5] text-white" : "border-border"
                    )}
                  >
                    {checked ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onStart}
            disabled={busy || selectedIds.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5B35D5] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#4526B8] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Starting bank..." : "Start official bank"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            {bank!.materials.map((row) => {
              const topics = Array.isArray(row.topic_outline) ? row.topic_outline : [];
              const totalTarget = topics.reduce((sum, t) => sum + Number(t.target ?? 0), 0);
              const totalGenerated = topics.reduce((sum, t) => sum + Number(t.generated ?? 0), 0);
              const pct = totalTarget > 0 ? Math.round((totalGenerated / totalTarget) * 100) : 0;
              return (
                <div key={row.id} className="rounded-2xl border border-border bg-background px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{bankMaterialTitle(row)}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                        {row.status === "covered"
                          ? "Covered"
                          : row.status === "failed"
                            ? "Needs retry"
                            : row.status === "pending"
                              ? "Pending outline"
                              : `${totalGenerated}/${totalTarget || "?"} topic questions`}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-extrabold text-[#5B35D5]">{row.status === "covered" ? "Done" : `${pct}%`}</span>
                  </div>
                  {topics.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {topics.slice(0, 4).map((topic) => (
                        <span key={topic.title} className="rounded-full border border-[#5B35D5]/15 bg-[#5B35D5]/5 px-2 py-0.5 text-[10px] font-semibold text-[#534AB7]">
                          {topic.title}: {topic.generated ?? 0}/{topic.target ?? 0}
                        </span>
                      ))}
                    </div>
                  )}
                  {row.error_message && (
                    <p className="mt-2 rounded-xl border border-rose-300/40 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700">
                      {row.error_message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy || ready}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B35D5] px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#4526B8] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Next batch
            </button>
            <Link
              href={`/study-admin/question-quality/${encodeURIComponent(bank!.run.quiz_set_id)}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5 text-xs font-extrabold text-foreground no-underline hover:bg-secondary/40"
            >
              <Play className="h-3.5 w-3.5" />
              Open editor
            </Link>
            <button
              type="button"
              onClick={onPublish}
              disabled={busy || (bank?.questionsCount ?? 0) === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/50 bg-emerald-50 px-3 py-2.5 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Publish
            </button>
          </div>
        </div>
      )}
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
  const [canManageBank, setCanManageBank] = useState(false);
  const [bank, setBank] = useState<BankState | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [selectedBankMaterialIds, setSelectedBankMaterialIds] = useState<string[]>([]);

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

  const grouped = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const m of filteredMaterials) {
      const key = String(m.material_type ?? "other");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    const entries = Array.from(map.entries());
    entries.sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a[0]);
      const ib = TYPE_ORDER.indexOf(b[0]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return entries;
  }, [filteredMaterials]);

  const pastQuestions = useMemo(
    () => filteredMaterials.filter((m) => m.material_type === "past_question"),
    [filteredMaterials]
  );

  const otherMaterials = useMemo(
    () => filteredMaterials.filter((m) => m.material_type !== "past_question"),
    [filteredMaterials]
  );

  const firstAiMaterial = useMemo(
    () => materials.find((m) => isAiSupported(m.file_path)) ?? null,
    [materials]
  );

  const compatibleMaterials = useMemo(
    () => materials.filter((m) => isAiSupported(m.file_path)),
    [materials]
  );

  useEffect(() => {
    setSelectedBankMaterialIds((prev) => {
      const valid = new Set(compatibleMaterials.map((m) => m.id));
      const kept = prev.filter((id) => valid.has(id));
      if (kept.length) return kept;
      return compatibleMaterials.slice(0, 5).map((m) => m.id);
    });
  }, [compatibleMaterials]);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in to manage this course bank.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async function refreshBank(courseId: string) {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/study/rep-question-bank?courseId=${encodeURIComponent(courseId)}`, {
        headers,
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        setCanManageBank(false);
        setBank(null);
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Could not load question bank.");
      setCanManageBank(true);
      setBank((json.bank ?? null) as BankState | null);
    } catch {
      setCanManageBank(false);
      setBank(null);
    }
  }

  useEffect(() => {
    if (!course?.id) return;
    void refreshBank(course.id);
  }, [course?.id]);

  const topPracticeHref = practiceSets[0]?.id
    ? `/study/practice/${encodeURIComponent(String(practiceSets[0].id))}`
    : `/study/practice?course=${encodeURIComponent(code)}`;

  // Smart primary CTA
  const primaryCta = useMemo(() => {
    if (practiceSets.length > 0) return "practice";
    if (materials.length > 0) return "browse";
    return "upload";
  }, [practiceSets, materials]);

  async function handleStartBank() {
    if (!course?.id || bankLoading) return;
    setBankLoading(true);
    setBankError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/study/rep-question-bank/start", {
        method: "POST",
        headers,
        body: JSON.stringify({
          courseId: course.id,
          materialIds: selectedBankMaterialIds,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to start question bank.");
      setCanManageBank(true);
      setBank(json.bank as BankState);
    } catch (e: unknown) {
      setBankError(e instanceof Error ? e.message : "Failed to start question bank.");
    } finally {
      setBankLoading(false);
    }
  }

  async function handleGenerateBatch() {
    if (!bank?.run.id || bankLoading) return;
    setBankLoading(true);
    setBankError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/study/rep-question-bank/${encodeURIComponent(bank.run.id)}/generate-batch`, {
        method: "POST",
        headers,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to generate batch.");
      setBank(json.bank as BankState);
    } catch (e: unknown) {
      setBankError(e instanceof Error ? e.message : "Failed to generate batch.");
    } finally {
      setBankLoading(false);
    }
  }

  async function handlePublishBank() {
    if (!bank?.run.id || bankLoading) return;
    setBankLoading(true);
    setBankError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/study/rep-question-bank/${encodeURIComponent(bank.run.id)}/publish`, {
        method: "POST",
        headers,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to publish bank.");
      router.push(`/study/practice/${encodeURIComponent(bank.run.quiz_set_id)}`);
    } catch (e: unknown) {
      setBankError(e instanceof Error ? e.message : "Failed to publish bank.");
    } finally {
      setBankLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 pb-28">
        <div className="h-48 animate-pulse rounded-3xl bg-[#5B35D5]/20" />
        <div className="h-24 animate-pulse rounded-3xl bg-secondary/60" />
        <div className="h-32 animate-pulse rounded-3xl bg-secondary/60" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-28 md:pb-8">

      {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="bg-[#5B35D5] px-5 pt-5 pb-5">
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

          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-none">{code}</h1>
          {course?.course_title && (
            <p className="mt-1.5 text-sm font-semibold text-white/75 leading-snug">{norm(course.course_title)}</p>
          )}
          {(dept || faculty) && (
            <p className="mt-0.5 text-xs text-white/50">{[dept, faculty].filter(Boolean).join(" Â· ")}</p>
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
            <p className="text-sm text-muted-foreground">No course matches "{code}".</p>
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
              <Zap className="h-4 w-4 text-[#5B35D5]" />
              <p className="text-sm font-extrabold text-foreground">Start studying</p>
            </div>

            {primaryCta === "practice" && (
              <Link
                href={topPracticeHref}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#5B35D5] px-4 py-3.5 no-underline transition hover:bg-[#4526B8] active:scale-[0.98]"
              >
                <div>
                  <p className="text-sm font-extrabold text-white">
                    {norm(String(practiceSets[0].title ?? "Practice set"))}
                  </p>
                  <p className="mt-0.5 text-xs text-white/70">
                    {[
                      practiceSets[0].questions_count ? `${practiceSets[0].questions_count} questions` : null,
                      practiceSets[0].time_limit_minutes ? `${practiceSets[0].time_limit_minutes} min` : null,
                    ].filter(Boolean).join(" Â· ")}
                  </p>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-white/80" />
              </Link>
            )}

            {primaryCta === "browse" && (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-foreground">Browse materials below</p>
                <p className="mt-0.5 text-xs text-muted-foreground">No practice sets yet. Use materials to revise.</p>
              </div>
            )}

            {primaryCta === "upload" && (
              <Link
                href={`/study/materials/upload?course_code=${encodeURIComponent(code)}`}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-[#5B35D5]/30 bg-[#5B35D5]/5 px-4 py-3.5 no-underline transition hover:bg-[#5B35D5]/10"
              >
                <div>
                  <p className="text-sm font-extrabold text-[#5B35D5]">Be the first to upload</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Add past questions, notes, or slides for {code}.</p>
                </div>
                <UploadCloud className="h-5 w-5 shrink-0 text-[#5B35D5]" />
              </Link>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-2">
              <Link
                href={`/study/practice?course=${encodeURIComponent(code)}`}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-2.5 text-center no-underline transition hover:bg-secondary/40"
              >
                <Sparkles className="h-4 w-4 text-[#5B35D5]" />
                <span className="text-[11px] font-semibold text-foreground leading-tight">Practice</span>
              </Link>
              <Link
                href={`/study/questions/ask?course=${encodeURIComponent(code)}`}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-2.5 text-center no-underline transition hover:bg-secondary/40"
              >
                <MessageCircle className="h-4 w-4 text-[#5B35D5]" />
                <span className="text-[11px] font-semibold text-foreground leading-tight">Ask AI</span>
              </Link>
              <Link
                href={`/study/materials/upload?course_code=${encodeURIComponent(code)}`}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-2.5 text-center no-underline transition hover:bg-secondary/40"
              >
                <UploadCloud className="h-4 w-4 text-[#5B35D5]" />
                <span className="text-[11px] font-semibold text-foreground leading-tight">Upload</span>
              </Link>
            </div>
          </div>

          {/* â”€â”€ Level filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {canManageBank && compatibleMaterials.length > 0 && (
            <BankBuilderCard
              bank={bank}
              compatibleMaterials={compatibleMaterials}
              selectedIds={selectedBankMaterialIds}
              setSelectedIds={setSelectedBankMaterialIds}
              busy={bankLoading}
              error={bankError}
              onStart={handleStartBank}
              onGenerate={handleGenerateBatch}
              onPublish={handlePublishBank}
            />
          )}

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
                      ? "border-[#5B35D5]/30 bg-[#EEEDFE] text-[#3B24A8]"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50"
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
                      className="text-xs font-semibold text-[#5B35D5] no-underline"
                    >
                      See all {pastQuestions.length} â†’
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
                    className="text-xs font-semibold text-[#5B35D5] no-underline"
                  >
                    See all â†’
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
              <div className="rounded-2xl border border-[#5B35D5]/15 bg-[#5B35D5]/5 px-4 py-3">
                <p className="text-sm font-semibold text-[#3C3489]">No practice sets yet</p>
                <p className="mt-0.5 text-xs text-[#534AB7]">
                  {firstAiMaterial
                    ? canManageBank
                      ? "Use the official question bank builder above to create the first class practice set."
                      : "Your course rep can publish an official practice set from the materials below."
                    : "Upload a material first, then your course rep can build practice from it."}
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
                            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {meta.label === "File" ? "Other" : `${meta.label}s`}
                            </p>
                            <div className="space-y-2">
                              {list.slice(0, 4).map((m) => (
                                <MaterialCard key={m.id} m={m} courseCode={code} />
                              ))}
                              {list.length > 4 && (
                                <Link
                                  href={`/study/library?type=${encodeURIComponent(type)}&q=${encodeURIComponent(code)}`}
                                  className="block text-center text-xs font-semibold text-[#5B35D5] no-underline py-1"
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
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-secondary/40"
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
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="font-extrabold text-foreground">No materials yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Be the first to share notes, slides or past questions for {code}.</p>
              <Link
                href={`/study/materials/upload?course_code=${encodeURIComponent(code)}`}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#5B35D5] px-4 py-2.5 text-sm font-extrabold text-white no-underline transition hover:bg-[#4526B8]"
              >
                <UploadCloud className="h-4 w-4" /> Upload material
              </Link>
            </div>
          )}

          {/* â”€â”€ Q&A â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#5B35D5]" />
                <p className="text-sm font-extrabold text-foreground">Q&amp;A</p>
              </div>
              {questions.length > 0 && (
                <Link
                  href={`/study/questions?course=${encodeURIComponent(code)}`}
                  className="text-xs font-semibold text-[#5B35D5] no-underline"
                >
                  See all â†’
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
                        solved ? "bg-emerald-500" : unanswered ? "bg-amber-400" : "bg-[#5B35D5]"
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground leading-snug truncate">
                          {norm(String(q.title ?? "Question"))}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {solved ? "Solved" : unanswered ? "Unanswered" : `${q.answers_count} answer${q.answers_count !== 1 ? "s" : ""}`}
                          {q.created_at ? ` Â· ${timeAgoShort(q.created_at)}` : ""}
                        </p>
                      </div>
                      {solved && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">No questions yet. Ask the first one.</p>
            )}

            <Link
              href={`/study/questions/ask?course=${encodeURIComponent(code)}`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#5B35D5]/30 bg-[#5B35D5]/5 px-4 py-2.5 text-sm font-semibold text-[#5B35D5] no-underline transition hover:bg-[#5B35D5]/10"
            >
              <MessageCircle className="h-4 w-4" /> Ask a question about {code}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
