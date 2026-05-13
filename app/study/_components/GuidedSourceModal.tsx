"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HighlightedPdfViewer } from "./HighlightedPdfViewer";

export type GuidedStudyRef = {
  chunkId?: string;
  topic?: string;
  instruction?: string;
  quote?: string;
  page?: number;
} | null | undefined;

type GuidedSourceModalProps = {
  open: boolean;
  onResume: () => void;
  materialId: string | null | undefined;
  title: string;
  filePath?: string | null;
  materialType?: string | null;
  studyRef?: GuidedStudyRef;
  page?: number;
};

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

function fileKind(filePath?: string | null, materialType?: string | null): "pdf" | "image" | "other" {
  const src = `${filePath ?? ""} ${materialType ?? ""}`.toLowerCase();
  if (src.includes(".pdf") || src.includes("pdf")) return "pdf";
  if (/\.(png|jpg|jpeg|webp|gif)(\?|$|\s)/.test(src) || src.includes("image")) return "image";
  return "other";
}

function sourceSnippet(value: string, maxLength = 260) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
}

const GDOCS = (url: string) =>
  `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

function PdfSourceFrame({ url, page }: { url: string; page?: number }) {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const safePage = normalizedPage(page);
  const src = useFallback ? GDOCS(url) : withPdfPage(url, safePage);

  useEffect(() => {
    setLoading(true);
    setErrored(false);
  }, [src]);

  useEffect(() => {
    if (/Mobi|Android/i.test(navigator.userAgent)) setUseFallback(true);
  }, []);

  return (
    <div className="relative h-full min-h-[18rem] overflow-hidden rounded-2xl border border-border bg-background">
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Preparing source...</p>
          </div>
        </div>
      )}

      {errored ? (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-foreground">Source preview could not load</p>
            <p className="mt-1 text-xs text-muted-foreground">Open the source directly, then come back to the question.</p>
            <div className="mt-4 flex justify-center gap-2">
              {!useFallback ? (
                <button
                  type="button"
                  onClick={() => {
                    setUseFallback(true);
                    setErrored(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:opacity-90"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Try viewer
                </button>
              ) : null}
              <a
                href={withPdfPage(url, safePage)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#5B4FD9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4A3FC8]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open source
              </a>
            </div>
          </div>
        </div>
      ) : (
        <iframe
          key={src}
          title="Source preview"
          src={src}
          className="h-full w-full"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setErrored(true);
          }}
        />
      )}

      {safePage ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur">
          Go to page {safePage}
        </div>
      ) : null}
    </div>
  );
}

function ImageSourceFrame({ url, title, fallbackText }: { url: string; title: string; fallbackText?: string }) {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  return (
    <div className="relative grid h-full min-h-[18rem] place-items-center overflow-auto rounded-2xl border border-border bg-background">
      {loading ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {errored ? (
        <div className="p-6 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-foreground">Image preview could not load</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {fallbackText || "Open the source directly, then resume the question."}
          </p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          className="h-full max-h-full w-full object-contain"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setErrored(true);
          }}
          draggable={false}
        />
      )}
    </div>
  );
}

export function GuidedSourceModal({
  open,
  onResume,
  materialId,
  title,
  filePath,
  materialType,
  studyRef,
  page,
}: GuidedSourceModalProps) {
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [chunkText, setChunkText] = useState("");
  const [chunkPage, setChunkPage] = useState<number | undefined>(undefined);
  const [highlightFailed, setHighlightFailed] = useState(false);
  const [highlightFailureReason, setHighlightFailureReason] = useState("");
  const safePage = normalizedPage(page) ?? normalizedPage(studyRef?.page) ?? chunkPage;
  const kind = useMemo(() => fileKind(filePath, materialType), [filePath, materialType]);
  const topic = studyRef?.topic?.trim();
  const instruction = studyRef?.instruction?.trim() || "Review the source material, then return to answer the question.";
  const quote = studyRef?.quote?.trim();
  const chunkSnippet = chunkText ? sourceSnippet(chunkText) : "";
  const visibleQuote = quote || chunkSnippet;
  const highlightText = quote || chunkSnippet;
  const sourceBacked = Boolean(studyRef?.chunkId?.trim());
  const sourceStateLabel = sourceBacked
    ? "Source-backed"
    : safePage
      ? "Best effort page"
      : "Not indexed yet";
  const sourceStateNote = sourceBacked
    ? null
    : safePage
      ? "Highlight may not appear until this material is indexed and questions are regenerated."
      : "This question can still use the source, but it does not have an exact indexed page yet.";
  const sourceHref = materialId ? `/api/study/materials/${encodeURIComponent(materialId)}/download` : "";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onResume();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onResume]);

  useEffect(() => {
    if (!open || !materialId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResolvedUrl("");

    void (async () => {
      try {
        const res = await fetch(`/api/study/materials/${encodeURIComponent(materialId)}/download?preview=1`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = res.ok ? await res.json() : null;
        const signedUrl = typeof json?.url === "string" ? json.url : "";
        if (!res.ok || !signedUrl) throw new Error(json?.message ?? "Could not prepare source preview.");
        setResolvedUrl(signedUrl);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not prepare source preview.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, materialId, retryKey]);

  useEffect(() => {
    if (!open || !materialId || !studyRef?.chunkId) {
      setChunkText("");
      setChunkPage(undefined);
      return;
    }

    const controller = new AbortController();
    setChunkText("");
    setChunkPage(undefined);

    void (async () => {
      try {
        const res = await fetch(
          `/api/study/materials/${encodeURIComponent(materialId)}/chunks/${encodeURIComponent(studyRef.chunkId ?? "")}`,
          { cache: "no-store", signal: controller.signal }
        );
        const json = res.ok ? await res.json() : null;
        if (!res.ok || !json?.chunk) return;
        if (typeof json.chunk.text === "string") setChunkText(json.chunk.text);
        const pageNumber = normalizedPage(json.chunk.page_number);
        if (pageNumber) setChunkPage(pageNumber);
      } catch {
        if (!controller.signal.aborted) {
          setChunkText("");
          setChunkPage(undefined);
        }
      }
    })();

    return () => controller.abort();
  }, [open, materialId, studyRef?.chunkId]);

  useEffect(() => {
    if (open) {
      setHighlightFailed(false);
      setHighlightFailureReason("");
    }
  }, [open, resolvedUrl, safePage, highlightText]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onResume} />
      <div className="relative z-10 flex h-full flex-col bg-card md:m-auto md:h-[90vh] md:w-[92vw] md:max-w-5xl md:rounded-3xl md:border md:border-border md:shadow-2xl">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-extrabold text-foreground">Review this first</p>
                {topic ? (
                  <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
                    {topic}
                  </span>
                ) : null}
                {safePage ? (
                  <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
                    {sourceBacked ? `Source: Page ${safePage}` : `Page ${safePage}`}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    sourceBacked
                      ? "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : safePage
                        ? "border-blue-300/70 bg-blue-50 text-blue-800 dark:border-blue-700/50 dark:bg-blue-950/30 dark:text-blue-300"
                        : "border-zinc-300/70 bg-zinc-50 text-zinc-700 dark:border-zinc-700/50 dark:bg-zinc-950/30 dark:text-zinc-300"
                  )}
                >
                  {sourceStateLabel}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 text-xs font-semibold text-muted-foreground">{title}</p>
            </div>

            <button
              type="button"
              onClick={onResume}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-border bg-background hover:bg-secondary/50"
              aria-label="Resume question"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 text-sm font-medium leading-relaxed text-foreground">{instruction}</p>
          {sourceStateNote ? (
            <p className="mt-2 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-300">
              {sourceStateNote}
            </p>
          ) : null}
          {visibleQuote ? (
            <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-xs font-medium leading-relaxed text-muted-foreground dark:border-amber-700">
              {visibleQuote}
            </blockquote>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 p-3">
          {loading ? (
            <div className="grid h-full min-h-[18rem] place-items-center rounded-2xl border border-border bg-background">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Preparing source...</p>
              </div>
            </div>
          ) : error || !resolvedUrl ? (
            <div className="grid h-full min-h-[18rem] place-items-center rounded-2xl border border-border bg-background p-6 text-center">
              <div>
                <p className="text-sm font-semibold text-foreground">Source preview could not load</p>
                <p className="mt-1 text-xs text-muted-foreground">{error ?? "Open the source directly, then resume the question."}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRetryKey((key) => key + 1)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:opacity-90"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Try again
                  </button>
                  {sourceHref ? (
                    <a
                      href={kind === "pdf" ? withPdfPage(sourceHref, safePage) : sourceHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#5B4FD9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4A3FC8]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open source
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ) : kind === "pdf" ? (
            safePage && !highlightFailed ? (
              <HighlightedPdfViewer
                url={resolvedUrl}
                page={safePage}
                highlightText={highlightText}
                fallbackHighlightText={sourceBacked ? chunkSnippet : undefined}
                onFatalError={(message) => {
                  setHighlightFailureReason(message);
                  setHighlightFailed(true);
                }}
              />
            ) : (
              <div className="flex h-full min-h-[18rem] flex-col gap-2">
                {highlightFailed ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
                    Highlighted reader could not load this PDF, so we opened the normal source preview.
                    {highlightFailureReason ? <span className="font-medium"> {highlightFailureReason}</span> : null}
                  </div>
                ) : null}
                <div className="min-h-0 flex-1">
                  <PdfSourceFrame url={resolvedUrl} page={safePage} />
                </div>
              </div>
            )
          ) : kind === "image" ? (
            <ImageSourceFrame url={resolvedUrl} title={title} fallbackText={instruction} />
          ) : (
            <div className="grid h-full min-h-[18rem] place-items-center rounded-2xl border border-border bg-background p-6 text-center">
              <div className="max-w-md">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold text-foreground">Open the source to review</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {instruction || "This file type is best viewed outside the inline reader."}
                </p>
                {visibleQuote ? (
                  <blockquote className="mt-4 border-l-2 border-amber-300 pl-3 text-left text-xs font-medium leading-relaxed text-muted-foreground dark:border-amber-700">
                    {visibleQuote}
                  </blockquote>
                ) : null}
                {sourceHref ? (
                  <a
                    href={sourceHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#5B4FD9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4A3FC8]"
                  >
                    <ExternalLink className="h-4 w-4" /> Open source
                  </a>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:flex">
              {kind === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              Read the source, then answer from memory.
            </div>
            <div className="flex gap-2">
              {sourceHref ? (
                <a
                  href={kind === "pdf" ? withPdfPage(sourceHref, safePage) : sourceHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/50 sm:flex-none"
                >
                  <ExternalLink className="h-4 w-4" /> Open source
                </a>
              ) : null}
              <button
                type="button"
                onClick={onResume}
                className="inline-flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-[#5B4FD9] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4A3FC8] sm:flex-none"
              >
                <ArrowLeft className="h-4 w-4" /> Resume question
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
