// app/study/_components/StudyUI.tsx
"use client";

// Small shared UI primitives to keep Study pages consistent (mobile-first).

import Link from "next/link";
import * as React from "react";
import {
  ArrowRight,
  UploadCloud,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm",
        "sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  variant = "default",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /**
   * Accepts either a React element (e.g. <ShieldCheck className="..." />)
   * or a component type (e.g. ShieldCheck).
   */
  icon?: React.ReactNode | React.ElementType;
  variant?: "default" | "compact";
}) {
  const compact = variant === "compact";

  const renderIcon = () => {
    if (!icon) return null;

    if (React.isValidElement(icon)) return icon;

    const maybeType = icon as any;
    const isElementType =
      typeof maybeType === "function" ||
      (typeof maybeType === "object" &&
        maybeType !== null &&
        "$$typeof" in maybeType);

    if (isElementType) {
      const Icon = icon as React.ElementType;
      return <Icon className="h-5 w-5" />;
    }

    return icon as React.ReactNode;
  };

  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card text-center shadow-sm",
        compact ? "p-4" : "p-6"
      )}
    >
      {icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border bg-background">
          {renderIcon()}
        </div>
      ) : null}

      <p
        className={cn(
          "text-base font-semibold text-foreground",
          compact && "text-[15px]"
        )}
      >
        {title}
      </p>

      {description ? (
        <p
          className={cn(
            "mx-auto mt-2 max-w-md text-sm text-muted-foreground",
            compact && "mt-1"
          )}
        >
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SkeletonCard({
  className,
  lines = 2,
}: {
  className?: string;
  lines?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm",
        "animate-pulse",
        className
      )}
    >
      <div className="h-4 w-2/3 rounded bg-muted" />
      {lines >= 2 ? <div className="mt-2 h-3 w-1/2 rounded bg-muted" /> : null}
      {lines >= 3 ? <div className="mt-2 h-3 w-1/3 rounded bg-muted" /> : null}
      <div className="mt-4 h-9 w-28 rounded-2xl bg-muted" />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          : "border-border bg-background text-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
        "text-xs font-semibold",
        toneClass,
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── ContributorStatusHub ────────────────────────────────────────────────────
// Conditional display — only shown for actionable states.
// not_applied → null  (link lives in the More sheet instead)
// approved    → compact upload shortcut strip
// pending     → amber alert banner
// rejected    → red alert banner with reapply CTA

export type ContributorRole = "course_rep" | "dept_librarian" | null;
export type ContributorStatus =
  | "not_applied"
  | "pending"
  | "approved"
  | "rejected";
export type ContributorScope =
  | {
      faculty_id: string | null;
      department_id: string | null;
      levels: number[] | null;
      all_levels: boolean;
    }
  | null;

function roleLabel(role: ContributorRole) {
  if (role === "course_rep") return "Course Rep";
  if (role === "dept_librarian") return "Dept. Librarian";
  return "Contributor";
}

function ContributorImpactStats() {
  const [stats, setStats] = React.useState<{ uploads: number; downloads: number } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data, error } = await supabase
          .from("study_materials")
          .select("id, downloads")
          .eq("uploader_id", user.id);
        if (error || !data || cancelled) return;
        const totalUploads = data.length;
        const totalDownloads = data.reduce((sum: number, r: { id: string; downloads: number | null }) => sum + (r.downloads ?? 0), 0);
        if (!cancelled) setStats({ uploads: totalUploads, downloads: totalDownloads });
      } catch {
        // silently fail — stats are non-critical
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!stats || (stats.uploads === 0 && stats.downloads === 0)) return null;

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-semibold text-foreground">
          {stats.uploads}
        </span>{" "}
        upload{stats.uploads !== 1 ? "s" : ""}
      </span>
      <span className="text-xs text-muted-foreground">·</span>
      <span className="text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-semibold text-foreground">
          {stats.downloads}
        </span>{" "}
        download{stats.downloads !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

export function ContributorStatusHub({
  loading,
  status,
  role,
  scope,
}: {
  loading: boolean;
  status: ContributorStatus;
  role: ContributorRole;
  scope: ContributorScope;
}) {
  // While loading, show nothing — prevents layout shift
  if (loading) return null;

  // not_applied — link lives in More sheet; nothing on home page
  if (status === "not_applied") return null;

  // approved — compact upload shortcut
  if (status === "approved") {
    const scopeLabel = (() => {
      if (!scope) return roleLabel(role);
      if (role === "dept_librarian" || scope.all_levels) return `${roleLabel(role)} · All levels`;
      const levels = scope.levels?.map((n) => `${n}L`).join(", ") ?? "";
      return `${roleLabel(role)}${levels ? ` · ${levels}` : ""}`;
    })();

    return (
      <div className={cn("rounded-2xl border border-border bg-card px-4 py-3")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{scopeLabel}</p>
              <p className="text-xs text-muted-foreground">You can upload materials for your department</p>
            </div>
          </div>
          <Link
            href="/study/materials/upload"
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-2xl bg-secondary px-3 py-2",
              "text-sm font-semibold text-foreground hover:opacity-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <UploadCloud className="h-4 w-4" />
            Upload
          </Link>
        </div>
        <ContributorImpactStats />
      </div>
    );
  }

  // pending — amber banner
  if (status === "pending") {
    return (
      <div className={cn("flex items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3")}>
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Application under review</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">You'll be notified once a moderator reviews it</p>
          </div>
        </div>
        <Link
          href="/study/apply-rep"
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2",
            "text-sm font-semibold text-amber-900 hover:bg-amber-500/20 dark:text-amber-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          View <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  // rejected — red banner with reapply CTA
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3")}>
      <div className="flex items-center gap-2 min-w-0">
        <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">Application not approved</p>
          <p className="text-xs text-rose-700 dark:text-rose-400">Reapply with clearer proof (e.g. appointment letter)</p>
        </div>
      </div>
      <Link
        href="/study/apply-rep"
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2",
          "text-sm font-semibold text-rose-900 hover:bg-rose-500/20 dark:text-rose-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        Reapply <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}