"use client";
// app/study-admin/page.tsx
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, FileText, Inbox, Loader2, ShieldCheck, Users } from "lucide-react";
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
  // (optional) if your summary route later adds this
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

function StatCard({
  title,
  value,
  href,
  icon,
  hint,
}: {
  title: string;
  value: string;
  href: string;
  icon: React.ReactNode;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-600">{title}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-sm text-zinc-500">{hint}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black text-white">
          {icon}
        </div>
      </div>
      <div className="mt-4 text-sm font-medium text-zinc-700 group-hover:text-black">Open →</div>
    </Link>
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
        if (!token) {
          router.replace(`/login?next=${encodeURIComponent("/study-admin")}`);
          return;
        }

        const res = await fetch("/api/study-admin/summary", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent("/study-admin")}`);
          return;
        }
        if (res.status === 403) {
          router.replace("/study");
          return;
        }

        if (!res.ok) throw new Error((await res.json())?.error || "Failed to load summary");
        const json = (await res.json()) as Summary;
        if (mounted) setData(json);
      } catch (e: any) {
        if (mounted) setErr(e?.message || "Something went wrong");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const scopeLabel = useMemo(() => {
    if (!data) return "";
    const role = normalizeRole(data.scope.role);

    if (role === "super") return "Super admin access";
    if (role === "dept_librarian") return "Departmental Librarian access (all levels)";
    return "Course Rep access (selected level(s))";
  }, [data]);

  const scopeHint = useMemo(() => {
    if (!data) return "";
    const role = normalizeRole(data.scope.role);

    const dept = data.scope.departmentId ? `Dept: ${data.scope.departmentId}` : "Dept: —";
    if (role === "super") return "Full access";
    if (role === "dept_librarian") return `${dept} • All levels`;
    const lv = Array.isArray(data.scope.levels) && data.scope.levels.length ? data.scope.levels.join(", ") : "—";
    return `${dept} • Levels: ${lv}`;
  }, [data]);

  const incompleteSetup = (data?.courseSetup ?? []).filter((item) => item.status !== "complete");
  const nextSetup = incompleteSetup[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Study Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Review uploads, handle course requests, and keep the library clean.
            </p>
            {data ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
                  {scopeLabel}
                </span>
                <span className="rounded-full border bg-white px-3 py-1 text-xs text-zinc-500">
                  {scopeHint}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>
      </div>

      {err ? (
        <div className={cn("rounded-3xl border p-4 text-sm", "border-red-200 bg-red-50 text-red-700")}>
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}

      {data && nextSetup ? (
        <Link
          href={`/study-admin/courses?level=${nextSetup.level}&semester=${nextSetup.semester}`}
          className="group block rounded-3xl border border-violet-200 bg-violet-50 p-4 text-violet-950 shadow-sm transition hover:border-violet-300 hover:bg-violet-100"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-violet-800">
                <BookOpen className="h-3.5 w-3.5" />
                First job
              </div>
              <h2 className="mt-3 text-lg font-semibold tracking-tight">Set up your class course list</h2>
              <p className="mt-1 text-sm text-violet-800">
                Add or confirm courses for {nextSetup.level}L {nextSetup.semester} semester so classmates can upload to the right course.
              </p>
              <p className="mt-2 text-xs font-medium text-violet-700">
                {nextSetup.courseCount} course{nextSetup.courseCount === 1 ? "" : "s"} added - {incompleteSetup.length} setup group{incompleteSetup.length === 1 ? "" : "s"} still incomplete
              </p>
            </div>
            <div className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white group-hover:bg-violet-800">
              Open setup <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      ) : null}

      {data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            title="Pending materials"
            value={String(data.pendingMaterials)}
            href="/study-admin/materials"
            icon={<FileText className="h-4 w-4" />}
            hint="Review uploads waiting for approval"
          />

          <StatCard
            title="Course requests"
            value={String(data.pendingRequests)}
            href="/study-admin/requests"
            icon={<Inbox className="h-4 w-4" />}
            hint="Approve/reject requested courses"
          />

          {/* Optional: show Rep Applications only if super admin (safe link even if not shown) */}
          {normalizeRole(data.scope.role) === "super" ? (
            <StatCard
              title="Rep applications"
              value={String(data.pendingRepApplications ?? "—")}
              href="/study-admin/rep-applications"
              icon={<Users className="h-4 w-4" />}
              hint="Approve Course Reps and Departmental Librarians"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
