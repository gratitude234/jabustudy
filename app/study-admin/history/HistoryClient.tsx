"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ExternalLink, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MaterialType = "past_question" | "handout" | "slides" | "note" | "timetable" | "other";

type HistoryItem = {
  id: string;
  title: string | null;
  course_code: string | null;
  department: string | null;
  department_id: string | null;
  level: string | null;
  semester: string | null;
  session: string | null;
  material_type: MaterialType;
  file_url: string | null;
  approved: boolean;
  created_at: string;
  uploader_id: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

type Department = { id: string; name: string };

const MATERIAL_TYPES: { value: MaterialType; label: string }[] = [
  { value: "past_question", label: "Past Question" },
  { value: "handout", label: "Handout" },
  { value: "slides", label: "Slides" },
  { value: "note", label: "Note" },
  { value: "timetable", label: "Timetable" },
  { value: "other", label: "Other" },
];
const TYPE_LABEL: Record<MaterialType, string> = Object.fromEntries(
  MATERIAL_TYPES.map((t) => [t.value, t.label])
) as Record<MaterialType, string>;

const LEVELS = [100, 200, 300, 400, 500, 600, 700];

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-NG", { year: "numeric", month: "short", day: "2-digit" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HistoryClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [departments, setDepartments] = useState<Department[]>([]);

  // Filters from URL
  const dept = searchParams.get("dept") ?? "";
  const level = searchParams.get("level") ?? "";
  const type = searchParams.get("type") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const uploader = searchParams.get("uploader") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));

  // Local filter inputs (applied on submit)
  const [deptInput, setDeptInput] = useState(dept);
  const [levelInput, setLevelInput] = useState(level);
  const [typeInput, setTypeInput] = useState(type);
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);
  const [uploaderInput, setUploaderInput] = useState(uploader);

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Load departments once
  useEffect(() => {
    supabase
      .from("study_departments")
      .select("id, name")
      .order("name")
      .then(({ data }) => setDepartments((data as Department[]) ?? []));
  }, []);

  function pushParams(overrides: Record<string, string>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  function applyFilters() {
    pushParams({
      dept: deptInput,
      level: levelInput,
      type: typeInput,
      from: fromInput,
      to: toInput,
      uploader: uploaderInput,
      page: "1",
    });
  }

  function clearFilters() {
    setDeptInput(""); setLevelInput(""); setTypeInput("");
    setFromInput(""); setToInput(""); setUploaderInput("");
    router.push(pathname);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const url = new URL("/api/study-admin/history", window.location.origin);
      if (dept) url.searchParams.set("dept", dept);
      if (level) url.searchParams.set("level", level);
      if (type) url.searchParams.set("type", type);
      if (from) url.searchParams.set("from", from);
      if (to) url.searchParams.set("to", to);
      if (uploader) url.searchParams.set("uploader", uploader);
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
      if (res.status === 403) { router.replace("/study"); return; }

      const json = await res.json() as { ok: boolean; items: HistoryItem[]; total: number; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to load history");
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [dept, level, type, from, to, uploader, page, pathname, router]);

  useEffect(() => { load(); }, [load]);

  async function deleteMaterial(id: string) {
    if (!window.confirm("Delete this material? This cannot be undone.")) return;
    setBusyId(id);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/study-admin/materials/${id}/delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Upload History</h1>
        <p className="mt-1 text-sm text-zinc-600">All materials uploaded by study admins.</p>
      </div>

      {/* Filter bar */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Department</label>
            <select
              className="h-9 rounded-2xl border bg-white px-3 text-sm"
              value={deptInput}
              onChange={(e) => setDeptInput(e.target.value)}
            >
              <option value="">All</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Level</label>
            <select
              className="h-9 rounded-2xl border bg-white px-3 text-sm"
              value={levelInput}
              onChange={(e) => setLevelInput(e.target.value)}
            >
              <option value="">All</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Type</label>
            <select
              className="h-9 rounded-2xl border bg-white px-3 text-sm"
              value={typeInput}
              onChange={(e) => setTypeInput(e.target.value)}
            >
              <option value="">All</option>
              {MATERIAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">From</label>
            <input type="date" className="h-9 rounded-2xl border bg-white px-3 text-sm" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">To</label>
            <input type="date" className="h-9 rounded-2xl border bg-white px-3 text-sm" value={toInput} onChange={(e) => setToInput(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Uploaded by</label>
            <input
              className="h-9 w-44 rounded-2xl border bg-white px-3 text-sm"
              placeholder="Name or email…"
              value={uploaderInput}
              onChange={(e) => setUploaderInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
            />
          </div>

          <button onClick={applyFilters} className="h-9 rounded-2xl bg-black px-4 text-sm font-medium text-white">
            Apply
          </button>
          <button onClick={clearFilters} className="h-9 rounded-2xl border px-4 text-sm text-zinc-600 hover:bg-zinc-50">
            Clear
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
      )}

      {/* Table */}
      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No materials found for these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Dept</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Uploaded by</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50">
                    <td className="max-w-[160px] truncate px-4 py-3 font-medium text-zinc-900">
                      {item.title || "Untitled"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{item.course_code ?? "—"}</td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-zinc-600">{item.department ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{item.level ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        {TYPE_LABEL[item.material_type] ?? item.material_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {item.profiles?.full_name ?? item.profiles?.email ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3">
                      <StatusChip approved={item.approved} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.file_url ? (
                          <a
                            href={item.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-2xl border px-3 text-xs font-medium hover:bg-zinc-50"
                          >
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-400">No file</span>
                        )}
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => deleteMaterial(item.id)}
                          className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-2xl border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700",
                            busyId === item.id ? "opacity-50" : "hover:bg-red-100"
                          )}
                        >
                          {busyId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-zinc-500">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => pushParams({ page: String(page - 1) })}
                className="inline-flex h-8 items-center gap-1 rounded-2xl border px-3 text-xs disabled:opacity-40"
              >
                <ChevronLeft className="h-3 w-3" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => pushParams({ page: String(page + 1) })}
                className="inline-flex h-8 items-center gap-1 rounded-2xl border px-3 text-xs disabled:opacity-40"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ approved }: { approved: boolean }) {
  if (approved) {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Approved</span>;
  }
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span>;
}
