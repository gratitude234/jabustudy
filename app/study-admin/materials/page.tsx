"use client";
// app/study-admin/materials/page.tsx
import { cn } from "@/lib/utils";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Presentation,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { isIndexableMaterialPath } from "@/lib/studyMaterialIndexEligibility";

type MaterialType = "past_question" | "handout" | "slides" | "note" | "timetable" | "other";

type CourseMini = {
  id: string;
  course_code: string;
  course_title: string | null;
  level: number;
  semester: string;
};

type MaterialItem = {
  id: string;
  title: string | null;
  material_type: MaterialType;
  department: string | null;
  session: string | null;
  file_url: string | null;
  file_path: string | null;
  created_at: string;
  approved: boolean;
  file_hash: string | null;
  uploader_email: string | null;
  index_status: "pending" | "indexing" | "ready" | "failed" | "skipped" | null;
  indexed_at: string | null;
  index_error: string | null;
  study_courses: CourseMini;
};

type ApiResponse = { ok: boolean; items: MaterialItem[]; error?: string };

const TYPE_LABEL: Record<MaterialType, string> = {
  past_question: "Past Q",
  handout: "Handout",
  slides: "Slides",
  note: "Note",
  timetable: "Timetable",
  other: "Other",
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

function fileKind(url: string) {
  const u = (url || "").toLowerCase();
  if (u.includes(".pdf")) return "pdf";
  if (u.match(/\.(png|jpg|jpeg|webp)(\?|$)/)) return "image";
  if (u.includes(".pptx")) return "pptx";
  return "file";
}

function KindIcon({ url }: { url: string }) {
  const k = fileKind(url);
  if (k === "image") return <ImageIcon className="h-4 w-4" />;
  if (k === "pptx") return <Presentation className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function indexStatusLabel(status: MaterialItem["index_status"]) {
  if (status === "ready") return "Indexed";
  if (status === "indexing") return "Indexing";
  if (status === "failed") return "Index failed";
  if (status === "skipped") return "Skipped";
  return "Not indexed";
}

function IndexStatusBadge({ item }: { item: MaterialItem }) {
  const status = item.index_status ?? "pending";
  const classes =
    status === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "indexing"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : status === "failed"
          ? "border-red-200 bg-red-50 text-red-700"
          : status === "skipped"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-zinc-200 bg-zinc-50 text-zinc-600";

  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", classes)}
      title={item.index_error || (item.indexed_at ? `Indexed ${formatDate(item.indexed_at)}` : undefined)}
    >
      {status === "indexing" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {indexStatusLabel(status)}
    </span>
  );
}

export default function StudyAdminMaterialsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "approved" | "all">("pending");
  const [brokenOnly, setBrokenOnly] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkIndexing, setBulkIndexing] = useState(false);
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    // If the list changes (filters, reload), clear selection to prevent accidental actions.
    setSelectedIds([]);
  }, [status, brokenOnly, q]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return Array.from(s);
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allIds = items.map((x) => x.id);
      const allSelected = prev.length > 0 && prev.length === allIds.length;
      return allSelected ? [] : allIds;
    });
  }

  async function getTokenOrRedirect() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent("/study-admin/materials")}`);
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
      const url = new URL("/api/study-admin/materials", window.location.origin);
      url.searchParams.set("status", status);
      if (q.trim()) url.searchParams.set("q", q.trim());
      if (brokenOnly) url.searchParams.set("broken", "1");
      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent("/study-admin/materials")}`);
        return;
      }
      if (res.status === 403) {
        router.replace("/study");
        return;
      }
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load materials");
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
  }, [status, brokenOnly]);

  const filteredCount = useMemo(() => items.length, [items]);

  async function approve(id: string) {
    setBusyId(id);
    setErr(null);
    setMsg(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/materials/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Approve failed");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setErr(null);
    setMsg(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/materials/${id}/reject`, {
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

  async function recheckStorage(id: string) {
    setBusyId(id);
    setErr(null);
    setMsg(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/materials/${id}/recheck-storage`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Re-check failed");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Re-check failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteMaterial(id: string) {
    const ok = window.confirm("Delete this material? This removes it from the database (and tries to remove the file from storage).");
    if (!ok) return;

    setBusyId(id);
    setErr(null);
    setMsg(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/materials/${id}/delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkApprove() {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(`Approve ${selectedIds.length} selected material(s)?`);
    if (!ok) return;

    setErr(null);
    setMsg(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/materials/bulk-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Bulk approve failed");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Bulk approve failed");
    }
  }

  async function reindex(id: string) {
    setBusyId(id);
    setErr(null);
    setMsg(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/materials/${id}/reindex`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || json.message || "Reindex failed");
      setMsg(json.status === "ready" ? `Indexed ${json.chunks ?? 0} chunk(s).` : "Reindex completed.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Reindex failed");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkReindex() {
    if (selectedIds.length === 0 || bulkIndexing) return;
    setBulkIndexing(true);
    setErr(null);
    setMsg(null);
    try {
      const token = await getTokenOrRedirect();
      if (!token) return;
      const res = await fetch(`/api/study-admin/materials/bulk-reindex`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Bulk reindex failed");
      setMsg(`Queued ${json.queued ?? 0} material(s) for indexing. ${json.skipped ?? 0} skipped.`);
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Bulk reindex failed");
    } finally {
      setBulkIndexing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Materials</h1>
            <p className="mt-1 text-sm text-zinc-600">Review uploads and approve what students should see.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="all">All</option>
            </select>

            <button
              type="button"
              onClick={() => setBrokenOnly((v) => !v)}
              className={cn(
                "h-10 rounded-2xl border px-3 text-sm font-medium",
                brokenOnly
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              )}
              title="Show uploads missing file URL/path"
            >
              {brokenOnly ? "Needs attention" : "All ok"}
            </button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-10 w-64 max-w-[70vw] rounded-2xl border bg-white pl-10 pr-3 text-sm"
                placeholder="Search title or course code…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
              />
            </div>

            <button
              onClick={load}
              className="h-10 rounded-2xl bg-black px-4 text-sm font-medium text-white"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
      ) : null}
      {msg ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{msg}</div>
      ) : null}

      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm"
              title="Select all visible items"
            >
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={items.length > 0 && selectedIds.length === items.length}
                readOnly
              />
              <span>Select all</span>
            </button>

            <p className="text-sm text-zinc-600">
              Showing <span className="font-semibold text-zinc-900">{filteredCount}</span> item(s)
            </p>
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                {selectedIds.length} selected
              </span>
              <button
                onClick={bulkApprove}
                className="h-9 rounded-2xl bg-black px-4 text-sm font-medium text-white"
              >
                Approve selected
              </button>
              <button
                onClick={bulkReindex}
                disabled={bulkIndexing}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-2xl border px-4 text-sm font-medium",
                  bulkIndexing ? "cursor-not-allowed bg-zinc-100 text-zinc-500" : "bg-white text-zinc-900 hover:bg-zinc-50"
                )}
              >
                {bulkIndexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Index selected
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="h-9 rounded-2xl border bg-white px-4 text-sm"
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 divide-y">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-600">{brokenOnly ? "No broken uploads found. Nice." : "No items found for these filters."}</div>
          ) : (
            items.map((m) => {
              const broken = !m.file_path || !m.file_url;
              const canReindex = m.approved && isIndexableMaterialPath(m.file_path);
              const indexBusy = busyId === m.id || m.index_status === "indexing";
              return (
              <div key={m.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-black"
                  checked={selectedSet.has(m.id)}
                  onChange={() => toggleSelect(m.id)}
                  aria-label="Select material"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-zinc-700">
                      <KindIcon url={m.file_url || ""} /> {TYPE_LABEL[m.material_type]}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      {m.study_courses.course_code}
                    </span>
                    <IndexStatusBadge item={m} />
                    {m.department ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        {m.department}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      {m.study_courses.level}L · {m.study_courses.semester}
                    </span>
                    {m.session ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{m.session}</span>
                    ) : null}
                  </div>

                  <p className="mt-2 truncate text-sm font-semibold text-zinc-900">
                    {m.title || m.study_courses.course_title || "Untitled"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Uploaded {formatDate(m.created_at)}{m.uploader_email ? ` · ${m.uploader_email}` : ""}
                    {m.file_hash ? ` · hash: ${m.file_hash.slice(0, 10)}…` : ""}
                  </p>
                  {m.index_error ? (
                    <p className="mt-1 line-clamp-1 text-xs text-amber-700">Index note: {m.index_error}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/api/study/materials/${m.id}/download`}
                    target="_blank"
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-black/5"
                  >
                    <ExternalLink className="h-4 w-4" /> Preview
                  </Link>

                  <button
                    disabled={busyId === m.id}
                    onClick={() => approve(m.id)}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-2xl bg-emerald-600 px-3 text-sm font-medium text-white",
                      busyId === m.id ? "opacity-60" : "hover:bg-emerald-700"
                    )}
                  >
                    {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve
                  </button>

                  {canReindex ? (
                    <button
                      disabled={indexBusy}
                      onClick={() => reindex(m.id)}
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-medium",
                        indexBusy ? "cursor-not-allowed bg-zinc-100 text-zinc-500" : "bg-white text-zinc-700 hover:bg-black/5"
                      )}
                    >
                      {indexBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Reindex
                    </button>
                  ) : null}

                  <button
                    disabled={busyId === m.id}
                    onClick={() => reject(m.id)}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700",
                      busyId === m.id ? "opacity-60" : "hover:bg-red-100"
                    )}
                  >
                    {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Reject
                  </button>

                  <button
                    disabled={busyId === m.id}
                    onClick={() => deleteMaterial(m.id)}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-medium",
                      busyId === m.id ? "opacity-60" : "hover:bg-zinc-50"
                    )}
                  >
                    {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Delete
                  </button>
                </div>
              </div>
            );
            })
          )}
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-900">Optional rejection note</p>
        <p className="mt-1 text-sm text-zinc-600">This is saved into the material description as a quick audit note.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Wrong course code / blurry scans / duplicate upload"
          className="mt-3 min-h-[90px] w-full rounded-2xl border bg-white p-3 text-sm"
        />
      </div>
    </div>
  );
}
