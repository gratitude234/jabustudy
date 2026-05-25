"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { WrittenAnswerGrade } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionFormat = "mcq" | "mixed" | "written";
type Difficulty = "easy" | "mixed" | "hard";
type GenerationIntent = "auto" | "weak_areas" | "untested_sections" | "application" | "hard" | "topic";

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

type BatchRecord = {
  setId: string;
  attemptId: string;
  count: number;
  correct: number;
  intent: string;
  questionFormat: string;
  generatedAt: string;
};

type MaterialSession = {
  id: string;
  total_questions: number;
  total_correct: number;
  batches: BatchRecord[];
  started_at: string;
  last_active_at: string;
  status: string;
};

type PracticeOption = {
  id: string;
  text: string;
  is_correct: boolean;
  position: number | null;
};

type PracticeQuestion = {
  id: string;
  prompt: string;
  explanation: string | null;
  question_type: "mcq" | "short_answer" | "theory";
  options: PracticeOption[];
  model_answer: string | null;
  marking_points: string[];
  source_topic: string | null;
  study_ref: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  } | null;
};

type WrittenGradeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; grade: WrittenAnswerGrade }
  | { status: "error"; message: string };

type StreamStatus = { message: string; phase?: string };

type Mode = "resume-prompt" | "configure" | "generating" | "answering" | "batch-complete";

