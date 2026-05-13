"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type HealthItem = {
  id: string;
  label: string;
  ok: boolean;
  details?: any;
};

export default function SemesterHealthClient() {
  const sp = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<HealthItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const simulateNoSemester = sp.get("simulate_no_semester") === "1";
  const session = sp.get("session") || "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (simulateNoSemester) qs.set("simulate_no_semester", "1");
      if (session) qs.set("session", session);
      const res = await fetch(`/api/admin/study/semester-health?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        // even if ok=false we still want to show items if provided
        if (json.items) setItems(json.items);
        throw new Error(json.error || "Health check failed");
      }
      setItems(json.items || []);
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulateNoSemester, session]);

  const allOk = useMemo(() => items.length > 0 && items.every((i) => i.ok), [items]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Semester Health Check</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Quick checklist to verify auto-semester, prompt logic, and filtering are working end-to-end.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Re-run
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
          <Activity className="h-4 w-4" />
          Overall:{" "}
          {loading ? (
            <span className="text-neutral-600">Checking…</span>
          ) : allOk ? (
            <span className="text-green-700">OK</span>
          ) : (
            <span className="text-red-700">Needs attention</span>
          )}
        </span>

        <Link className="rounded-full border px-3 py-1 hover:bg-neutral-50" href="/admin/study">
          Back to Study Admin
        </Link>

        <Link
          className="rounded-full border px-3 py-1 hover:bg-neutral-50"
          href={`/admin/study/semester-health?simulate_no_semester=${simulateNoSemester ? "0" : "1"}${session ? `&session=${encodeURIComponent(session)}` : ""}`}
        >
          {simulateNoSemester ? "Disable" : "Enable"} simulate_no_semester
        </Link>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="mt-4 space-y-3">
        {loading && items.length === 0 ? (
          <div className="rounded-xl border p-4 text-sm text-neutral-600">Loading checks…</div>
        ) : null}

        {items.map((it) => (
          <div key={it.id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {it.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-700" />
                )}
                <div className="font-medium">{it.label}</div>
              </div>
              <div className={it.ok ? "text-xs text-green-700" : "text-xs text-red-700"}>{it.ok ? "PASS" : "FAIL"}</div>
            </div>

            {it.details ? (
              <pre className="mt-3 overflow-auto rounded-lg bg-neutral-950 p-3 text-xs text-neutral-100">
{JSON.stringify(it.details, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border bg-neutral-50 p-4 text-sm">
        <div className="font-medium">Manual smoke test links</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link className="rounded-lg border bg-white px-3 py-2 hover:bg-neutral-50" href="/study/onboarding">
            Onboarding
          </Link>
          <Link className="rounded-lg border bg-white px-3 py-2 hover:bg-neutral-50" href="/study">
            Study Home
          </Link>
          <Link className="rounded-lg border bg-white px-3 py-2 hover:bg-neutral-50" href="/study/materials?mine=1">
            Materials (Mine)
          </Link>
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          Tip: open Onboarding after clearing your semester to confirm the auto-prefill, then come back here and re-run.
        </p>
      </div>
    </div>
  );
}
