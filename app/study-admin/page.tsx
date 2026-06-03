"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BookOpen,
  Clock,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ScopeRole = "super" | "course_rep" | "dept_librarian" | "rep" | "librarian";

type CourseSetupItem = {
  facultyId: string | null;
  departmentId: string | null;
  level: number;
  semester: string;
  courseCount: number;
  status: "in_progress" | "complete";
  completedAt: string | null;
};

type Metrics = {
  totalStudents: number;
  activeToday: number;
  activeWeek: number;
  totalMaterials: number;
  totalQuizSets: number;
  practiceSessionsToday: number;
  aiGenerationsToday: number;
  pendingBillingOrders: number;
  failedIndexes: number;
};

type ActionQueueItem = {
  key: string;
  label: string;
  value: number;
  href: string;
  tone: "default" | "warning" | "danger";
};

type Summary = {
  scope: {
    role: ScopeRole;
    facultyId: string | null;
    departmentId: string | null;
    levels?: number[] | null;
  };
  pendingMaterials: number;
  pendingRequests: number;
  pendingRepApplications?: number;
  courseSetup?: CourseSetupItem[];
  metrics?: Metrics;
  actionQueue?: ActionQueueItem[];
  recent?: {
    uploads?: RecentUpload[];
    requests?: RecentRequest[];
    practice?: RecentPractice[];
    billing?: RecentBilling[];
    repApplications?: RecentRepApplication[];
  };
};

type CourseRelation = {
  course_code?: string | null;
  course_title?: string | null;
  level?: number | string | null;
} | Array<{
  course_code?: string | null;
  course_title?: string | null;
  level?: number | string | null;
}> | null;

type QuizSetRelation = {
  title?: string | null;
  course_code?: string | null;
} | Array<{
  title?: string | null;
  course_code?: string | null;
}> | null;

type RecentUpload = {
  id: string;
  title: string | null;
  created_at: string | null;
  approved: boolean | null;
  index_status: string | null;
  study_courses?: CourseRelation;
};

type RecentRequest = {
  id: string;
  course_code: string | null;
  course_title: string | null;
  status: string | null;
  level: number | null;
  semester: string | null;
  created_at: string | null;
};

type RecentPractice = {
  id: string;
  status: string | null;
  score: number | null;
  total_questions: number | null;
  started_at: string | null;
  submitted_at: string | null;
  study_quiz_sets?: QuizSetRelation;
};

type RecentBilling = {
  id: string;
  status: string | null;
  plan_key: string | null;
  amount_naira: number | null;
  created_at: string | null;
  submitted_at: string | null;
};

type RecentRepApplication = {
  id: string;
  status: string | null;
  role: string | null;
  levels: number[] | null;
  created_at: string | null;
};

function normalizeRole(role: ScopeRole): "super" | "course_rep" | "dept_librarian" {
  if (role === "super") return "super";
  if (role === "course_rep" || role === "rep") return "course_rep";
  return "dept_librarian";
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Number(value ?? 0)));
}

