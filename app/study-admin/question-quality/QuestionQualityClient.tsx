"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, FileText, Filter, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type Issue =
  | "missing_source"
  | "missing_metadata"
  | "duplicate_fingerprint"
  | "thin_explanation"
  | "missing_ref_quote"
  | "missing_ref_page";

type QualityItem = {
  id: string;
  setId: string | null;
  prompt: string;
  explanation: string | null;
  options: Array<{ id: string; text: string; isCorrect: boolean; position: number | null }>;
  correctAnswer: string | null;
  studyRef: Record<string, unknown> | null;
  sourceChunkId: string | null;
  sourceChunkPage: number | null;
  sourceChunkIndex: number | null;
  sourceMaterialId: string | null;
  sourceMaterialTitle: string | null;
  sourceMaterialType: string | null;
  quizSetTitle: string | null;
  quizSetCourseCode: string | null;
  quizSetSource: string | null;
  sourceTopic: string | null;
  questionKind: string | null;
  difficultyLevel: string | null;
  cognitiveLevel: string | null;
  questionFingerprint: string | null;
  generationMeta: Record<string, unknown> | null;
  sourceBacked: boolean;
  issues: Issue[];
};

type QualitySummary = {
  total: number;
  sourceBacked: number;
  missingMetadata: number;
  duplicateFingerprints: number;
  issueCounts: Record<Issue, number>;
  topTopics: Array<{ label: string; count: number }>;
  kindMix: Record<string, number>;
  cognitiveMix: Record<string, number>;
};

type ApiResponse = {
  ok: boolean;
  items: QualityItem[];
  summary: QualitySummary;
  page: number;
  per: number;
  total: number;
  totalPages: number;
  error?: string;
};

const DEFAULT_PER = 20;

const ISSUE_LABEL: Record<Issue, string> = {
  missing_source: "Missing source",
  missing_metadata: "Missing metadata",
  duplicate_fingerprint: "Duplicate",
  thin_explanation: "Thin explanation",
  missing_ref_quote: "Missing quote",
  missing_ref_page: "Missing page",
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function asInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback;
}

