"use client";
// app/study-admin/requests/page.tsx
import { cn } from "@/lib/utils";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Search,
  X,
  Inbox,
  Clock,
  BadgeCheck,
  Ban,
  PlusCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type CourseRequest = {
  id: string;
  created_at: string;
  updated_at: string;
  faculty: string;
  department: string;
  faculty_id: string | null;
  department_id: string | null;
  level: number;
  semester: string;
  course_code: string;
  course_title: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  user_id: string;
};

type ApiResponse = { ok: boolean; items: CourseRequest[]; error?: string };

type ApproveCreateState = {
  busy: boolean;
  showForm: boolean;
  level: number;
  semester: "first" | "second" | "summer";
  error: string | null;
  success: string | null;
};

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

function StatusPill({ status }: { status: CourseRequest["status"] }) {
  const tone =
    status === "approved"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "rejected"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-amber-50 text-amber-900 border-amber-200";
  const Icon = status === "approved" ? BadgeCheck : status === "rejected" ? Ban : Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", tone)}>
      <Icon className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

export default function StudyAdminRequestsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CourseRequest[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approveCreateMap, setApproveCreateMap] = useState<Record<string, ApproveCreateState>>({});

  async function getTokenOrRedirect() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent("/study-admin/requests")}`);
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
      const url = new URL("/api/study-admin/course-requests", window.location.origin);
      url.searchParams.set("status", status);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent("/study-admin/requests")}`);
        return;
      }
      if (res.status === 403) {
        router.replace("/study");
        return;
      }
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load requests");
      setItems(json.items || []);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const count = useMemo(() => items.length, [items]);

  async function approve(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/course-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Approve failed");
      setNote("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  function getAcState(id: string): ApproveCreateState {
    return approveCreateMap[id] ?? {
      busy: false,
      showForm: false,
      level: 0,
      semester: "first",
      error: null,
      success: null,
    };
  }

  function setAcState(id: string, updates: Partial<ApproveCreateState>) {
    setApproveCreateMap((prev) => ({
      ...prev,
      [id]: { ...getAcState(id), ...prev[id], ...updates },
    }));
  }

  async function approveAndCreate(r: CourseRequest) {
    const ac = getAcState(r.id);

    // Need department scope to create a course
    if (!r.department_id) {
      setAcState(r.id, { error: "Request is missing department info — cannot auto-create course." });
      return;
    }

    const level = ac.level || r.level || 0;
    const semester = ac.semester || (r.semester as "first" | "second" | "summer") || "first";

    // If missing required fields, show inline form
    if (!level || !semester) {
      setAcState(r.id, { showForm: true });
      return;
    }

    setAcState(r.id, { busy: true, error: null, success: null });
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;

      // Step 1: create the course through the scoped admin course API
      const courseRes = await fetch("/api/study-admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          course_code:  r.course_code,
          course_title: r.course_title,
          level,
          semester,
          department_id: r.department_id,
        }),
      });
      const courseJson = await courseRes.json();

      if (!courseRes.ok && courseJson?.code !== "COURSE_EXISTS") {
        throw new Error(courseJson?.error || courseJson?.message || "Failed to create course.");
      }

      // Step 2: approve the request
      const approveRes = await fetch(`/api/study-admin/course-requests/${r.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: "Auto-approved via approve & create." }),
      });
      const approveJson = await approveRes.json();
      if (!approveRes.ok || !approveJson.ok) {
        throw new Error(approveJson?.error || "Approved course but failed to close request.");
      }

      setAcState(r.id, {
        busy: false,
        showForm: false,
        success: courseJson?.code === "COURSE_EXISTS"
          ? "Course already exists — request approved."
          : "Course created and request approved.",
      });
      await load();
    } catch (e: any) {
      setAcState(r.id, { busy: false, error: e?.message || "Failed." });
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/course-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Reject failed");
      setNote("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Course requests</h1>
            <p className="mt-1 text-sm text-zinc-600">Approve requested courses so students can upload properly.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-10 w-64 max-w-[70vw] rounded-2xl border bg-white pl-10 pr-3 text-sm"
                placeholder="Search code, title, department…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
              />
            </div>
            <button onClick={load} className="h-10 rounded-2xl bg-black px-4 text-sm font-medium text-white">
              Refresh
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
      ) : null}

      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600">
            Showing <span className="font-semibold text-zinc-900">{count}</span> request(s)
          </p>
          <div className="inline-flex items-center gap-2 rounded-2xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <Inbox className="h-4 w-4" /> Requests
          </div>
        </div>

        <div className="mt-4 divide-y">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-600">No requests found.</div>
          ) : (
            items.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={r.status} />
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{r.course_code}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      {r.level}L · {r.semester}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      {r.department}
                    </span>
                  </div>

                  <p className="mt-2 truncate text-sm font-semibold text-zinc-900">
                    {r.course_title || "(No title)"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Requested {formatDate(r.created_at)}</p>
                  {r.admin_note ? <p className="mt-2 text-xs text-zinc-600">Note: {r.admin_note}</p> : null}
                </div>

                {r.status === "pending" ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Approve & create — one-click course creation + approval */}
                      <button
                        disabled={busyId === r.id || getAcState(r.id).busy}
                        onClick={() => {
                          const ac = getAcState(r.id);
                          const level = r.level || 0;
                          const semester = (r.semester as "first" | "second" | "summer") || "first";
                          if (!level || !semester) {
                            setAcState(r.id, {
                              showForm: !ac.showForm,
                              level: ac.level || level,
                              semester: ac.semester || semester,
                            });
                          } else {
                            setAcState(r.id, { level, semester });
                            approveAndCreate(r);
                          }
                        }}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-2xl bg-violet-600 px-3 text-sm font-medium text-white",
                          (busyId === r.id || getAcState(r.id).busy) ? "opacity-60" : "hover:bg-violet-700"
                        )}
                      >
                        {getAcState(r.id).busy
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <PlusCircle className="h-4 w-4" />
                        }
                        Approve &amp; create
                      </button>

                      <button
                        disabled={busyId === r.id}
                        onClick={() => approve(r.id)}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-2xl bg-emerald-600 px-3 text-sm font-medium text-white",
                          busyId === r.id ? "opacity-60" : "hover:bg-emerald-700"
                        )}
                      >
                        {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </button>

                      <button
                        disabled={busyId === r.id}
                        onClick={() => reject(r.id)}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700",
                          busyId === r.id ? "opacity-60" : "hover:bg-red-100"
                        )}
                      >
                        {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Reject
                      </button>
                    </div>

                    {/* Inline form for missing level/semester */}
                    {getAcState(r.id).showForm && (
                      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-3">
                        <p className="w-full text-xs font-medium text-violet-900">Fill in missing info to create course:</p>
                        <select
                          value={getAcState(r.id).level || ""}
                          onChange={(e) => setAcState(r.id, { level: Number(e.target.value) })}
                          className="h-8 rounded-xl border border-violet-200 bg-white px-2 text-xs text-zinc-800"
                        >
                          <option value="" disabled>Select level</option>
                          {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((l) => (
                            <option key={l} value={l}>{l}L</option>
                          ))}
                        </select>
                        <select
                          value={getAcState(r.id).semester}
                          onChange={(e) => setAcState(r.id, { semester: e.target.value as "first" | "second" | "summer" })}
                          className="h-8 rounded-xl border border-violet-200 bg-white px-2 text-xs text-zinc-800"
                        >
                          <option value="first">First</option>
                          <option value="second">Second</option>
                          <option value="summer">Summer</option>
                        </select>
                        <button
                          onClick={() => approveAndCreate(r)}
                          disabled={!getAcState(r.id).level || getAcState(r.id).busy}
                          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-medium text-white disabled:opacity-60 hover:bg-violet-700"
                        >
                          {getAcState(r.id).busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Confirm
                        </button>
                      </div>
                    )}

                    {/* Inline feedback */}
                    {getAcState(r.id).error && (
                      <p className="text-xs text-red-700">{getAcState(r.id).error}</p>
                    )}
                    {getAcState(r.id).success && (
                      <p className="text-xs text-emerald-700">{getAcState(r.id).success}</p>
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-900">Optional admin note</p>
        <p className="mt-1 text-sm text-zinc-600">Saved on the request when you approve/reject.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Fixed course title / merged duplicate request"
          className="mt-3 min-h-[90px] w-full rounded-2xl border bg-white p-3 text-sm"
        />
      </div>
    </div>
  );
}
