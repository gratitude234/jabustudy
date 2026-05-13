"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  UserCheck2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type RepApplication = {
  id: string;
  user_id: string;
  created_at: string;
  status: "pending" | "approved" | "rejected";
  role: "course_rep" | "dept_librarian" | null;
  faculty_id: string | null;
  department_id: string | null;
  level: number | null;
  levels: number[] | null;
  all_levels?: boolean;
  note: string | null;
  admin_note: string | null;
  decision_reason?: string | null;
};

type ActiveRepRow = {
  user_id: string;
  department_id: string | null;
  role: "course_rep" | "dept_librarian" | null;
  levels: number[] | null;
};

type ApiResponse = {
  ok: boolean;
  items?: RepApplication[];
  data?: RepApplication[];
  error?: string;
};

type FacultyRow = { id: string; name: string };
type DeptRow = { id: string; name: string; faculty_id: string };

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

function daysWaiting(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function StatusPill({ status }: { status: RepApplication["status"] }) {
  const tone =
    status === "approved"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-400"
      : status === "rejected"
      ? "bg-red-50 text-red-700 border-red-200 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400"
      : "bg-amber-50 text-amber-900 border-amber-200 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300";
  const Icon = status === "approved" ? BadgeCheck : status === "rejected" ? Ban : Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", tone)}>
      <Icon className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

function RolePill({ role }: { role: RepApplication["role"] }) {
  if (!role) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border bg-zinc-50 px-2 py-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/30">
        Unknown role
      </span>
    );
  }
  const isLib = role === "dept_librarian";
  const Icon = isLib ? Building2 : GraduationCap;
  const label = isLib ? "Departmental Librarian" : "Course Rep";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-zinc-50 px-2 py-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/30">
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function LevelsPill({
  role,
  levels,
}: {
  role: RepApplication["role"];
  levels: number[] | null;
}) {
  const label =
    role === "dept_librarian"
      ? "All levels"
      : levels?.length
      ? levels.map((l) => `${l}L`).join(", ")
      : "—";
  return (
    <span className="rounded-full border bg-zinc-50 px-2 py-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/30">
      {label}
    </span>
  );
}

export default function StudyAdminRepApplicationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [q, setQ] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RepApplication[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeReps, setActiveReps] = useState<ActiveRepRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [engagementMap, setEngagementMap] = useState<Record<string, number>>({});
  const [faculties, setFaculties] = useState<FacultyRow[]>([]);
  const [departments, setDepartments] = useState<DeptRow[]>([]);

  async function getTokenOrRedirect() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent("/study-admin/rep-applications")}`);
      return null;
    }
    return token;
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;

      const url = new URL("/api/study-admin/rep-applications", window.location.origin);
      url.searchParams.set("status", status);
      if (q.trim()) url.searchParams.set("q", q.trim());

      const [res, repsRes] = await Promise.all([
        fetch(url.toString(), {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        supabase
          .from("study_reps")
          .select("user_id, department_id, role, levels")
          .eq("active", true),
      ]);

      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent("/study-admin/rep-applications")}`);
        return;
      }
      if (res.status === 403) {
        router.replace("/study");
        return;
      }

      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load applications");
      const list = json.items ?? json.data ?? [];
      setItems(list);
      if (!repsRes.error) {
        setActiveReps((repsRes.data as ActiveRepRow[] | null) ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [fRes, dRes] = await Promise.all([
          supabase.from("study_faculties").select("id,name").order("name"),
          supabase.from("study_departments").select("id,name,faculty_id").order("name"),
        ]);
        if (!mounted) return;
        if (!fRes.error) setFaculties((fRes.data as FacultyRow[] | null) ?? []);
        if (!dRes.error) setDepartments((dRes.data as DeptRow[] | null) ?? []);
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const count = useMemo(() => items.length, [items]);

  async function toggleExpanded(app: RepApplication) {
    const nextId = expandedId === app.id ? null : app.id;
    setExpandedId(nextId);
    if (!nextId || engagementMap[app.id] !== undefined) return;

    const { count } = await supabase
      .from("study_daily_activity")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", app.user_id)
      .eq("did_practice", true);

    setEngagementMap((prev) => ({
      ...prev,
      [app.id]: count ?? 0,
    }));
  }

  async function approve(id: string) {
    if (!id) {
      setErr("Missing application id. Please refresh the page and try again.");
      return;
    }
    setBusyId(id);
    setErr(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const appId = encodeURIComponent(String(id));
      const res = await fetch(`/api/study-admin/rep-applications/${appId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ admin_note: adminNote.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Approve failed");
      setAdminNote("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (!id) {
      setErr("Missing application id. Please refresh the page and try again.");
      return;
    }
    setBusyId(id);
    setErr(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const appId = encodeURIComponent(String(id));
      const res = await fetch(`/api/study-admin/rep-applications/${appId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          admin_note: adminNote.trim() || null,
          decision_reason: rejectReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Reject failed");
      setAdminNote("");
      setRejectId(null);
      setRejectReason("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Class rep applications
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Approve who can upload and moderate materials for a scope.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-2xl border bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-10 w-64 max-w-[70vw] rounded-2xl border bg-white pl-10 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="Search faculty, dept, note…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load();
                }}
              />
            </div>
            <button
              onClick={() => {
                void load();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-black px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400">
          {err}
        </div>
      ) : null}

      <div className="rounded-3xl border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{count}</span> application(s)
          </p>
          <div className="inline-flex items-center gap-2 rounded-2xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
            <UserCheck2 className="h-4 w-4" />
            Rep Apps
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-3xl border bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Optional admin note</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Saved on the application when you approve or reject.
            </div>
            <input
              className="mt-3 h-11 w-full rounded-2xl border bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="e.g. Approved (verified class rep)"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="rounded-3xl border p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              No applications yet.
            </div>
          ) : (
            items.map((it) => {
              const waitDays = daysWaiting(it.created_at);
              const deptHasRep = activeReps.some(
                (r) => r.department_id === it.department_id && r.user_id !== it.user_id
              );
              const isExpanded = expandedId === it.id;

              return (
                <div key={it.id} className="rounded-3xl border p-4 dark:border-zinc-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={it.status} />
                        <RolePill role={it.role} />
                        <LevelsPill
                          role={it.role}
                          levels={it.levels ?? (typeof it.level === "number" ? [it.level] : null)}
                        />
                        <span className="rounded-full border bg-zinc-50 px-2 py-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/30">
                          {departments.find((d) => d.id === it.department_id)?.name ||
                            (it.department_id ? "Department" : "—")}
                        </span>
                        <span className="rounded-full border bg-zinc-50 px-2 py-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/30">
                          {faculties.find((f) => f.id === it.faculty_id)?.name ||
                            (it.faculty_id ? "Faculty" : "—")}
                        </span>
                        {deptHasRep ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50/80 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3" />
                            Dept has rep
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Application
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <span>Submitted {formatDate(it.created_at)}</span>
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            waitDays >= 7
                              ? "text-rose-700 dark:text-rose-400"
                              : waitDays >= 3
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {waitDays === 0 ? "Today" : `${waitDays}d ago`}
                        </span>
                      </div>
                      {it.note ? (
                        <div className="mt-3 text-sm text-zinc-900 dark:text-zinc-100">“{it.note}”</div>
                      ) : null}
                      {it.admin_note ? (
                        <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                          Admin note: {it.admin_note}
                        </div>
                      ) : null}
                      {it.decision_reason ? (
                        <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                          Decision reason: {it.decision_reason}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          void toggleExpanded(it);
                        }}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 transition hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            Hide context
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            Show context
                          </>
                        )}
                      </button>
                    </div>

                    {it.status === "pending" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            void approve(it.id);
                          }}
                          disabled={busyId === it.id}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {busyId === it.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectId(it.id);
                            setRejectReason("");
                          }}
                          disabled={busyId === it.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400"
                        >
                          {busyId === it.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {isExpanded ? (
                    <div className="mt-4 rounded-3xl border bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>{engagementMap[it.id] ?? 0} practice days on platform</span>
                        <span>
                          {deptHasRep
                            ? "This department already has an active rep."
                            : "No active rep found for this department."}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {rejectId === it.id ? (
                    <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-950/20">
                      <div className="flex items-start gap-2">
                        <MessageSquareWarning className="mt-0.5 h-4 w-4 text-red-700 dark:text-red-400" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-red-900 dark:text-red-300">
                            Rejection reason (required)
                          </div>
                          <div className="mt-1 text-xs text-red-800/80 dark:text-red-400">
                            This will be shown to the applicant.
                          </div>
                        </div>
                      </div>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                        className="mt-3 w-full resize-none rounded-2xl border bg-white px-3 py-2 text-sm outline-none dark:border-red-800/40 dark:bg-zinc-950 dark:text-zinc-100"
                        placeholder="e.g. Please provide proof of appointment and confirm your department."
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            void reject(it.id);
                          }}
                          disabled={busyId === it.id || !rejectReason.trim()}
                          className="inline-flex items-center gap-2 rounded-2xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {busyId === it.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Confirm reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectId(null);
                            setRejectReason("");
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
