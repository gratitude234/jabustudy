"use client";
// app/study/apply-rep/page.tsx

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Building2,
  GraduationCap,
  Clock,
  Upload,
  ChevronLeft,
} from "lucide-react";

type FacultyRow = { id: string; name: string; sort_order?: number | null };
type DeptRow = { id: string; name: string; faculty_id: string; sort_order?: number | null };
type Role = "course_rep" | "dept_librarian";
type MeStatus = "not_applied" | "pending" | "approved" | "rejected";

const LEVELS = [100, 200, 300, 400, 500, 600];

function codeToMessage(code?: string) {
  switch (code) {
    case "NO_SESSION":          return "Please log in to continue.";
    case "MISSING_DEPARTMENT":  return "Select your department to continue.";
    case "LEVELS_REQUIRED":     return "Select at least one level for Course Rep.";
    case "ALREADY_PENDING":     return "You already have a pending application.";
    case "ALREADY_APPROVED":    return "You're already approved.";
    case "INVALID_ROLE":        return "Please select a valid role.";
    default:                    return null;
  }
}

export default function ApplyRepPage() {
  const router = useRouter();

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const [faculties, setFaculties] = useState<FacultyRow[]>([]);
  const [depts, setDepts]         = useState<DeptRow[]>([]);

  const [facultyId, setFacultyId] = useState("");
  const [deptId, setDeptId]       = useState("");
  const [role, setRole]           = useState<Role>("course_rep");
  const [levels, setLevels]       = useState<number[]>([100]);
  const [note, setNote]           = useState("");

  const [meStatus, setMeStatus]               = useState<MeStatus>("not_applied");
  const [meRole, setMeRole]                   = useState<Role | null>(null);
  const [meScope, setMeScope]                 = useState<{ faculty_id: string | null; department_id: string | null; levels: number[] | null; all_levels?: boolean } | null>(null);
  const [meDecisionReason, setMeDecisionReason] = useState<string | null>(null);

  const deptsForFaculty = useMemo(
    () => (!facultyId ? depts : depts.filter((d) => d.faculty_id === facultyId)),
    [depts, facultyId]
  );

  const facultyName = useMemo(() => faculties.find((x) => x.id === facultyId)?.name ?? "", [faculties, facultyId]);
  const deptName    = useMemo(() => depts.find((x) => x.id === deptId)?.name ?? "",       [depts, deptId]);

  const selectedLevelsLabel = useMemo(() => {
    if (role === "dept_librarian") return "All levels";
    const ls = levels.map((x) => `${x}L`).join(", ");
    return ls || "None selected";
  }, [role, levels]);

  const canSubmit = useMemo(() => {
    if (!facultyId || !deptId) return false;
    if (role === "course_rep" && levels.length === 0) return false;
    return true;
  }, [facultyId, deptId, role, levels]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) { router.replace("/login?next=%2Fstudy%2Fapply-rep"); return; }

        const [facRes, depRes, meRes] = await Promise.all([
          supabase.from("study_faculties").select("id,name,sort_order").eq("is_active", true).order("sort_order"),
          supabase.from("study_departments").select("id,name,faculty_id,sort_order").eq("is_active", true).order("sort_order"),
          fetch("/api/study/rep-applications/me", { cache: "no-store" }).then((r) => r.json()),
        ]);

        if (!mounted) return;
        setFaculties((facRes.data as any) ?? []);
        setDepts((depRes.data as any) ?? []);

        if (meRes?.ok) {
          setMeStatus(meRes.status ?? "not_applied");
          setMeRole(meRes.role ?? null);
          setMeScope(meRes.scope ?? null);
          setMeDecisionReason(meRes?.application?.decision_reason ?? meRes?.application?.note ?? null);
          if (meRes?.scope?.faculty_id)    setFacultyId(meRes.scope.faculty_id);
          if (meRes?.scope?.department_id) setDeptId(meRes.scope.department_id);
          if (meRes?.role === "dept_librarian") setRole("dept_librarian");
          if (meRes?.role === "course_rep")     setRole("course_rep");
          const existingLevels = Array.isArray(meRes?.scope?.levels) && meRes.scope.levels.length ? meRes.scope.levels : null;
          if (existingLevels) setLevels(existingLevels);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  function selectLevel(l: number) {
    setLevels([l]);
  }

  async function submit() {
    setError(null);
    if (!facultyId) { setError("Select your faculty."); return; }
    if (!deptId)    { setError("Select your department."); return; }
    if (role === "course_rep" && levels.length === 0) { setError("Select at least one level."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/study/rep-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          faculty_id:    facultyId || null,
          department_id: deptId,
          role,
          levels: role === "course_rep" ? levels : null,
          note:   note || null,
        }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(codeToMessage(json?.code) || json?.message || json?.error || "Request failed");

      const me = await fetch("/api/study/rep-applications/me", { cache: "no-store" }).then((r) => r.json());
      if (me?.ok) {
        setMeStatus(me.status ?? "pending");
        setMeRole(me.role ?? role);
        setMeScope(me.scope ?? null);
        setMeDecisionReason(me?.application?.decision_reason ?? null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Status screens ──────────────────────────────────────────────────────────
  if (meStatus === "pending") {
    return <StatusScreen status="pending" meRole={meRole} meScope={meScope} />;
  }
  if (meStatus === "approved") {
    return <StatusScreen status="approved" meRole={meRole} meScope={meScope} />;
  }
  if (meStatus === "rejected") {
    return (
      <StatusScreen
        status="rejected"
        meRole={meRole}
        meScope={meScope}
        decisionReason={meDecisionReason}
        onReapply={() => setMeStatus("not_applied")}
      />
    );
  }

  // ── Application form ────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28 md:pb-8">
      {/* Back */}
      <Link
        href="/study"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Study Hub
      </Link>

      {/* Page hero */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#5B35D5]/10">
            <ShieldCheck className="h-5 w-5 text-[#5B35D5]" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">Apply to contribute</h1>
            <p className="text-xs text-muted-foreground">Course reps & librarians can upload materials for their dept.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { step: "1", label: "Apply" },
            { step: "2", label: "Review" },
            { step: "3", label: "Upload" },
          ].map(({ step, label }) => (
            <div key={step} className="rounded-2xl border border-border bg-secondary/30 px-2 py-2">
              <p className="text-xs font-extrabold text-[#5B35D5]">{step}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Role selection */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-extrabold text-foreground">What's your role?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Choose the role that matches your appointment.</p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <RoleCard
            selected={role === "course_rep"}
            onClick={() => setRole("course_rep")}
            icon={<GraduationCap className="h-5 w-5" />}
            title="Course Rep"
            description="Upload for your specific level(s)"
          />
          <RoleCard
            selected={role === "dept_librarian"}
            onClick={() => setRole("dept_librarian")}
            icon={<Building2 className="h-5 w-5" />}
            title="Dept Librarian"
            description="Upload for all levels in your dept"
          />
        </div>
      </section>

      {/* Scope */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-extrabold text-foreground">Your scope</p>
        <p className="mt-0.5 text-xs text-muted-foreground">We'll restrict your uploads to this area.</p>

        <div className="mt-4 space-y-3">
          {/* Faculty */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Faculty</label>
            <select
              value={facultyId}
              onChange={(e) => { setFacultyId(e.target.value); setDeptId(""); }}
              className={cn(
                "w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-[#5B35D5]/50 appearance-none"
              )}
            >
              <option value="">Select faculty</option>
              {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Department</label>
            <select
              value={deptId}
              disabled={!facultyId}
              onChange={(e) => setDeptId(e.target.value)}
              className={cn(
                "w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-[#5B35D5]/50 appearance-none",
                !facultyId && "opacity-50 cursor-not-allowed"
              )}
            >
              <option value="">{facultyId ? "Select department" : "Select faculty first"}</option>
              {deptsForFaculty.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Level */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Level scope</label>
            {role === "dept_librarian" ? (
              <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">All levels</p>
                <p className="text-xs text-muted-foreground mt-0.5">Librarians cover every level in the department.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => {
                  const active = levels.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => selectLevel(l)}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-xs font-extrabold border transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5]/50 focus-visible:ring-offset-2",
                        active
                          ? "bg-[#5B35D5] border-[#5B35D5] text-white"
                          : "bg-background border-border text-muted-foreground hover:border-[#5B35D5]/40 hover:text-foreground"
                      )}
                    >
                      {l}L
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Note */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-extrabold text-foreground">Verification note <span className="text-muted-foreground font-semibold">(optional)</span></p>
        <p className="mt-0.5 text-xs text-muted-foreground">Mention any proof — appointment letter, screenshot, etc. Helps speed up review.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder='e.g. "Appointed course rep by HOD on 15 Jan. Screenshot available."'
          className={cn(
            "mt-3 w-full resize-none rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-[#5B35D5]/50 placeholder:text-muted-foreground/60"
          )}
        />
      </section>

      {/* Review strip */}
      {(facultyName || deptName) && (
        <div className="rounded-2xl border border-[#5B35D5]/20 bg-[#5B35D5]/5 px-4 py-3 text-xs text-foreground">
          <p className="font-extrabold text-[#5B35D5] mb-1">Reviewing your application</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            <span>Role</span><span className="font-semibold text-foreground text-right">{role === "course_rep" ? "Course Rep" : "Dept Librarian"}</span>
            {facultyName && <><span>Faculty</span><span className="font-semibold text-foreground text-right truncate">{facultyName}</span></>}
            {deptName    && <><span>Department</span><span className="font-semibold text-foreground text-right truncate">{deptName}</span></>}
            <span>Level(s)</span><span className="font-semibold text-foreground text-right">{selectedLevelsLabel}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit || submitting}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5",
          "text-sm font-extrabold text-white transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2",
          canSubmit && !submitting
            ? "bg-[#5B35D5] hover:bg-[#4526B8] active:scale-[0.98]"
            : "bg-[#5B35D5]/40 cursor-not-allowed"
        )}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {submitting ? "Submitting…" : "Submit application"}
      </button>

      {/* How it works */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-extrabold text-foreground">How it works</p>
        </div>
        <ol className="space-y-3">
          {[
            { title: "Submit your application", body: "Fill in your role, department, and level. Add proof for faster approval." },
            { title: "Moderator review", body: "A study admin reviews your request, usually within 2–3 working days." },
            { title: "Upload materials", body: "Once approved, the Upload tab unlocks. Materials go live after review." },
          ].map(({ title, body }, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5B35D5]/10 text-[10px] font-extrabold text-[#5B35D5]">
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-extrabold text-foreground">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ── Status screen ──────────────────────────────────────────────────────────────
function StatusScreen({
  status,
  meRole,
  meScope,
  decisionReason,
  onReapply,
}: {
  status: "pending" | "approved" | "rejected";
  meRole: Role | null;
  meScope: { faculty_id: string | null; department_id: string | null; levels: number[] | null; all_levels?: boolean } | null;
  decisionReason?: string | null;
  onReapply?: () => void;
}) {
  const scopeLine = meRole === "dept_librarian"
    ? "All levels"
    : Array.isArray(meScope?.levels) && meScope.levels.length
      ? meScope.levels.map((x) => `${x}L`).join(", ")
      : null;

  const roleLabel = meRole === "dept_librarian" ? "Departmental Librarian" : "Course Rep";

  const config = {
    pending: {
      icon: <Clock className="h-6 w-6 text-amber-600" />,
      bg: "bg-amber-50 border-amber-200",
      iconBg: "bg-amber-100",
      title: "Application under review",
      body: "Your application is with a study admin. Reviews usually take 2–3 working days. You'll get a notification when there's an update.",
      badge: <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-700">Pending</span>,
    },
    approved: {
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />,
      bg: "bg-emerald-50 border-emerald-200",
      iconBg: "bg-emerald-100",
      title: "You're approved!",
      body: "You can now upload study materials within your assigned scope. All uploads are reviewed before going live.",
      badge: <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-700">Approved</span>,
    },
    rejected: {
      icon: <AlertTriangle className="h-6 w-6 text-rose-600" />,
      bg: "bg-rose-50 border-rose-200",
      iconBg: "bg-rose-100",
      title: "Application not approved",
      body: "Your application wasn't approved this time. You can update your details and reapply. Adding proof of appointment helps.",
      badge: <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-extrabold text-rose-700">Not approved</span>,
    },
  }[status];

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28 md:pb-8">
      <Link
        href="/study"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Study Hub
      </Link>

      <div className={cn("rounded-3xl border p-5 shadow-sm", config.bg)}>
        <div className="flex items-start gap-4">
          <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", config.iconBg)}>
            {config.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-extrabold text-foreground">{config.title}</p>
              {config.badge}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{config.body}</p>
          </div>
        </div>

        {/* Scope summary */}
        {(meRole || scopeLine) && (
          <div className="mt-4 rounded-2xl border border-white/60 bg-white/50 p-3 space-y-1.5">
            {meRole && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Role</span>
                <span className="font-extrabold text-foreground">{roleLabel}</span>
              </div>
            )}
            {scopeLine && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Level(s)</span>
                <span className="font-extrabold text-foreground">{scopeLine}</span>
              </div>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {status === "rejected" && decisionReason && (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-white/50 px-3 py-2.5 text-xs text-rose-800">
            <span className="font-extrabold">Reason: </span>{decisionReason}
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2">
        {status === "approved" && (
          <Link
            href="/study/materials/upload"
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl bg-[#5B35D5] px-4 py-3.5",
              "text-sm font-extrabold text-white hover:bg-[#4526B8] active:scale-[0.98] transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
            )}
          >
            <Upload className="h-4 w-4" /> Upload materials
          </Link>
        )}
        {status === "rejected" && onReapply && (
          <button
            type="button"
            onClick={onReapply}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl bg-[#5B35D5] px-4 py-3.5",
              "text-sm font-extrabold text-white hover:bg-[#4526B8] active:scale-[0.98] transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
            )}
          >
            Apply again <ArrowRight className="h-4 w-4" />
          </button>
        )}
        <Link
          href="/study"
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3",
            "text-sm font-semibold text-foreground hover:bg-secondary/40 transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          Back to Study Hub
        </Link>
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────
function RoleCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-3.5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5]/50 focus-visible:ring-offset-2",
        selected
          ? "border-[#5B35D5] bg-[#5B35D5]/5"
          : "border-border bg-background hover:bg-secondary/40"
      )}
    >
      <div className={cn(
        "grid h-8 w-8 place-items-center rounded-xl mb-2",
        selected ? "bg-[#5B35D5]/10 text-[#5B35D5]" : "bg-secondary text-muted-foreground"
      )}>
        {icon}
      </div>
      <p className={cn("text-xs font-extrabold", selected ? "text-[#5B35D5]" : "text-foreground")}>{title}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">{description}</p>
    </button>
  );
}
