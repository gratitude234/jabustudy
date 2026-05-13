"use client";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, PageHeader } from "../../_components/StudyUI";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  GraduationCap,
  BookOpen,
  X,
} from "lucide-react";

type ExistingStatus = "none" | "active" | "inactive";

const LEVELS = ["100", "200", "300", "400", "500", "600"] as const;

// ─── small UI helpers ────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background px-3 py-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-extrabold text-foreground">{value || "—"}</span>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}

function InlineSuccess({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function TutorApplyPage() {
  const router = useRouter();

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Existing tutor record for this user (if any)
  const [existingStatus, setExistingStatus] = useState<ExistingStatus>("none");
  const [existingId, setExistingId] = useState<string | null>(null);

  // Pre-filled from auth
  const [authEmail, setAuthEmail] = useState("");

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [coursesRaw, setCoursesRaw] = useState(""); // comma-separated
  const [bio, setBio] = useState("");

  const isLocked = existingStatus === "active";

  // Parse courses input into a clean array
  const coursesArray = useMemo(() => {
    return coursesRaw
      .split(/[,，\n]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [coursesRaw]);

  // ── load auth + check for existing tutor record ───────────────────────────
  useEffect(() => {
    let mounted = true;

    (async () => {
      setPageLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user ?? null;

      if (!user) {
        router.replace("/login?next=%2Fstudy%2Ftutors%2Fapply");
        return;
      }

      if (mounted) setAuthEmail(user.email ?? "");

      // Check if this user already has a tutor record
      const { data: existing } = await supabase
        .from("study_tutors")
        .select("id,full_name,phone,whatsapp,faculty,department,level,courses,bio,active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (existing?.id) {
        setExistingId(existing.id);
        setExistingStatus(existing.active ? "active" : "inactive");

        // Pre-fill all fields so they can review/update
        setFullName(existing.full_name ?? "");
        setPhone(existing.phone ?? "");
        setWhatsapp(existing.whatsapp ?? "");
        setFaculty(existing.faculty ?? "");
        setDepartment(existing.department ?? "");
        setLevel(existing.level ?? "");
        setCoursesRaw(
          Array.isArray(existing.courses)
            ? existing.courses.join(", ")
            : (existing.courses ?? "")
        );
        setBio(existing.bio ?? "");
      }

      setPageLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // ── validation ────────────────────────────────────────────────────────────
  const canSubmit = useMemo(() => {
    if (isLocked) return false;
    if (!fullName.trim()) return false;
    if (!department.trim()) return false;
    if (coursesArray.length === 0) return false;
    return true;
  }, [isLocked, fullName, department, coursesArray]);

  // ── submit ────────────────────────────────────────────────────────────────
  async function submit() {
    setError(null);

    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (!department.trim()) { setError("Department is required."); return; }
    if (coursesArray.length === 0) { setError("Add at least one course code."); return; }

    setSubmitting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user ?? null;
      if (!user) throw new Error("Not logged in.");

      const payload = {
        user_id: user.id,
        full_name: fullName.trim(),
        email: authEmail || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        faculty: faculty.trim() || null,
        department: department.trim(),
        level: level || null,
        courses: coursesArray,
        bio: bio.trim() || null,
        active: true,
        verified: false,
      };

      let dbError;

      if (existingId) {
        // Update existing record
        const res = await supabase
          .from("study_tutors")
          .update(payload as any)
          .eq("id", existingId);
        dbError = res.error;
      } else {
        // Insert new record
        const res = await supabase
          .from("study_tutors")
          .insert(payload as any);
        dbError = res.error;
      }

      if (dbError) throw new Error(dbError.message);

      setSuccess(true);
      setExistingStatus("active");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── status banner ─────────────────────────────────────────────────────────
  const statusBanner = (() => {
    if (pageLoading) return null;

    if (success) {
      return (
        <Card className="rounded-3xl">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <p className="font-semibold text-emerald-900">Profile submitted!</p>
              <p className="mt-1 text-sm text-emerald-800">
                You're now listed in the tutor directory. An admin will review and verify your
                profile soon. Students can already find and contact you.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/study/tutors"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2",
                    "text-sm font-semibold text-foreground hover:opacity-90"
                  )}
                >
                  View tutor directory <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/study"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2",
                    "text-sm font-semibold text-foreground hover:bg-secondary/50"
                  )}
                >
                  Back to Study
                </Link>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    if (existingStatus === "active" && !success) {
      return (
        <Card className="rounded-3xl">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/30 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">You're already listed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your tutor profile is active. You can update your details below and resubmit.
              </p>
              <div className="mt-3">
                <Link
                  href="/study/tutors"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2",
                    "text-sm font-semibold text-foreground hover:bg-secondary/50"
                  )}
                >
                  View directory <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    return null;
  })();

  // ── loading skeleton ──────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="space-y-4 pb-28 md:pb-6">
        <PageHeader
          title="Become a tutor"
          subtitle="List yourself in the JABU tutor directory so students can find and contact you."
        />
        <Card className="rounded-3xl animate-pulse">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="mt-3 h-4 w-full rounded bg-muted" />
          <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="h-10 rounded-2xl bg-muted" />
            <div className="h-10 rounded-2xl bg-muted" />
          </div>
        </Card>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <PageHeader
        title="Become a tutor"
        subtitle="List yourself in the JABU tutor directory so students can find and contact you."
        right={
          <Link
            href="/study/tutors"
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2",
              "text-sm font-semibold text-foreground hover:bg-secondary/50"
            )}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      {/* How it works */}
      <Card className="rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary">
            <GraduationCap className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-foreground">How it works</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>→ Fill in your name, contact details, and the courses you teach.</li>
              <li>→ Your profile goes live immediately — students can WhatsApp or call you.</li>
              <li>→ An admin will review and add a <span className="font-semibold text-foreground">Verified</span> badge to trusted tutors.</li>
            </ul>
          </div>
        </div>
      </Card>

      {statusBanner}

      <div className="grid gap-4 md:grid-cols-5">
        {/* ── Form ── */}
        <Card className="rounded-3xl md:col-span-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary">
              <BookOpen className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-extrabold tracking-tight text-foreground">
                {existingStatus === "active" ? "Update your profile" : "Your tutor profile"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                All contact info is displayed publicly in the directory.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Full name */}
            <Field label="Full name" required>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Chidi Okonkwo"
                className={cn(
                  "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground",
                  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                )}
              />
            </Field>

            {/* Contact */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="WhatsApp number" hint="Students will use this to reach you.">
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="e.g. 08012345678"
                  type="tel"
                  className={cn(
                    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  )}
                />
              </Field>

              <Field label="Phone (optional)" hint="Alternative call number.">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  type="tel"
                  className={cn(
                    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  )}
                />
              </Field>
            </div>

            {/* Faculty + Department */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Faculty (optional)">
                <input
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  placeholder="e.g. Science & Technology"
                  className={cn(
                    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  )}
                />
              </Field>

              <Field label="Department" required>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className={cn(
                    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  )}
                />
              </Field>
            </div>

            {/* Level */}
            <Field label="Your level (optional)" hint="The level you're currently in.">
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel((prev) => (prev === l ? "" : l))}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      level === l
                        ? "border-border bg-secondary text-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    {l}L
                  </button>
                ))}
              </div>
            </Field>

            {/* Courses */}
            <Field
              label="Courses you teach"
              hint="Enter course codes separated by commas."
              required
            >
              <input
                value={coursesRaw}
                onChange={(e) => setCoursesRaw(e.target.value)}
                placeholder="e.g. CSC301, MTH201, GST101"
                className={cn(
                  "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground",
                  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                )}
              />
              {coursesArray.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {coursesArray.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground"
                    >
                      {c}
                      <button
                        type="button"
                        aria-label={`Remove ${c}`}
                        onClick={() =>
                          setCoursesRaw(
                            coursesArray.filter((x) => x !== c).join(", ")
                          )
                        }
                        className="rounded-full hover:text-rose-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </Field>

            {/* Bio */}
            <Field
              label="Short bio (optional)"
              hint="Briefly describe your teaching style, experience, or availability."
            >
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="e.g. Final year CSC student with 2 years tutoring experience. Available weekday evenings."
                className={cn(
                  "w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground",
                  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                )}
              />
            </Field>
          </div>

          {error ? <InlineError message={error} /> : null}

          {/* Actions */}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/study/tutors"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2",
                "text-sm font-semibold text-foreground hover:bg-secondary/50"
              )}
            >
              Cancel
            </Link>

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || submitting}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-2",
                "text-sm font-extrabold text-foreground hover:opacity-90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                (!canSubmit || submitting) && "opacity-60"
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {existingStatus === "active" ? "Update profile" : "Submit profile"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </Card>

        {/* ── Summary sidebar ── */}
        <Card className="rounded-3xl md:col-span-2">
          <p className="text-sm font-extrabold text-foreground">Preview</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This is how your profile will appear in the directory.
          </p>

          <div className="mt-3 space-y-2">
            <SummaryRow label="Name" value={fullName} />
            <SummaryRow label="WhatsApp" value={whatsapp} />
            <SummaryRow label="Department" value={department} />
            <SummaryRow label="Level" value={level ? `${level}L` : ""} />
            <SummaryRow
              label="Courses"
              value={coursesArray.length ? coursesArray.join(", ") : ""}
            />
          </div>

          {bio.trim() ? (
            <div className="mt-3 rounded-2xl border border-border bg-background p-3">
              <p className="text-xs font-semibold text-muted-foreground">Bio</p>
              <p className="mt-1 text-sm text-foreground line-clamp-4">{bio}</p>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Verification</p>
            <p className="mt-1">
              Your profile is listed immediately. A <span className="font-semibold">Verified</span> badge
              is added after admin review — this increases student trust.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}