"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Brain,
  Calculator,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  History,
  Library,
  Loader2,
  MessageCircleQuestion,
  PenLine,
  Settings,
  Target,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import StudyTabs from "../_components/StudyTabs";
import { Badge, Card, PageHeader } from "../_components/StudyUI";
import { StudyPrefsProvider, useStudyPrefs, type RepStatus } from "../_components/StudyPrefsContext";

type Counts = {
  saved: number;
  attempts: number;
  uploads: number;
  approvedUploads: number;
  pendingUploads: number;
  questions: number;
};

const EMPTY_COUNTS: Counts = {
  saved: 0,
  attempts: 0,
  uploads: 0,
  approvedUploads: 0,
  pendingUploads: 0,
  questions: 0,
};

type Tone = "study" | "blue" | "green" | "amber" | "zinc";

const toneClass: Record<Tone, string> = {
  study: "border-primary/20 bg-primary-light text-primary",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  zinc: "border-border bg-background text-foreground",
};

function initials(name: string | null, email: string | null) {
  const source = (name ?? email ?? "Study User").trim();
  const parts = source.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "S").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function roleLabel(status: RepStatus, role: string | null) {
  if (status === "approved") {
    return role === "dept_librarian" ? "Dept Librarian" : "Course Rep";
  }
  if (status === "pending") return "Rep pending";
  if (status === "rejected") return "Rep rejected";
  return "Student";
}

function semesterLabel(value?: string | null) {
  if (value === "first") return "1st semester";
  if (value === "second") return "2nd semester";
  if (value === "summer") return "Summer";
  return "Semester not set";
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-background px-3 py-2.5 text-center">
      <div className="font-[family-name:var(--font-bricolage)] text-base font-extrabold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 truncate text-[11px] font-medium text-muted-brand">{label}</div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  desc,
  icon,
  tone,
}: {
  href: string;
  title: string;
  desc: string;
  icon: ReactNode;
  tone: Tone;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-card p-3 no-underline shadow-sm transition hover:bg-secondary/20"
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", toneClass[tone])}>
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-foreground">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-brand">{desc}</span>
        </span>
      </div>
    </Link>
  );
}

function ToolRow({
  href,
  title,
  desc,
  icon,
  tone,
  badge,
}: {
  href: string;
  title: string;
  desc: string;
  icon: ReactNode;
  tone: Tone;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 no-underline shadow-sm transition hover:bg-secondary/20"
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", toneClass[tone])}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-brand">{desc}</span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full border border-primary/20 bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">
          {badge}
        </span>
      ) : null}
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-brand" />
    </Link>
  );
}

function StudyMeSkeleton() {
  return (
    <>
      <div className="h-7 w-40 animate-pulse rounded bg-muted" />
      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      </div>
    </>
  );
}

