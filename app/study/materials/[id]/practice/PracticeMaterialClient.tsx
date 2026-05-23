"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  X,
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
  };
}

// ─── Score ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ correct, total }: { correct: number; total: number }) {
  const r = 40;
  const cx = 50;
  const circ = 2 * Math.PI * r;
  const p = pct(correct, total);
  const offset = circ * (1 - p / 100);
  const color = p >= 80 ? "#22c55e" : p >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" strokeWidth={8} opacity={0.1} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
        fontSize={18} fontWeight={700} fill="currentColor" fontFamily="var(--font-bricolage)">
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

  // Hide bottom nav during active session
  useEffect(() => {
    if (mode === "answering" || mode === "generating") {
      document.body.setAttribute("data-hide-nav", "true");
    } else {
      document.body.removeAttribute("data-hide-nav");
    }
    return () => { document.body.removeAttribute("data-hide-nav"); };
  }, [mode]);

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
    setError(null);
    setStreamingQuestions([]);
    setGenerationStatus("Preparing question generation...");
    setMode("generating");

    const resolvedIntent = resolveIntent(config.intent, config);

    try {
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

      const { draftSetId, creditsRemaining } = await readNdjsonStream(
        res,
        (q) => setStreamingQuestions((prev) => [...prev, q]),
        (s) => setGenerationStatus(s.message)
      );

      if (!draftSetId) throw new Error("Questions generated, but the draft could not be saved. Please try again.");
      if (typeof creditsRemaining === "number") setCredits(creditsRemaining);

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
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMode("configure");
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
    await handleGenerateMore(moreCfg);
  }

  async function handleGenerateMore(moreCfg: SessionConfig) {
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

      const { draftSetId, creditsRemaining } = await readNdjsonStream(
        res,
        (q) => setStreamingQuestions((prev) => [...prev, q]),
        (s) => setGenerationStatus(s.message)
      );

      if (!draftSetId) throw new Error("Questions generated, but the draft could not be saved. Please try again.");
      if (typeof creditsRemaining === "number") setCredits(creditsRemaining);

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
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMode("batch-complete");
    }
  }

  async function handleFinishSession() {
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

  const sessionTotal = (session?.total_questions ?? 0) + (completedBatch && mode === "batch-complete" ? 0 : 0);
  const sessionCorrect = session?.total_correct ?? 0;
  const batchCount = session?.batches.length ?? 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  const creditCost = Math.ceil(config.count / 5);
  const canGenerate = credits >= creditCost;

  const currentQ = batchQuestions[currentIndex];
  const isMcq = currentQ?.question_type === "mcq";
  const currentAnswered = currentQ ? isQuestionAnswered(currentQ) : false;

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
      <div className="space-y-4 pb-28 md:pb-8">
        <div>
          <Link
            href={`/study/materials/${m.id}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/50"
          >
            <ArrowLeft className="h-4 w-4" />
            {title}
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-sm">
          <div className="bg-gradient-to-br from-primary to-primary/65 px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Practice Session</p>
            <h1 className="mt-1 font-[family-name:var(--font-bricolage)] text-2xl font-bold text-white">
              {title}
            </h1>
            {course && (
              <p className="mt-1 text-sm font-semibold text-white/80">
                {course.course_code}{course.level ? ` · ${course.level}L` : ""}
              </p>
            )}
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-950/20">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                You paused {pausedAgo}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-background py-3 text-center">
                <p className="text-lg font-bold text-foreground">{session.total_questions}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-brand">Questions</p>
              </div>
              <div className="rounded-xl border border-border bg-background py-3 text-center">
                <p className="text-lg font-bold text-primary">{session.total_correct}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-brand">Correct</p>
              </div>
              <div className="rounded-xl border border-border bg-background py-3 text-center">
                <p className="text-lg font-bold text-foreground">{totalPct}%</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-brand">Score</p>
              </div>
            </div>

            {session.batches.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">Batch history</p>
                <div className="flex flex-wrap gap-2">
                  {session.batches.map((b, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary-light px-3 py-1 text-xs font-semibold text-primary-text"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Batch {i + 1} ({b.correct}/{b.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-center text-xs text-red-500">{error}</p>}

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleContinue()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" />
                Continue session
              </button>
              <button
                type="button"
                onClick={() => void handleStartFresh()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary/50"
              >
                Start fresh (uses credits)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Mode: configure ──────────────────────────────────────────────────────────

  if (mode === "configure") {
    return (
      <div className="space-y-4 pb-28 md:pb-8">
        <div>
          <Link
            href={`/study/materials/${m.id}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/50"
          >
            <ArrowLeft className="h-4 w-4" />
            {title}
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-sm">
          <div className="bg-gradient-to-br from-primary to-primary/65 px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">New Practice Session</p>
            <h1 className="mt-1 font-[family-name:var(--font-bricolage)] text-2xl font-bold text-white">
              {title}
            </h1>
            {course && (
              <p className="mt-1 text-sm font-semibold text-white/80">
                {course.course_code}{course.level ? ` · ${course.level}L` : ""}
              </p>
            )}
          </div>

          <div className="space-y-5 p-5">
            {/* Count */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">
                Number of questions
              </p>
              <div className="flex gap-2">
                {([5, 10, 15, 20] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, count: n }))}
                    className={cn(
                      "flex-1 rounded-xl border py-2.5 text-sm font-semibold transition focus-visible:outline-none",
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

            {/* Format */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">Format</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { value: "mixed", label: "Mixed", sub: "Objective + written" },
                    { value: "mcq", label: "Objective", sub: "A–D only" },
                    { value: "written", label: "Written", sub: "Typed answers" },
                  ] as const
                ).map(({ value, label, sub }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, format: value }))}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none",
                      config.format === value
                        ? "border-primary bg-primary-light"
                        : "border-border bg-background hover:bg-secondary/40"
                    )}
                  >
                    <p className={cn("text-sm font-semibold", config.format === value ? "text-primary-text" : "text-foreground")}>
                      {label}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-brand">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">Difficulty</p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { value: "easy", label: "Easy warm-up", sub: "Recall & definitions" },
                    { value: "mixed", label: "Mixed", sub: "Recall, application & analysis" },
                    { value: "hard", label: "Exam-hard", sub: "Deep understanding & application" },
                  ] as const
                ).map(({ value, label, sub }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, difficulty: value }))}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none",
                      config.difficulty === value
                        ? "border-primary bg-primary-light"
                        : "border-border bg-background hover:bg-secondary/40"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 shrink-0 rounded-full border-2",
                        config.difficulty === value ? "border-primary bg-primary" : "border-border"
                      )}
                    />
                    <div>
                      <p className={cn("text-sm font-semibold", config.difficulty === value ? "text-primary-text" : "text-foreground")}>
                        {label}
                      </p>
                      <p className="text-xs text-muted-brand">{sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Intent */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">
                What should Jabu focus on?
              </p>
              <div className="rounded-xl border border-border bg-background px-3 py-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <select
                    value={config.intent}
                    onChange={(e) => setConfig((c) => ({ ...c, intent: e.target.value as GenerationIntent }))}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
                  >
                    <option value="auto">Let Jabu decide</option>
                    <option value="weak_areas">Strengthen weak spots</option>
                    <option value="untested_sections">Cover new ground</option>
                    <option value="application">Practice applying concepts</option>
                    <option value="hard">Exam-style hard</option>
                    <option value="topic">Focus on a topic</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Focus area */}
            {(config.intent === "topic" || config.focus) && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">
                  Focus area <span className="normal-case font-normal">(optional)</span>
                </p>
                <input
                  type="text"
                  value={config.focus}
                  onChange={(e) => setConfig((c) => ({ ...c, focus: e.target.value }))}
                  placeholder="e.g. Krebs cycle"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            {/* Credits */}
            <div
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm",
                canGenerate
                  ? "border-border bg-background text-muted-brand"
                  : "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-300"
              )}
            >
              {canGenerate
                ? `Cost: ${creditCost} credit${creditCost === 1 ? "" : "s"} · ${credits} remaining`
                : `Not enough credits — need ${creditCost}, have ${credits}`}
            </div>

            {error && <p className="text-center text-xs text-red-500">{error}</p>}

            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!canGenerate}
              className="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-4 text-left text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none active:scale-[0.99]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold">Generate {config.count} questions</p>
                <p className="text-xs font-medium text-white/75">
                  {config.difficulty === "hard" ? "Exam-hard" : config.difficulty === "easy" ? "Easy warm-up" : "Mixed"} ·{" "}
                  {config.format === "mcq" ? "Objective" : config.format === "written" ? "Written" : "Mixed format"}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Mode: generating ─────────────────────────────────────────────────────────

  if (mode === "generating") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-card px-5 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-light text-primary">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <div className="max-w-sm space-y-2">
          <p className="text-base font-bold text-foreground">
            {streamingQuestions.length > 0
              ? `${streamingQuestions.length} of ${config.count} questions ready`
              : `Generating ${config.count} questions`}
          </p>
          <p className="text-sm leading-relaxed text-muted-brand">{generationStatus}</p>
        </div>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full bg-primary transition-all duration-500",
              streamingQuestions.length === 0 && "w-1/3 animate-pulse"
            )}
            style={
              streamingQuestions.length > 0
                ? { width: `${Math.min(100, Math.round((streamingQuestions.length / config.count) * 100))}%` }
                : undefined
            }
          />
        </div>
        {streamingQuestions.length > 0 && (
          <div className="w-full max-w-sm space-y-2 text-left">
            {streamingQuestions.slice(-3).map((q, i) => (
              <div key={i} className="rounded-xl border border-border bg-background px-3 py-2">
                <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-foreground">
                  {typeof q.question === "string" ? q.question : ""}
                </p>
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
      <div className="fixed inset-0 z-50 flex flex-col bg-card">
        {/* Top strip */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setMode("configure")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-brand hover:bg-secondary/50"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{title}</p>
            <p className="text-xs text-muted-brand">
              Q{currentIndex + 1} of {batchQuestions.length}
              {session && session.total_questions > 0 && (
                <> · Session: {session.total_correct}/{session.total_questions} ({pct(session.total_correct, session.total_questions)}%)</>
              )}
              {batchCount > 0 && <> · Batch {batchCount + 1}</>}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 shrink-0 bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((currentIndex + 1) / batchQuestions.length) * 100}%` }}
          />
        </div>

        {/* Question content */}
        <div className="flex-1 overflow-y-auto px-4 py-5 pb-36">
          <p className="mb-4 text-sm font-bold leading-relaxed text-foreground">
            {currentIndex + 1}. {currentQ.prompt}
          </p>

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
                        "flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm text-left transition focus-visible:outline-none",
                        !answered && "hover:bg-secondary/50 border-border/60 text-foreground",
                        answered && opt.is_correct && "border-primary bg-primary-light font-semibold text-primary-text",
                        answered && isChosen && !opt.is_correct && "border-red-400 bg-red-50 font-semibold text-red-700",
                        answered && !opt.is_correct && !isChosen && "border-border/40 text-muted-brand opacity-60"
                      )}
                    >
                      <span className="shrink-0 font-bold">{label}.</span>
                      <span>{opt.text}</span>
                    </button>
                  );
                })}
              </div>
              {chosenOptionId && currentQ.explanation && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary-light/60 px-4 py-3">
                  <p className="text-xs leading-relaxed text-primary-text/85">
                    <span className="font-semibold">Explanation: </span>
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
        </div>

        {/* Bottom actions */}
        <div className="absolute inset-x-0 bottom-0 flex gap-2 border-t border-border bg-card px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!currentAnswered && isMcq && (
            <button
              type="button"
              onClick={handleContinueQuestion}
              className="flex-1 rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-brand transition hover:bg-secondary/50 focus-visible:outline-none"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            disabled={!currentAnswered}
            onClick={handleContinueQuestion}
            className={cn(
              "rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-none",
              !currentAnswered && isMcq ? "flex-[2]" : "w-full"
            )}
          >
            {currentIndex + 1 >= batchQuestions.length ? "Finish batch →" : "Continue →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Mode: batch-complete ─────────────────────────────────────────────────────

  if (mode === "batch-complete" && completedBatch) {
    const batchPct = pct(completedBatch.correct, completedBatch.total);
    const updatedSessionTotal = (session?.total_questions ?? 0) + completedBatch.total;
    const updatedSessionCorrect = (session?.total_correct ?? 0) + completedBatch.correct;
    const updatedBatchCount = (session?.batches.length ?? 0) + 1;

    const moreCost = Math.ceil(moreConfig.count / 5);
    const canMore = credits >= moreCost;

    return (
      <div className="space-y-4 pb-28 md:pb-8">
        {/* Top strip */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleFinishSession()}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/50"
          >
            <ArrowLeft className="h-4 w-4" />
            {title}
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-muted-brand">
              Session: {updatedSessionCorrect}/{updatedSessionTotal} · {pct(updatedSessionCorrect, updatedSessionTotal)}% · {updatedBatchCount} batch{updatedBatchCount === 1 ? "" : "es"}
            </p>
          </div>
        </div>

        {/* Score ring */}
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-card py-6">
          <ScoreRing correct={completedBatch.correct} total={completedBatch.total} />
          <p className="text-sm font-semibold text-foreground">
            {batchPct >= 80 ? "Excellent!" : batchPct >= 60 ? "Good effort" : "Keep practising"}
          </p>
          <p className="text-xs text-muted-brand">
            {completedBatch.correct} of {completedBatch.total} correct in this batch
          </p>
        </div>

        {/* Weak areas */}
        {missedTopics.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-brand">Weak areas</p>
            <div className="flex flex-wrap gap-2">
              {missedTopics.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-red-300/60 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-700/40 dark:bg-red-950/20 dark:text-red-300"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Session running total */}
        <div className="rounded-2xl border border-primary/20 bg-primary-light/30 px-4 py-3">
          <p className="text-xs font-semibold text-primary-text">
            Session total: {updatedSessionCorrect} of {updatedSessionTotal} correct ({pct(updatedSessionCorrect, updatedSessionTotal)}%) across {updatedBatchCount} batch{updatedBatchCount === 1 ? "" : "es"}
          </p>
        </div>

        {error && <p className="text-center text-xs text-red-500">{error}</p>}

        {/* Generate more */}
        <div className="rounded-3xl border border-border bg-card p-4 space-y-4">
          <p className="text-sm font-bold text-foreground">Generate more questions</p>

          {/* Count */}
          <div className="flex gap-2">
            {([5, 10, 15, 20] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMoreConfig((c) => ({ ...c, count: n }))}
                className={cn(
                  "flex-1 rounded-xl border py-2 text-sm font-semibold transition",
                  moreConfig.count === n
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-background text-foreground hover:bg-secondary/50"
                )}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Intent */}
          <div className="rounded-xl border border-border bg-background px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <select
                value={moreConfig.intent}
                onChange={(e) => setMoreConfig((c) => ({ ...c, intent: e.target.value as GenerationIntent }))}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
              >
                <option value="auto">Let Jabu decide</option>
                <option value="weak_areas">Strengthen weak spots</option>
                <option value="untested_sections">Cover new ground</option>
                <option value="application">Practice applying concepts</option>
                <option value="hard">Exam-style hard</option>
                <option value="topic">Focus on a topic</option>
              </select>
            </div>
          </div>

          {/* Credits */}
          <div
            className={cn(
              "rounded-xl border px-3 py-2 text-xs",
              canMore
                ? "border-border bg-background text-muted-brand"
                : "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-300"
            )}
          >
            {canMore
              ? `Cost: ${moreCost} credit${moreCost === 1 ? "" : "s"} · ${credits} remaining`
              : `Not enough credits — need ${moreCost}, have ${credits}`}
          </div>

          <button
            type="button"
            disabled={!canMore}
            onClick={() => void handleSaveBatchAndGenerateMore(moreConfig)}
            className="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-4 text-left text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold">Generate {moreConfig.count} more questions</p>
              <p className="text-xs font-medium text-white/75">Continue this session</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleFinishSession()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary/50 focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
            Finish session
          </button>
        </div>
      </div>
    );
  }

  // Fallback (shouldn't render)
  return null;
}
