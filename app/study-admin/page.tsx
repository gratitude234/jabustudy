"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, FileText, Inbox, Loader2, ShieldCheck, Users, Upload, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ScopeRole = "super" | "course_rep" | "dept_librarian" | "rep" | "librarian";

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
  courseSetup?: Array<{
    facultyId: string | null;
    departmentId: string | null;
    level: number;
    semester: string;
    courseCount: number;
    status: "in_progress" | "complete";
    completedAt: string | null;
  }>;
};

function normalizeRole(role: ScopeRole): "super" | "course_rep" | "dept_librarian" {
  if (role === "super") return "super";
  if (role === "course_rep" || role === "rep") return "course_rep";
  return "dept_librarian";
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title, value, href, icon, hint, accent = "primary",
}: {
  title: string;
  value: string | number;
  href: string;
  icon: React.ReactNode;
  hint: string;
  accent?: "primary" | "accent" | "orange";
}) {
  const accentCls = {
    primary: "bg-primary/10 text-primary",
    accent:  "bg-accent/10 text-accent",
    orange:  "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  }[accent];

  const valueCls = Number(value) > 0 ? "text-foreground" : "text-muted-foreground";

  return (
    <Link
      href={href}
      className="group flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", accentCls)}>
          {icon}
        </div>
      </div>
      <div>
        <p className={cn("text-3xl font-bold tracking-tight tabular-nums", valueCls)}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        View all <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

// ─── Quick action link ────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    if (role === "super") return "Full access to all departments";
    const dept = data.scope.departmentId ?? "—";
    if (role === "dept_librarian") return `${dept} · All levels`;
    const lv = Array.isArray(data.scope.levels) && data.scope.levels.length
      ? data.scope.levels.map((l) => `${l}L`).join(", ")
      : "—";
    return `${dept} · ${lv}`;
  }, [data, role]);

  const incompleteSetup = (data?.courseSetup ?? []).filter((i) => i.status !== "complete");
  const nextSetup = incompleteSetup[0] ?? null;

  // ── Loading / error ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

      {/* ── Welcome banner ── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Study Admin
            </p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review uploads, handle course requests, and keep the library clean.
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Role badge */}
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

      {/* ── Setup banner ── */}
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

      {/* ── Stat cards ── */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Pending Materials"
            value={data.pendingMaterials}
            href="/study-admin/materials"
            icon={<FileText className="h-4 w-4" />}
            hint="Uploads waiting for approval"
            accent="primary"
          />
          <StatCard
            title="Course Requests"
            value={data.pendingRequests}
            href="/study-admin/requests"
            icon={<Inbox className="h-4 w-4" />}
            hint="Student course requests"
            accent="accent"
          />
          {role === "super" && (
            <StatCard
              title="Rep Applications"
              value={data.pendingRepApplications ?? "—"}
              href="/study-admin/rep-applications"
              icon={<Users className="h-4 w-4" />}
              hint="Pending rep & librarian approvals"
              accent="orange"
            />
          )}
        </div>
      )}

      {/* ── Quick actions ── */}
      {data && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quick actions
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <QuickAction href="/study-admin/upload" label="Upload materials" icon={<Upload className="h-4 w-4" />} />
            <QuickAction href="/study-admin/courses" label="Manage courses" icon={<BookOpen className="h-4 w-4" />} />
            <QuickAction href="/study-admin/history" label="Upload history" icon={<History className="h-4 w-4" />} />
            <QuickAction href="/study-admin/question-quality" label="Question quality" icon={<FileText className="h-4 w-4" />} />
          </div>
        </div>
      )}
    </div>
  );
}
