"use client";

// app/study/materials/[id]/MaterialDetailClient.tsx

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { toggleSaved } from "@/lib/studySaved";
import { supabase } from "@/lib/supabase";
import { GuidedSourceModal, type GuidedStudyRef } from "@/app/study/_components/GuidedSourceModal";

type GeneratedQuestion = {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: "A" | "B" | "C" | "D";
  explanation: string;
  hint?: string;
  questionKind?: string;
  difficultyLevel?: string;
  cognitiveLevel?: string;
  sourceTopic?: string;
  questionFingerprint?: string;
  generationMeta?: Record<string, unknown> | null;
  studyRef?: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  };
};

type AiGenerationMeta = {
  provider: "bedrock" | "gemini";
  model: string;
  inputMode: "extracted-text" | "inline-file" | "indexed-chunks" | "coverage-aware";
  reason?: string;
  fallbackProvider?: "bedrock" | "gemini";
  fallbackReason?: string;
  error?: string;
  coverage?: {
    topicsCovered?: number;
    questionKindCounts?: Record<string, number>;
    cognitiveLevelCounts?: Record<string, number>;
    chunksLoaded?: number;
    chunksCatalogued?: number;
  };
};

type GenerateQuestionsResponse = {
  questions?: GeneratedQuestion[];
  ai?: AiGenerationMeta;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "model";
  text: string;
};

type Course = {
  id: string;
  course_code: string;
  course_title: string | null;
  level: number | null;
  semester: string | null;
  faculty: string | null;
  department: string | null;
};

type Material = {
  id: string;
  title: string | null;
  description: string | null;
  material_type: string | null;
  session: string | null;
  approved: boolean | null;
  downloads: number | null;
  up_votes: number | null;
  down_votes: number | null;
  file_url: string | null;
  file_path: string | null;
  verified: boolean | null;
  featured: boolean | null;
  created_at: string | null;
  uploader_email: string | null;
  uploader_id: string | null;
  ai_summary: string | null;
  study_courses: Course | null;
};

function detectKind(m: Material): "pdf" | "image" | "other" {
  const src = (m.file_path ?? "").toLowerCase();
  if (src.includes(".pdf")) return "pdf";
  if (src.match(/\.(png|jpg|jpeg|webp|gif)/)) return "image";
  return "other";
}

function isAiGenSupported(m: Material): boolean {
  const src = (m.file_path ?? "").toLowerCase();
  return /\.(pdf|png|jpg|jpeg|webp|docx|pptx)$/.test(src);
}

function fileTypeBadge(kind: "pdf" | "image" | "other", m: Material) {
  if (kind === "pdf") return "PDF";
  if (kind === "image") return "IMAGE";
  const src = (m.file_path ?? "").toLowerCase();
  if (src.match(/\.(ppt|pptx)/)) return "PPT";
  if (src.match(/\.(doc|docx)/)) return "WORD";
  return "FILE";
}

function FileIcon({ kind }: { kind: "pdf" | "image" | "other" }) {
  if (kind === "pdf") return <FileText className="h-6 w-6" />;
  if (kind === "image") return <ImageIcon className="h-6 w-6" />;
  return <File className="h-6 w-6" />;
}

function obfuscateEmail(email: string | null | undefined): string {
  if (!email) return "Anonymous";
  const [local, domain] = email.split("@");
  if (!local || !domain) return email.slice(0, 3) + "***";
  return local.slice(0, 3) + "***@" + domain;
}

function getInitials(email: string | null | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase();
}

function formatMaterialType(t: string | null) {
  if (!t) return "Material";
  return (
    {
      past_question: "Past Question",
      handout: "Handout",
      note: "Lecture Note",
      slides: "Slides",
      timetable: "Timetable",
      other: "Other",
    }[t] ?? t
  );
}

function formatAiProvider(ai: AiGenerationMeta | null) {
  if (!ai) return null;
  return ai.provider === "bedrock" ? "Bedrock Claude" : "Gemini";
}

function formatAiModel(ai: AiGenerationMeta | null) {
  if (!ai) return "";
  return ai.model.split("/").pop() ?? ai.model;
}

function formatAiReason(ai: AiGenerationMeta | null) {
  const reason = ai?.reason?.trim() ?? "";
  if (!reason) return "";
  if (/pdf text extraction failed|dommatrix/i.test(reason)) {
    return "The AI provider read the PDF directly.";
  }
  return reason;
}

function normalizedPage(page: unknown): number | undefined {
  if (typeof page !== "number" || !Number.isFinite(page)) return undefined;
  const rounded = Math.floor(page);
  return rounded >= 1 && rounded <= 2000 ? rounded : undefined;
}

function withPdfPage(url: string, page?: number) {
  const safePage = normalizedPage(page);
  if (!safePage) return url;
  return `${url.split("#")[0]}#page=${safePage}`;
}

async function readGenerateQuestionsResponse(res: Response): Promise<GenerateQuestionsResponse> {
  const text = await res.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as GenerateQuestionsResponse;
  } catch {
    console.error("[study-ai] non-json generate-questions response", {
      status: res.status,
      contentType: res.headers.get("content-type"),
      bodyStart: text.slice(0, 240),
    });
    return {
      error: res.ok
        ? "The server returned an unreadable AI response."
        : "The AI server crashed before returning JSON. Check the deployment function logs for /api/ai/generate-questions.",
    };
  }
}

const GDOCS = (url: string) =>
  `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

function previewUrl(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}preview=1`;
}