function formatNairaShort(value: number | null | undefined) {
  return `₦${formatNumber(value ?? 0)}`;
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "Unknown time";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "Unknown time";
  const diff = Date.now() - ms;
  const mins = Math.max(0, Math.round(diff / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function statusLabel(value: string | null | undefined) {
  return String(value ?? "unknown").replace(/_/g, " ");
}

function MetricCard({
  label,
  value,
  hint,
  href,
  icon,
  accent = "primary",
}: {
  label: string;
  value: number;
  hint: string;
  href?: string;
  icon: React.ReactNode;
  accent?: "primary" | "emerald" | "amber" | "rose" | "sky";
}) {
  const accentCls = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  }[accent];

  const body = (
    <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", accentCls)}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{formatNumber(value)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );

  if (!href) return body;
  return <Link href={href} className="block h-full no-underline">{body}</Link>;
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function QueueItem({ item }: { item: ActionQueueItem }) {
  const toneCls = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    danger: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  }[item.tone];

  return (
    <Link
      href={item.href}
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-secondary"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.value > 0 ? "Needs review" : "Clear"}</p>
      </div>
      <span className={cn("inline-flex min-w-9 justify-center rounded-full px-2 py-1 text-xs font-bold tabular-nums", toneCls)}>
        {formatNumber(item.value)}
      </span>
    </Link>
  );
}

function RecentSection({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
        <Link href={href} className="text-xs font-semibold text-primary no-underline">Open</Link>
      </div>
      {empty ? (
        <p className="rounded-xl bg-secondary/60 px-3 py-6 text-center text-sm text-muted-foreground">Nothing recent.</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function RecentRow({ title, meta, status }: { title: string; meta: string; status?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {status ? (
        <span className="shrink-0 rounded-full bg-background px-2 py-1 text-[11px] font-semibold capitalize text-muted-foreground">
          {statusLabel(status)}
        </span>
      ) : null}
    </div>
  );
}

export default function StudyAdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) { router.replace(`/login?next=${encodeURIComponent("/study-admin")}`); return; }

        const res = await fetch("/api/study-admin/summary", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) { router.replace(`/login?next=${encodeURIComponent("/study-admin")}`); return; }
        if (res.status === 403) { router.replace("/study"); return; }
        if (!res.ok) throw new Error((await res.json())?.error || "Failed to load summary");

        const json = (await res.json()) as Summary;
        if (mounted) setData(json);
      } catch (e: unknown) {
        if (mounted) setErr((e as Error)?.message || "Something went wrong");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  const role = data ? normalizeRole(data.scope.role) : null;

  const roleLabel = useMemo(() => {
    if (!role) return "";
    if (role === "super") return "Super Admin";
    if (role === "dept_librarian") return "Dept. Librarian";
    return "Course Rep";
  }, [role]);

  const scopeHint = useMemo(() => {
    if (!data || !role) return "";
    if (role === "super") return "Full platform overview";
    const dept = data.scope.departmentId ?? "—";
    if (role === "dept_librarian") return `${dept} · All levels`;
    const lv = Array.isArray(data.scope.levels) && data.scope.levels.length
      ? data.scope.levels.map((l) => `${l}L`).join(", ")
      : "—";
    return `${dept} · ${lv}`;
  }, [data, role]);

  const metrics = data?.metrics ?? {
    totalStudents: 0,
    activeToday: 0,
    activeWeek: 0,
    totalMaterials: 0,
    totalQuizSets: 0,
    practiceSessionsToday: 0,
    aiGenerationsToday: 0,
    pendingBillingOrders: 0,
    failedIndexes: 0,
  };
  const recent = data?.recent ?? {};
  const incompleteSetup = (data?.courseSetup ?? []).filter((i) => i.status !== "complete");
  const nextSetup = incompleteSetup[0] ?? null;
  const actionQueue = data?.actionQueue ?? [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading admin overview...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {err}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <LayoutDashboard className="h-3.5 w-3.5" /> Study Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Platform overview</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Watch activity, review queues, and jump into the admin work that needs attention.
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        {data && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {roleLabel}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
              {scopeHint}
            </span>
          </div>
        )}
      </div>

      {nextSetup && (
        <Link
          href={`/study-admin/courses?level=${nextSetup.level}&semester=${nextSetup.semester}`}
          className="group block rounded-2xl border border-primary/30 bg-primary/5 p-5 transition-all hover:border-primary/50 hover:bg-primary/10"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <BookOpen className="h-3 w-3" /> Action needed
              </span>
              <h2 className="mt-2 text-base font-semibold tracking-tight text-foreground">
                Set up your class course list
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Add courses for {nextSetup.level}L {nextSetup.semester} semester before classmates can upload.
              </p>
              <p className="mt-1.5 text-xs font-medium text-primary">
                {incompleteSetup.length} setup group{incompleteSetup.length > 1 ? "s" : ""} still incomplete
              </p>
            </div>
            <div className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity group-hover:opacity-90">
              Open setup <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Students" value={metrics.totalStudents} hint="Known study profiles" icon={<Users className="h-4 w-4" />} accent="primary" />
        <MetricCard label="Active today" value={metrics.activeToday} hint="Users with WAT activity" icon={<Activity className="h-4 w-4" />} accent="emerald" />
        <MetricCard label="Active week" value={metrics.activeWeek} hint="Unique users this week" icon={<Clock className="h-4 w-4" />} accent="sky" />
        <MetricCard label="Practice today" value={metrics.practiceSessionsToday} hint="Sessions started today" icon={<Zap className="h-4 w-4" />} accent="amber" />
        <MetricCard label="Materials" value={metrics.totalMaterials} hint={`${formatNumber(data?.pendingMaterials ?? 0)} pending review`} href="/study-admin/materials" icon={<FileText className="h-4 w-4" />} accent="primary" />
        <MetricCard label="Quiz sets" value={metrics.totalQuizSets} hint="Available practice banks" href="/study-admin/quiz-sets" icon={<BookOpen className="h-4 w-4" />} accent="sky" />
        <MetricCard label="AI today" value={metrics.aiGenerationsToday} hint="Drafts and bank runs" href="/study-admin/question-quality" icon={<Sparkles className="h-4 w-4" />} accent="emerald" />
        <MetricCard label="Index failures" value={metrics.failedIndexes} hint="Materials needing repair" href="/study-admin/materials" icon={<AlertTriangle className="h-4 w-4" />} accent={metrics.failedIndexes > 0 ? "rose" : "emerald"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">Recent activity</h2>
              <p className="text-xs text-muted-foreground">Latest movement across Study Hub.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RecentSection title="Uploads" href="/study-admin/materials" empty={(recent.uploads ?? []).length === 0}>
              {(recent.uploads ?? []).map((item) => {
                const course = firstRelation(item.study_courses);
                return (
                  <RecentRow
                    key={item.id}
                    title={item.title ?? "Untitled material"}
                    meta={`${course?.course_code ?? "No course"} · ${formatWhen(item.created_at)}`}
                    status={item.approved ? "approved" : item.index_status ?? "pending"}
                  />
                );
              })}
            </RecentSection>

            <RecentSection title="Practice" href="/study-admin" empty={(recent.practice ?? []).length === 0}>
              {(recent.practice ?? []).map((item) => {
                const set = firstRelation(item.study_quiz_sets);
                const score = typeof item.score === "number" && typeof item.total_questions === "number"
                  ? `${item.score}/${item.total_questions}`
                  : statusLabel(item.status);
                return (
                  <RecentRow
                    key={item.id}
                    title={set?.title ?? "Practice attempt"}
                    meta={`${set?.course_code ?? "Study"} · ${score} · ${formatWhen(item.submitted_at ?? item.started_at)}`}
                    status={item.status ?? undefined}
                  />
                );
              })}
            </RecentSection>

            <RecentSection title="Course requests" href="/study-admin/requests" empty={(recent.requests ?? []).length === 0}>
              {(recent.requests ?? []).map((item) => (
                <RecentRow
                  key={item.id}
                  title={item.course_code ?? item.course_title ?? "Course request"}
                  meta={`${item.level ? `${item.level}L` : "Level pending"} · ${item.semester ?? "semester"} · ${formatWhen(item.created_at)}`}
                  status={item.status ?? undefined}
                />
              ))}
            </RecentSection>

            {role === "super" ? (
              <RecentSection title="Billing" href="/study-admin/billing" empty={(recent.billing ?? []).length === 0}>
                {(recent.billing ?? []).map((item) => (
                  <RecentRow
                    key={item.id}
                    title={item.plan_key ?? "Billing order"}
                    meta={`${formatNairaShort(item.amount_naira)} · ${formatWhen(item.submitted_at ?? item.created_at)}`}
                    status={item.status ?? undefined}
                  />
                ))}
              </RecentSection>
            ) : (
              <RecentSection title="Scoped queue" href="/study-admin/courses" empty={incompleteSetup.length === 0}>
                {incompleteSetup.slice(0, 5).map((item) => (
                  <RecentRow
                    key={`${item.level}:${item.semester}`}
                    title={`${item.level}L ${item.semester} semester`}
                    meta={`${formatNumber(item.courseCount)} course${item.courseCount === 1 ? "" : "s"} added`}
                    status={item.status}
                  />
                ))}
              </RecentSection>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold tracking-tight text-foreground">Action queue</h2>
              <span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">
                {formatNumber(actionQueue.reduce((sum, item) => sum + item.value, 0))}
              </span>
            </div>
            <div className="space-y-1">
              {actionQueue.length > 0 ? (
                actionQueue.map((item) => <QueueItem key={item.key} item={item} />)
              ) : (
                <p className="rounded-xl bg-secondary/60 px-3 py-6 text-center text-sm text-muted-foreground">No queued work.</p>
              )}
            </div>
          </section>

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick actions
            </p>
            <div className="grid gap-2">
              <QuickAction href="/study-admin/upload" label="Upload materials" icon={<Upload className="h-4 w-4" />} />
              <QuickAction href="/study-admin/courses" label="Manage courses" icon={<BookOpen className="h-4 w-4" />} />
              <QuickAction href="/study-admin/materials" label="Review materials" icon={<FileText className="h-4 w-4" />} />
              <QuickAction href="/study-admin/question-quality" label="Question quality" icon={<Sparkles className="h-4 w-4" />} />
              <QuickAction href="/study-admin/history" label="Upload history" icon={<History className="h-4 w-4" />} />
              {role === "super" && (
                <>
                  <QuickAction href="/study-admin/billing" label="Billing reviews" icon={<Banknote className="h-4 w-4" />} />
                  <QuickAction href="/study-admin/rep-applications" label="Rep applications" icon={<Inbox className="h-4 w-4" />} />
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
