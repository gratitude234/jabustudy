"use client";
// app/study/apply-rep/page.tsx

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  GraduationCap,
  Clock,
  Upload,
  ChevronLeft,
  Camera,
  X,
} from "lucide-react";

type FacultyRow = { id: string; name: string; sort_order?: number | null };
type DeptRow    = { id: string; name: string; faculty_id: string; sort_order?: number | null };
type MeStatus   = "not_applied" | "pending" | "approved" | "rejected";

const LEVELS = [100, 200, 300, 400, 500, 600];

function codeToMessage(code?: string) {
  switch (code) {
    case "NO_SESSION":         return "Please log in to continue.";
    case "MISSING_DEPARTMENT": return "Select your department to continue.";
    case "LEVELS_REQUIRED":    return "Select at least one level.";
    case "ALREADY_PENDING":    return "You already have a pending application.";
    case "ALREADY_APPROVED":   return "You're already approved.";
    case "INVALID_ROLE":       return "Invalid role.";
    default:                   return null;
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
  const [levels, setLevels]       = useState<number[]>([100]);
  const [note, setNote]           = useState("");

  // Photo
  const [photoUrl, setPhotoUrl]         = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError]     = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing application state
  const [meStatus, setMeStatus]                   = useState<MeStatus>("not_applied");
  const [meScope, setMeScope]                     = useState<{ faculty_id: string | null; department_id: string | null; levels: number[] | null } | null>(null);
  const [meDecisionReason, setMeDecisionReason]   = useState<string | null>(null);

  const deptsForFaculty = useMemo(
    () => (!facultyId ? depts : depts.filter((d) => d.faculty_id === facultyId)),
    [depts, facultyId]
  );

  const facultyName = useMemo(() => faculties.find((x) => x.id === facultyId)?.name ?? "", [faculties, facultyId]);
  const deptName    = useMemo(() => depts.find((x) => x.id === deptId)?.name ?? "",       [depts, deptId]);
  const levelsLabel = useMemo(() => levels.map((x) => `${x}L`).join(", ") || "None", [levels]);

  const canSubmit = useMemo(
    () => !!(facultyId && deptId && levels.length > 0),
    [facultyId, deptId, levels]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) { router.replace("/login?next=%2Fstudy%2Fapply-rep"); return; }

        const [facRes, depRes, meRes, prefsRes] = await Promise.all([
          supabase.from("study_faculties").select("id,name,sort_order").eq("is_active", true).order("sort_order"),
          supabase.from("study_departments").select("id,name,faculty_id,sort_order").eq("is_active", true).order("sort_order"),
          fetch("/api/study/rep-applications/me", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/study/personalization", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        ]);

        if (!mounted) return;
        setFaculties((facRes.data as any) ?? []);
        setDepts((depRes.data as any) ?? []);

        if (meRes?.ok) {
          setMeStatus(meRes.status ?? "not_applied");
          setMeScope(meRes.scope ?? null);
          setMeDecisionReason(meRes?.application?.decision_reason ?? meRes?.application?.note ?? null);

          if (meRes?.scope?.faculty_id)    setFacultyId(meRes.scope.faculty_id);
          if (meRes?.scope?.department_id) setDeptId(meRes.scope.department_id);
          const existingLevels = Array.isArray(meRes?.scope?.levels) && meRes.scope.levels.length ? meRes.scope.levels : null;
          if (existingLevels) setLevels(existingLevels);

          // If no existing application scope, seed from onboarding prefs
          if (!meRes?.scope && prefsRes?.ok && prefsRes.prefs) {
            const p = prefsRes.prefs;
            if (p.faculty_id)    setFacultyId(p.faculty_id);
            if (p.department_id) setDeptId(p.department_id);
            if (p.level)         setLevels([p.level]);
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);

    const fd = new FormData();
    fd.append("photo", file);

    try {
      const res = await fetch("/api/study/rep-applications/photo", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Upload failed.");
      setPhotoUrl(json.url);
    } catch (e: any) {
      setPhotoError(e.message ?? "Failed to upload photo.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function selectLevel(l: number) {
    setLevels([l]);
  }

  async function submit() {
    setError(null);
    if (!facultyId) { setError("Select your faculty."); return; }
    if (!deptId)    { setError("Select your department."); return; }
    if (levels.length === 0) { setError("Select your level."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/study/rep-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          faculty_id:    facultyId || null,
          department_id: deptId,
          role:          "course_rep",
          levels,
          note:          note || null,
          photo_url:     photoUrl || null,
        }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(codeToMessage(json?.code) || json?.message || json?.error || "Request failed");

      const me = await fetch("/api/study/rep-applications/me", { cache: "no-store" }).then((r) => r.json());
      if (me?.ok) {
        setMeStatus(me.status ?? "pending");
        setMeScope(me.scope ?? null);
        setMeDecisionReason(me?.application?.decision_reason ?? null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Status screens ───────────────────────────────────────────────────────────
  if (meStatus === "pending")  return <StatusScreen status="pending"  meScope={meScope} />;
  if (meStatus === "approved") return <StatusScreen status="approved" meScope={meScope} />;
  if (meStatus === "rejected") return (
    <StatusScreen
      status="rejected"
      meScope={meScope}
      decisionReason={meDecisionReason}
      onReapply={() => setMeStatus("not_applied")}
    />
  );

  // ── Application form ─────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28 md:pb-8">
      {/* Back */}
      <Link
        href="/study"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Study Hub
      </Link>

      {/* Hero */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#5B35D5]/10">
            <GraduationCap className="h-5 w-5 text-[#5B35D5]" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">Apply as Course Rep</h1>
            <p className="text-xs text-muted-foreground">Course reps can upload and manage materials for their level.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { step: "1", label: "Apply" },
            { step: "2", label: "Review" },
            { step: "3", label: "Set up courses" },
          ].map(({ step, label }) => (
            <div key={step} className="rounded-2xl border border-border bg-secondary/30 px-2 py-2">
              <p className="text-xs font-extrabold text-[#5B35D5]">{step}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Photo */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-extrabold text-foreground">Your photo</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Helps the admin verify your identity. JPEG, PNG, WebP — max 2 MB.</p>

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-border bg-secondary/40 transition hover:border-[#5B35D5]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5]"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="Your photo" className="h-full w-full object-cover" />
            ) : (
              <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              </div>
            )}
          </button>

          <div className="min-w-0">
            {photoUrl ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600">Photo uploaded</span>
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-xs font-semibold text-foreground">
                {uploadingPhoto ? "Uploading…" : "Click to upload"}
              </p>
            )}
            {photoError && <p className="mt-1 text-xs text-destructive">{photoError}</p>}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </section>

      {/* Scope */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-extrabold text-foreground">Your scope</p>
        <p className="mt-0.5 text-xs text-muted-foreground">We'll restrict your uploads to this area.</p>

        <div className="mt-4 space-y-3">
          {/* Faculty */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Faculty</label>
            <select
              value={facultyId}
              onChange={(e) => { setFacultyId(e.target.value); setDeptId(""); }}
              className={cn(
                "w-full appearance-none rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-[#5B35D5]/50"
              )}
            >
              <option value="">Select faculty</option>
              {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Department</label>
            <select
              value={deptId}
              disabled={!facultyId}
              onChange={(e) => setDeptId(e.target.value)}
              className={cn(
                "w-full appearance-none rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-[#5B35D5]/50",
                !facultyId && "cursor-not-allowed opacity-50"
              )}
            >
              <option value="">{facultyId ? "Select department" : "Select faculty first"}</option>
              {deptsForFaculty.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Level — single-select (course rep covers one level) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Your level</label>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => {
                const active = levels.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => selectLevel(l)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-xs font-extrabold transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5]/50 focus-visible:ring-offset-2",
                      active
                        ? "border-[#5B35D5] bg-[#5B35D5] text-white"
                        : "border-border bg-background text-muted-foreground hover:border-[#5B35D5]/40 hover:text-foreground"
                    )}
                  >
                    {l}L
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Note */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-extrabold text-foreground">
          Verification note <span className="font-semibold text-muted-foreground">(optional)</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mention any proof — appointment letter, screenshot, etc. Helps speed up review.
        </p>
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
          <p className="mb-1 font-extrabold text-[#5B35D5]">Reviewing your application</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            {facultyName && <><span>Faculty</span><span className="truncate text-right font-semibold text-foreground">{facultyName}</span></>}
            {deptName    && <><span>Department</span><span className="truncate text-right font-semibold text-foreground">{deptName}</span></>}
            <span>Level</span><span className="text-right font-semibold text-foreground">{levelsLabel}</span>
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
        disabled={!canSubmit || submitting || uploadingPhoto}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5",
          "text-sm font-extrabold text-white transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2",
          canSubmit && !submitting && !uploadingPhoto
            ? "bg-[#5B35D5] hover:bg-[#4526B8] active:scale-[0.98]"
            : "cursor-not-allowed bg-[#5B35D5]/40"
        )}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {submitting ? "Submitting…" : "Submit application"}
      </button>

      {/* How it works */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-extrabold text-foreground">How it works</p>
        </div>
        <ol className="space-y-3">
          {[
            { title: "Submit your application", body: "Fill in your department and level. Adding a photo and a note speeds up approval." },
            { title: "Moderator review", body: "A study admin reviews your request, usually within 2–3 working days." },
            { title: "Set up your department's courses", body: "Once approved, you'll add all courses your department offers before classmates can upload materials." },
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
  meScope,
  decisionReason,
  onReapply,
}: {
  status: "pending" | "approved" | "rejected";
  meScope: { faculty_id: string | null; department_id: string | null; levels: number[] | null } | null;
  decisionReason?: string | null;
  onReapply?: () => void;
}) {
  const scopeLine = Array.isArray(meScope?.levels) && meScope.levels.length
    ? meScope.levels.map((x) => `${x}L`).join(", ")
    : null;

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
      body: "Your next step is to add all the courses your department offers so your classmates can start uploading materials.",
      badge: <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-700">Approved</span>,
    },
    rejected: {
      icon: <AlertTriangle className="h-6 w-6 text-rose-600" />,
      bg: "bg-rose-50 border-rose-200",
      iconBg: "bg-rose-100",
      title: "Application not approved",
      body: "Your application wasn't approved this time. You can update your details and reapply. Adding a photo and a note helps.",
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-extrabold text-foreground">{config.title}</p>
              {config.badge}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{config.body}</p>
          </div>
        </div>

        {scopeLine && (
          <div className="mt-4 rounded-2xl border border-white/60 bg-white/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Level(s)</span>
              <span className="font-extrabold text-foreground">{scopeLine}</span>
            </div>
          </div>
        )}

        {status === "rejected" && decisionReason && (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-white/50 px-3 py-2.5 text-xs text-rose-800">
            <span className="font-extrabold">Reason: </span>{decisionReason}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {status === "approved" && (
          <Link
            href="/study/rep-setup"
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl bg-[#5B35D5] px-4 py-3.5",
              "text-sm font-extrabold text-white hover:bg-[#4526B8] active:scale-[0.98] transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
            )}
          >
            <Upload className="h-4 w-4" /> Set up department courses
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
