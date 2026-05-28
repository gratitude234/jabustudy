"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Star,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import StudyTabs from "../../_components/StudyTabs";
import { Card, EmptyState, PageHeader } from "../../_components/StudyUI";

type MaterialType =
  | "past_question"
  | "handout"
  | "slides"
  | "note"
  | "timetable"
  | "other";

type CourseMini = {
  course_code: string;
  course_title: string | null;
  level: number | null;
  semester: string | null;
};

type Item = {
  id: string;
  title: string | null;
  material_type: MaterialType | null;
  approved: boolean | null;
  upload_status: string | null;
  downloads: number | null;
  created_at: string;
  description: string | null;
  rejection_reason: string | null;
  study_courses?: CourseMini | null;
};

type MaterialRow = Omit<Item, "study_courses"> & {
  study_courses?: CourseMini | CourseMini[] | null;
  rejection_reason?: string | null;
  upload_status?: string | null;
};

type RepMeResponse = {
  ok: boolean;
  status?: "not_applied" | "pending" | "approved" | "rejected";
  role?: "course_rep" | "dept_librarian" | null;
  scope?: {
    department_id: string | null;
    levels: number[] | null;
  } | null;
};

type DepartmentRow = {
  name: string | null;
};

type ContributionStats = {
  totalUploads: number;
  approvedUploads: number;
  pendingUploads: number;
  rejectedBrokenUploads: number;
  studentsHelped: number;
  coursesHelped: number;
  firstCourseUploads: number;
  practiceSetsPowered: number;
  practiceQuestionsPowered: number;
};

type TopContributionMaterial = {
  id: string;
  title: string | null;
  downloads: number;
  practiceQuestionsPowered: number;
  isFirstCourseUpload?: boolean;
  course: CourseMini | null;
};

type ContributionResponse = {
  ok?: boolean;
  stats?: Partial<ContributionStats>;
  topMaterials?: TopContributionMaterial[];
};

const EMPTY_CONTRIBUTION_STATS: ContributionStats = {
  totalUploads: 0,
  approvedUploads: 0,
  pendingUploads: 0,
  rejectedBrokenUploads: 0,
  studentsHelped: 0,
  coursesHelped: 0,
  firstCourseUploads: 0,
  practiceSetsPowered: 0,
  practiceQuestionsPowered: 0,
};

const EMPTY_CONTRIBUTION_RESPONSE: ContributionResponse = {
  ok: false,
};

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

function formatMaterialType(value: MaterialType | null) {
  if (!value) return "Other";
  return value.replace(/_/g, " ");
}

