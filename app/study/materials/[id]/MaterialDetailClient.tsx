"use client";

// app/study/materials/[id]/MaterialDetailClient.tsx

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Coins,
  Download,
  Eye,
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  PenLine,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { toggleSaved } from "@/lib/studySaved";
import { supabase } from "@/lib/supabase";
import { BetterExplanationInline, type BetterExplanationOptionKey } from "@/app/study/_components/BetterExplanationInline";
import { GuidedSourceModal, type GuidedStudyRef } from "@/app/study/_components/GuidedSourceModal";
import type { WrittenAnswerGrade } from "@/lib/types";

type QuestionType = "mcq" | "short_answer" | "theory";
type QuestionFormat = "mcq" | "mixed" | "written";
type OptionKey = "A" | "B" | "C" | "D";

type GeneratedMcqQuestion = {
  question_type?: "mcq" | null;
  question: string;
  options: Record<OptionKey, string>;
  answer: OptionKey;
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

type GeneratedWrittenQuestion = {
  question_type: "short_answer" | "theory";
  question: string;
  model_answer: string;
  marking_points: string[];
  explanation?: string;
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

type GeneratedQuestion = GeneratedMcqQuestion | GeneratedWrittenQuestion;

type WrittenGradeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; grade: WrittenAnswerGrade }
  | { status: "error"; message: string };

function isBetterExplanationOptionKey(value: string | undefined): value is BetterExplanationOptionKey {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

type GenerationIntent = "weak_areas" | "untested_sections" | "application" | "hard" | "topic";
type GenerationMode = "auto" | GenerationIntent;

type AiGenerationMeta = {
  provider: "bedrock" | "gemini";
  model: string;
  inputMode: "extracted-text" | "inline-file" | "file-uri" | "indexed-chunks" | "coverage-aware";
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
    intent?: GenerationIntent | null;
    intentLabel?: string;
    targetedTopic?: string | null;
    reason?: string;
  };
};

type GenerateQuestionsResponse = {
  questions?: GeneratedQuestion[];
  ai?: AiGenerationMeta;
  error?: string;
};

type GenerationStreamStatus = {
  message: string;
  phase?: string;
};

type ActiveAiDraft = {
  setId: string;
  title: string | null;
  questionsCount: number;
  createdAt: string | null;
  expiresAt: string | null;
  requestSignature?: string | null;
  attempt?: { id: string; status: string | null; updatedAt: string | null } | null;
};

type GenerationTrustStatus = {
  credits: {
    balance: number;
    cost: number;
    canAfford: boolean;
  };
  dailyLimit: {
    limit: number;
    used: number;
    remaining: number;
    retryAfterSeconds: number;
  };
  matchingDraft: ActiveAiDraft | null;
  latestDraft: ActiveAiDraft | null;
};

type PreviousGeneratedSet = {
  id: string;
  title: string | null;
  created_at: string | null;
  total_questions: number | null;
  attempt: {
    set_id: string;
    status: string | null;
    completed_at: string | null;
    updated_at: string | null;
  } | null;
};

const STUDENT_GENERATION_MODES: Array<{ value: GenerationMode; label: string; sub: string }> = [
  { value: "auto",              label: "Let Jabu decide",            sub: "Auto-selects the best next set for you" },
  { value: "weak_areas",        label: "Strengthen weak spots",      sub: "Focus on topics you've struggled with in this material" },
  { value: "untested_sections", label: "Cover new ground",           sub: "Pull from parts of the material not yet tested" },
  { value: "application",       label: "Practice applying concepts", sub: "Go beyond recall — use and analyse ideas" },
  { value: "hard",              label: "Exam-style hard",            sub: "Questions that require deeper reasoning and application" },
  { value: "topic",             label: "Focus on a topic",          sub: "Use the focus area you type below." },
];

const QUESTION_FORMATS: Array<{ value: QuestionFormat; label: string; sub: string }> = [
  { value: "mixed", label: "Mixed", sub: "Objective, short-answer, and theory" },
  { value: "mcq", label: "Objective", sub: "A-D questions only" },
  { value: "written", label: "Written/Theory", sub: "Typed answers and marking points" },
];

function resolveGenerationIntent(mode: GenerationMode, config: { difficulty: "easy" | "mixed" | "hard"; focus: string }): GenerationIntent {
  if (mode !== "auto") return mode;
  if (config.focus.trim()) return "topic";
  if (config.difficulty === "hard") return "hard";
  return "weak_areas";
}

function generationModeCopy(mode: GenerationMode, config: { difficulty: "easy" | "mixed" | "hard"; focus: string }) {
  if (mode !== "auto") return STUDENT_GENERATION_MODES.find((item) => item.value === mode)?.sub ?? "";
  if (config.focus.trim()) return "Auto will focus on the topic you typed.";
  if (config.difficulty === "hard") return "Auto will generate harder exam-style questions.";
  return "Auto will cover weak areas first.";
}

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

function questionTypeOf(question: Pick<GeneratedQuestion, "question_type"> | null | undefined): QuestionType {
  return question?.question_type === "short_answer" || question?.question_type === "theory"
    ? question.question_type
    : "mcq";
}

function isMcqQuestion(question: GeneratedQuestion): question is GeneratedMcqQuestion {
  return questionTypeOf(question) === "mcq";
}

function isWrittenQuestion(question: GeneratedQuestion): question is GeneratedWrittenQuestion {
  return questionTypeOf(question) !== "mcq";
}

function questionTypeLabel(type: QuestionType) {
  if (type === "short_answer") return "Short answer";
  if (type === "theory") return "Theory";
  return "Objective";
}

function verdictLabel(verdict: WrittenAnswerGrade["verdict"]) {
  if (verdict === "correct") return "Correct";
  if (verdict === "mostly_correct") return "Mostly correct";
  if (verdict === "partially_correct") return "Partially correct";
  if (verdict === "unanswered") return "Unanswered";
  return "Needs work";
}

function formatQuestionFormat(format: QuestionFormat) {
  if (format === "mcq") return "objective";
  if (format === "written") return "written/theory";
  return "mixed";
}

function withPdfPage(url: string, page?: number) {
  const safePage = normalizedPage(page);
  if (!safePage) return url;
  return `${url.split("#")[0]}#page=${safePage}`;
}

async function readNdjsonQuestions(
  res: Response,
  onQuestion?: (q: GeneratedQuestion) => void,
  onStatus?: (status: GenerationStreamStatus) => void
): Promise<{
  questions: GeneratedQuestion[];
  ai: AiGenerationMeta | null;
  draftSetId?: string;
  savedCount?: number;
  requestedCount?: number;
  repaired?: boolean;
  replacedCount?: number;
  skippedCount?: number;
  reusedDraft?: boolean;
  charged?: boolean;
  creditCost?: number;
  creditsRemaining?: number;
  receiptMessage?: string;
}> {
  if (!res.ok) {
    let errorMsg = "Failed to generate questions.";
    try {
      const text = await res.text();
      const parsed = JSON.parse(text);
      if (parsed.message) errorMsg = parsed.message;
      else if (parsed.error) errorMsg = parsed.error;
    } catch { /* ignore */ }
    throw new Error(errorMsg);
  }
  if (!res.body) throw new Error("No response body from server.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalAi: AiGenerationMeta | null = null;
  let doneMeta: Record<string, unknown> = {};
  const questions: GeneratedQuestion[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.type === "question") {
          questions.push(msg.question as GeneratedQuestion);
          onQuestion?.(msg.question as GeneratedQuestion);
        } else if (msg.type === "status") {
          const message = typeof msg.message === "string" ? msg.message : "";
          if (message) {
            onStatus?.({
              message,
              phase: typeof msg.phase === "string" ? msg.phase : undefined,
            });
          }
        } else if (msg.type === "done") {
          finalAi = msg.ai as AiGenerationMeta;
          doneMeta = msg;
        } else if (msg.type === "error") {
          throw new Error(String(msg.message ?? "Generation failed."));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    questions,
    ai: finalAi,
    draftSetId: typeof doneMeta.draftSetId === "string" ? doneMeta.draftSetId : undefined,
    savedCount: typeof doneMeta.savedCount === "number" ? doneMeta.savedCount : undefined,
    requestedCount: typeof doneMeta.requestedCount === "number" ? doneMeta.requestedCount : undefined,
    repaired: typeof doneMeta.repaired === "boolean" ? doneMeta.repaired : undefined,
    replacedCount: typeof doneMeta.replacedCount === "number" ? doneMeta.replacedCount : undefined,
    skippedCount: typeof doneMeta.skippedCount === "number" ? doneMeta.skippedCount : undefined,
    reusedDraft: typeof doneMeta.reusedDraft === "boolean" ? doneMeta.reusedDraft : undefined,
    charged: typeof doneMeta.charged === "boolean" ? doneMeta.charged : undefined,
    creditCost: typeof doneMeta.creditCost === "number" ? doneMeta.creditCost : undefined,
    creditsRemaining: typeof doneMeta.creditsRemaining === "number" ? doneMeta.creditsRemaining : undefined,
    receiptMessage: typeof doneMeta.receiptMessage === "string" ? doneMeta.receiptMessage : undefined,
  };
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

function InlinePreview({
  url,
  title,
  kind,
  defaultOpen = false,
}: {
  url: string;
  title: string;
  kind: "pdf" | "image" | "other";
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  if (kind === "other" || !url) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-expanded={open}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary">
            {kind === "pdf" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{open ? "Hide preview" : `Preview ${kind === "pdf" ? "PDF" : "image"}`}</p>
            <p className="text-xs text-muted-brand">{open ? "Reading inline" : "Tap to expand inline"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/50">
            Open <ExternalLink className="h-3 w-3" />
          </a>
          {open ? <ChevronUp className="h-4 w-4 text-muted-brand" /> : <ChevronDown className="h-4 w-4 text-muted-brand" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border p-3">
          {kind === "pdf" && (
            <div className="relative">
              <ResolvedFileViewer url={url} title={title} kind="pdf" heightClass="h-[68vh] min-h-[420px]" />
            </div>
          )}
          {kind === "image" && <ResolvedFileViewer url={url} title={title} kind="image" heightClass="h-[68vh] min-h-[420px]" />}
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
  material: m,
  initialSaved = false,
  relatedMaterials: initialRelatedMaterials = [],
  fromCourse = null,
  initialCredits = 20,
  userId,
}: {
  material: Material;
  initialSaved?: boolean;
  relatedMaterials?: any[];
  fromCourse?: string | null;
  initialCredits?: number;
  userId?: string;
}) {
  const router = useRouter();
  const kind = detectKind(m);
  const badge = fileTypeBadge(kind, m);
  const course = m.study_courses;
  const title = (m.title ?? course?.course_code ?? "Untitled material").trim();
  const fileUrl = m.file_path ? `/api/study/materials/${m.id}/download` : "";
  const hasFile = fileUrl.length > 0;
  const aiSupported = isAiGenSupported(m);

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
  const [saveQsError, setSaveQsError] = useState<string | null>(null);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [generateMoreError, setGenerateMoreError] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState<Record<number, boolean>>({});
  const [generationAi, setGenerationAi] = useState<AiGenerationMeta | null>(null);
  const [streamingQuestions, setStreamingQuestions] = useState<GeneratedQuestion[]>([]);
  const [generationStatus, setGenerationStatus] = useState("Preparing question generation...");
  const [generationMode, setGenerationMode] = useState<GenerationMode>("auto");
  const [activeDraft, setActiveDraft] = useState<ActiveAiDraft | null>(null);
  const [matchingDraft, setMatchingDraft] = useState<ActiveAiDraft | null>(null);
  const [generationTrust, setGenerationTrust] = useState<GenerationTrustStatus | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftAction, setDraftAction] = useState<"discard" | "new" | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [activeTab, setActiveTab] = useState<"practice" | "read" | "info">("practice");
  const [prevSets, setPrevSets] = useState<PreviousGeneratedSet[]>([]);

  // Quiz state machine
  const [quizState, setQuizState] = useState<"idle" | "loading" | "quiz" | "results">("idle");
  const [quizConfig, setQuizConfig] = useState<{ count: number; difficulty: "easy" | "mixed" | "hard"; focus: string; questionFormat: QuestionFormat }>({
    count: 10,
    difficulty: "mixed",
    focus: "",
    questionFormat: "mixed",
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { chosen: string; correct: boolean; skipped: boolean }>>({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<number, string>>({});
  const [writtenCompared, setWrittenCompared] = useState<Record<number, boolean>>({});
  const [writtenGradeStates, setWrittenGradeStates] = useState<Record<number, WrittenGradeState>>({});
  const [retryPool, setRetryPool] = useState<GeneratedQuestion[] | null>(null);
  const syncedQuizMissesRef = useRef<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2600);
  }

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

  useEffect(() => {
    void loadActiveDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id, quizConfig.count, quizConfig.difficulty, quizConfig.focus, quizConfig.questionFormat, generationMode]);

  useEffect(() => {
    if (!userId) {
      setPrevSets([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data: sets } = await supabase
        .from("study_quiz_sets")
        .select("id, title, created_at, total_questions")
        .eq("source_material_id", m.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const materialSets = (sets ?? []) as Array<{
        id: string;
        title: string | null;
        created_at: string | null;
        total_questions: number | null;
      }>;

      if (!materialSets.length) {
        if (!cancelled) setPrevSets([]);
        return;
      }

      const { data: attempts } = await supabase
        .from("study_practice_attempts")
        .select("set_id, status, completed_at, updated_at")
        .eq("user_id", userId)
        .in("set_id", materialSets.map((set) => set.id))
        .order("updated_at", { ascending: false });

      const attemptMap = new Map<string, PreviousGeneratedSet["attempt"]>();
      for (const attempt of (attempts ?? []) as NonNullable<PreviousGeneratedSet["attempt"]>[]) {
        if (!attemptMap.has(attempt.set_id)) attemptMap.set(attempt.set_id, attempt);
      }

      if (!cancelled) {
        setPrevSets(materialSets.map((set) => ({ ...set, attempt: attemptMap.get(set.id) ?? null })));
      }
    })();

    return () => { cancelled = true; };
  }, [m.id, userId]);

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
  const mcqCount = qs.filter(isMcqQuestion).length;
  const writtenCount = qs.filter(isWrittenQuestion).length;
  const correctCount = Object.values(answers).filter((a) => a.correct).length;
  const writtenAnsweredCount = qs.filter((q, i) => isWrittenQuestion(q) && (writtenAnswers[i] ?? "").trim().length > 0).length;
  const missedList = qs
    .map((q, i) => ({ q, i, ans: answers[i] }))
    .filter((item): item is { q: GeneratedMcqQuestion; i: number; ans: { chosen: string; correct: boolean; skipped: boolean } } =>
      isMcqQuestion(item.q) && Boolean(item.ans) && !item.ans.correct && !item.ans.skipped
    );
  const missedTopicsForDisplay = Array.from(
    new Set(
      missedList
        .map(({ q }) => q.sourceTopic ?? q.studyRef?.topic)
        .filter((t): t is string => Boolean(t))
    )
  ).slice(0, 2);

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
    if (matchingDraft?.setId) {
      showToast("Saved draft ready - no credits charged.");
      router.push(`/study/practice/${encodeURIComponent(matchingDraft.setId)}${matchingDraft.attempt?.id ? `?attempt=${encodeURIComponent(matchingDraft.attempt.id)}` : ""}`);
      return;
    }

    setQuizState("loading");
    setStreamingQuestions([]);
    setGenerationStatus("Preparing question generation...");
    setGenQsError(null);
    setGenerationAi(null);
    setSavedSetId(null);
    setSaveQsError(null);
    syncedQuizMissesRef.current = null;
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          count: quizConfig.count,
          difficulty: quizConfig.difficulty,
          focus: quizConfig.focus || undefined,
          questionFormat: quizConfig.questionFormat,
          persistDraft: true,
          generationIntent: resolveGenerationIntent(generationMode, quizConfig),
        }),
      });
      const {
        questions,
        ai,
        draftSetId,
        savedCount,
        repaired,
        replacedCount,
        skippedCount,
        creditsRemaining,
        receiptMessage,
        reusedDraft,
      } = await readNdjsonQuestions(res, (q) => {
        setStreamingQuestions((prev) => [...prev, q]);
      }, (status) => {
        setGenerationStatus(status.message);
      });
      if (typeof creditsRemaining === "number") setCredits(creditsRemaining);
      if (!draftSetId) throw new Error("Questions generated, but the draft could not be saved. Please try again.");
      if (!reusedDraft && !questions.length) throw new Error("Failed to generate questions.");
      console.info("[study-ai] generated questions", {
        provider: ai?.provider ?? "unknown",
        model: ai?.model ?? "unknown",
        inputMode: ai?.inputMode ?? "unknown",
        reason: ai?.reason ?? null,
        fallbackProvider: ai?.fallbackProvider ?? null,
        fallbackReason: ai?.fallbackReason ?? null,
        count: questions.length,
      });
      const repairDetails = [
        Number(replacedCount ?? 0) > 0 ? `replaced ${replacedCount}` : "",
        Number(skippedCount ?? 0) > 0 ? `skipped ${skippedCount}` : "",
      ].filter(Boolean).join(", ");
      showToast(
        receiptMessage
          ? receiptMessage
          : repaired || repairDetails
          ? `Saved ${savedCount ?? questions.length} questions (${repairDetails || "cleaned up"} duplicate${(Number(replacedCount ?? 0) + Number(skippedCount ?? 0)) === 1 ? "" : "s"})`
          : "Draft saved. Opening practice..."
      );
      router.push(`/study/practice/${encodeURIComponent(draftSetId)}`);
      return;
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : "Something went wrong.";
      setGenQsError(detail.includes("no credits charged") ? detail : `Generation failed - no credits charged. ${detail}`);
      setQuizState("idle");
    }
  }

  async function handleGenerateMore(mode: GenerationMode = generationMode) {
    const intent = resolveGenerationIntent(mode, quizConfig);
    setGeneratingMore(true);
    setGenerateMoreError(null);
    setStreamingQuestions([]);
    setGenerationStatus("Preparing the next set...");
    setGenerationMode(mode);
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          count: quizConfig.count,
          difficulty: quizConfig.difficulty,
          focus: quizConfig.focus || undefined,
          questionFormat: quizConfig.questionFormat,
          coveredQuestions: generatedQuestions?.map((q) => q.question) ?? [],
          generationIntent: intent,
        }),
      });
      const { questions: moreQuestions, ai: moreAi, creditsRemaining } = await readNdjsonQuestions(res, (q) => {
        setStreamingQuestions((prev) => [...prev, q]);
      }, (status) => {
        setGenerationStatus(status.message);
      });
      if (!moreQuestions.length) throw new Error("Failed to generate questions.");
      if (typeof creditsRemaining === "number") setCredits(creditsRemaining);
      console.info("[study-ai] generated more questions", {
        provider: moreAi?.provider ?? "unknown",
        model: moreAi?.model ?? "unknown",
        inputMode: moreAi?.inputMode ?? "unknown",
        reason: moreAi?.reason ?? null,
        fallbackProvider: moreAi?.fallbackProvider ?? null,
        fallbackReason: moreAi?.fallbackReason ?? null,
        count: moreQuestions.length,
      });
      setGeneratedQuestions(moreQuestions);
      setGenerationAi(moreAi);
      setAnswers({});
      setWrittenAnswers({});
      setWrittenCompared({});
      setWrittenGradeStates({});
      setCurrentQuestionIndex(0);
      setRetryPool(null);
      setHintShown({});
      setSavedSetId(null);
      setSaveQsError(null);
      syncedQuizMissesRef.current = null;
      setQuizState("quiz");
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : "Something went wrong.";
      setGenerateMoreError(detail.includes("no credits charged") ? detail : `Generation failed - no credits charged. ${detail}`);
    } finally {
      setGeneratingMore(false);
      setStreamingQuestions([]);
    }
  }

  async function handleGenerateMoreFromMistakes() {
    const uniqueTopics = Array.from(
      new Set(
        missedList
          .map(({ q }) => q.sourceTopic ?? q.studyRef?.topic)
          .filter((t): t is string => Boolean(t))
      )
    );
    if (!uniqueTopics.length) return handleGenerateMore("weak_areas");
    setGeneratingMore(true);
    setGenerateMoreError(null);
    setStreamingQuestions([]);
    setGenerationStatus("Generating questions on your weak topics...");
    setGenerationMode("weak_areas");
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          count: quizConfig.count,
          difficulty: quizConfig.difficulty,
          focus: uniqueTopics.join(", "),
          questionFormat: quizConfig.questionFormat,
          coveredQuestions: generatedQuestions?.map((q) => q.question) ?? [],
          generationIntent: "weak_areas",
        }),
      });
      const { questions: moreQuestions, ai: moreAi, creditsRemaining } = await readNdjsonQuestions(res,
        (q) => { setStreamingQuestions((prev) => [...prev, q]); },
        (status) => { setGenerationStatus(status.message); }
      );
      if (!moreQuestions.length) throw new Error("Failed to generate questions.");
      if (typeof creditsRemaining === "number") setCredits(creditsRemaining);
      setGeneratedQuestions(moreQuestions);
      setGenerationAi(moreAi);
      setAnswers({});
      setWrittenAnswers({});
      setWrittenCompared({});
      setWrittenGradeStates({});
      setCurrentQuestionIndex(0);
      setRetryPool(null);
      setHintShown({});
      setSavedSetId(null);
      setSaveQsError(null);
      syncedQuizMissesRef.current = null;
      setQuizState("quiz");
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : "Something went wrong.";
      setGenerateMoreError(detail.includes("no credits charged") ? detail : `Generation failed - no credits charged. ${detail}`);
    } finally {
      setGeneratingMore(false);
      setStreamingQuestions([]);
    }
  }

  async function loadActiveDraft() {
    if (!isAiGenSupported(m)) return;
    setDraftLoading(true);
    try {
      const params = new URLSearchParams({
        materialId: m.id,
        count: String(quizConfig.count),
        difficulty: quizConfig.difficulty,
        questionFormat: quizConfig.questionFormat,
        generationIntent: resolveGenerationIntent(generationMode, quizConfig),
      });
      if (quizConfig.focus.trim()) params.set("focus", quizConfig.focus.trim());

      const res = await fetch(`/api/ai/generate-questions/status?${params.toString()}`);
      const data = await res.json().catch(() => null) as ({ ok?: boolean } & Partial<GenerationTrustStatus>) | null;
      if (res.ok && data?.ok && data.credits && data.dailyLimit) {
        const nextStatus: GenerationTrustStatus = {
          credits: data.credits,
          dailyLimit: data.dailyLimit,
          matchingDraft: data.matchingDraft ?? null,
          latestDraft: data.latestDraft ?? null,
        };
        setGenerationTrust(nextStatus);
        setCredits(data.credits.balance);
        setMatchingDraft(nextStatus.matchingDraft);
        setActiveDraft(nextStatus.latestDraft);
      }
    } catch {
      // Draft lookup should not block the material page.
    } finally {
      setDraftLoading(false);
    }
  }

  async function discardActiveDraft(action: "discard" | "new" = "discard") {
    if (!activeDraft?.setId) return;
    setDraftAction(action);
    try {
      const res = await fetch(`/api/ai/generated-drafts/${encodeURIComponent(activeDraft.setId)}/discard`, { method: "POST" });
      const data = await res.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Could not discard draft.");
      setActiveDraft(null);
      setMatchingDraft(null);
      setGenerationTrust((prev) => prev ? { ...prev, matchingDraft: null, latestDraft: null } : prev);
      showToast("Draft discarded");
      if (action === "new") void handleGenerateQuestions();
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Could not discard draft.");
    } finally {
      setDraftAction(null);
    }
  }

  async function gradeGeneratedWrittenAnswer(questionIndex: number, question: GeneratedWrittenQuestion) {
    const answer = (writtenAnswers[questionIndex] ?? "").trim();
    if (!answer) return;

    setWrittenCompared((prev) => ({ ...prev, [questionIndex]: true }));
    setWrittenGradeStates((prev) => ({ ...prev, [questionIndex]: { status: "loading" } }));

    try {
      const res = await fetch("/api/ai/grade-generated-written-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          questionType: question.question_type,
          question: question.question,
          modelAnswer: question.model_answer,
          markingPoints: question.marking_points,
          answer,
        }),
      });
      const data = await res.json().catch(() => null) as
        | { ok?: boolean; grade?: WrittenAnswerGrade; message?: string; error?: string }
        | null;

      if (!res.ok || !data?.ok || !data.grade) {
        throw new Error(data?.message || data?.error || "Could not grade this answer.");
      }

      setWrittenGradeStates((prev) => ({
        ...prev,
        [questionIndex]: { status: "done", grade: data.grade! },
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not grade this answer.";
      setWrittenGradeStates((prev) => ({ ...prev, [questionIndex]: { status: "error", message } }));
    }
  }

  async function handleSaveQuestions() {
    if (!generatedQuestions) return;
    setSavingQs(true);
    setSaveQsError(null);
    try {
      const res = await fetch("/api/ai/save-generated-questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: m.id, questions: generatedQuestions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save questions.");
      setSavedSetId(data.setId);
      if (data.repaired || data.skippedCount > 0) {
        const savedCount = Number(data.savedCount ?? generatedQuestions.length);
        const replacedCount = Number(data.replacedCount ?? 0);
        const skippedCount = Number(data.skippedCount ?? 0);
        const details = [
          replacedCount > 0 ? `replaced ${replacedCount}` : "",
          skippedCount > 0 ? `skipped ${skippedCount}` : "",
        ].filter(Boolean).join(", ");
        showToast(`Saved ${savedCount} questions${details ? ` (${details} duplicate${replacedCount + skippedCount === 1 ? "" : "s"})` : ""}`);
      }
      syncedQuizMissesRef.current = null;
    } catch (e: unknown) {
      setSaveQsError(e instanceof Error ? e.message : "Failed to save questions.");
    } finally { setSavingQs(false); }
  }

  function closeAiPracticeWorkspace() {
    if (quizState === "loading") {
      setGenerationStatus("Your AI draft is still being saved. Practice will open when it is ready.");
      return;
    }
    setQuizState("idle");
  }

  const HeroBadge = ({
    children,
    variant = "default",
  }: {
    children: React.ReactNode;
    variant?: "default" | "verified" | "featured";
  }) => (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold text-white",
        variant === "default" && "border-white/20 bg-white/10",
        variant === "verified" && "border-green-300/30 bg-green-400/20",
        variant === "featured" && "border-amber-300/30 bg-amber-400/20"
      )}
    >
      {children}
    </span>
  );

  const HeroStat = ({
    icon: Icon,
    children,
  }: {
    icon: typeof Download;
    children: React.ReactNode;
  }) => (
    <div className="inline-flex min-w-0 items-center gap-1.5 text-xs font-bold text-white/85">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );

  const backHref = fromCourse ? `/study/courses/${encodeURIComponent(fromCourse)}` : "/study/library";
  const backLabel = fromCourse ?? "Materials";
  const creditCost = generationTrust?.credits.cost ?? Math.ceil(quizConfig.count / 5);
  const dailyRemaining = generationTrust?.dailyLimit.remaining ?? 4;
  const hasMatchingDraft = Boolean(matchingDraft?.setId);
  const canGenerate = aiSupported && quizState !== "loading" && (
    hasMatchingDraft || ((generationTrust?.credits.canAfford ?? credits >= creditCost) && dailyRemaining > 0)
  );
  const generationAvailabilityCopy = hasMatchingDraft
    ? "Saved draft ready - no credits charged"
    : `${creditCost} credit${creditCost === 1 ? "" : "s"} - ${dailyRemaining} generation${dailyRemaining === 1 ? "" : "s"} left today`;
  const tabLabels: Array<{ value: typeof activeTab; label: string }> = [
    { value: "practice", label: "Practice" },
    { value: "read", label: "Read" },
    { value: "info", label: "Info" },
  ];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background">
      <div className="px-4 pb-0 pt-3 md:px-6 md:pt-4">
        <Link
          href={backHref}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="truncate">{backLabel}</span>
        </Link>
      </div>

      <div className="sticky top-[56px] z-20 bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="grid grid-cols-3 rounded-2xl border border-border bg-card p-1 shadow-sm">
          {tabLabels.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "rounded-xl px-2 py-2 text-sm font-bold transition focus-visible:outline-none",
                activeTab === tab.value
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-brand hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl items-start gap-4 p-4 pb-24 pt-2 md:grid-cols-[minmax(0,1fr)_420px] md:gap-5 md:p-6 md:pt-5 md:pb-12">
        <section
          className={cn(
            "flex flex-col gap-4",
            activeTab !== "read" && activeTab !== "info" ? "hidden md:flex" : "flex"
          )}
        >
          <div
            className="relative overflow-hidden rounded-3xl shadow-sm"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, oklch(45% 0.2 298) 100%)" }}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/10" />
            <div className="relative px-5 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {course?.course_code && <HeroBadge>{course.course_code}</HeroBadge>}
                {course?.level && <HeroBadge>{course.level}L</HeroBadge>}
                {course?.semester && <HeroBadge>{course.semester}</HeroBadge>}
                {m.session && <HeroBadge>{m.session}</HeroBadge>}
                {m.verified && (
                  <HeroBadge variant="verified">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </HeroBadge>
                )}
                {m.featured && (
                  <HeroBadge variant="featured">
                    <Star className="h-3 w-3" /> Featured
                  </HeroBadge>
                )}
              </div>
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/10 sm:h-12 sm:w-12">
                  <FileIcon kind={kind} />
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-white/70">
                    {formatMaterialType(m.material_type)} · {badge}
                  </p>
                  <h1 className="break-words text-lg font-extrabold leading-snug text-white sm:text-xl">{title}</h1>
                  <p className="mt-1 line-clamp-2 text-sm text-white/75">
                    Uploaded by {obfuscateEmail(m.uploader_email)} · {timeAgo(m.created_at ?? "")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/15 pt-3.5">
                <HeroStat icon={Download}>{downloads.toLocaleString("en-NG")} downloads</HeroStat>
                <HeroStat icon={ThumbsUp}>{upvoteCount.toLocaleString("en-NG")} upvotes</HeroStat>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_44px_44px] gap-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_48px_48px]">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={!hasFile}
              className="inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-primary bg-primary px-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:border-border disabled:bg-muted disabled:text-muted-brand disabled:opacity-70"
            >
              <Eye className="h-4 w-4 shrink-0" />
              <span className="truncate">Read {badge}</span>
            </button>
            <a
              href={hasFile ? fileUrl : "#"}
              download
              onClick={(e) => {
                if (!hasFile) {
                  e.preventDefault();
                  return;
                }
                void handleDownload();
              }}
              className={cn(
                "inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 text-sm font-bold text-foreground shadow-sm transition hover:bg-secondary/50",
                !hasFile && "pointer-events-none opacity-50"
              )}
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="truncate">Download</span>
            </a>
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={saving}
              aria-label={saved ? "Remove from library" : "Save to library"}
              className={cn(
                "grid h-12 w-full shrink-0 place-items-center rounded-2xl border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                saved ? "border-primary/30 bg-primary-light text-primary-text" : "border-border bg-card text-foreground hover:bg-secondary/50",
                saving && "opacity-60"
              )}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share"
              className="grid h-12 w-full shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground shadow-sm transition hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {hasFile ? (
            <div className={cn(activeTab === "info" ? "hidden md:block" : "block")}>
              <InlinePreview url={fileUrl} title={title} kind={kind} defaultOpen={activeTab === "read"} />
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-brand">
              This material does not have a readable file attached.
            </div>
          )}

          {m.ai_summary && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary-light text-primary">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-foreground">AI Summary</p>
                  <p className="text-xs text-muted-brand">Quick scan before reading</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-brand">{m.ai_summary}</p>
            </div>
          )}

          <div className={cn("space-y-4", activeTab === "info" ? "block" : "hidden md:block")}>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-brand">Material info</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{course?.course_code ?? "Source file"}</p>
                  {course?.course_title && <p className="mt-0.5 text-xs text-muted-brand">{course.course_title}</p>}
                </div>
                {course?.course_code && (
                  <Link
                    href={`/study/courses/${encodeURIComponent(course.course_code)}`}
                    className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-primary transition hover:bg-secondary/50"
                  >
                    Course <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="min-h-[74px] rounded-2xl border border-border bg-background px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-brand">Level</p>
                  <p className="mt-1 font-extrabold text-foreground">{course?.level ? `${course.level}L` : "-"}</p>
                </div>
                <div className="min-h-[74px] rounded-2xl border border-border bg-background px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-brand">Semester</p>
                  <p className="mt-1 font-extrabold text-foreground">{course?.semester ?? "-"}</p>
                </div>
                <div className="min-h-[74px] rounded-2xl border border-border bg-background px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-brand">Type</p>
                  <p className="mt-1 font-extrabold text-foreground">{formatMaterialType(m.material_type)}</p>
                </div>
                <div className="min-h-[74px] rounded-2xl border border-border bg-background px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-brand">Session</p>
                  <p className="mt-1 font-extrabold text-foreground">{m.session ?? "-"}</p>
                </div>
              </div>
              {m.description && <p className="mt-4 text-sm leading-relaxed text-muted-brand">{m.description}</p>}
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-light text-xs font-bold text-primary">
                    {getInitials(m.uploader_email)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-brand">Uploaded by</p>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {m.uploader_email ? obfuscateEmail(m.uploader_email) : "A student"}
                      </p>
                      {uploaderIsRep && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary-text">
                          <ShieldCheck className="h-3 w-3" />
                          Course Rep
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-brand">Downloads</p>
                  <p className="text-xl font-extrabold text-foreground">{downloads.toLocaleString("en-NG")}</p>
                </div>
              </div>
            </div>

            {relatedMaterials.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-brand">Related materials</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">More for {course?.course_code ?? "this course"}</p>
                </div>
                <div className="space-y-2">
                  {relatedMaterials.map((r) => (
                    <Link
                      key={r.id}
                      href={`/study/materials/${r.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 no-underline transition hover:bg-secondary/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{r.title ?? "Untitled"}</p>
                        <p className="mt-0.5 text-xs text-muted-brand">
                          {r.material_type?.replace("_", " ")} · {r.downloads ?? 0} downloads
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-brand" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border/50 bg-background p-3 text-center">
              <Link href="/study/report" className="inline-flex items-center gap-1.5 text-xs text-muted-brand transition hover:text-foreground">
                Something wrong with this material? Report it →
              </Link>
            </div>
          </div>
        </section>

        <aside
          className={cn(
            "flex flex-col gap-3 md:sticky md:top-[76px]",
            activeTab !== "practice" ? "hidden md:flex" : "flex"
          )}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50">
              <Coins className="h-5 w-5 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-brand">AI Credits</p>
              <p className="text-lg font-extrabold text-foreground">
                {credits} <span className="text-sm font-semibold text-muted-brand">remaining</span>
              </p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    credits <= 2
                      ? "bg-gradient-to-r from-red-500 to-red-400"
                      : "bg-gradient-to-r from-amber-500 to-amber-400"
                  )}
                  style={{ width: `${Math.min(100, (credits / 20) * 100)}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              className="h-9 shrink-0 rounded-xl border border-primary/25 bg-primary-light px-3 text-xs font-bold text-primary"
            >
              + Get more
            </button>
          </div>

          {draftLoading ? (
            <div className="rounded-2xl border border-primary/20 bg-primary-light/40 px-4 py-3 text-xs font-semibold text-primary shadow-sm">
              Checking for saved AI drafts...
            </div>
          ) : activeDraft ? (
            <div className="rounded-2xl border border-primary/20 bg-primary-light/45 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card text-primary">
                  <PenLine className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-primary-text">Draft found</p>
                  <p className="mt-1 text-xs leading-relaxed text-primary/75">
                    {activeDraft.questionsCount} question{activeDraft.questionsCount === 1 ? "" : "s"} saved from this material.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href={`/study/practice/${encodeURIComponent(activeDraft.setId)}${activeDraft.attempt?.id ? `?attempt=${encodeURIComponent(activeDraft.attempt.id)}` : ""}`}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-white transition hover:opacity-90"
                >
                  Resume draft
                </Link>
                <button
                  type="button"
                  onClick={() => void discardActiveDraft("discard")}
                  disabled={draftAction !== null}
                  className="inline-flex items-center justify-center rounded-xl border border-primary/25 bg-card px-3 py-2.5 text-xs font-bold text-primary-text transition hover:bg-background disabled:opacity-60"
                >
                  {draftAction === "discard" ? "Discarding..." : "Discard"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void discardActiveDraft("new")}
                disabled={draftAction !== null}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-muted-brand transition hover:bg-background disabled:opacity-60"
              >
                {draftAction === "new" ? "Starting..." : "Start new"}
              </button>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-secondary/20 px-4 py-3.5">
              <p className="flex items-center gap-2 text-base font-extrabold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Practice
              </p>
              <p className="mt-1 text-xs text-muted-brand">Start with 10 questions, or customize the set.</p>
            </div>
            <div className="space-y-3.5 p-4">
              <div className={cn(
                "flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm",
                hasMatchingDraft ? "border-primary/25 bg-primary-light text-primary-text" : "border-amber-300 bg-amber-50 text-amber-800"
              )}>
                <span className="font-semibold">{generationAvailabilityCopy}</span>
                <span className="font-extrabold">
                  {hasMatchingDraft ? "Free" : `${credits} left`}
                </span>
              </div>

              {genQsError && <p className="text-center text-xs text-red-500">{genQsError}</p>}
              {!aiSupported && (
                <p className="text-center text-xs text-muted-brand">AI practice is available for PDF, image, Word, and PowerPoint files.</p>
              )}
              {aiSupported && !hasMatchingDraft && dailyRemaining <= 0 && (
                <p className="text-center text-xs font-semibold text-amber-700">Daily generation limit reached.</p>
              )}
              {aiSupported && !hasMatchingDraft && !(generationTrust?.credits.canAfford ?? credits >= creditCost) && (
                <p className="text-center text-xs font-semibold text-amber-700">Not enough credits for this set.</p>
              )}

              <button
                type="button"
                disabled={!canGenerate}
                onClick={() => void handleGenerateQuestions()}
                className="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-left text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
                  <Sparkles className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold">
                    {hasMatchingDraft ? "Resume saved draft" : `Generate ${quizConfig.count} questions`}
                  </span>
                  <span className="text-xs font-medium text-white/75">
                    {hasMatchingDraft ? "No credits charged" : "Opens practice immediately"}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCustomizeOpen((open) => !open)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground transition hover:bg-secondary/50"
              >
                {customizeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Customize
              </button>

              {customizeOpen && (
                <div className="space-y-3.5">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-brand">Questions</p>
                <div className="flex gap-2">
                  {([5, 10, 15, 20] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQuizConfig((c) => ({ ...c, count: n }))}
                      className={cn(
                        "h-10 flex-1 rounded-xl border text-sm font-bold transition focus-visible:outline-none",
                        quizConfig.count === n
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-background text-foreground hover:bg-secondary/50"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-brand">Format</p>
                <div className="space-y-2">
                  {QUESTION_FORMATS.map(({ value, label, sub }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setQuizConfig((c) => ({ ...c, questionFormat: value }))}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition focus-visible:outline-none",
                        quizConfig.questionFormat === value
                          ? "border-primary bg-primary-light ring-1 ring-primary/25"
                          : "border-border bg-background hover:bg-secondary/40"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2",
                          quizConfig.questionFormat === value ? "border-primary bg-primary" : "border-border bg-card"
                        )}
                      />
                      <span>
                        <span className={cn("block text-sm font-bold", quizConfig.questionFormat === value ? "text-primary-text" : "text-foreground")}>
                          {label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-brand">{sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-brand">Difficulty</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "easy", label: "Easy" },
                    { value: "mixed", label: "Mixed" },
                    { value: "hard", label: "Exam-hard" },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setQuizConfig((c) => ({ ...c, difficulty: value }))}
                      className={cn(
                        "h-10 rounded-xl border px-2 text-xs font-extrabold transition focus-visible:outline-none",
                        quizConfig.difficulty !== value && "border-border bg-background text-foreground hover:bg-secondary/50",
                        quizConfig.difficulty === "easy" && value === "easy" && "border-green-300 bg-green-50 text-green-700",
                        quizConfig.difficulty === "mixed" && value === "mixed" && "border-amber-300 bg-amber-50 text-amber-700",
                        quizConfig.difficulty === "hard" && value === "hard" && "border-red-300 bg-red-50 text-red-600"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-brand">Smart targeting</p>
                <div className="relative rounded-2xl border border-border bg-background px-3 py-2.5">
                  <select
                    value={generationMode}
                    onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
                    className="w-full appearance-none bg-transparent pr-8 text-sm font-bold text-foreground outline-none"
                  >
                    {STUDENT_GENERATION_MODES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-muted-brand" />
                  <p className="mt-1.5 text-xs leading-snug text-muted-brand">
                    {generationModeCopy(generationMode, quizConfig)}
                  </p>
                </div>
              </div>

              {(generationMode === "topic" || quizConfig.focus) && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-brand">Focus area</p>
                  <input
                    type="text"
                    value={quizConfig.focus}
                    onChange={(e) => setQuizConfig((c) => ({ ...c, focus: e.target.value }))}
                    placeholder="e.g. continuity and limits"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}

                </div>
              )}

              <Link
                href={`/study/materials/${m.id}/practice`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground transition hover:bg-secondary/50"
              >
                <PenLine className="h-4 w-4" /> Open practice session
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                <PenLine className="h-4 w-4 text-primary" /> Your sets from this material
              </p>
              <Link href="/study/library" className="text-xs font-semibold text-primary">See all</Link>
            </div>
            {prevSets.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-muted-brand">No sets generated yet</p>
            ) : (
              prevSets.map((set) => (
                <Link
                  key={set.id}
                  href={`/study/practice/${set.id}`}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 transition last:border-0 hover:bg-background"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light">
                    <PenLine className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">
                      {set.title ?? `${course?.course_code ?? "Set"} - ${set.total_questions ?? 0}Q`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-brand">{timeAgo(set.created_at ?? "")}</p>
                  </div>
                  {set.attempt?.status === "in_progress" ? (
                    <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">Continue</span>
                  ) : null}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-brand" />
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>

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

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div role="status" className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {quizState === "loading" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary-light">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
            <p className="mb-1.5 text-lg font-extrabold text-foreground">Generating questions...</p>
            <p className="text-sm text-muted-brand">{generationStatus}</p>
            <div className="mt-5 h-0.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{
                  width: streamingQuestions.length === 0
                    ? "30%"
                    : `${Math.min(100, (streamingQuestions.length / quizConfig.count) * 100)}%`,
                }}
              />
            </div>
            {streamingQuestions.length > 0 && (
              <div className="mt-4 max-h-28 space-y-2 overflow-hidden">
                {streamingQuestions.slice(-3).map((q, i) => (
                  <div key={`${q.question}-${i}`} className="rounded-xl border border-border bg-background px-3 py-2 text-left text-xs text-foreground">
                    {typeof q.question === "string" ? q.question : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Practice Questions Sheet — config / loading / quiz / results */}
      {quizState !== "idle" && quizState !== "loading" && (() => {
        const currentQ = qs[currentQuestionIndex];
        const currentQuestionType = currentQ ? questionTypeOf(currentQ) : "mcq";
        const currentWrittenAnswer = writtenAnswers[currentQuestionIndex] ?? "";
        const currentWrittenCompared = Boolean(writtenCompared[currentQuestionIndex]);
        const currentGradeState: WrittenGradeState = writtenGradeStates[currentQuestionIndex] ?? { status: "idle" };
        const answered = currentQ
          ? currentQuestionType === "mcq"
            ? currentAnswer !== undefined
            : currentWrittenAnswer.trim().length > 0
          : false;
        const scoreRingR = 40;
        const scoreRingCx = 50;
        const scoreRingCirc = 2 * Math.PI * scoreRingR;
        const scoreRingPct = mcqCount === 0 ? 0 : Math.round((correctCount / mcqCount) * 100);
        const scoreRingOffset = scoreRingCirc * (1 - scoreRingPct / 100);
        const scoreRingColor = scoreRingPct >= 80 ? "#22c55e" : scoreRingPct >= 60 ? "#f59e0b" : "#ef4444";
        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
              onClick={closeAiPracticeWorkspace}
            />
            <div className="fixed inset-0 z-50 flex flex-col bg-card shadow-2xl md:inset-x-6 md:bottom-auto md:top-6 md:mx-auto md:h-[calc(100vh-3rem)] md:max-w-4xl md:overflow-hidden md:rounded-3xl md:border md:border-border">
              {/* Workspace header */}
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4 md:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-brand">
                    AI practice workspace
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {quizState === "quiz" ? `Q ${currentQuestionIndex + 1} / ${qs.length}` :
                     "Results"}
                  </p>
                  {quizState === "quiz" && (
                    <p className="text-xs text-primary font-semibold">
                      MCQ {correctCount}/{mcqCount || 0} correct
                      {writtenCount > 0 ? ` · Written ${writtenAnsweredCount}/${writtenCount}` : ""}
                    </p>
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
                <button type="button" onClick={closeAiPracticeWorkspace}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-brand transition hover:bg-secondary/50 focus-visible:outline-none"
                  aria-label="Close AI practice workspace"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

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
                    {isMcqQuestion(currentQ) ? (
                      <>
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
                          <div className="mt-4 space-y-2">
                            <div className="rounded-xl border border-primary/20 bg-primary-light/60 px-4 py-3">
                              <p className="text-xs leading-relaxed text-primary-text/85">
                                <span className="font-semibold">Explanation: </span>{currentQ.explanation}
                              </p>
                            </div>
                            {isBetterExplanationOptionKey(currentAnswer?.chosen) ? (
                              <BetterExplanationInline
                                questionPrompt={currentQ.question}
                                options={currentQ.options}
                                chosenOptionKey={currentAnswer.chosen}
                                chosenOptionText={currentQ.options[currentAnswer.chosen]}
                                correctOptionKey={currentQ.answer}
                                correctOptionText={currentQ.options[currentQ.answer]}
                                isCorrect={currentAnswer.correct}
                                basicExplanation={currentQ.explanation}
                                studyRef={currentQ.studyRef}
                                sourceTopic={currentQ.sourceTopic}
                              />
                            ) : null}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-primary/30 bg-primary-light px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-primary-text">
                            {questionTypeLabel(currentQuestionType)}
                          </span>
                        </div>
                        <textarea
                          value={currentWrittenAnswer}
                          onChange={(e) => {
                            const value = e.target.value;
                            setWrittenAnswers((prev) => ({ ...prev, [currentQuestionIndex]: value }));
                            setWrittenCompared((prev) => ({ ...prev, [currentQuestionIndex]: false }));
                            setWrittenGradeStates((prev) => ({ ...prev, [currentQuestionIndex]: { status: "idle" } }));
                          }}
                          placeholder="Type your answer here..."
                          rows={currentQuestionType === "theory" ? 8 : 4}
                          className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={currentWrittenAnswer.trim().length < 5 || currentGradeState.status === "loading"}
                            onClick={() => void gradeGeneratedWrittenAnswer(currentQuestionIndex, currentQ)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary bg-primary-light px-4 py-2.5 text-sm font-semibold text-primary-text transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-none"
                          >
                            {currentGradeState.status === "loading" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <BookOpen className="h-4 w-4" />
                            )}
                            {currentGradeState.status === "loading"
                              ? "Grading..."
                              : currentGradeState.status === "done"
                                ? "Refresh grade"
                                : "Grade answer"}
                          </button>
                        </div>
                        {currentWrittenCompared && currentGradeState.status === "loading" && (
                          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary-light/50 px-3 py-1.5 text-xs font-semibold text-primary-text">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            AI is grading your answer...
                          </div>
                        )}
                        {currentWrittenCompared && currentGradeState.status === "error" && (
                          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
                            <p className="text-xs font-extrabold text-rose-700 dark:text-rose-300">AI grading failed</p>
                            <p className="mt-1 text-sm text-foreground">{currentGradeState.message}</p>
                          </div>
                        )}
                        {currentWrittenCompared && currentGradeState.status === "done" && (
                          <div className="space-y-3">
                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">AI feedback</p>
                                <span className="rounded-full border border-emerald-500/30 bg-background px-2.5 py-1 text-xs font-extrabold text-foreground">
                                  {currentGradeState.grade.score}/{currentGradeState.grade.maxScore} - {verdictLabel(currentGradeState.grade.verdict)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-foreground">{currentGradeState.grade.feedback}</p>
                              {currentGradeState.grade.missingPoints.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-extrabold text-amber-700 dark:text-amber-300">Focus on</p>
                                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                                    {currentGradeState.grade.missingPoints.map((point, pointIndex) => (
                                      <li key={`${point}-${pointIndex}`}>{point}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              <p className="mt-3 text-[11px] font-semibold text-muted-brand">
                                AI feedback only - save this set to Practice Library if you want persistent grading history.
                              </p>
                            </div>
                            <details className="rounded-2xl border border-border bg-background px-4 py-3">
                              <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wide text-muted-brand">
                                Model answer and marking points
                              </summary>
                              <div className="mt-3 space-y-3">
                                <div>
                                  <p className="text-xs font-extrabold uppercase tracking-wide text-muted-brand">Model answer</p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{currentQ.model_answer}</p>
                                </div>
                                {currentQ.marking_points.length > 0 && (
                                  <div>
                                    <p className="text-xs font-extrabold uppercase tracking-wide text-muted-brand">Marking points</p>
                                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                                      {currentQ.marking_points.map((point, index) => (
                                        <li key={`${point}-${index}`}>{point}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {currentQ.explanation?.trim() && (
                                  <p className="text-xs leading-relaxed text-muted-brand">
                                    <span className="font-semibold">Note: </span>{currentQ.explanation}
                                  </p>
                                )}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex gap-2 border-t border-border bg-card px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button type="button"
                      onClick={() => {
                        if (!answered && currentQuestionType === "mcq") {
                          setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: { chosen: "", correct: false, skipped: true } }));
                        }
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
                        fontSize={18} fontWeight={700} fill="currentColor" fontFamily="var(--font-bricolage)">
                        {mcqCount > 0 ? `${correctCount}/${mcqCount}` : `${writtenAnsweredCount}/${writtenCount}`}
                      </text>
                    </svg>
                    <p className="text-sm font-semibold text-foreground">
                      {mcqCount > 0
                        ? scoreRingPct >= 80 ? "Excellent!" : scoreRingPct >= 60 ? "Good effort" : "Keep practising"
                        : "Written practice complete"}
                    </p>
                  </div>

                  {/* Stat pills */}
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl border border-border bg-background py-3 text-center">
                      <p className="text-lg font-bold text-primary">{correctCount}/{mcqCount}</p>
                      <p className="text-[10px] text-muted-brand uppercase tracking-wide">MCQ score</p>
                    </div>
                    <div className="flex-1 rounded-xl border border-border bg-background py-3 text-center">
                      <p className="text-lg font-bold text-red-500">{missedList.length}</p>
                      <p className="text-[10px] text-muted-brand uppercase tracking-wide">Missed</p>
                    </div>
                    <div className="flex-1 rounded-xl border border-border bg-background py-3 text-center">
                      <p className="text-lg font-bold text-muted-brand">{writtenAnsweredCount}/{writtenCount}</p>
                      <p className="text-[10px] text-muted-brand uppercase tracking-wide">Written</p>
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
                  {saveQsError && (
                    <p className="text-center text-xs font-semibold text-rose-600">{saveQsError}</p>
                  )}
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
                    <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-muted-brand">Next set</span>
                    <select
                      value={generationMode}
                      onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
                      disabled={generatingMore}
                      className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-foreground outline-none disabled:opacity-60"
                    >
                      {STUDENT_GENERATION_MODES.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button"
                    onClick={() => handleGenerateMore(generationMode)}
                    disabled={generatingMore}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary bg-primary-light px-4 py-3 text-sm font-semibold text-primary-text transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none">
                    {generatingMore
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                      : <><Sparkles className="h-4 w-4" /> Generate {quizConfig.count} more {formatQuestionFormat(quizConfig.questionFormat)} questions</>
                    }
                  </button>
                  {generatingMore && (
                    <div className="rounded-2xl border border-border bg-background px-3 py-2 text-center">
                      <p className="text-xs font-semibold text-foreground">
                        {streamingQuestions.length > 0
                          ? `Generated ${streamingQuestions.length} of ${quizConfig.count}`
                          : generationStatus}
                      </p>
                    </div>
                  )}
                  {missedList.length > 0 && (
                    <>
                    <button type="button"
                      onClick={() => {
                        const missed = missedList.map(({ q }) => q);
                        setGeneratedQuestions(missed);
                        setRetryPool(missed);
                        setAnswers({});
                        setWrittenAnswers({});
                        setWrittenCompared({});
                        setWrittenGradeStates({});
                        setCurrentQuestionIndex(0);
                        setHintShown({});
                        syncedQuizMissesRef.current = null;
                        setQuizState("quiz");
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary/50 focus-visible:outline-none">
                      <RotateCcw className="h-4 w-4" />
                      Retry missed ({missedList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateMoreFromMistakes()}
                      disabled={generatingMore}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary-light px-4 py-3 text-sm font-semibold text-primary-text transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none"
                    >
                      {generatingMore
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                        : <>
                            <Sparkles className="h-4 w-4" />
                            {missedTopicsForDisplay.length > 0
                              ? `You got ${missedList.length} wrong — practice ${missedTopicsForDisplay.join(" & ")}`
                              : `Generate on what I got wrong (${missedList.length})`}
                          </>
                      }
                    </button>
                    </>
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
