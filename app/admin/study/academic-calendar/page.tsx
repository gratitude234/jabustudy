"use client";
// app/admin/study/academic-calendar/page.tsx
import { cn } from "@/lib/utils";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, Loader2, Plus, Save, Trash2, X } from "lucide-react";

type Semester = "first" | "second" | "summer";

type Row = {
  id: string;
  session: string;
  semester: Semester;
  starts_on: string; // YYYY-MM-DD
  ends_on: string;   // YYYY-MM-DD
  created_at: string;
};

function Banner({
  kind,
  text,
  onClose,
}: {
  kind: "success" | "error" | "info";
  text: string;
  onClose: () => void;
}) {
  const tone =
    kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : kind === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-zinc-200 bg-white text-zinc-700";

  const icon =
    kind === "success" ? <Check className="h-4 w-4" /> : kind === "error" ? <X className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />;

  return (
    <div className={cn("rounded-2xl border p-4 text-sm", tone)} role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5">{icon}</div>
          <p>{text}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl border bg-white p-1.5 hover:bg-zinc-50" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AcademicCalendarAdminPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [banner, setBanner] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const [draft, setDraft] = useState({
    session: "2025/2026",
    semester: "first" as Semester,
    starts_on: todayISO(),
    ends_on: todayISO(),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.session || "Unknown session";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    // sort sessions desc if possible
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  async function load() {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/study/academic-calendar", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load calendar");
      setRows((json.rows ?? []) as Row[]);
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Failed to load calendar" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function upsertRow(payload: Partial<Row> & { session: string; semester: Semester; starts_on: string; ends_on: string; id?: string }) {
    setBanner(null);
    const res = await fetch("/api/admin/study/academic-calendar/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Save failed");
  }

  async function deleteRow(id: string) {
    setBanner(null);
    const res = await fetch("/api/admin/study/academic-calendar/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Delete failed");
  }

  async function addNew() {
    try {
      await upsertRow(draft);
      setBanner({ kind: "success", text: "Saved." });
      await load();
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Save failed" });
    }
  }

  async function saveInline(r: Row) {
    try {
      await upsertRow({ id: r.id, session: r.session, semester: r.semester, starts_on: r.starts_on, ends_on: r.ends_on });
      setBanner({ kind: "success", text: "Updated." });
      await load();
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Update failed" });
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this semester range?")) return;
    try {
      await deleteRow(id);
      setBanner({ kind: "success", text: "Deleted." });
      await load();
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Delete failed" });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/study" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900 no-underline">
            <ArrowLeft className="h-4 w-4" /> Back to Study Admin
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">Academic Calendar</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Update semester date ranges per session. The app uses this to auto-detect <span className="font-semibold">first/second</span> semester.
          </p>
        </div>
      </div>

      {banner ? <div className="mt-4"><Banner kind={banner.kind} text={banner.text} onClose={() => setBanner(null)} /></div> : null}

      {/* Add new */}
      <div className="mt-6 rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Plus className="h-4 w-4" /> Add / Paste new range
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-zinc-600">Session</span>
            <input
              value={draft.session}
              onChange={(e) => setDraft((d) => ({ ...d, session: e.target.value }))}
              className="w-full rounded-2xl border bg-white px-3 py-2 outline-none focus:ring-2"
              placeholder="2025/2026"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-zinc-600">Semester</span>
            <select
              value={draft.semester}
              onChange={(e) => setDraft((d) => ({ ...d, semester: e.target.value as Semester }))}
              className="w-full rounded-2xl border bg-white px-3 py-2 outline-none focus:ring-2"
            >
              <option value="first">First</option>
              <option value="second">Second</option>
              <option value="summer">Summer</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-zinc-600">Starts on</span>
            <input
              type="date"
              value={draft.starts_on}
              onChange={(e) => setDraft((d) => ({ ...d, starts_on: e.target.value }))}
              className="w-full rounded-2xl border bg-white px-3 py-2 outline-none focus:ring-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-zinc-600">Ends on</span>
            <input
              type="date"
              value={draft.ends_on}
              onChange={(e) => setDraft((d) => ({ ...d, ends_on: e.target.value }))}
              className="w-full rounded-2xl border bg-white px-3 py-2 outline-none focus:ring-2"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={addNew}
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Save className="h-4 w-4" /> Save range
          </button>
        </div>
      </div>

      {/* Existing */}
      <div className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Existing sessions</h2>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-4 rounded-3xl border bg-white p-6 text-sm text-zinc-600">Loading…</div>
        ) : grouped.length === 0 ? (
          <div className="mt-4 rounded-3xl border bg-white p-6 text-sm text-zinc-600">No rows yet.</div>
        ) : (
          <div className="mt-4 space-y-6">
            {grouped.map(([session, items]) => (
              <div key={session} className="rounded-3xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-zinc-50">
                      <CalendarDays className="h-5 w-5 text-zinc-800" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{session}</p>
                      <p className="text-xs text-zinc-500">{items.length} range{items.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left text-xs text-zinc-500">
                        <th className="py-2 pr-3">Semester</th>
                        <th className="py-2 pr-3">Starts</th>
                        <th className="py-2 pr-3">Ends</th>
                        <th className="py-2 pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .slice()
                        .sort((a, b) => (a.starts_on > b.starts_on ? 1 : -1))
                        .map((r) => (
                          <tr key={r.id} className="border-t">
                            <td className="py-3 pr-3">
                              <select
                                value={r.semester}
                                onChange={(e) => {
                                  const v = e.target.value as Semester;
                                  setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, semester: v } : x)));
                                }}
                                className="rounded-2xl border bg-white px-3 py-2 text-sm"
                              >
                                <option value="first">First</option>
                                <option value="second">Second</option>
                                <option value="summer">Summer</option>
                              </select>
                            </td>
                            <td className="py-3 pr-3">
                              <input
                                type="date"
                                value={r.starts_on}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, starts_on: v } : x)));
                                }}
                                className="rounded-2xl border bg-white px-3 py-2 text-sm"
                              />
                            </td>
                            <td className="py-3 pr-3">
                              <input
                                type="date"
                                value={r.ends_on}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ends_on: v } : x)));
                                }}
                                className="rounded-2xl border bg-white px-3 py-2 text-sm"
                              />
                            </td>
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveInline(r)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                                >
                                  <Save className="h-4 w-4" /> Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => remove(r.id)}
                                  className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                                >
                                  <Trash2 className="h-4 w-4" /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-3xl border bg-white p-4 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-900">Tip</p>
        <p className="mt-1">
          When JABU publishes a new session calendar, just add the <span className="font-semibold">first</span> and <span className="font-semibold">second</span> rows for that session here.
          The app will start auto-detecting immediately — no redeploy.
        </p>
      </div>
    </div>
  );
}