function PdfViewer({ url, heightClass = "h-[70vh]", page }: { url: string; heightClass?: string; page?: number }) {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const safePage = normalizedPage(page);
  const src = useFallback ? GDOCS(url) : withPdfPage(url, safePage);

  useEffect(() => { setLoading(true); setErrored(false); }, [src]);
  useEffect(() => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) setUseFallback(true);
  }, []);

  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl border border-border bg-background", heightClass)}>
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-brand" />
            <p className="text-xs text-muted-brand">Loading PDF…</p>
          </div>
        </div>
      )}
      {errored ? (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-foreground">Couldn't load PDF</p>
            <p className="mt-1 text-xs text-muted-brand">Your browser may be blocking the file.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {!useFallback && (
                <button type="button" onClick={() => { setUseFallback(true); setErrored(false); }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:opacity-90">
                  <RefreshCw className="h-3.5 w-3.5" /> Try Google Docs viewer
                </button>
              )}
              <a href={withPdfPage(url, safePage)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/50">
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </a>
            </div>
          </div>
        </div>
      ) : (
        <iframe key={src} title="PDF preview" src={src} className="h-full w-full"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setErrored(true); }} />
      )}
      {safePage && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur">
          Go to page {safePage}
        </div>
      )}
    </div>
  );
}