type SessionConfig = {
  count: number;
  difficulty: Difficulty;
  format: QuestionFormat;
  intent: GenerationIntent;
  focus: string;
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

type Props = {
  material: Material;
  userId: string;
  initialCredits: number;
  activeSession: MaterialSession | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function materialTitle(m: Material): string {
  return (m.title ?? m.study_courses?.course_code ?? "Untitled material").trim();
}

function resolveIntent(intent: GenerationIntent, config: SessionConfig): string {
  if (intent !== "auto") return intent;
  if (config.focus.trim()) return "topic";
  if (config.difficulty === "hard") return "hard";
  return "weak_areas";
}

function pct(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

function verdictLabel(v: WrittenAnswerGrade["verdict"]): string {
  if (v === "correct") return "Correct";
  if (v === "mostly_correct") return "Mostly correct";
  if (v === "partially_correct") return "Partially correct";
  if (v === "unanswered") return "Unanswered";
  return "Needs work";
}

// ─── NDJSON stream reader (mirrors MaterialDetailClient) ──────────────────────

async function readNdjsonStream(
  res: Response,
  onQuestion?: (q: Record<string, unknown>) => void,
  onStatus?: (s: StreamStatus) => void
): Promise<{
  draftSetId?: string;
  creditCost?: number;
  creditsRemaining?: number;
  reusedDraft?: boolean;
  charged?: boolean;
  receiptMessage?: string;
}> {
  if (!res.ok) {
    let msg = "Failed to generate questions.";
    try {
      const t = await res.text();
      const p = JSON.parse(t);
      if (p.message) msg = p.message;
      else if (p.error) msg = p.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (!res.body) throw new Error("No response body from server.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneMeta: Record<string, unknown> = {};

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
          onQuestion?.(msg.question as Record<string, unknown>);
        } else if (msg.type === "status") {
          const message = typeof msg.message === "string" ? msg.message : "";
          if (message) onStatus?.({ message, phase: typeof msg.phase === "string" ? msg.phase : undefined });
        } else if (msg.type === "done") {
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
    draftSetId: typeof doneMeta.draftSetId === "string" ? doneMeta.draftSetId : undefined,
    creditCost: typeof doneMeta.creditCost === "number" ? doneMeta.creditCost : undefined,
    creditsRemaining: typeof doneMeta.creditsRemaining === "number" ? doneMeta.creditsRemaining : undefined,
    reusedDraft: typeof doneMeta.reusedDraft === "boolean" ? doneMeta.reusedDraft : undefined,
    charged: typeof doneMeta.charged === "boolean" ? doneMeta.charged : undefined,
    receiptMessage: typeof doneMeta.receiptMessage === "string" ? doneMeta.receiptMessage : undefined,
  };
}

// ─── Score ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ correct, total, size = 100 }: { correct: number; total: number; size?: number }) {
  const r = 40;
  const cx = 50;
  const circ = 2 * Math.PI * r;
  const p = pct(correct, total);
  const offset = circ * (1 - p / 100);
  const color = p >= 80 ? "#22c55e" : p >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" strokeWidth={8} opacity={0.1} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
        fontSize={size <= 60 ? 20 : 18} fontWeight={700} fill="currentColor" fontFamily="var(--font-bricolage)">
        {total > 0 ? `${correct}/${total}` : "—"}
      </text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SessionConfig = {
  count: 10,
  difficulty: "mixed",
  format: "mixed",
  intent: "auto",
  focus: "",
};

const FORMAT_OPTIONS: Array<{ value: QuestionFormat; label: string; sub: string }> = [
  { value: "mixed", label: "Mixed", sub: "Objective, short-answer, and theory" },
  { value: "mcq", label: "Objective", sub: "A-D questions only" },
  { value: "written", label: "Written", sub: "Typed answers and marking points" },
];

const GENERATION_OPTIONS: Array<{ value: GenerationIntent; label: string }> = [
  { value: "auto", label: "Let Jabu decide" },
  { value: "weak_areas", label: "Strengthen weak spots" },
  { value: "untested_sections", label: "Cover new ground" },
  { value: "application", label: "Practice applying concepts" },
  { value: "hard", label: "Exam-style hard" },
  { value: "topic", label: "Focus on a topic" },
];

export default function PracticeMaterialClient({
  material: m,
  userId,
  initialCredits,
  activeSession,
}: Props) {
  const router = useRouter();
  const title = materialTitle(m);
  const course = m.study_courses;

  const [mode, setMode] = useState<Mode>(activeSession ? "resume-prompt" : "configure");
  const [session, setSession] = useState<MaterialSession | null>(activeSession);
  const [credits, setCredits] = useState(initialCredits);
  const [config, setConfig] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [generationTrust, setGenerationTrust] = useState<GenerationTrustStatus | null>(null);
  const [matchingDraft, setMatchingDraft] = useState<ActiveAiDraft | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generating state
  const [streamingQuestions, setStreamingQuestions] = useState<Record<string, unknown>[]>([]);
  const [generationStatus, setGenerationStatus] = useState("Preparing...");

  // Current batch state
  const [batchQuestions, setBatchQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [batchAttemptId, setBatchAttemptId] = useState<string | null>(null);
  const [batchSetId, setBatchSetId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId → optionId
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({});
  const [writtenGradeStates, setWrittenGradeStates] = useState<Record<string, WrittenGradeState>>({});

  // Batch complete state
  const [completedBatch, setCompletedBatch] = useState<{
    setId: string;
    attemptId: string;
    correct: number;
    total: number;
    mcqQuestions: PracticeQuestion[];
  } | null>(null);
  const [batchSaved, setBatchSaved] = useState(false);
  const [moreConfig, setMoreConfig] = useState<SessionConfig>(DEFAULT_CONFIG);

  // All covered question prompts across batches (for coveredQuestions param)
  const coveredQuestionsRef = useRef<string[]>([]);
  const generationInFlightRef = useRef(false);
  const finishInFlightRef = useRef(false);

  function beginGenerationRequest() {
    if (generationInFlightRef.current) return false;
    generationInFlightRef.current = true;
    return true;
  }

  function endGenerationRequest() {
    generationInFlightRef.current = false;
  }

  // Hide bottom nav during active session
  useEffect(() => {
    if (mode === "answering" || mode === "generating" || mode === "batch-complete" || mode === "resume-prompt") {
      document.body.setAttribute("data-hide-nav", "true");
    } else {
      document.body.removeAttribute("data-hide-nav");
    }
    return () => { document.body.removeAttribute("data-hide-nav"); };
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const params = new URLSearchParams({
          materialId: m.id,
          count: String(config.count),
          difficulty: config.difficulty,
          questionFormat: config.format,
          generationIntent: resolveIntent(config.intent, config),
        });
        if (config.focus.trim()) params.set("focus", config.focus.trim());

        const res = await fetch(`/api/ai/generate-questions/status?${params.toString()}`);
        const data = await res.json().catch(() => null) as ({ ok?: boolean } & Partial<GenerationTrustStatus>) | null;
        if (cancelled || !res.ok || !data?.ok || !data.credits || !data.dailyLimit) return;

        const nextStatus: GenerationTrustStatus = {
          credits: data.credits,
          dailyLimit: data.dailyLimit,
          matchingDraft: data.matchingDraft ?? null,
          latestDraft: data.latestDraft ?? null,
        };
        setGenerationTrust(nextStatus);
        setMatchingDraft(nextStatus.matchingDraft);
        setCredits(data.credits.balance);
      } catch {
        // Status should never block configuring practice.
      }
    })();

    return () => { cancelled = true; };
  }, [m.id, config.count, config.difficulty, config.format, config.intent, config.focus]);

  // ── Resume prompt actions ────────────────────────────────────────────────────

  async function handleContinue() {
    if (!session?.batches.length) { setMode("configure"); return; }
    const lastBatch = session.batches[session.batches.length - 1];
    await loadBatchForAnswering(lastBatch.setId, lastBatch.attemptId);
  }

  async function handleStartFresh() {
    if (!session) { setMode("configure"); return; }
    setError(null);
    try {
      await fetch(`/api/study/material-sessions/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
    } catch { /* non-critical */ }
    setSession(null);
    setMode("configure");
  }

  // ── Load batch questions from DB ─────────────────────────────────────────────

  async function loadBatchForAnswering(setId: string, attemptId: string) {
    setError(null);
    try {
      const qRes = await supabase
        .from("study_quiz_questions")
        .select(
          "id, prompt, explanation, question_type, model_answer, marking_points, source_topic, study_ref," +
          "study_quiz_options(id, text, is_correct, position)"
        )
        .eq("set_id", setId)
        .order("position", { ascending: true });

      if (qRes.error) throw qRes.error;

      const questions: PracticeQuestion[] = (qRes.data ?? []).map((row: any) => ({
        id: String(row.id),
        prompt: String(row.prompt ?? ""),
        explanation: row.explanation ?? null,
        question_type: (row.question_type === "short_answer" || row.question_type === "theory")
          ? row.question_type : "mcq",
        options: (Array.isArray(row.study_quiz_options) ? row.study_quiz_options : [])
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
          .map((o: any) => ({
            id: String(o.id),
            text: String(o.text ?? ""),
            is_correct: Boolean(o.is_correct),
            position: typeof o.position === "number" ? o.position : null,
          })),
        model_answer: row.model_answer ?? null,
        marking_points: Array.isArray(row.marking_points)
          ? row.marking_points.map((p: unknown) => String(p ?? "")).filter(Boolean)
          : [],
        source_topic: row.source_topic ?? null,
        study_ref: row.study_ref ?? null,
      }));

      if (questions.length === 0) throw new Error("No questions found in this batch.");

      // Restore existing answers from the attempt
      const ansRes = await supabase
        .from("study_attempt_answers")
        .select("question_id, selected_option_id, text_answer")
        .eq("attempt_id", attemptId);

      const restoredAnswers: Record<string, string> = {};
      const restoredWritten: Record<string, string> = {};
      for (const row of (ansRes.data ?? [])) {
        if (row.question_id && row.selected_option_id)
          restoredAnswers[String(row.question_id)] = String(row.selected_option_id);
        if (row.question_id && typeof row.text_answer === "string" && row.text_answer.trim())
          restoredWritten[String(row.question_id)] = String(row.text_answer);
      }

      // Find first unanswered question to resume from
      const firstUnanswered = questions.findIndex((q) => {
        if (q.question_type !== "mcq") return !restoredWritten[q.id]?.trim();
        return !restoredAnswers[q.id];
      });

      setBatchQuestions(questions);
      setBatchAttemptId(attemptId);
      setBatchSetId(setId);
      setAnswers(restoredAnswers);
      setWrittenAnswers(restoredWritten);
      setWrittenGradeStates({});
      setCurrentIndex(Math.max(0, firstUnanswered === -1 ? questions.length - 1 : firstUnanswered));
      setMode("answering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions.");
    }
  }

  // ── Generation flow ──────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!beginGenerationRequest()) return;
    setError(null);
    setStreamingQuestions([]);
    setGenerationStatus("Preparing question generation...");
    setMode("generating");

    const resolvedIntent = resolveIntent(config.intent, config);

    try {
      if (matchingDraft?.setId && coveredQuestionsRef.current.length === 0) {
        setGenerationStatus("Opening saved draft - no credits charged.");
        let sessionId = session?.id ?? null;
        if (!sessionId) {
          const sessionRes = await fetch(`/api/study/material-sessions/${m.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const sessionData = await sessionRes.json();
          if (sessionData.ok && sessionData.session) {
            setSession(sessionData.session);
            sessionId = sessionData.session.id;
          }
        }

        let attemptId = matchingDraft.attempt?.id ?? null;
        if (!attemptId) {
          const startedIso = new Date().toISOString();
          const { data: attemptData } = await supabase
            .from("study_practice_attempts")
            .insert({ user_id: userId, set_id: matchingDraft.setId, status: "in_progress", started_at: startedIso } as any)
            .select("id")
            .maybeSingle();
          attemptId = attemptData?.id ? String(attemptData.id) : null;
        }
        if (!attemptId) throw new Error("Could not create practice session. Please try again.");
        await loadBatchForAnswering(matchingDraft.setId, attemptId);
        return;
      }

      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          count: config.count,
          difficulty: config.difficulty,
          focus: config.focus || undefined,
          questionFormat: config.format,
          persistDraft: true,
          generationIntent: resolvedIntent,
          coveredQuestions: coveredQuestionsRef.current.slice(-20),
        }),
      });

      const { draftSetId, creditsRemaining, receiptMessage } = await readNdjsonStream(
        res,
        (q) => setStreamingQuestions((prev) => [...prev, q]),
        (s) => setGenerationStatus(s.message)
      );

      if (!draftSetId) throw new Error("Questions generated, but the draft could not be saved. Please try again.");
      if (typeof creditsRemaining === "number") setCredits(creditsRemaining);
      if (receiptMessage) setGenerationStatus(receiptMessage);

      // Ensure session exists
      let sessionId = session?.id ?? null;
      if (!sessionId) {
        const sessionRes = await fetch(`/api/study/material-sessions/${m.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const sessionData = await sessionRes.json();
        if (sessionData.ok && sessionData.session) {
          setSession(sessionData.session);
          sessionId = sessionData.session.id;
        }
      }

      // Create practice attempt
      const startedIso = new Date().toISOString();
      const { data: attemptData } = await supabase
        .from("study_practice_attempts")
        .insert({ user_id: userId, set_id: draftSetId, status: "in_progress", started_at: startedIso } as any)
        .select("id")
        .maybeSingle();

      const attemptId = attemptData?.id ? String(attemptData.id) : null;
      if (!attemptId) throw new Error("Could not create practice session. Please try again.");

      await loadBatchForAnswering(draftSetId, attemptId);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Something went wrong.";
      setError(detail.includes("no credits charged") ? detail : `Generation failed - no credits charged. ${detail}`);
      setMode("configure");
    } finally {
      endGenerationRequest();
    }
  }

  // ── Answer handling ──────────────────────────────────────────────────────────

  function handleMcqAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    if (!batchAttemptId) return;
    void supabase.from("study_attempt_answers").upsert(
      { attempt_id: batchAttemptId, question_id: questionId, selected_option_id: optionId, answered_at: new Date().toISOString() } as any,
      { onConflict: "attempt_id,question_id" }
    );
  }

  function handleWrittenChange(questionId: string, text: string) {
    setWrittenAnswers((prev) => ({ ...prev, [questionId]: text }));
    setWrittenGradeStates((prev) => ({ ...prev, [questionId]: { status: "idle" } }));
  }

  async function handleGradeWritten(questionId: string, question: PracticeQuestion) {
    const answer = (writtenAnswers[questionId] ?? "").trim();
    if (!answer || !question.model_answer) return;
    setWrittenGradeStates((prev) => ({ ...prev, [questionId]: { status: "loading" } }));
    try {
      const res = await fetch("/api/ai/grade-generated-written-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          questionType: question.question_type,
          question: question.prompt,
          modelAnswer: question.model_answer,
          markingPoints: question.marking_points,
          answer,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.grade) throw new Error(data.message || "Could not grade answer.");
      setWrittenGradeStates((prev) => ({ ...prev, [questionId]: { status: "done", grade: data.grade } }));
      if (batchAttemptId) {
        void supabase.from("study_attempt_answers").upsert(
          { attempt_id: batchAttemptId, question_id: questionId, text_answer: answer, answered_at: new Date().toISOString() } as any,
          { onConflict: "attempt_id,question_id" }
        );
      }
    } catch (e) {
      setWrittenGradeStates((prev) => ({
        ...prev,
        [questionId]: { status: "error", message: e instanceof Error ? e.message : "Could not grade answer." },
      }));
    }
  }

  function handleContinueQuestion() {
    if (currentIndex + 1 >= batchQuestions.length) {
      finishBatch();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  function isQuestionAnswered(question: PracticeQuestion): boolean {
    if (question.question_type !== "mcq") return (writtenAnswers[question.id] ?? "").trim().length > 0;
    return Boolean(answers[question.id]);
  }

  // ── Batch completion ─────────────────────────────────────────────────────────

  function finishBatch() {
    if (!batchSetId || !batchAttemptId) return;
    const mcqQs = batchQuestions.filter((q) => q.question_type === "mcq");
    let correct = 0;
    for (const q of mcqQs) {
      const optId = answers[q.id];
      if (optId) {
        const opt = q.options.find((o) => o.id === optId);
        if (opt?.is_correct) correct++;
      }
    }

    const missedT = Array.from(
      new Set(
        mcqQs
          .filter((q) => {
            const optId = answers[q.id];
            if (!optId) return false;
            return !q.options.find((o) => o.id === optId)?.is_correct;
          })
          .map((q) => q.source_topic)
          .filter((t): t is string => Boolean(t))
      )
    ).slice(0, 3);

    const defaultMoreIntent: GenerationIntent = missedT.length > 0 ? "weak_areas" : "untested_sections";
    setMoreConfig({ ...config, intent: defaultMoreIntent });

    // Add all question prompts to covered list
    coveredQuestionsRef.current = [
      ...coveredQuestionsRef.current,
      ...batchQuestions.map((q) => q.prompt),
    ].slice(-40);

    setCompletedBatch({
      setId: batchSetId,
      attemptId: batchAttemptId,
      correct,
      total: mcqQs.length,
      mcqQuestions: mcqQs,
    });
    setBatchSaved(false);
    setMode("batch-complete");
  }

  async function handleSaveBatchAndGenerateMore(moreCfg: SessionConfig) {
    if (!completedBatch) return;
    if (!beginGenerationRequest()) return;
    setError(null);

    const batchRecord: BatchRecord = {
      setId: completedBatch.setId,
      attemptId: completedBatch.attemptId,
      count: completedBatch.total,
      correct: completedBatch.correct,
      intent: resolveIntent(config.intent, config),
      questionFormat: config.format,
      generatedAt: new Date().toISOString(),
    };

    if (!batchSaved) {
      try {
        await fetch(`/api/study/material-sessions/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "append_batch", batch: batchRecord }),
        });
        setBatchSaved(true);
        setSession((s) =>
          s
            ? {
                ...s,
                total_questions: s.total_questions + completedBatch.total,
                total_correct: s.total_correct + completedBatch.correct,
                batches: [...s.batches, batchRecord],
              }
            : s
        );
      } catch { /* non-critical */ }
    }

    setConfig(moreCfg);
    await handleGenerateMore(moreCfg, true);
  }

  async function handleGenerateMore(moreCfg: SessionConfig, lockHeld = false) {
    if (!lockHeld && !beginGenerationRequest()) return;
    setError(null);
    setStreamingQuestions([]);
    setGenerationStatus("Preparing the next set...");
    setMode("generating");

    const resolvedIntent = resolveIntent(moreCfg.intent, moreCfg);

    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: m.id,
          count: moreCfg.count,
          difficulty: moreCfg.difficulty,
          focus: moreCfg.focus || undefined,
          questionFormat: moreCfg.format,
          persistDraft: true,
          generationIntent: resolvedIntent,
          coveredQuestions: coveredQuestionsRef.current.slice(-20),
        }),
      });

      const { draftSetId, creditsRemaining, receiptMessage } = await readNdjsonStream(
        res,
        (q) => setStreamingQuestions((prev) => [...prev, q]),
        (s) => setGenerationStatus(s.message)
      );

      if (!draftSetId) throw new Error("Questions generated, but the draft could not be saved. Please try again.");
      if (typeof creditsRemaining === "number") setCredits(creditsRemaining);
      if (receiptMessage) setGenerationStatus(receiptMessage);

      const startedIso = new Date().toISOString();
      const { data: attemptData } = await supabase
        .from("study_practice_attempts")
        .insert({ user_id: userId, set_id: draftSetId, status: "in_progress", started_at: startedIso } as any)
        .select("id")
        .maybeSingle();

      const attemptId = attemptData?.id ? String(attemptData.id) : null;
      if (!attemptId) throw new Error("Could not create practice session. Please try again.");

      await loadBatchForAnswering(draftSetId, attemptId);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Something went wrong.";
      setError(detail.includes("no credits charged") ? detail : `Generation failed - no credits charged. ${detail}`);
      setMode("batch-complete");
    } finally {
      endGenerationRequest();
    }
  }

  async function handleFinishSession() {
    if (finishInFlightRef.current) return;
    finishInFlightRef.current = true;

    if (completedBatch && !batchSaved) {
      const batchRecord: BatchRecord = {
        setId: completedBatch.setId,
        attemptId: completedBatch.attemptId,
        count: completedBatch.total,
        correct: completedBatch.correct,
        intent: resolveIntent(config.intent, config),
        questionFormat: config.format,
        generatedAt: new Date().toISOString(),
      };
      try {
        await fetch(`/api/study/material-sessions/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "append_batch", batch: batchRecord }),
        });
      } catch { /* non-critical */ }
    }
    try {
      await fetch(`/api/study/material-sessions/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
    } catch { /* non-critical */ }
    router.push(`/study/materials/${m.id}`);
  }

  // ── Derived session totals ───────────────────────────────────────────────────

  const batchCount = session?.batches.length ?? 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  const creditCost = generationTrust?.credits.cost ?? Math.ceil(config.count / 5);
  const dailyRemaining = generationTrust?.dailyLimit.remaining ?? 4;
  const hasMatchingDraft = Boolean(matchingDraft?.setId);
  const canGenerate = hasMatchingDraft || ((generationTrust?.credits.canAfford ?? credits >= creditCost) && dailyRemaining > 0);
  const generationAvailabilityCopy = hasMatchingDraft
    ? "Saved draft ready - no credits charged"
    : `${creditCost} credit${creditCost === 1 ? "" : "s"} - ${dailyRemaining} generation${dailyRemaining === 1 ? "" : "s"} left today`;

  const currentQ = batchQuestions[currentIndex];
  const isMcq = currentQ?.question_type === "mcq";
  const currentAnswered = currentQ ? isQuestionAnswered(currentQ) : false;

  const CreditsCard = () => (
    <div className="flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3.5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-50">
        <Sparkles className="h-5 w-5 text-amber-500" />
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
      <button type="button" className="shrink-0 rounded-xl border border-primary bg-primary-light px-3 py-1.5 text-xs font-bold text-primary">
        + Get more
      </button>
    </div>
  );

  const GenerateConfigCard = () => (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <p className="flex items-center gap-2 text-base font-extrabold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Practice
        </p>
        <p className="mt-1 text-xs text-muted-brand">Start with 10 questions, or customize the set.</p>
      </div>
      <div className="space-y-4 p-4">
        <div className={cn(
          "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm",
          hasMatchingDraft ? "border-primary/25 bg-primary-light text-primary-text" : "border-amber-300 bg-amber-50 text-amber-800"
        )}>
          <span className="font-semibold">{generationAvailabilityCopy}</span>
          <span className="font-extrabold">{hasMatchingDraft ? "Free" : `${credits} left`}</span>
        </div>

        {error && <p className="text-center text-xs text-red-500">{error}</p>}
        {!hasMatchingDraft && dailyRemaining <= 0 && (
          <p className="text-center text-xs font-semibold text-amber-700">Daily generation limit reached.</p>
        )}
        {!hasMatchingDraft && !(generationTrust?.credits.canAfford ?? credits >= creditCost) && (
          <p className="text-center text-xs font-semibold text-amber-700">
            Not enough credits - need {creditCost}, have {credits}.
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={!canGenerate}
          className="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-4 text-left text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none active:scale-[0.99]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-extrabold">
              {hasMatchingDraft ? "Resume saved draft" : `Generate ${config.count} questions`}
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
          <ChevronDown className={cn("h-4 w-4 transition", customizeOpen && "rotate-180")} />
          Customize
        </button>

        <div className={cn("space-y-4", !customizeOpen && "hidden")}>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-brand">Questions</p>
          <div className="flex gap-2">
            {([5, 10, 15, 20] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, count: n }))}
                className={cn(
                  "flex-1 rounded-xl border py-2.5 text-sm font-bold transition focus-visible:outline-none",
                  config.count === n
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
            {FORMAT_OPTIONS.map(({ value, label, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, format: value }))}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none",
                  config.format === value
                    ? "border-primary bg-primary-light"
                    : "border-border bg-background hover:bg-secondary/40"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2",
                    config.format === value ? "border-primary bg-primary" : "border-border bg-card"
                  )}
                />
                <span>
                  <span className={cn("block text-sm font-bold", config.format === value ? "text-primary-text" : "text-foreground")}>
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
                onClick={() => setConfig((c) => ({ ...c, difficulty: value }))}
                className={cn(
                  "rounded-xl border px-2 py-2 text-xs font-extrabold transition focus-visible:outline-none",
                  config.difficulty !== value && "border-border bg-background text-foreground hover:bg-secondary/50",
                  config.difficulty === "easy" && value === "easy" && "border-green-300 bg-green-50 text-green-700",
                  config.difficulty === "mixed" && value === "mixed" && "border-amber-300 bg-amber-50 text-amber-700",
                  config.difficulty === "hard" && value === "hard" && "border-red-300 bg-red-50 text-red-600"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-brand">Smart targeting</p>
          <div className="relative rounded-2xl border border-border bg-background px-3 py-3">
            <select
              value={config.intent}
              onChange={(e) => setConfig((c) => ({ ...c, intent: e.target.value as GenerationIntent }))}
              className="w-full appearance-none bg-transparent pr-8 text-sm font-bold text-foreground outline-none"
            >
              {GENERATION_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-muted-brand" />
          </div>
        </div>

        {(config.intent === "topic" || config.focus) && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-brand">Focus area</p>
            <input
              type="text"
              value={config.focus}
              onChange={(e) => setConfig((c) => ({ ...c, focus: e.target.value }))}
              placeholder="e.g. Krebs cycle"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}

        </div>

      </div>
    </div>
  );

  // Weak areas from current batch
  const missedTopics = completedBatch
    ? Array.from(
        new Set(
          completedBatch.mcqQuestions
            .filter((q) => {
              const optId = answers[q.id];
              if (!optId) return false;
              const opt = q.options.find((o) => o.id === optId);
              return !opt?.is_correct;
            })
            .map((q) => q.source_topic)
            .filter((t): t is string => Boolean(t))
        )
      ).slice(0, 3)
    : [];

  // ── Mode: resume-prompt ──────────────────────────────────────────────────────

  if (mode === "resume-prompt" && session) {
    const pausedAgo = timeAgo(session.last_active_at);
    const totalPct = pct(session.total_correct, session.total_questions);

    return (
      <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
        <div className="border-b border-border bg-card px-4 pb-4 pt-14">
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            Paused {pausedAgo}
          </span>
          <h1 className="mt-2 text-xl font-extrabold text-foreground">Session in progress</h1>
          <p className="text-sm text-muted-brand">
            {title}{course ? ` - ${course.course_code}` : ""}
          </p>
        </div>
        <div className="flex-1 space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border bg-card py-3 text-center">
              <p className="text-lg font-extrabold text-foreground">{session.total_questions}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-brand">Answered</p>
            </div>
            <div className="rounded-2xl border border-border bg-card py-3 text-center">
              <p className="text-lg font-extrabold text-green-600">{session.total_correct}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-brand">Correct</p>
            </div>
            <div className="rounded-2xl border border-border bg-card py-3 text-center">
              <p className="text-lg font-extrabold text-primary">{totalPct}%</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-brand">Score</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Your progress</p>
              <p className="text-xs font-semibold text-muted-brand">Q1-Q{session.total_questions} answered</p>
            </div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70" style={{ width: "100%" }} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {session.batches.map((b, i) => (
                <span key={i} className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700">
                  Batch {i + 1}: {b.correct}/{b.count}
                </span>
              ))}
            </div>
          </div>

          {error && <p className="text-center text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleContinue()}
              className="flex-[2] rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-white transition hover:opacity-90"
            >
              Continue from Q{session.total_questions + 1} →
            </button>
            <button
              type="button"
              onClick={() => void handleStartFresh()}
              className="flex-1 rounded-2xl border border-border bg-card py-3.5 text-sm font-bold text-muted-brand transition hover:bg-secondary/50"
            >
              Start fresh
            </button>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-brand">
            Session resumes if returned within 24 hours.<br />
            <strong className="text-foreground">{credits} credits remaining</strong>
          </p>
        </div>
      </div>
    );
  }

  // ── Mode: configure ──────────────────────────────────────────────────────────

  if (mode === "configure") {
    return (
      <div className="mx-auto max-w-xl space-y-3 p-4 pb-28 md:pb-8">
        <div className="pt-1">
          <Link
            href={`/study/materials/${m.id}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/50"
          >
            <ArrowLeft className="h-4 w-4" />
            {title}
          </Link>
        </div>
        <CreditsCard />
        <GenerateConfigCard />
      </div>
    );
  }

  // ── Mode: generating ─────────────────────────────────────────────────────────

  if (mode === "generating") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background px-7">
        <div className="h-12 w-12 rounded-full border-[3px] border-border border-t-primary animate-spin" />
        <p className="text-center text-lg font-extrabold text-foreground">
          Generating {config.count} questions
        </p>
        <p className="text-center text-sm leading-relaxed text-muted-brand">{generationStatus}</p>
        {streamingQuestions.length > 0 && (
          <div className="max-h-48 w-full space-y-2 overflow-hidden rounded-2xl border border-border bg-card p-3">
            {streamingQuestions.slice(-5).map((q, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-brand">
                <div
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    i < streamingQuestions.slice(-5).length - 1 ? "bg-green-500" : "bg-border"
                  )}
                />
                <span className={i < streamingQuestions.slice(-5).length - 1 ? "text-foreground" : ""}>
                  {typeof q.question === "string" ? q.question : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Mode: answering ──────────────────────────────────────────────────────────

  if (mode === "answering" && currentQ) {
    const chosenOptionId = answers[currentQ.id];
    const chosenOption = isMcq ? currentQ.options.find((o) => o.id === chosenOptionId) ?? null : null;
    const gradeState: WrittenGradeState = writtenGradeStates[currentQ.id] ?? { status: "idle" };

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="shrink-0 border-b border-border bg-card px-4 pb-3 pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="truncate text-[11px] font-bold text-primary">
              {course?.course_code ?? title}{course ? ` - ${m.title ?? ""}` : ""}
            </p>
            <button
              type="button"
              onClick={() => setMode("configure")}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-sm text-muted-brand"
              aria-label="Close session"
            >
              ×
            </button>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-extrabold text-foreground">Q{currentIndex + 1} of {batchQuestions.length}</span>
            {session && session.total_correct > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
                {session.total_correct} correct
              </span>
            )}
            <span className="ml-auto text-sm font-extrabold tabular-nums text-foreground">
              {pct(session?.total_correct ?? 0, session?.total_questions ?? 0)}%
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / batchQuestions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 pb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-light px-2.5 py-1 text-[10px] font-bold text-primary">
            Batch {batchCount + 1} - {batchQuestions.length} questions
          </div>

          <div className="rounded-2xl border border-border bg-card p-3.5">
            {currentQ.study_ref?.chunkId && (
              <div className="mb-2.5 flex items-center gap-1 text-[11px] font-semibold text-muted-brand">
                <FileText className="h-3 w-3 shrink-0" />
                {currentQ.study_ref.page ? `Page ${currentQ.study_ref.page}` : currentQ.study_ref.topic ?? "Source"}
              </div>
            )}
            <p className="text-[15px] font-bold leading-relaxed text-foreground">{currentQ.prompt}</p>
          </div>

          {isMcq ? (
            <>
              <div className="space-y-2.5">
                {currentQ.options.map((opt, idx) => {
                  const label = ["A", "B", "C", "D"][idx] ?? String.fromCharCode(65 + idx);
                  const isChosen = chosenOptionId === opt.id;
                  const answered = Boolean(chosenOptionId);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={answered}
                      onClick={() => handleMcqAnswer(currentQ.id, opt.id)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-xl border-[1.5px] px-3 py-3 text-left transition focus-visible:outline-none",
                        !answered && "border-border bg-card hover:border-primary hover:bg-primary-light",
                        answered && opt.is_correct && "border-green-400 bg-green-50",
                        answered && isChosen && !opt.is_correct && "border-red-400 bg-red-50",
                        answered && !opt.is_correct && !isChosen && "border-border/40 text-muted-brand opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold transition",
                          !answered && "bg-secondary text-muted-brand",
                          answered && opt.is_correct && "bg-green-500 text-white",
                          answered && isChosen && !opt.is_correct && "bg-red-500 text-white",
                          answered && !opt.is_correct && !isChosen && "bg-secondary text-muted-brand"
                        )}
                      >
                        {label}
                      </span>
                      <span
                        className={cn(
                          "flex-1 text-[13.5px] font-medium leading-relaxed",
                          answered && opt.is_correct && "font-semibold text-green-800",
                          answered && isChosen && !opt.is_correct && "text-red-700"
                        )}
                      >
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
              {chosenOptionId && (
                <div className={cn("flex items-start gap-2.5 rounded-xl p-3", chosenOption?.is_correct ? "bg-green-50" : "bg-red-50")}>
                  <span className="shrink-0 text-lg leading-tight">{chosenOption?.is_correct ? "✓" : "✗"}</span>
                  <p className="text-[12.5px] leading-relaxed text-foreground">
                    <strong>{chosenOption?.is_correct ? "Correct!" : "Not quite."}</strong>{" "}
                    {currentQ.explanation}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <span className="rounded-full border border-primary/30 bg-primary-light px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-primary-text">
                {currentQ.question_type === "theory" ? "Theory" : "Short answer"}
              </span>
              <textarea
                value={writtenAnswers[currentQ.id] ?? ""}
                onChange={(e) => handleWrittenChange(currentQ.id, e.target.value)}
                placeholder="Type your answer here..."
                rows={currentQ.question_type === "theory" ? 8 : 4}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                disabled={(writtenAnswers[currentQ.id] ?? "").trim().length < 5 || gradeState.status === "loading"}
                onClick={() => void handleGradeWritten(currentQ.id, currentQ)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary bg-primary-light px-4 py-2.5 text-sm font-semibold text-primary-text transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-none"
              >
                {gradeState.status === "loading"
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Grading...</>
                  : <><BookOpen className="h-4 w-4" /> {gradeState.status === "done" ? "Refresh grade" : "Grade answer"}</>}
              </button>
              {gradeState.status === "done" && (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">AI feedback</p>
                    <span className="rounded-full border border-emerald-500/30 bg-background px-2.5 py-1 text-xs font-extrabold text-foreground">
                      {gradeState.grade.score}/{gradeState.grade.maxScore} — {verdictLabel(gradeState.grade.verdict)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{gradeState.grade.feedback}</p>
                  {gradeState.grade.missingPoints.length > 0 && (
                    <div>
                      <p className="text-xs font-extrabold text-amber-700 dark:text-amber-300">Focus on</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                        {gradeState.grade.missingPoints.map((pt, i) => <li key={i}>{pt}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {gradeState.status === "error" && (
                <p className="text-xs text-red-500">{gradeState.message}</p>
              )}
            </div>
          )}

          {currentAnswered && (
            <button
              type="button"
              onClick={handleContinueQuestion}
              className="w-full rounded-2xl bg-primary py-3.5 text-[15px] font-extrabold text-white transition hover:opacity-90 focus-visible:outline-none"
            >
              {currentIndex + 1 >= batchQuestions.length ? "Finish batch →" : "Continue →"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Mode: batch-complete ─────────────────────────────────────────────────────

  if (mode === "batch-complete" && completedBatch) {
    const updatedSessionTotal = (session?.total_questions ?? 0) + completedBatch.total;
    const updatedSessionCorrect = (session?.total_correct ?? 0) + completedBatch.correct;
    const updatedBatchCount = (session?.batches.length ?? 0) + 1;

    const moreCost = Math.ceil(moreConfig.count / 5);
    const canMore = credits >= moreCost;

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="relative z-30 shrink-0 border-b border-border bg-card px-4 pb-3 pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="truncate text-[11px] font-bold text-primary">
              {course?.course_code ?? title}{course ? ` - ${m.title ?? ""}` : ""}
            </p>
            <button
              type="button"
              onClick={() => void handleFinishSession()}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-sm text-muted-brand"
              aria-label="Close session"
            >
              ×
            </button>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-extrabold text-foreground">{updatedBatchCount} batch{updatedBatchCount === 1 ? "" : "es"}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
              {updatedSessionCorrect} correct
            </span>
            <span className="ml-auto text-sm font-extrabold tabular-nums text-foreground">
              {pct(updatedSessionCorrect, updatedSessionTotal)}%
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: "100%" }} />
          </div>
        </div>

        <div className="fixed inset-0 z-20 bg-black/40" />
        <div className="fixed inset-x-0 bottom-0 z-30 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-card">
          <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-border" />
          <div className="border-b border-border px-4 pb-3 pt-3.5">
            <p className="text-lg font-extrabold text-foreground">Batch {updatedBatchCount} done</p>
            <p className="text-[12.5px] text-muted-brand">{completedBatch.total} questions - {title}</p>
          </div>
          <div className="space-y-3 px-4 py-3.5">
            <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-background p-3">
              <ScoreRing correct={completedBatch.correct} total={completedBatch.total} size={52} />
              <div>
                <p className="text-2xl font-extrabold leading-none text-foreground">
                  {completedBatch.correct} <em className="text-sm font-semibold not-italic text-muted-brand">/ {completedBatch.total} correct</em>
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-muted-brand">
                  Running total: {updatedSessionCorrect} / {updatedSessionTotal}
                </p>
              </div>
            </div>

            {missedTopics.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-brand">Needs more practice</p>
                <div className="space-y-1.5">
                  {missedTopics.map((t) => (
                    <div key={t} className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 dark:border-red-900 dark:bg-red-950/40">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <span className="flex-1 text-sm font-bold text-foreground">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2.5 rounded-2xl border border-primary/20 bg-primary-light p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-primary-text">
                <Sparkles className="h-3.5 w-3.5" /> Generate more - targeting weak areas
              </p>
              {missedTopics.length > 0 && (
                <div className="flex justify-between text-[12.5px]">
                  <span className="font-semibold text-muted-brand">Focus</span>
                  <span className="ml-3 truncate font-bold text-primary">{missedTopics.join(" + ")}</span>
                </div>
              )}
              <div className="flex gap-1.5">
                {([5, 10, 15, 20] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMoreConfig((c) => ({ ...c, count: n }))}
                    className={cn(
                      "flex-1 rounded-xl border py-1.5 text-xs font-bold transition",
                      moreConfig.count === n
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-card text-foreground"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
                <span className="font-semibold text-muted-brand">Cost</span>
                <span className="font-extrabold text-amber-600">{moreCost} credits · {credits} remaining</span>
              </div>
            </div>

            {error && <p className="text-center text-xs text-red-500">{error}</p>}

            <button
              type="button"
              disabled={!canMore}
              onClick={() => void handleSaveBatchAndGenerateMore(moreConfig)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" /> Generate {moreConfig.count} more questions
            </button>

            <button
              type="button"
              onClick={() => void handleFinishSession()}
              className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-foreground transition hover:bg-secondary/50"
            >
              Finish session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (shouldn't render)
  return null;
}