function StudyMeInner() {
  const { loading, userId, userEmail, displayName, prefs, hasPrefs, rep } = useStudyPrefs();
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [countsLoading, setCountsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadCounts() {
      setCountsLoading(true);
      const [
        savedRes,
        attemptsRes,
        uploadsRes,
        approvedUploadsRes,
        questionsRes,
      ] = await Promise.all([
        supabase.from("study_saved_items").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("study_practice_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "submitted"),
        supabase.from("study_materials").select("id", { count: "exact", head: true }).eq("uploader_id", userId),
        supabase
          .from("study_materials")
          .select("id", { count: "exact", head: true })
          .eq("uploader_id", userId)
          .eq("approved", true),
        supabase.from("study_questions").select("id", { count: "exact", head: true }).eq("author_id", userId),
      ]);

      if (cancelled) return;

      const uploads = uploadsRes.count ?? 0;
      const approvedUploads = approvedUploadsRes.count ?? 0;
      setCounts({
        saved: savedRes.count ?? 0,
        attempts: attemptsRes.count ?? 0,
        uploads,
        approvedUploads,
        pendingUploads: Math.max(0, uploads - approvedUploads),
        questions: questionsRes.count ?? 0,
      });
      setCountsLoading(false);
    }

    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const profileSummary = useMemo(() => {
    const department = prefs?.department ?? "Department not set";
    const level = prefs?.level ? `${prefs.level}L` : "Level not set";
    return `${department} - ${level}`;
  }, [prefs?.department, prefs?.level]);

  const isContributor = rep.status === "approved";
  const repBadge = roleLabel(rep.status, rep.role);

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <StudyTabs contributorStatus={loading ? undefined : rep.status} />

      {loading ? (
        <StudyMeSkeleton />
      ) : (
        <>

      <PageHeader
        title="Study Profile"
        subtitle="Your academic hub for saved resources, practice progress and contributor tools."
        right={
          <Link
            href="/study/onboarding"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground no-underline shadow-sm transition hover:bg-secondary/40"
          >
            <Settings className="h-4 w-4" />
            Edit profile
          </Link>
        }
      />

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-[16px] bg-primary text-lg font-extrabold text-white shadow-[0_4px_16px_rgba(91,53,213,0.3)]">
              {initials(displayName, userEmail)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-extrabold text-foreground">
                {displayName ?? "Study User"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted-brand">{profileSummary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={isContributor ? "success" : rep.status === "pending" ? "warning" : "neutral"}>
                  {isContributor ? <BadgeCheck className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                  {repBadge}
                </Badge>
                <Badge tone="neutral">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {semesterLabel(prefs?.semester)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill label="Saved" value={counts.saved} />
          <StatPill label="Practice" value={counts.attempts} />
          <StatPill label="Uploads" value={counts.uploads} />
          <StatPill label="Questions" value={counts.questions} />
        </div>

        {!hasPrefs ? (
          <Link
            href="/study/onboarding"
            className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-light px-4 py-3 no-underline"
          >
            <span>
              <span className="block text-sm font-bold text-primary-text">Complete your study profile</span>
              <span className="mt-0.5 block text-xs text-primary">Set department, level and semester for better recommendations.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
          </Link>
        ) : null}
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Academic profile</h2>
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {[
            { label: "Faculty", value: prefs?.faculty ?? "Not set" },
            { label: "Department", value: prefs?.department ?? "Not set" },
            { label: "Level", value: prefs?.level ? `${prefs.level}L` : "Not set" },
            { label: "Semester", value: semesterLabel(prefs?.semester) },
          ].map(({ label, value }, i, arr) => (
            <div
              key={label}
              className={cn(
                "flex items-center justify-between px-4 py-3",
                i < arr.length - 1 && "border-b border-border"
              )}
            >
              <span className="text-xs text-muted-brand">{label}</span>
              <span className="text-sm font-medium text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Study tools</h2>
        <div className="space-y-2">
          <ToolRow
            href="/study/saved"
            title="Saved"
            desc={`${counts.saved.toLocaleString("en-NG")} saved resources`}
            icon={<Library className="h-4 w-4" />}
            tone="study"
          />
          <ToolRow
            href="/study/history"
            title="Practice History"
            desc={`${counts.attempts.toLocaleString("en-NG")} submitted attempts`}
            icon={<History className="h-4 w-4" />}
            tone="blue"
          />
          <ToolRow
            href="/study/gpa"
            title="GPA Tools"
            desc="CGPA, targets and semester planning"
            icon={<Calculator className="h-4 w-4" />}
            tone="green"
          />
          <ToolRow
            href="/study/questions"
            title="My Questions"
            desc={`${counts.questions.toLocaleString("en-NG")} asked so far`}
            icon={<MessageCircleQuestion className="h-4 w-4" />}
            tone="amber"
          />
          <ToolRow
            href="/study/library"
            title="Find Materials"
            desc="Browse notes, handouts, slides and past questions"
            icon={<BookOpen className="h-4 w-4" />}
            tone="blue"
          />
          <ToolRow
            href="/study/tutors"
            title="Tutors"
            desc="Find verified student tutors"
            icon={<HelpCircle className="h-4 w-4" />}
            tone="green"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Contributor tools</h2>
        <div className="space-y-2">
          {isContributor ? (
            <>
              <ToolRow
                href="/study/materials/upload"
                title="Upload Material"
                desc="Add course files for your approved scope"
                icon={<UploadCloud className="h-4 w-4" />}
                tone="green"
                badge="Rep"
              />
              <ToolRow
                href="/study/materials/my"
                title="My Uploads"
                desc={`${counts.approvedUploads} approved, ${counts.pendingUploads} pending`}
                icon={<FileText className="h-4 w-4" />}
                tone="study"
              />
              <ToolRow
                href="/study/questions"
                title="Answer Questions"
                desc="Help classmates and build contributor trust"
                icon={<PenLine className="h-4 w-4" />}
                tone="blue"
              />
            </>
          ) : (
            <ToolRow
              href="/study/apply-rep"
              title={rep.status === "pending" ? "Course Rep Application" : "Become a Course Rep"}
              desc={rep.status === "pending" ? "Your application is under review" : "Apply to upload and manage materials"}
              icon={<ClipboardList className="h-4 w-4" />}
              tone={rep.status === "pending" ? "amber" : "study"}
              badge={rep.status === "pending" ? "Pending" : undefined}
            />
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Card className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-light text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">AI study plan</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-brand">
              Generate a weekly plan from your courses and available time.
            </p>
            <Link href="/study/ai-plan" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary no-underline">
              Open planner <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>

        <Card className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Focus areas</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-brand">
              Use practice history to spot weak topics and revise smarter.
            </p>
            <Link href="/study/practice" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary no-underline">
              Practice now <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </section>

      {countsLoading ? (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-brand">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Refreshing study stats
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}

export default function StudyMeClient() {
  return (
    <StudyPrefsProvider>
      <StudyMeInner />
    </StudyPrefsProvider>
  );
}