function ResolvedFileViewer({
  url,
  title,
  kind,
  heightClass,
  page,
}: {
  url: string;
  title: string;
  kind: "pdf" | "image";
  heightClass: string;
  page?: number;
}) {
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResolvedUrl("");

    void (async () => {
      try {
        const res = await fetch(previewUrl(url), {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = res.ok ? await res.json() : null;
        const signedUrl = typeof json?.url === "string" ? json.url : "";
        if (!res.ok || !signedUrl) throw new Error(json?.message ?? "Could not prepare preview");
        setResolvedUrl(signedUrl);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Could not prepare preview");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [url, retryKey]);

  if (loading) {
    return (
      <div className={cn("grid w-full place-items-center rounded-2xl border border-border bg-background", heightClass)}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-brand" />
          <p className="text-xs text-muted-brand">Preparing preview...</p>
        </div>
      </div>
    );
  }

  if (error || !resolvedUrl) {
    return (
      <div className={cn("grid w-full place-items-center rounded-2xl border border-border bg-background p-6 text-center", heightClass)}>
        <div>
          <p className="text-sm font-semibold text-foreground">Preview could not load</p>
          <p className="mt-1 text-xs text-muted-brand">{error ?? "Try again or open the file directly."}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setRetryKey((key) => key + 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:opacity-90"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
            <a
              href={kind === "pdf" ? withPdfPage(url, page) : url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open file
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "pdf") return <PdfViewer url={resolvedUrl} heightClass={heightClass} page={page} />;
  return <ImageViewer url={resolvedUrl} title={title} heightClass={heightClass} />;
}

function ImageViewer({ url, title, heightClass = "h-[70vh]" }: { url: string; title: string; heightClass?: string }) {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className={cn("relative w-full overflow-auto rounded-2xl border border-border bg-background", heightClass, zoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
      onClick={() => setZoomed((v) => !v)} title={zoomed ? "Click to zoom out" : "Click to zoom in"}>
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-brand" />
        </div>
      )}
      {errored ? (
        <div className="grid h-full place-items-center p-6 text-center">
          <p className="text-sm text-muted-brand">Image failed to load.</p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title}
          className={cn("transition-transform duration-300 ease-in-out select-none",
            zoomed ? "min-h-full min-w-full object-contain scale-150 origin-top-left" : "h-full w-full object-contain")}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setErrored(true); }}
          draggable={false} />
      )}
      {!loading && !errored && (
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-1 text-[10px] font-semibold text-muted-brand backdrop-blur">
          {zoomed ? <ZoomOut className="h-3 w-3" /> : <ZoomIn className="h-3 w-3" />}
          {zoomed ? "Zoom out" : "Zoom in"}
        </div>
      )}
    </div>
  );
}

function InlinePreview({ url, title, kind, onAskAI }: { url: string; title: string; kind: "pdf" | "image" | "other"; onAskAI?: () => void }) {
  const [open, setOpen] = useState(false);
  if (kind === "other" || !url) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-expanded={open}>
        <div className="flex items-center gap-3">
          {kind === "pdf" ? <FileText className="h-4 w-4 shrink-0 text-muted-brand" /> : <ImageIcon className="h-4 w-4 shrink-0 text-muted-brand" />}
          <div>
            <p className="text-sm font-semibold text-foreground">{open ? "Hide preview" : `Preview ${kind === "pdf" ? "PDF" : "image"}`}</p>
            {!open && <p className="text-xs text-muted-brand">Tap to expand inline</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/50">
            Open <ExternalLink className="h-3 w-3" />
          </a>
          {open ? <ChevronUp className="h-4 w-4 text-muted-brand" /> : <ChevronDown className="h-4 w-4 text-muted-brand" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border p-3">
          {kind === "pdf" && (
            <div className="relative">
              <ResolvedFileViewer url={url} title={title} kind="pdf" heightClass="h-[60vh]" />
              {onAskAI && (
                <button
                  type="button"
                  onClick={onAskAI}
                  className={cn(
                    "absolute bottom-3 right-3 z-10",
                    "inline-flex items-center gap-1.5 rounded-full",
                    "bg-primary px-3.5 py-2 text-xs font-extrabold text-white",
                    "shadow-lg hover:opacity-90",
                    "focus-visible:outline-none focus-visible:ring-2",
                    "focus-visible:ring-primary focus-visible:ring-offset-2"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Ask AI
                </button>
              )}
            </div>
          )}
          {kind === "image" && <ResolvedFileViewer url={url} title={title} kind="image" heightClass="h-[60vh]" />}
        </div>
      )}
    </div>
  );
}

function computeWeakQuestionNextDue(missCount: number, fromIso: string): string {
  const daysMap: Record<number, number> = { 1: 1, 2: 1 };
  const days = daysMap[missCount] ?? Math.min(Math.pow(2, missCount - 2), 30);
  const base = new Date(fromIso).getTime();
  return new Date(base + days * 86_400_000).toISOString();
}

function PreviewModal({
  open,
  onClose,
  title,
  url,
  kind,
  page,
  resumeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
  kind: "pdf" | "image" | "other";
  page?: number;
  resumeLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full flex-col md:m-auto md:h-auto md:w-[90vw] md:max-w-4xl md:rounded-3xl md:border md:border-border md:shadow-2xl bg-card">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            {normalizedPage(page) && (
              <p className="mt-0.5 text-[11px] font-semibold text-muted-brand">Go to page {normalizedPage(page)}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a href={kind === "pdf" ? withPdfPage(url, page) : url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary/50">
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
            {resumeLabel && (
              <button type="button" onClick={onClose}
                className="hidden items-center gap-2 rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 md:inline-flex">
                <ArrowLeft className="h-3.5 w-3.5" /> {resumeLabel}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-2xl border border-border bg-background hover:bg-secondary/50" aria-label="Close preview">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-3 md:flex-none">
          {kind === "pdf" && <ResolvedFileViewer url={url} title={title} kind="pdf" page={page} heightClass="h-[calc(100vh-6rem)] md:h-[75vh]" />}
          {kind === "image" && <ResolvedFileViewer url={url} title={title} kind="image" heightClass="h-[calc(100vh-6rem)] md:h-[75vh]" />}
          {kind === "other" && (
            <div className="grid h-48 place-items-center p-6 text-center">
              <div>
                <p className="text-sm font-semibold text-foreground">Preview not available</p>
                <p className="mt-1 text-sm text-muted-brand">Tap "Open" to view in a new tab.</p>
              </div>
            </div>
          )}
        </div>
        {resumeLabel && (
          <div className="shrink-0 border-t border-border p-3 md:hidden">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              <ArrowLeft className="h-4 w-4" /> {resumeLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewBeforeAnswer({
  question,
  canReadSource,
  onReadSource,
  onHide,
}: {
  question: GeneratedQuestion;
  canReadSource: boolean;
  onReadSource: (page?: number) => void;
  onHide: () => void;
}) {
  const ref = question.studyRef;
  const page = normalizedPage(ref?.page);
  const instruction = ref?.instruction?.trim() || question.hint?.trim() || "Review the relevant part of the material before answering.";
  const topic = ref?.topic?.trim();
  const quote = ref?.quote?.trim();
  const sourceLabel = ref?.chunkId ? "Source-backed" : null;

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-3 dark:border-amber-700/40 dark:bg-amber-950/20">
      <div className="flex items-start gap-2.5">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-extrabold text-amber-900 dark:text-amber-200">Review this first</p>
            {topic && (
              <span className="rounded-full border border-amber-300/70 bg-white/70 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
                {topic}
              </span>
            )}
            {sourceLabel && (
              <span className="rounded-full border border-emerald-300/70 bg-white/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                {sourceLabel}
              </span>
            )}
            {page && (
              <span className="rounded-full border border-amber-300/70 bg-white/70 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
                {ref?.chunkId ? `Source: Page ${page}` : `Page ${page}`}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-300">
            {instruction}
          </p>
          {quote && (
            <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-[11px] font-medium leading-relaxed text-amber-900/80 dark:border-amber-700 dark:text-amber-200/80">
              {quote}
            </blockquote>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {canReadSource && (
              <button
                type="button"
                onClick={() => onReadSource(page)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <FileText className="h-3.5 w-3.5" />
                Read source
              </button>
            )}
            <button
              type="button"
              onClick={onHide}
              className="inline-flex items-center rounded-xl border border-amber-300/70 bg-white/70 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300"
            >
              Hide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function MaterialDetailClient({
  material: m, initialSaved = false, relatedMaterials: initialRelatedMaterials = [], fromCourse = null,
}: {
  material: Material; initialSaved?: boolean; relatedMaterials?: any[]; fromCourse?: string | null;
}) {
  const kind = detectKind(m);
  const badge = fileTypeBadge(kind, m);
  const course = m.study_courses;
  const title = (m.title ?? course?.course_code ?? "Untitled material").trim();
  const fileUrl = m.file_path ? `/api/study/materials/${m.id}/download` : "";
  const hasFile = fileUrl.length > 0;

  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);
  const [downloads, setDownloads] = useState(m.downloads ?? 0);
  const [uploaderIsRep, setUploaderIsRep] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [readingRef, setReadingRef] = useState<{ open: boolean; page?: number; studyRef?: GuidedStudyRef } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const upvoteCount = m.up_votes ?? 0;
  const [relatedMaterials] = useState<any[]>(initialRelatedMaterials);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [genQsError, setGenQsError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[] | null>(null);
  const [savingQs, setSavingQs] = useState(false);
  const [savedSetId, setSavedSetId] = useState<string | null>(null);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [generateMoreError, setGenerateMoreError] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState<Record<number, boolean>>({});
  const [generationAi, setGenerationAi] = useState<AiGenerationMeta | null>(null);

  // Quiz state machine
  const [quizState, setQuizState] = useState<"idle" | "config" | "loading" | "quiz" | "results">("idle");
  const [quizConfig, setQuizConfig] = useState<{ count: number; difficulty: "easy" | "mixed" | "hard"; focus: string }>({ count: 10, difficulty: "mixed", focus: "" });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { chosen: string; correct: boolean; skipped: boolean }>>({});
  const [retryPool, setRetryPool] = useState<GeneratedQuestion[] | null>(null);
  const syncedQuizMissesRef = useRef<string | null>(null);


  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);
  useEffect(() => { if (!chatOpen) return; chatInputRef.current?.focus(); }, [chatOpen]);
  useEffect(() => {
    setUploaderIsRep(false);
    if (!m.uploader_id) return;

    void (async () => {
      try {
        const { data } = await supabase
          .from("study_reps")
          .select("user_id, role, active")
          .eq("user_id", m.uploader_id)
          .eq("active", true)
          .maybeSingle();
        if (data?.user_id) setUploaderIsRep(true);
      } catch {}
    })();
  }, [m.uploader_id]);

  // Hide bottom nav while quiz sheet is open
  useEffect(() => {
    if (quizState !== "idle") {
      document.body.setAttribute("data-hide-nav", "true");
    } else {
      document.body.removeAttribute("data-hide-nav");
    }
    return () => { document.body.removeAttribute("data-hide-nav"); };
  }, [quizState]);


  const qs = generatedQuestions ?? [];
  const currentAnswer = answers[currentQuestionIndex];
  const correctCount = Object.values(answers).filter((a) => a.correct).length;
  const skippedCount = Object.values(answers).filter((a) => a.skipped).length;
  const missedList = qs
    .map((q, i) => ({ q, i, ans: answers[i] }))
    .filter(({ ans }) => ans && !ans.correct && !ans.skipped);

  useEffect(() => {
    if (quizState !== "results" || !savedSetId || missedList.length === 0) return;

    const syncKey = `${savedSetId}:${missedList.map(({ i }) => i).join(",")}`;
    if (syncedQuizMissesRef.current === syncKey) return;
    syncedQuizMissesRef.current = syncKey;

    type ExistingWeakRow = {
      question_id: string;
      miss_count: number | null;
      correct_streak: number | null;
      last_missed_at: string | null;
    };

    type SavedQuestionRow = {
      id: string;
      prompt: string | null;
      position: number | null;
    };

    void (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return;

        const { data: dbQuestions } = await supabase
          .from("study_quiz_questions")
          .select("id, prompt, position")
          .eq("set_id", savedSetId)
          .order("position", { ascending: true });

        const orderedQuestions = (dbQuestions ?? []) as SavedQuestionRow[];
        if (orderedQuestions.length === 0) return;

        const mappedQuestionIds = missedList
          .map(({ i }) => orderedQuestions[i]?.id ?? null)
          .filter((questionId): questionId is string => Boolean(questionId));

        if (mappedQuestionIds.length === 0) return;

        const { data: existingRows } = await supabase
          .from("study_weak_questions")
          .select("question_id, miss_count, correct_streak, last_missed_at")
          .eq("user_id", userId)
          .in("question_id", mappedQuestionIds);

        const existingMap = new Map<string, ExistingWeakRow>();
        for (const row of (existingRows ?? []) as ExistingWeakRow[]) {
          existingMap.set(row.question_id, row);
        }

        const nowIso = new Date().toISOString();
        const upsertRows = mappedQuestionIds.map((questionId) => {
          const existing = existingMap.get(questionId);
          const missCount = (existing?.miss_count ?? 0) + 1;
          return {
            user_id: userId,
            question_id: questionId,
            miss_count: missCount,
            last_missed_at: nowIso,
            next_due_at: computeWeakQuestionNextDue(missCount, nowIso),
            correct_streak: 0,
            graduated_at: null,
            updated_at: nowIso,
          };
        });

        await supabase
          .from("study_weak_questions")
          .upsert(upsertRows, { onConflict: "user_id,question_id" });
      } catch {
        // non-critical — SRS failure must never break the quiz UX
      }
    })();
  }, [missedList, quizState, savedSetId]);

  async function handleToggleSave() {
    setSaving(true);
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      await toggleSaved({ itemType: "material", materialId: m.id });
      showToast(wasSaved ? "Removed from Saved" : "Saved");
    } catch (e: any) {
      setSaved(wasSaved);
      showToast(e?.message ?? "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    setDownloads((d) => d + 1);
    showToast("Download started");
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : `https://jabu.edu.ng/study/materials/${m.id}`;
    const shareTitle = m.title ?? "Study material";
    const text = [shareTitle, course ? `${course.course_code} · ${course.level}L` : ""].filter(Boolean).join(" — ");
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: shareTitle, text, url }); return; } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(url); showToast("Link copied to clipboard"); }
    catch { showToast("Could not copy link"); }
  }

  async function handleGenerateQuestions() {
    setQuizState("loading");
    setGenQsError(null);
    setGenerationAi(null);
    setSavedSetId(null);
    syncedQuizMissesRef.current = null;
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          count: quizConfig.count,
          difficulty: quizConfig.difficulty,
          focus: quizConfig.focus || undefined,
        }),
      });
      const data = await readGenerateQuestionsResponse(res);
      if (!res.ok) {
        console.warn("[study-ai] question generation failed", {
          provider: data.ai?.provider ?? "unknown",
          model: data.ai?.model ?? "unknown",
          error: data.ai?.error ?? data.error ?? null,
        });
        throw new Error(data.error ?? "Failed to generate questions.");
      }
      if (!Array.isArray(data.questions)) {
        throw new Error("Failed to generate questions.");
      }
      console.info("[study-ai] generated questions", {
        provider: data.ai?.provider ?? "unknown",
        model: data.ai?.model ?? "unknown",
        inputMode: data.ai?.inputMode ?? "unknown",
        reason: data.ai?.reason ?? null,
        fallbackProvider: data.ai?.fallbackProvider ?? null,
        fallbackReason: data.ai?.fallbackReason ?? null,
        count: data.questions.length,
      });
      setGeneratedQuestions(data.questions);
      setGenerationAi(data.ai ?? null);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setRetryPool(null);
      setHintShown({});
      setQuizState("quiz");
    } catch (e: unknown) {
      setGenQsError(e instanceof Error ? e.message : "Something went wrong.");
      setQuizState("config");
    }
  }

  async function handleGenerateMore() {
    setGeneratingMore(true);
    setGenerateMoreError(null);
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          count: quizConfig.count,
          difficulty: quizConfig.difficulty,
          focus: quizConfig.focus || undefined,
          coveredQuestions: generatedQuestions?.map((q) => q.question) ?? [],
        }),
      });
      const data = await readGenerateQuestionsResponse(res);
      if (!res.ok) {
        console.warn("[study-ai] generate more failed", {
          provider: data.ai?.provider ?? "unknown",
          model: data.ai?.model ?? "unknown",
          error: data.ai?.error ?? data.error ?? null,
        });
        throw new Error(data.error ?? "Failed to generate questions.");
      }
      if (!Array.isArray(data.questions)) {
        throw new Error("Failed to generate questions.");
      }
      console.info("[study-ai] generated more questions", {
        provider: data.ai?.provider ?? "unknown",
        model: data.ai?.model ?? "unknown",
        inputMode: data.ai?.inputMode ?? "unknown",
        reason: data.ai?.reason ?? null,
        fallbackProvider: data.ai?.fallbackProvider ?? null,
        fallbackReason: data.ai?.fallbackReason ?? null,
        count: data.questions.length,
      });
      setGeneratedQuestions(data.questions);
      setGenerationAi(data.ai ?? null);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setRetryPool(null);
      setHintShown({});
      setSavedSetId(null);
      syncedQuizMissesRef.current = null;
      setQuizState("quiz");
    } catch (e: unknown) {
      setGenerateMoreError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setGeneratingMore(false);
    }
  }

  async function handleSaveQuestions() {
    if (!generatedQuestions) return;
    setSavingQs(true);
    try {
      const res = await fetch("/api/ai/save-generated-questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: m.id, questions: generatedQuestions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedSetId(data.setId);
      syncedQuizMissesRef.current = null;
    } finally { setSavingQs(false); }
  }

  async function handleChatSend() {
    const message = chatInput.trim();
    if (!message || chatLoading) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: message };
    const modelMessageId = crypto.randomUUID();
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);
    try {
      const res = await fetch("/api/ai/material-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: m.id, message, history: chatHistory }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error ?? "Chat failed."); }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let modelText = "";
      setChatHistory([...updatedHistory, { id: modelMessageId, role: "model", text: "" }]);
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          modelText += decoder.decode(value, { stream: true });
          setChatHistory([...updatedHistory, { id: modelMessageId, role: "model", text: modelText }]);
        }
      }
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : "Something went wrong.");
      setChatHistory(chatHistory);
    } finally { setChatLoading(false); }
  }

  const MetaPill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
      {children}
    </span>
  );

  return (
    <div className="space-y-3 pb-28 md:pb-8">

      {/* Back */}
      <div>
        <Link
          href={fromCourse ? `/study/courses/${encodeURIComponent(fromCourse)}` : "/study/library"}
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ArrowLeft className="h-4 w-4" />
          {fromCourse ?? "Materials"}
        </Link>
      </div>

      {/* ══ HERO CARD ══ */}
      <div className="overflow-hidden rounded-3xl border border-border shadow-sm">

        {/* Purple gradient banner */}
        <div className="relative bg-gradient-to-br from-primary to-primary/60 px-5 pt-5 pb-6">
          <div className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/[0.06]" />
          <div className="pointer-events-none absolute -bottom-8 left-4 h-24 w-24 rounded-full bg-white/[0.04]" />

          {/* Context chips */}
          <div className="relative mb-4 flex flex-wrap items-center gap-1.5">
            {course?.course_code && <MetaPill>{course.course_code}</MetaPill>}
            {course?.level && <MetaPill>{course.level}L</MetaPill>}
            {course?.semester && <MetaPill>{course.semester} sem</MetaPill>}
            {m.session && <MetaPill>{m.session}</MetaPill>}
          </div>

          {/* Icon + title */}
          <div className="relative flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 text-white">
              <FileIcon kind={kind} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-[family-name:var(--font-bricolage)] text-xl font-bold leading-snug tracking-tight text-white">{title}</h1>
                {m.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </span>
                )}
                {m.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                    <Star className="h-3 w-3" /> Featured
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <MetaPill>{badge}</MetaPill>
                {m.material_type && <MetaPill>{formatMaterialType(m.material_type)}</MetaPill>}
                <MetaPill><Clock className="mr-1 h-2.5 w-2.5" />{timeAgo(m.created_at)}</MetaPill>
              </div>
            </div>
          </div>

          {m.description && (
            <p className="relative mt-3 text-sm leading-relaxed text-white/75">{m.description}</p>
          )}
        </div>

        {/* Action area */}
        <div className="space-y-4 bg-card px-5 pb-5 pt-4">
          <div className="rounded-3xl border border-border bg-background p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-brand">File actions</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Download, save, or share this material.</p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-brand">
                {badge}
              </span>
            </div>

          {/* Primary action row */}
          <div className="flex items-center gap-2">
            <a href={hasFile ? `/api/study/materials/${m.id}/download` : "#"} download
              onClick={(e) => { if (!hasFile) { e.preventDefault(); return; } handleDownload(); }}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold no-underline transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                !hasFile ? "pointer-events-none border border-border/60 bg-muted text-muted-brand"
                  : "bg-primary text-white hover:opacity-90 active:scale-[0.98]"
              )}>
              <Download className="h-4 w-4" /> Download PDF
            </a>

            <button type="button" onClick={handleToggleSave} disabled={saving} aria-label={saved ? "Remove from library" : "Save to library"}
              className={cn(
                "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                saved ? "border-primary/30 bg-primary-light text-primary-text" : "border-border/60 bg-background text-foreground hover:bg-secondary/50",
                saving ? "opacity-60" : ""
              )}>
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>

            <button type="button" onClick={handleShare} aria-label="Share"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background text-foreground transition hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-brand">
            {downloads.toLocaleString("en-NG")} downloads
            {upvoteCount > 0 && ` · ${upvoteCount} found helpful`}
          </p>

          </div>

          {/* AI feature cluster */}
          {(isAiGenSupported(m) || kind === "pdf") && (
          <div className="space-y-3 rounded-3xl border border-primary/20 bg-primary-light/40 p-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">AI study tools</p>
              <p className="mt-1 text-sm font-semibold text-primary-text">Turn this file into practice or ask questions about it.</p>
            </div>

            <div className="space-y-2">
            {/* Generate practice questions */}
            {isAiGenSupported(m) && (
              <button type="button"
                onClick={() => setQuizState("config")}
                className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary-light/70 px-4 py-3.5 text-left transition hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-primary-text">Generate Practice Questions</p>
                  <p className="text-xs text-primary/70">AI-powered exam prep from this material</p>
                </div>
              </button>
            )}

            {kind === "pdf" && (
              <button type="button" onClick={() => setChatOpen((v) => !v)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  chatOpen
                    ? "border-primary/30 bg-primary-light"
                    : "border-border/60 bg-background hover:bg-secondary/40"
                )}>
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", chatOpen ? "bg-primary text-white" : "bg-secondary text-muted-brand")}>
                  <Send className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-bold", chatOpen ? "text-primary-text" : "text-foreground")}>Ask AI</p>
                  <p className="text-xs text-muted-brand">Ask anything about this PDF</p>
                </div>
              </button>
            )}
            </div>

            {/* Chat panel */}
            {kind === "pdf" && chatOpen && (
        <div id="material-chat-panel" className="overflow-hidden rounded-2xl border border-primary/25 bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Ask AI about this material</p>
            </div>
            <div className="flex items-center gap-2">
              {chatHistory.length > 0 && (
                <button type="button" onClick={() => { setChatHistory([]); setChatError(null); }}
                  className="rounded-xl border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-brand transition hover:bg-secondary/30 hover:text-foreground">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setChatOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-xl border border-border/60 text-muted-brand hover:bg-secondary/40">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto px-4 py-3">
            {chatHistory.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-brand">
                Ask anything about this document. AI answers only from its content.
              </p>
            )}
            {chatHistory.map((msg) => (
              <div key={msg.id} className={cn("max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "user" ? "ml-auto bg-primary text-white" : "mr-auto bg-primary-light text-primary-text")}>
                {msg.text || (<span className="flex items-center gap-1.5 text-primary/60"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</span>)}
              </div>
            ))}
            {chatError && <p className="text-center text-xs text-red-500">{chatError}</p>}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
            <input ref={chatInputRef} type="text" value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleChatSend(); }}
              placeholder="Ask a question…" disabled={chatLoading}
              className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />
            <button type="button" onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white transition hover:opacity-90 disabled:opacity-50">
              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Inline preview */}
      {hasFile && (
        <InlinePreview
          url={fileUrl}
          title={title}
          kind={kind}
          onAskAI={kind === "pdf" ? () => {
            setChatOpen(true);
            setTimeout(() => {
              document.getElementById("material-chat-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
          } : undefined}
        />
      )}

      {/* About card */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-brand">About this material</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="text-xs text-muted-brand">Course</p>
            {course ? (
              <>
                <p className="mt-1 text-base font-bold text-foreground">{course.course_code}</p>
                {course.course_title && <p className="mt-0.5 text-xs text-muted-brand line-clamp-1">{course.course_title}</p>}
                <Link href={`/study/courses/${encodeURIComponent(course.course_code)}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  View course <ArrowRight className="h-3 w-3" />
                </Link>
              </>
            ) : <p className="mt-1 text-sm text-muted-brand">—</p>}
          </div>
          <div>
            <p className="text-xs text-muted-brand">Level</p>
            <p className="mt-1 text-base font-bold text-foreground">{course?.level ? `${course.level}L` : "—"}</p>
            {m.verified && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
        </div>
        <div className="my-4 border-t border-border/60" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-light text-[11px] font-bold text-primary">
              {getInitials(m.uploader_email)}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-brand">Uploaded by</p>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate text-xs font-semibold text-foreground">
                  {m.uploader_email ? obfuscateEmail(m.uploader_email) : "A student"}
                </p>
                {uploaderIsRep && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                      "border border-primary/30 bg-primary-light text-[10px] font-semibold",
                      "text-primary-text dark:border-primary/40 dark:bg-primary/10",
                      "dark:text-indigo-200"
                    )}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Course Rep
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-muted-brand">Downloads</p>
            <p className="text-xl font-bold text-foreground">{downloads.toLocaleString("en-NG")}</p>
          </div>
        </div>
      </div>

      {/* Related materials */}
      {relatedMaterials.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-brand">Related materials</p>
            <p className="mt-1 text-sm font-semibold text-foreground">More for {course?.course_code ?? "this course"}</p>
          </div>
          <div className="space-y-2">
            {relatedMaterials.map((r) => (
              <Link key={r.id} href={`/study/materials/${r.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 no-underline transition hover:bg-secondary/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{r.title ?? "Untitled"}</p>
                  <p className="mt-0.5 text-xs text-muted-brand">{r.material_type?.replace("_", " ")} · {r.downloads ?? 0} downloads</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-brand" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Report */}
      <div className="rounded-2xl border border-border/50 bg-background p-3 text-center">
        <Link href="/study/report" className="inline-flex items-center gap-1.5 text-xs text-muted-brand transition hover:text-foreground">
          Something wrong with this material? Report it →
        </Link>
      </div>

      {/* Preview modal */}
      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} title={title} url={fileUrl} kind={kind} />
      <GuidedSourceModal
        open={Boolean(readingRef?.open)}
        onResume={() => setReadingRef(null)}
        materialId={m.id}
        title={title}
        filePath={m.file_path}
        materialType={m.material_type}
        studyRef={readingRef?.studyRef}
        page={readingRef?.page}
      />

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div role="status" className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Practice Questions Sheet — config / loading / quiz / results */}
      {quizState !== "idle" && (() => {
        const currentQ = qs[currentQuestionIndex];
        const answered = currentAnswer !== undefined;
        const scoreRingR = 40;
        const scoreRingCx = 50;
        const scoreRingCirc = 2 * Math.PI * scoreRingR;
        const scoreRingPct = qs.length === 0 ? 0 : Math.round((correctCount / qs.length) * 100);
        const scoreRingOffset = scoreRingCirc * (1 - scoreRingPct / 100);
        const scoreRingColor = scoreRingPct >= 80 ? "#22c55e" : scoreRingPct >= 60 ? "#f59e0b" : "#ef4444";

        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setQuizState("idle")} />
            <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-3xl bg-card shadow-2xl">
              {/* Sheet header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {quizState === "config" ? "Configure Questions" :
                     quizState === "loading" ? "Generating…" :
                     quizState === "quiz" ? `Q ${currentQuestionIndex + 1} / ${qs.length}` :
                     "Results"}
                  </p>
                  {quizState === "quiz" && (
                    <p className="text-xs text-primary font-semibold">{correctCount}/{currentQuestionIndex} correct</p>
                  )}
                  {generationAi && (quizState === "quiz" || quizState === "results") && (
                    <p
                      className="mt-1 max-w-[300px] truncate text-[11px] font-semibold text-muted-brand"
                      title={`${generationAi.provider} · ${generationAi.model} · ${generationAi.inputMode}`}
                    >
                      {formatAiProvider(generationAi)} · {formatAiModel(generationAi)}
                    </p>
                  )}
                  {generationAi?.fallbackReason && (quizState === "quiz" || quizState === "results") && (
                    <p
                      className="mt-0.5 max-w-[300px] line-clamp-2 text-[10px] font-medium leading-snug text-amber-700"
                      title={generationAi.fallbackReason}
                    >
                      Fallback: {generationAi.fallbackReason}
                    </p>
                  )}
                  {generationAi && formatAiReason(generationAi) && (quizState === "quiz" || quizState === "results") && (
                    <p
                      className="mt-0.5 max-w-[300px] line-clamp-2 text-[10px] font-medium leading-snug text-muted-brand"
                      title={formatAiReason(generationAi)}
                    >
                      {formatAiReason(generationAi)}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setQuizState("idle")}
                  className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-muted-brand hover:bg-secondary/50 focus-visible:outline-none">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ── Panel A: Config ── */}
              {quizState === "config" && (
                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">Number of questions</p>
                    <div className="flex gap-2">
                      {([5, 10, 15, 20] as const).map((n) => (
                        <button key={n} type="button"
                          onClick={() => setQuizConfig((c) => ({ ...c, count: n }))}
                          className={cn("flex-1 rounded-xl border py-2.5 text-sm font-semibold transition focus-visible:outline-none",
                            quizConfig.count === n
                              ? "border-primary bg-primary text-white"
                              : "border-border bg-background text-foreground hover:bg-secondary/50"
                          )}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">Difficulty</p>
                    <div className="flex flex-col gap-2">
                      {([
                        { value: "easy", label: "Easy warm-up", sub: "Recall & definitions" },
                        { value: "mixed", label: "Mixed", sub: "Recall, application & analysis" },
                        { value: "hard", label: "Exam-hard", sub: "Deep understanding & application" },
                      ] as const).map(({ value, label, sub }) => (
                        <button key={value} type="button"
                          onClick={() => setQuizConfig((c) => ({ ...c, difficulty: value }))}
                          className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none",
                            quizConfig.difficulty === value
                              ? "border-primary bg-primary-light"
                              : "border-border bg-background hover:bg-secondary/40"
                          )}>
                          <div className={cn("h-4 w-4 shrink-0 rounded-full border-2",
                            quizConfig.difficulty === value ? "border-primary bg-primary" : "border-border")} />
                          <div>
                            <p className={cn("text-sm font-semibold", quizConfig.difficulty === value ? "text-primary-text" : "text-foreground")}>{label}</p>
                            <p className="text-xs text-muted-brand">{sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">Focus area <span className="normal-case font-normal text-muted-brand">(optional)</span></p>
                    <input type="text" value={quizConfig.focus}
                      onChange={(e) => setQuizConfig((c) => ({ ...c, focus: e.target.value }))}
                      placeholder="e.g. continuity and limits"
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  </div>

                  {genQsError && <p className="text-center text-xs text-red-500">{genQsError}</p>}

                  <div className="pb-4">
                    <button type="button" onClick={handleGenerateQuestions}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <Sparkles className="h-4 w-4" />
                      Generate {quizConfig.count} questions
                    </button>
                  </div>
                </div>
              )}

              {/* ── Panel B: Loading ── */}
              {quizState === "loading" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-brand">Generating {quizConfig.count} questions…</p>
                </div>
              )}

              {/* ── Panel C: Quiz ── */}
              {quizState === "quiz" && currentQ && (
                <>
                  {/* Progress bar */}
                  <div className="h-1 bg-secondary">
                    <div className="h-full bg-primary transition-all"
                      style={{ width: `${((currentQuestionIndex + 1) / qs.length) * 100}%` }} />
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-5 pb-36">
                    <p className="mb-4 text-sm font-bold text-foreground leading-relaxed">
                      {currentQuestionIndex + 1}. {currentQ.question}
                    </p>
                    {(currentQ.studyRef?.chunkId || currentQ.questionKind || currentQ.cognitiveLevel) && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {currentQ.studyRef?.chunkId && (
                          <span className="rounded-full border border-emerald-300/70 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                            Source-backed
                          </span>
                        )}
                        {currentQ.questionKind && (
                          <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[10px] font-bold text-muted-brand">
                            {currentQ.questionKind.replace(/_/g, " ")}
                          </span>
                        )}
                        {currentQ.cognitiveLevel && (
                          <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[10px] font-bold text-muted-brand">
                            {currentQ.cognitiveLevel}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Hint */}
                    {(currentQ.hint || currentQ.studyRef) && !answered && (
                      <div className="mb-4">
                        {hintShown[currentQuestionIndex] ? (
                          <ReviewBeforeAnswer
                            question={currentQ}
                            canReadSource={hasFile}
                            onReadSource={(page) => setReadingRef({ open: true, page, studyRef: currentQ.studyRef })}
                            onHide={() => setHintShown((prev) => ({ ...prev, [currentQuestionIndex]: false }))}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setHintShown((prev) => ({ ...prev, [currentQuestionIndex]: true }))}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/40"
                          >
                            <Lightbulb className="h-3.5 w-3.5" />
                            Show hint
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {(["A", "B", "C", "D"] as const).map((key) => {
                        const isCorrect = currentQ.answer === key;
                        const isChosen = currentAnswer?.chosen === key;
                        return (
                          <button key={key} type="button"
                            disabled={answered}
                            onClick={() => {
                              if (answered) return;
                              setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: { chosen: key, correct: isCorrect, skipped: false } }));
                            }}
                            className={cn(
                              "flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm text-left transition focus-visible:outline-none",
                              !answered && "hover:bg-secondary/50 border-border/60 text-foreground",
                              answered && isCorrect && "border-primary bg-primary-light font-semibold text-primary-text",
                              answered && isChosen && !isCorrect && "border-red-400 bg-red-50 font-semibold text-red-700",
                              answered && !isCorrect && !isChosen && "border-border/40 text-muted-brand opacity-60",
                            )}>
                            <span className="shrink-0 font-bold">{key}.</span>
                            <span>{currentQ.options[key]}</span>
                          </button>
                        );
                      })}
                    </div>
                    {answered && (
                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary-light/60 px-4 py-3">
                        <p className="text-xs leading-relaxed text-primary-text/85">
                          <span className="font-semibold">Explanation: </span>{currentQ.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex gap-2 border-t border-border bg-card px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button type="button"
                      onClick={() => {
                        if (!answered) setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: { chosen: "", correct: false, skipped: true } }));
                        if (currentQuestionIndex + 1 >= qs.length) {
                          setQuizState("results");
                        } else {
                          setCurrentQuestionIndex((i) => i + 1);
                        }
                      }}
                      className="flex-1 rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-brand transition hover:bg-secondary/50 focus-visible:outline-none">
                      Skip
                    </button>
                    <button type="button"
                      disabled={!answered}
                      onClick={() => {
                        if (currentQuestionIndex + 1 >= qs.length) {
                          setQuizState("results");
                        } else {
                          setCurrentQuestionIndex((i) => i + 1);
                        }
                      }}
                      className="flex-[2] rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-none">
                      Next →
                    </button>
                  </div>
                </>
              )}

              {/* ── Panel D: Results ── */}
              {quizState === "results" && (
                <div className="flex-1 overflow-y-auto px-4 py-5 pb-40 space-y-5">
                  {/* Score ring */}
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <svg width={100} height={100} viewBox="0 0 100 100">
                      <circle cx={scoreRingCx} cy={scoreRingCx} r={scoreRingR} fill="none" stroke="currentColor" strokeWidth={8} opacity={0.1} />
                      <circle cx={scoreRingCx} cy={scoreRingCx} r={scoreRingR} fill="none"
                        stroke={scoreRingColor} strokeWidth={8}
                        strokeDasharray={scoreRingCirc} strokeDashoffset={scoreRingOffset}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${scoreRingCx} ${scoreRingCx})`} />
                      <text x={scoreRingCx} y={scoreRingCx} textAnchor="middle" dominantBaseline="central"
                        fontSize={18} fontWeight={700} fill="currentColor" fontFamily="var(--font-bricolage)">{correctCount}/{qs.length}</text>
                    </svg>
                    <p className="text-sm font-semibold text-foreground">
                      {scoreRingPct >= 80 ? "Excellent!" : scoreRingPct >= 60 ? "Good effort" : "Keep practising"}
                    </p>
                  </div>

                  {/* Stat pills */}
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl border border-border bg-background py-3 text-center">
                      <p className="text-lg font-bold text-primary">{correctCount}</p>
                      <p className="text-[10px] text-muted-brand uppercase tracking-wide">Correct</p>
                    </div>
                    <div className="flex-1 rounded-xl border border-border bg-background py-3 text-center">
                      <p className="text-lg font-bold text-red-500">{missedList.length}</p>
                      <p className="text-[10px] text-muted-brand uppercase tracking-wide">Missed</p>
                    </div>
                    <div className="flex-1 rounded-xl border border-border bg-background py-3 text-center">
                      <p className="text-lg font-bold text-muted-brand">{skippedCount}</p>
                      <p className="text-[10px] text-muted-brand uppercase tracking-wide">Skipped</p>
                    </div>
                  </div>

                  {/* Missed questions list */}
                  {missedList.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-brand">Missed questions</p>
                      {missedList.map(({ q, i, ans }) => (
                        <div key={i} className="rounded-2xl border border-border bg-background p-4 space-y-2">
                          <p className="text-sm font-semibold text-foreground">{q.question}</p>
                          <div className="flex gap-2 text-xs">
                            {ans?.chosen && (
                              <span className="rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-red-700 font-medium">
                                You: {ans.chosen}. {q.options[ans.chosen as "A"|"B"|"C"|"D"]}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-primary font-semibold">
                            Correct: {q.answer}. {q.options[q.answer]}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Results footer */}
              {quizState === "results" && (
                <div className="absolute inset-x-0 bottom-0 space-y-2 border-t border-border bg-card px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {generateMoreError && (
                    <p className="text-center text-xs font-semibold text-rose-600">{generateMoreError}</p>
                  )}
                  {/* Generate more */}
                  <button type="button"
                    onClick={handleGenerateMore}
                    disabled={generatingMore}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary bg-primary-light px-4 py-3 text-sm font-semibold text-primary-text transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none">
                    {generatingMore
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                      : <><Sparkles className="h-4 w-4" /> Generate {quizConfig.count} more questions</>
                    }
                  </button>
                  {missedList.length > 0 && (
                    <button type="button"
                      onClick={() => {
                        const missed = missedList.map(({ q }) => q);
                        setGeneratedQuestions(missed);
                        setRetryPool(missed);
                        setAnswers({});
                        setCurrentQuestionIndex(0);
                        setHintShown({});
                        syncedQuizMissesRef.current = null;
                        setQuizState("quiz");
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary/50 focus-visible:outline-none">
                      <RotateCcw className="h-4 w-4" />
                      Retry missed ({missedList.length})
                    </button>
                  )}
                  {savedSetId ? (
                    <Link href="/study/practice"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none">
                      Saved — view on practice page →
                    </Link>
                  ) : (
                    <button type="button" onClick={handleSaveQuestions} disabled={savingQs}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus-visible:outline-none">
                      {savingQs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {savingQs ? "Saving…" : "Save to practice library"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