function StatusPill({
  approved,
  rejectionReason,
}: {
  approved: boolean | null;
  rejectionReason?: string | null;
}) {
  const looksRejected = approved === false && !!(rejectionReason || "").trim();
  if (approved) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Approved
      </span>
    );
  }
  if (looksRejected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
        <XCircle className="h-3.5 w-3.5" />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400">
      <Clock3 className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

export default function MyUploadsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [repMe, setRepMe] = useState<RepMeResponse | null>(null);
  const [repDeptName, setRepDeptName] = useState<string | null>(null);
  const [contributionStats, setContributionStats] = useState<ContributionStats>(EMPTY_CONTRIBUTION_STATS);
  const [topMaterials, setTopMaterials] = useState<TopContributionMaterial[]>([]);

  const isRep = repMe?.ok && repMe.status === "approved" && !!repMe.role;
  const roleLabel = isRep && repMe?.role === "dept_librarian" ? "Dept Librarian" : "Course Rep";
  const scopeLabel = repDeptName ?? "Your department";

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          router.replace(`/login?next=${encodeURIComponent("/study/materials/my")}`);
          return;
        }

        const [repRes, materialsRes, contributionRes] = await Promise.all([
          fetch("/api/study/rep-applications/me", { cache: "no-store" }).then((r) =>
            r.json() as Promise<RepMeResponse>
          ),
          supabase
            .from("study_materials")
            .select(
              "id,title,material_type,approved,upload_status,downloads,created_at,description,rejection_reason,study_courses:course_id(course_code,course_title,level,semester)"
            )
            .eq("uploader_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50),
          fetch("/api/study/contributions/me", { cache: "no-store" })
            .then((r) => r.json() as Promise<ContributionResponse>)
            .catch(() => EMPTY_CONTRIBUTION_RESPONSE),
        ]);

        if (!mounted) return;

        setRepMe(repRes);
        if (materialsRes.error) throw materialsRes.error;
        const rows = ((materialsRes.data as MaterialRow[] | null) ?? []).map((row) => ({
          ...row,
          study_courses: Array.isArray(row.study_courses)
            ? row.study_courses[0] ?? null
            : row.study_courses ?? null,
        }));
        setItems(rows);
        if (contributionRes.ok && contributionRes.stats) {
          setContributionStats({
            ...EMPTY_CONTRIBUTION_STATS,
            ...contributionRes.stats,
          });
          setTopMaterials(contributionRes.topMaterials ?? []);
        } else {
          setContributionStats(EMPTY_CONTRIBUTION_STATS);
          setTopMaterials([]);
        }

        const repDepartmentId = repRes.scope?.department_id;
        if (repRes.ok && repRes.status === "approved" && repDepartmentId) {
          void (async () => {
            try {
              const { data } = await supabase
                .from("study_departments")
                .select("name")
                .eq("id", repDepartmentId)
                .maybeSingle();
              if (mounted) setRepDeptName((data as DepartmentRow | null)?.name ?? null);
            } catch {}
          })();
        }
      } catch (e) {
        if (!mounted) return;
        setErr(e instanceof Error ? e.message : "Failed to load uploads");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const stats = useMemo(() => contributionStats, [contributionStats]);

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <StudyTabs contributorStatus={repMe?.status} />

      <PageHeader
        title="My uploads"
        subtitle="Track what you've uploaded, and see how your contributions are doing."
        right={
          <Link
            href="/study/materials/upload"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-primary px-3 py-2 text-sm font-semibold text-white no-underline shadow-sm transition hover:opacity-90"
          >
            <ShieldCheck className="h-4 w-4" />
            Upload another
          </Link>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/study/library"
          className="inline-flex items-center gap-2 text-sm text-muted-brand no-underline transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to materials
        </Link>

        {!isRep && (
          <div className="hidden items-center gap-2 text-xs text-muted-brand md:flex">
            <span className="rounded-full bg-secondary px-2 py-1">Total: {stats.totalUploads}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
              Approved: {stats.approvedUploads}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
              Pending: {stats.pendingUploads}
            </span>
            <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400">
              Rejected: {stats.rejectedBrokenUploads}
            </span>
          </div>
        )}
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
          {err}
        </div>
      ) : null}

      {loading ? (
        <Card className="rounded-3xl p-6">
          <div className="flex items-center gap-2 text-sm text-muted-brand">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your uploads…
          </div>
        </Card>
      ) : items.length === 0 ? (
        <Card className="rounded-3xl p-6">
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No uploads yet"
            description="When you upload materials, they’ll appear here with their review status."
            action={
              <Link
                href="/study/materials/upload"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white no-underline transition hover:opacity-90"
              >
                Upload a material
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {isRep ? (
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-light dark:bg-primary/10">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-foreground">
                      Your impact as a rep
                    </p>
                    <p className="text-xs text-muted-brand">
                      {roleLabel} · {scopeLabel}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                {[
                  { label: "Uploads", value: stats.totalUploads },
                  { label: "Approved", value: stats.approvedUploads },
                  { label: "Students helped", value: stats.studentsHelped },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-3 text-center">
                    <p className="text-xl font-extrabold tabular-nums text-foreground">
                      {value.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-brand">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              {stats.pendingUploads > 0 && (
                <div className="px-4 py-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {stats.pendingUploads} upload{stats.pendingUploads !== 1 ? "s" : ""} pending review
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Uploaded", value: stats.totalUploads },
                { label: "Students helped", value: stats.studentsHelped },
                { label: "Courses helped", value: stats.coursesHelped },
                { label: "Practice powered", value: stats.practiceQuestionsPowered },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-3 text-center shadow-sm">
                  <p className="text-xl font-extrabold text-foreground">{value.toLocaleString("en-NG")}</p>
                  <p className="mt-0.5 text-[11px] text-muted-brand">{label}</p>
                </div>
              ))}
            </div>
          )}

          {topMaterials.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <p className="text-sm font-extrabold text-foreground">Top impact</p>
                <p className="mt-0.5 text-xs text-muted-brand">
                  Your uploads helping the most students.
                </p>
              </div>
              <div className="divide-y divide-border">
                {topMaterials.map((material) => {
                  const code = material.course?.course_code ?? "Course";
                  return (
                    <Link
                      key={material.id}
                      href={`/study/materials/${encodeURIComponent(material.id)}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 no-underline transition hover:bg-secondary/30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {material.title ?? "Untitled material"}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-brand">
                          {code} · helped {material.downloads.toLocaleString("en-NG")} student{material.downloads === 1 ? "" : "s"} · {material.practiceQuestionsPowered.toLocaleString("en-NG")} questions powered
                        </span>
                        {material.isFirstCourseUpload ? (
                          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary-text">
                            <Star className="h-3 w-3" /> First helper for {code}
                          </span>
                        ) : null}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <p className="text-sm font-extrabold text-foreground">Your materials</p>
              <p className="mt-0.5 text-xs text-muted-brand">
                Review status, students helped, and any rejection notes.
              </p>
            </div>
            <div className="divide-y divide-border">
              {items.map((it) => {
                const courseCode = it.study_courses?.course_code ?? "Course";
                const courseMeta = [
                  it.study_courses?.level ? `${it.study_courses.level}L` : null,
                  it.study_courses?.semester ? String(it.study_courses.semester).toUpperCase() : null,
                  formatMaterialType(it.material_type),
                ].filter(Boolean);

                return (
                  <div key={it.id} className="px-4 py-3">
                    <Link
                      href={`/study/materials/${encodeURIComponent(it.id)}`}
                      className="flex items-start justify-between gap-3 no-underline transition hover:opacity-90"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {it.title ?? "Untitled material"}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary-text dark:bg-primary/10 dark:text-indigo-200">
                            {courseCode}
                          </span>
                          <StatusPill approved={it.approved} rejectionReason={it.rejection_reason} />
                        </div>
                        <p className="mt-1 text-xs text-muted-brand">
                          {courseMeta.join(" · ")}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-brand">
                          <span>Helped {(it.downloads ?? 0).toLocaleString()} student{(it.downloads ?? 0) === 1 ? "" : "s"}</span>
                          <span>Uploaded {formatDate(it.created_at)}</span>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary dark:text-indigo-300">
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                    </Link>

                    {(() => {
                      if (it.approved) return null;
                      const isBroken = it.upload_status === "broken" ||
                        (it.description || "").startsWith("[BROKEN_UPLOAD");
                      const adminNote = (it.rejection_reason || "").trim();
                      if (isBroken) {
                        return (
                          <div className={cn(
                            "mt-3 rounded-2xl border px-3 py-3 text-xs",
                            "border-amber-200 bg-amber-50 text-amber-800",
                            "dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-300"
                          )}>
                            <p className="font-semibold">Upload incomplete</p>
                            <p className="mt-1">The file didn't reach our servers. Please try uploading it again.</p>
                            <Link
                              href="/study/materials/upload"
                              className="mt-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2 no-underline"
                            >
                              Re-upload
                            </Link>
                          </div>
                        );
                      }
                      if (adminNote) {
                        return (
                          <div className={cn(
                            "mt-3 rounded-2xl border px-3 py-3 text-xs",
                            "border-rose-200 bg-rose-50 text-rose-700",
                            "dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400"
                          )}>
                            <p className="font-semibold">Rejection note</p>
                            <p className="mt-1">{adminNote}</p>
                            <p className="mt-2">Fix it and re-upload from the Upload page.</p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
