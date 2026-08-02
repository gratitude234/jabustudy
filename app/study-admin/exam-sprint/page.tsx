"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, CircleDollarSign, EyeOff, FileQuestion, GraduationCap, Loader2, Plus, RefreshCw, Rocket, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ExamSet = {
  id: string;
  title: string;
  courseCode: string;
  published: boolean;
  questions: number;
  verified: number;
  timeLimitMinutes: number;
  attemptQuestionCount: number;
  diagnosticQuestionCount: number;
  diagnosticStarts: number;
  diagnosticCompletions: number;
  paidAttempts: number;
  paidCompletions: number;
  completed: number;
  learners: number;
};
type Course = { code: string; slug: string; title: string; examAt: string; priority: boolean; sets: ExamSet[] };
type Snapshot = {
  ok: boolean;
  minimumQuestions: number;
  courses: Course[];
  metrics: { diagnosticStarts: number; diagnosticCompletions: number; paidAttempts: number; learners: number; conversions: number; revenueNaira: number };
  message?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to continue.");
  return { Authorization: `Bearer ${token}` };
}

export default function ExamSprintAdminPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [courseCode, setCourseCode] = useState("GNS 121");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/study-admin/exam-sprint", { cache: "no-store", headers: await authHeaders() });
      const data = await response.json().catch(() => null) as Snapshot | null;
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Could not load Exam Sprint.");
      setSnapshot(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Exam Sprint.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createBank() {
    setBusy("create");
    setError(null);
    try {
      const response = await fetch("/api/study-admin/exam-sprint", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...await authHeaders() },
        body: JSON.stringify({ courseCode }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; setId?: string; message?: string } | null;
      if (!response.ok || !data?.ok || !data.setId) throw new Error(data?.message || "Could not create the bank.");
      router.push(`/study-admin/exam-sprint/${encodeURIComponent(data.setId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the bank.");
      setBusy(null);
    }
  }

  async function changePublication(set: ExamSet) {
    setBusy(set.id);
    setError(null);
    try {
      const response = await fetch(`/api/study-admin/exam-sprint/${encodeURIComponent(set.id)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...await authHeaders() },
        body: JSON.stringify({ action: set.published ? "unpublish" : "publish" }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; message?: string; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.message || data?.error || "Could not update publication.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update publication.");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !snapshot) return <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading Exam Sprint…</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Supplementary 2026</p><h1 className="mt-1 text-2xl font-extrabold">Exam Sprint control room</h1><p className="mt-1 text-sm text-muted-foreground">Build, verify and publish secure paid CBT banks.</p></div>
        <button onClick={() => { setLoading(true); setError(null); void load(); }} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh</button>
      </header>

      {error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-800" role="alert">{error}</div> : null}

      {snapshot ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Diagnostic starts", value: snapshot.metrics.diagnosticStarts, icon: FileQuestion },
              { label: "Diagnostic finishes", value: snapshot.metrics.diagnosticCompletions, icon: CheckCircle2 },
              { label: "Paid attempts", value: snapshot.metrics.paidAttempts, icon: GraduationCap },
              { label: "Unique learners", value: snapshot.metrics.learners, icon: Users },
              { label: "Plus conversions", value: snapshot.metrics.conversions, icon: Rocket },
              { label: "Attributed revenue", value: money(snapshot.metrics.revenueNaira), icon: CircleDollarSign },
            ].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-border bg-card p-4"><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p></div>)}
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="font-extrabold">Create a private exam bank</h2>
            <p className="mt-1 text-sm text-muted-foreground">The bank stays hidden until all {snapshot.minimumQuestions} questions are verified and a super admin publishes it.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <select value={courseCode} onChange={(event) => setCourseCode(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm font-bold">
                {snapshot.courses.map((course) => <option key={course.code} value={course.code}>{course.code} — {course.title}</option>)}
              </select>
              <button type="button" onClick={() => void createBank()} disabled={busy !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create bank</button>
            </div>
          </section>

          <section className="space-y-3">
            {snapshot.courses.map((course) => (
              <article key={course.code} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">{course.code}</span>{course.priority ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800">Initial launch</span> : null}</div><h2 className="mt-2 font-extrabold">{course.title}</h2></div><span className="text-xs font-semibold text-muted-foreground">{course.sets.length ? `${course.sets.length} bank${course.sets.length === 1 ? "" : "s"}` : "Coming soon"}</span></div>
                {course.sets.length ? <div className="mt-4 space-y-3">{course.sets.map((set) => {
                  const ready = set.questions >= snapshot.minimumQuestions && set.verified === set.questions;
                  return <div key={set.id} className="rounded-2xl border border-border bg-secondary/40 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-extrabold">{set.title}</p><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase", set.published ? "bg-emerald-100 text-emerald-800" : ready ? "bg-blue-100 text-blue-800" : "bg-zinc-200 text-zinc-700")}>{set.published ? "Published" : ready ? "Ready" : "Draft"}</span></div><p className="mt-1 text-xs text-muted-foreground">{set.questions}/{snapshot.minimumQuestions} questions · {set.verified} verified · diagnostics {set.diagnosticCompletions}/{set.diagnosticStarts} · paid mocks {set.paidCompletions}/{set.paidAttempts} · {set.learners} learners</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (set.verified / snapshot.minimumQuestions) * 100)}%` }} /></div></div><div className="flex shrink-0 flex-wrap gap-2"><Link href={`/study-admin/exam-sprint/${set.id}`} className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground no-underline">Edit & verify <ChevronRight className="h-3.5 w-3.5" /></Link><button type="button" onClick={() => void changePublication(set)} disabled={busy !== null || (!set.published && !ready)} className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black disabled:opacity-40", set.published ? "border border-amber-300 bg-amber-50 text-amber-900" : "bg-emerald-600 text-white")}>{busy === set.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : set.published ? <EyeOff className="h-3.5 w-3.5" /> : ready ? <Rocket className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{set.published ? "Unpublish" : "Publish"}</button></div></div></div>;
                })}</div> : <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-center text-xs font-semibold text-muted-foreground">No secure bank yet.</div>}
              </article>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