function buildHref(path: string, params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const clean = String(value).trim();
    if (clean) sp.set(key, clean);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "red" | "amber" | "blue" }) {
  const classes =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "red"
        ? "border-red-200 bg-red-50 text-red-700"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : tone === "blue"
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-zinc-200 bg-zinc-50 text-zinc-700";
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", classes)}>{children}</span>;
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-56 overflow-auto rounded-2xl border bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-50">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

export function QuestionQualityClient({
  apiPath,
  title,
  description,
  authMode = "admin",
  tabValue,
}: {
  apiPath: string;
  title: string;
  description: string;
  authMode?: "admin" | "study-admin";
  tabValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const page = asInt(sp.get("page"), 1);
  const per = Math.min(100, Math.max(5, asInt(sp.get("per"), DEFAULT_PER)));
  const q = sp.get("q") ?? "";
  const courseCode = sp.get("courseCode") ?? "";
  const source = sp.get("source") ?? "";
  const kind = sp.get("kind") ?? "";
  const cognitive = sp.get("cognitive") ?? "";
  const issue = sp.get("issue") ?? "";

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<QualityItem | null>(null);
  const [qDraft, setQDraft] = useState(q);
  const qTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseParams = useMemo(() => ({
    tab: tabValue,
    q: q || null,
    courseCode: courseCode || null,
    source: source || null,
    kind: kind || null,
    cognitive: cognitive || null,
    issue: issue || null,
    per: per !== DEFAULT_PER ? per : null,
  }), [cognitive, courseCode, issue, kind, per, q, source, tabValue]);

  function replace(next: Record<string, string | number | null | undefined>) {
    router.replace(buildHref(pathname, { ...baseParams, ...next }));
  }

  useEffect(() => {
    setQDraft(q);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (courseCode) params.set("courseCode", courseCode);
        if (source) params.set("source", source);
        if (kind) params.set("kind", kind);
        if (cognitive) params.set("cognitive", cognitive);
        if (issue) params.set("issue", issue);
        params.set("page", String(page));
        params.set("per", String(per));

        const headers: HeadersInit = {};
        if (authMode === "study-admin") {
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          if (!token) throw new Error("You need to sign in again.");
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(`${apiPath}?${params.toString()}`, { cache: "no-store", headers });
        const json = await res.json().catch(() => null) as ApiResponse | null;
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load question quality.");
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load question quality.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiPath, authMode, cognitive, courseCode, issue, kind, page, per, q, source]);

  const summary = data?.summary;

  return (
    <div className="space-y-4 pb-10">
      <header className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
            <p className="mt-1 text-sm text-zinc-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => replace({ page: null })}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            <Filter className="h-4 w-4" /> Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_150px_150px]">
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={qDraft}
              placeholder="Search prompt, topic, material..."
              className="w-full bg-transparent text-sm outline-none"
              onChange={(event) => {
                const value = event.target.value;
                setQDraft(value);
                if (qTimerRef.current) clearTimeout(qTimerRef.current);
                qTimerRef.current = setTimeout(() => {
                  replace({ q: normalize(value) || null, page: null });
                }, 350);
              }}
            />
            {q ? (
              <button type="button" onClick={() => replace({ q: null, page: null })} className="rounded-xl p-1 hover:bg-zinc-100" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <input
            value={courseCode}
            onChange={(event) => replace({ courseCode: normalize(event.target.value).toUpperCase() || null, page: null })}
            placeholder="Course code"
            className="rounded-2xl border bg-white px-3 py-2 text-sm outline-none"
          />
          <select value={source} onChange={(event) => replace({ source: event.target.value || null, page: null })} className="rounded-2xl border bg-white px-3 py-2 text-sm">
            <option value="">All source</option>
            <option value="backed">Source-backed</option>
            <option value="missing">Missing source</option>
          </select>
          <select value={issue} onChange={(event) => replace({ issue: event.target.value || null, page: null })} className="rounded-2xl border bg-white px-3 py-2 text-sm">
            <option value="">All issues</option>
            {Object.entries(ISSUE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <select value={kind} onChange={(event) => replace({ kind: event.target.value || null, page: null })} className="rounded-2xl border bg-white px-3 py-2 text-sm">
            <option value="">All kinds</option>
            {Object.keys(summary?.kindMix ?? {}).filter((v) => v !== "unknown").map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
          </select>
          <select value={cognitive} onChange={(event) => replace({ cognitive: event.target.value || null, page: null })} className="rounded-2xl border bg-white px-3 py-2 text-sm">
            <option value="">All cognitive levels</option>
            {Object.keys(summary?.cognitiveMix ?? {}).filter((v) => v !== "unknown").map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={String(per)} onChange={(event) => replace({ per: event.target.value, page: null })} className="rounded-2xl border bg-white px-3 py-2 text-sm">
            {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value} per page</option>)}
          </select>
        </div>
      </header>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryCard label="Questions" value={summary.total} />
          <SummaryCard label="Source-backed" value={summary.sourceBacked} />
          <SummaryCard label="Missing metadata" value={summary.missingMetadata} />
          <SummaryCard label="Duplicate fingerprints" value={summary.duplicateFingerprints} />
        </div>
      ) : null}

      {summary?.topTopics?.length ? (
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Top topics</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.topTopics.map((topic) => <Badge key={topic.label} tone="blue">{topic.label} ({topic.count})</Badge>)}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading question quality...
          </div>
        ) : data?.items?.length ? (
          <div className="divide-y">
            {data.items.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelected(item)} className="block w-full p-4 text-left transition hover:bg-zinc-50">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      {item.sourceBacked ? <Badge tone="green">Source-backed</Badge> : <Badge tone="red">No source</Badge>}
                      {item.quizSetCourseCode ? <Badge>{item.quizSetCourseCode}</Badge> : null}
                      {item.questionKind ? <Badge>{item.questionKind.replace(/_/g, " ")}</Badge> : null}
                      {item.cognitiveLevel ? <Badge>{item.cognitiveLevel}</Badge> : null}
                      {item.sourceChunkPage ? <Badge tone="blue">Page {item.sourceChunkPage}</Badge> : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-900">{item.prompt}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {item.sourceTopic || "No topic"} {item.sourceMaterialTitle ? `- ${item.sourceMaterialTitle}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 md:max-w-xs md:justify-end">
                    {item.issues.length ? item.issues.map((it) => (
                      <Badge key={it} tone={it === "duplicate_fingerprint" ? "amber" : "red"}>{ISSUE_LABEL[it]}</Badge>
                    )) : <Badge tone="green">Looks complete</Badge>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-zinc-400" />
            <p className="mt-2 text-sm font-semibold text-zinc-900">No generated questions found</p>
            <p className="mt-1 text-xs text-zinc-500">Try clearing filters or generating new source-backed questions.</p>
          </div>
        )}
      </div>

      {data ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => replace({ page: Math.max(1, page - 1) })}
            disabled={page <= 1}
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> Prev
          </button>
          <p className="text-sm font-semibold text-zinc-700">Page {data.page} of {data.totalPages}</p>
          <button
            type="button"
            onClick={() => replace({ page: page + 1 })}
            disabled={page >= data.totalPages}
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <DetailDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function DetailDrawer({ item, onClose }: { item: QualityItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close question details" />
      <section className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Question details</p>
            <p className="text-xs text-zinc-500">{item.quizSetCourseCode || "No course"} - {item.sourceTopic || "No topic"}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl border hover:bg-zinc-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Prompt</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-zinc-900">{item.prompt}</p>
          </div>
          <div className="space-y-2">
            {item.options.map((option, index) => (
              <div key={option.id} className={cn("rounded-2xl border p-3 text-sm", option.isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-white text-zinc-800")}>
                <span className="font-bold">{String.fromCharCode(65 + index)}.</span> {option.text}
              </div>
            ))}
          </div>
          <Info label="Explanation" value={item.explanation || "No explanation"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Kind" value={item.questionKind || "Missing"} />
            <Info label="Cognitive level" value={item.cognitiveLevel || "Missing"} />
            <Info label="Difficulty" value={item.difficultyLevel || "Missing"} />
            <Info label="Fingerprint" value={item.questionFingerprint || "Missing"} />
          </div>
          <div className="rounded-2xl border bg-zinc-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <FileText className="h-4 w-4" /> Source
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              {item.sourceMaterialTitle || "No material"} {item.sourceChunkPage ? `- Page ${item.sourceChunkPage}` : ""}
            </p>
            <p className="mt-1 break-all text-xs text-zinc-500">Chunk: {item.sourceChunkId || "Missing"}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Issue flags</p>
            <div className="flex flex-wrap gap-2">
              {item.issues.length ? item.issues.map((issue) => <Badge key={issue} tone="amber"><AlertTriangle className="mr-1 h-3 w-3" />{ISSUE_LABEL[issue]}</Badge>) : <Badge tone="green">No obvious issues</Badge>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Study ref</p>
            <JsonBlock value={item.studyRef} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Generation metadata</p>
            <JsonBlock value={item.generationMeta} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t p-4">
          {item.setId ? (
            <Link href={`/study/practice/${item.setId}`} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
              <BookOpen className="h-4 w-4" /> Open practice
            </Link>
          ) : null}
          {item.sourceMaterialId ? (
            <Link href={`/study/materials/${item.sourceMaterialId}`} className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
              <FileText className="h-4 w-4" /> Open material
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm text-zinc-800">{value}</p>
    </div>
  );
}
