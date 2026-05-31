"use client";
import { cn, normalize, msToClock, safePushRecent } from "@/lib/utils";
import type { QuizSet, QuizQuestion, QuizOption, ReviewTab, WrittenAnswerGrade } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type LatestRestore = {
  answers?: Record<string, string>;
  writtenAnswers?: Record<string, string>;
  flagged?: Record<string, boolean>;
  currentQuestionId?: string;
  questionIndex?: number;
};

type SubmitPointSummary = {
  pointsAwarded: number;
  practicePointsAwarded: number;
  writtenPointsAwarded: number;
};

type PracticeAccessSummary = {
  limit: number | null;
  used: number;
  remaining: number | null;
  activityDate: string;
  plus?: { active: boolean; activeUntil: string | null; planKey: string | null };
};

type QuestionType = "mcq" | "short_answer" | "theory";

function questionTypeOf(q: Pick<QuizQuestion, "question_type"> | null | undefined): QuestionType {
  return q?.question_type === "short_answer" || q?.question_type === "theory" ? q.question_type : "mcq";
}

function isWrittenQuestion(q: Pick<QuizQuestion, "question_type"> | null | undefined) {
  return questionTypeOf(q) !== "mcq";
}

function normalizeMarkingPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}


function isMissingAiGradeColumn(error: unknown) {
  const message = typeof (error as { message?: unknown })?.message === "string"
    ? String((error as { message?: unknown }).message).toLowerCase()
    : "";
  return message.includes("ai_grade") || message.includes("ai_graded");
}

function cleanString(value: unknown, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function compactText(value: unknown, maxLength = 180) {
  const text = cleanString(value, maxLength + 80).replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd().replace(/[.,;:\s]+$/, "")}...`;
}

function cleanArray(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => compactText(item, 90))
    .filter(Boolean)
    .slice(0, maxItems);
}

function writtenGradeFromRow(row: any): WrittenAnswerGrade | null {
  if (row?.ai_grade_score == null || !row?.ai_graded_at) return null;
  const score = Number(row.ai_grade_score);
  if (!Number.isFinite(score)) return null;
  const verdict = row.ai_grade_verdict === "correct" ||
    row.ai_grade_verdict === "mostly_correct" ||
    row.ai_grade_verdict === "partially_correct" ||
    row.ai_grade_verdict === "incorrect" ||
    row.ai_grade_verdict === "unanswered"
      ? row.ai_grade_verdict
      : score >= 9
        ? "correct"
        : score >= 7
          ? "mostly_correct"
          : score >= 4
            ? "partially_correct"
            : "incorrect";

  return {
    score: Math.round(Math.max(0, Math.min(10, score)) * 10) / 10,
    maxScore: Number(row.ai_grade_max_score) || 10,
    verdict,
    feedback: compactText(row.ai_grade_feedback),
    matchedPoints: cleanArray(row.ai_grade_matched_points, 2),
    missingPoints: cleanArray(row.ai_grade_missing_points, 3),
    improvedAnswer: compactText(row.ai_grade_improved_answer, 220) || null,
    gradedAt: cleanString(row.ai_graded_at, 80),
    provider: cleanString(row.ai_grade_provider, 80) || null,
    model: cleanString(row.ai_grade_model, 120) || null,
  };
}

function readLocalDraft(key: string): LatestRestore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as any;
    return {
      answers: parsed?.answers && typeof parsed.answers === "object" ? parsed.answers : undefined,
      writtenAnswers:
        parsed?.writtenAnswers && typeof parsed.writtenAnswers === "object"
          ? parsed.writtenAnswers
          : undefined,
      flagged: parsed?.flagged && typeof parsed.flagged === "object" ? parsed.flagged : undefined,
      currentQuestionId:
        typeof parsed?.currentQuestionId === "string" ? parsed.currentQuestionId : undefined,
      questionIndex:
        typeof parsed?.questionIndex === "number" && Number.isFinite(parsed.questionIndex)
          ? parsed.questionIndex
          : typeof parsed?.idx === "number" && Number.isFinite(parsed.idx)
            ? parsed.idx
            : undefined,
    };
  } catch {
    return {};
  }
}

function resolveResumeIndex({
  questions,
  answers,
  writtenAnswers,
  local,
}: {
  questions: QuizQuestion[];
  answers: Record<string, string>;
  writtenAnswers: Record<string, string>;
  local?: LatestRestore;
}) {
  if (!questions.length) return 0;

  if (local?.currentQuestionId) {
    const byIdIndex = questions.findIndex((q) => q.id === local.currentQuestionId);
    if (byIdIndex >= 0) return byIdIndex;
  }

  if (
    typeof local?.questionIndex === "number" &&
    local.questionIndex >= 0 &&
    local.questionIndex < questions.length
  ) {
    return local.questionIndex;
  }

  const firstUnanswered = questions.findIndex((q) =>
    isWrittenQuestion(q) ? !writtenAnswers[q.id]?.trim() : !answers[q.id]
  );

  return firstUnanswered >= 0 ? firstUnanswered : questions.length - 1;
}

export function usePracticeEngine({
  setId,
  attemptFromUrl,
  freshFromUrl = false,
  studyMode = false,
  dueQuestionIds,
}: {
  setId: string;
  attemptFromUrl: string;
  /** One-time intent from ?fresh=1: create a new attempt instead of restoring an existing one. */
  freshFromUrl?: boolean;
  /** Study mode: skip timer, reveal answers immediately. No schema changes needed. */
  studyMode?: boolean;
  /**
   * Due Today mode — pre-filter questions to only these IDs.
   * Passed in by PracticeTakeClient when ?due=1 is in the URL.
   * Uses the same retryWeakIds mechanism so no extra engine state is needed.
   */
  dueQuestionIds?: string[] | null;
}) {
  // Track whether this is a pre-filtered Due Today session (vs normal or retry).
  const isDueMode = Boolean(dueQuestionIds && dueQuestionIds.length > 0);

  const [meta, setMeta] = useState<QuizSet | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [originalQuestionCount, setOriginalQuestionCount] = useState<number | null>(null);
  const [optionsByQ, setOptionsByQ] = useState<Record<string, QuizOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({});
  const [writtenGrades, setWrittenGrades] = useState<Record<string, WrittenAnswerGrade>>({});
  const [writtenSaving, setWrittenSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  const [attemptId, setAttemptId] = useState<string | null>(attemptFromUrl || null);

  // IMPORTANT UX: when we add ?attempt= to the URL (router.replace), we should NOT re-run the whole loader.
  // Capture the initial attempt (if any) only once for this page load.
  const initialAttemptRef = useRef<string | null>(attemptFromUrl || null);
  const initialFreshRef = useRef<boolean>(freshFromUrl);

  // Cache userId from the initial auth call so choose() and finalizeAttempt()
  // never need to call supabase.auth.getUser() again during a session.
  const userIdRef = useRef<string | null>(null);

  // Timer
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const deadlineRef = useRef<number | null>(null);
  const startedAtMsRef = useRef<number>(Date.now());

  // Finalize
  const [finalizing, setFinalizing] = useState(false);
  const finalizedRef = useRef(false);
  const [submitPoints, setSubmitPoints] = useState<SubmitPointSummary | null>(null);
  const [practiceAccess, setPracticeAccess] = useState<PracticeAccessSummary | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Review
  const [reviewTab, setReviewTab] = useState<ReviewTab>("all");

  // Soft-reset counter — incrementing triggers a full in-memory reload without
  // a router.refresh() page wipe. This is the dependency that replaces router.
  const [resetKey, setResetKey] = useState(0);

  // True when the load effect detected and restored an existing in-progress attempt.
  const [isResumed, setIsResumed] = useState(false);

  // Retry-weak mode — when set, the active question list is filtered to only
  // these IDs. The full questions/options data is still held in memory.
  const [retryWeakIds, setRetryWeakIds] = useState<Set<string> | null>(null);

  // SRS summary surfaced to the results screen after finalize.
  // Populated by finalizeAttempt — null until the attempt is submitted.
  const [weakSummary, setWeakSummary] = useState<Array<{
    questionId: string;
    prompt: string;
    missCount: number;
    nextDueAt: string;
    wasCorrect: boolean;
    reviewReason?: "missed";
  }> | null>(null);

  // Local draft autosave (backup if DB upsert fails)
  const draftKey = useMemo(
    () => `jabu:practiceDraft:${setId}:${attemptId ?? "noattempt"}`,
    [setId, attemptId]
  );

  async function loadAttemptAnswers(effectiveAttemptId: string) {
    let ansRes: any = await supabase
      .from("study_attempt_answers")
      .select("question_id,selected_option_id,text_answer,ai_grade_score,ai_grade_max_score,ai_grade_verdict,ai_grade_feedback,ai_grade_matched_points,ai_grade_missing_points,ai_grade_improved_answer,ai_grade_provider,ai_grade_model,ai_graded_at")
      .eq("attempt_id", effectiveAttemptId);

    if (ansRes.error && isMissingAiGradeColumn(ansRes.error)) {
      ansRes = await supabase
        .from("study_attempt_answers")
        .select("question_id,selected_option_id,text_answer")
        .eq("attempt_id", effectiveAttemptId);
    }

    const amap: Record<string, string> = {};
    const wmap: Record<string, string> = {};
    const gmap: Record<string, WrittenAnswerGrade> = {};
    (ansRes.data ?? []).forEach((r: any) => {
      if (r?.question_id && r?.selected_option_id)
        amap[String(r.question_id)] = String(r.selected_option_id);
      if (r?.question_id && typeof r?.text_answer === "string")
        wmap[String(r.question_id)] = String(r.text_answer);
      const grade = writtenGradeFromRow(r);
      if (r?.question_id && grade)
        gmap[String(r.question_id)] = grade;
    });

    return { answers: amap, writtenAnswers: wmap, writtenGrades: gmap };
  }

  // The active question list — either the full set or a weak-only subset
  // when the student has chosen "Retry Weak Questions".
  const activeQuestions = useMemo(
    () =>
      retryWeakIds
        ? questions.filter((q) => retryWeakIds.has(q.id))
        : questions,
    [questions, retryWeakIds]
  );

  const current = activeQuestions[idx];
  const currentQuestionId = current?.id ?? null;
  const opts = current ? optionsByQ[current.id] ?? [] : [];
  const idxRef = useRef(0);

  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  function clampQuestionIndex(value: number, questionList = activeQuestions) {
    const maxIndex = Math.max(0, questionList.length - 1);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(maxIndex, Math.trunc(value)));
  }

  function persistProgress(nextIndex = idxRef.current, questionList = activeQuestions) {
    if (typeof window === "undefined") return;
    if (!setId || !attemptId) return;

    const questionIndex = clampQuestionIndex(nextIndex, questionList);
    const nextQuestionId = questionList[questionIndex]?.id ?? currentQuestionId;

    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({
          answers,
          writtenAnswers,
          flagged,
          currentQuestionId: nextQuestionId,
          questionIndex,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // ignore
    }
  }

  function setPersistedIdx(value: number | ((currentIndex: number) => number)) {
    const nextValue = typeof value === "function" ? value(idxRef.current) : value;
    const nextIndex = clampQuestionIndex(nextValue);
    idxRef.current = nextIndex;
    persistProgress(nextIndex);
    setIdx(nextIndex);
  }

  const stats = useMemo(() => {
    const total = activeQuestions.length;
    const answered = activeQuestions.filter((q) =>
      isWrittenQuestion(q) ? Boolean(writtenAnswers[q.id]?.trim()) : Boolean(answers[q.id])
    ).length;
    const flaggedCount = activeQuestions.filter((q) => flagged[q.id]).length;
    const scoredTotal = activeQuestions.filter((q) => !isWrittenQuestion(q)).length;
    const writtenTotal = total - scoredTotal;
    const writtenAnswered = activeQuestions.filter((q) => isWrittenQuestion(q) && Boolean(writtenAnswers[q.id]?.trim())).length;

    let correct = 0;
    if (submitted) {
      for (const q of activeQuestions) {
        if (isWrittenQuestion(q)) continue;
        const chosen = answers[q.id];
        if (!chosen) continue;
        const o = (optionsByQ[q.id] ?? []).find((x) => x.id === chosen);
        if (o?.is_correct) correct += 1;
      }
    }
    return { total, answered, flaggedCount, correct, scoredTotal, writtenTotal, writtenAnswered };
  }, [activeQuestions, answers, writtenAnswers, flagged, submitted, optionsByQ]);

  // Load + restore/create attempt + timer base
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);
      setSubmitErr(null);
      setSubmitted(false);
      setFinalizing(false);
      setSubmitPoints(null);
      setPracticeAccess(null);
      setOriginalQuestionCount(null);
      finalizedRef.current = false;
      setIdx(0);
      setAnswers({});
      setFlagged({});
      setTimeLeftMs(null);
      deadlineRef.current = null;
      setReviewTab("all");
      setWrittenAnswers({});
      setWrittenGrades({});
      setWrittenSaving(false);
      setIsResumed(false);
      setRetryWeakIds(null);

      try {
        if (!setId) throw new Error("Missing set id");

        // ─── PHASE 1: fire everything we can in parallel ──────────────────
        // auth, quiz set, questions+options (nested join), and attempt
        // validation (if a URL attempt id exists) all start at the same time.
        // On a slow campus network this cuts initial load from ~4 sequential
        // round trips down to 1.

        const setReq = supabase
          .from("study_quiz_sets")
          .select("id,title,description,course_code,level,time_limit_minutes,source_material_id,published,created_by,visibility,draft_status,draft_expires_at,generation_config")
          .eq("id", setId)
          .maybeSingle();

        // Fetch questions AND their options in one query via PostgREST nested
        // select — eliminates the previous options waterfall step entirely.
        const qReq = supabase
          .from("study_quiz_questions")
          .select(
            "id,prompt,explanation,question_type,model_answer,marking_points,ai_explanation,study_ref,question_kind,difficulty_level,cognitive_level,source_topic,question_fingerprint,generation_meta,position," +
            "study_quiz_options(id,question_id,text,is_correct,position)"
          )
          .eq("set_id", setId)
          .order("position", { ascending: true });

        // Validate the attempt from the URL (if present) in the same wave.
        const attValidateReq = initialAttemptRef.current
          ? supabase
              .from("study_practice_attempts")
              .select("id,set_id,status,started_at")
              .eq("id", initialAttemptRef.current)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null });

        const [authRes, setRes, qRes, attValidateRes, billingRes] = await Promise.all([
          supabase.auth.getUser(),
          setReq,
          qReq,
          attValidateReq,
          fetch("/api/billing/me", { cache: "no-store" })
            .then((r) => r.ok ? r.json() : null)
            .catch(() => null),
        ]);

        const user = authRes.data?.user ?? null;
        userIdRef.current = user?.id ?? null;

        const billingData = billingRes?.ok ? billingRes : null;
        if (!cancelled && billingData?.practice) {
          setPracticeAccess(billingData.practice);
        }

        if (setRes.error) throw setRes.error;
        if (!setRes.data) throw new Error("Practice set not found");
        if (qRes.error) throw qRes.error;

        const setData = setRes.data as {
          published?: boolean | null;
          created_by?: string | null;
          visibility?: string | null;
        };
        const isAuthor = Boolean(setData.created_by && setData.created_by === user?.id);
        const isPublic = (setData.visibility ?? "public") === "public";

        // Block unpublished or private sets for non-privileged non-authors
        if (!setData.published || !isPublic) {
          const [repRow, adminRow] = await Promise.all([
            supabase.from("study_reps").select("id").eq("user_id", user?.id ?? "").maybeSingle(),
            supabase.from("study_admins").select("id").eq("user_id", user?.id ?? "").maybeSingle(),
          ]);
          const isPrivileged = Boolean(repRow.data?.id || adminRow.data?.id);
          if (!isPrivileged && !isAuthor) throw new Error("This practice set is not available yet.");
        }

        // Unpack the nested options from each question row
        const qData = (qRes.data ?? []) as any[];
        const grouped: Record<string, QuizOption[]> = {};
        for (const q of qData) {
          const qid = String(q.id);
          const rawOpts: any[] = Array.isArray(q.study_quiz_options)
            ? q.study_quiz_options
            : [];
          grouped[qid] = rawOpts
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((o) => ({
              id: String(o.id),
              question_id: qid,
              text: String(o.text ?? ""),
              is_correct: Boolean(o.is_correct),
              position: typeof o.position === "number" ? o.position : null,
            }));
        }

        // Strip nested options key so qData shape matches QuizQuestion type
        const cleanQData: QuizQuestion[] = qData.map(({ study_quiz_options: _opts, ...rest }) => ({
          id: String(rest.id),
          prompt: String(rest.prompt ?? ""),
          explanation: rest.explanation ?? null,
          question_type: questionTypeOf(rest as any),
          model_answer: (rest as any).model_answer ?? null,
          marking_points: normalizeMarkingPoints((rest as any).marking_points),
          ai_explanation: (rest as any).ai_explanation ?? null,
          study_ref: (rest as any).study_ref ?? null,
          question_kind: (rest as any).question_kind ?? null,
          difficulty_level: (rest as any).difficulty_level ?? null,
          cognitive_level: (rest as any).cognitive_level ?? null,
          source_topic: (rest as any).source_topic ?? null,
          question_fingerprint: (rest as any).question_fingerprint ?? null,
          generation_meta: (rest as any).generation_meta ?? null,
          position: typeof rest.position === "number" ? rest.position : null,
        }));

        // Cap questions to the user's remaining free quota.
        // Skip for due-mode sessions (SRS review of specific weak questions).
        // Skip when remaining = 0 — the gate handles that case instead of an empty quiz.
        let finalQuestions = cleanQData;
        const practiceRemaining = billingData?.practice?.remaining;
        const practiceLimit = billingData?.practice?.limit;
        if (
          !isDueMode &&
          practiceLimit !== null && practiceLimit !== undefined &&
          typeof practiceRemaining === "number" &&
          practiceRemaining > 0 &&
          cleanQData.length > practiceRemaining
        ) {
          finalQuestions = cleanQData.slice(0, practiceRemaining);
        }

        const resumeQuestions =
          dueQuestionIds && dueQuestionIds.length > 0
            ? finalQuestions.filter((q) => dueQuestionIds.includes(q.id))
            : finalQuestions;

        // ─── PHASE 2: attempt restore / create ───────────────────────────
        // Attempt creation needs userId (from Phase 1 auth).
        // Answers fetch needs the validated attemptId (from Phase 1 attValidate).
        // These are the only true sequential dependencies left.

        let effectiveAttemptId: string | null = null;
        let startedAtMs = Date.now();
        let resumeIdx = 0;

        if (user && initialAttemptRef.current) {
          // Use the already-validated attempt data from Phase 1
          const attData = !attValidateRes.error ? (attValidateRes as any).data : null;

          if (attData?.id && String(attData.set_id) === setId && attData.status === "in_progress") {
            effectiveAttemptId = String(attData.id);
            const st = new Date(String(attData.started_at)).getTime();
            startedAtMs = Number.isFinite(st) ? st : Date.now();
            startedAtMsRef.current = startedAtMs;

            // Answers are the only remaining sequential fetch — they need
            // the confirmed attemptId before we can request them.
            const restored = await loadAttemptAnswers(effectiveAttemptId);
            const amap = restored.answers;
            const wmap = restored.writtenAnswers;
            const gmap = restored.writtenGrades;

            // Merge local draft (localStorage wins for latest unsaved answers)
            const local = readLocalDraft(`jabu:practiceDraft:${setId}:${effectiveAttemptId}`);
            if (local.answers) Object.assign(amap, local.answers);
            if (local.writtenAnswers) Object.assign(wmap, local.writtenAnswers);
            resumeIdx = resolveResumeIndex({
              questions: resumeQuestions,
              answers: amap,
              writtenAnswers: wmap,
              local,
            });

            if (!cancelled) {
              setAnswers(amap);
              setWrittenAnswers(wmap);
              setWrittenGrades(gmap);
              if (local.flagged) setFlagged(local.flagged);
              if (Object.keys(amap).length > 0 || Object.keys(wmap).length > 0 || resumeIdx > 0) {
                setIsResumed(true);
              }
            }
          }
        }

        // Create new attempt if no valid in-progress attempt was restored.
        if (user && !effectiveAttemptId) {
          // Check for existing in_progress attempt first (deduplication guard)
          const { data: existingAttempt } = initialFreshRef.current
            ? { data: null }
            : await supabase
                .from("study_practice_attempts")
                .select("id, started_at")
                .eq("user_id", user.id)
                .eq("set_id", setId)
                .eq("status", "in_progress")
                .order("updated_at", { ascending: false })
                .maybeSingle();

          if (existingAttempt?.id) {
            effectiveAttemptId = String(existingAttempt.id);
            const st = new Date(String(existingAttempt.started_at)).getTime();
            startedAtMs = Number.isFinite(st) ? st : Date.now();
            startedAtMsRef.current = startedAtMs;

            // Restore saved answers from the existing attempt
            const restored = await loadAttemptAnswers(effectiveAttemptId);
            const local = readLocalDraft(`jabu:practiceDraft:${setId}:${effectiveAttemptId}`);
            if (local.answers) Object.assign(restored.answers, local.answers);
            if (local.writtenAnswers) Object.assign(restored.writtenAnswers, local.writtenAnswers);
            resumeIdx = resolveResumeIndex({
              questions: resumeQuestions,
              answers: restored.answers,
              writtenAnswers: restored.writtenAnswers,
              local,
            });

            if (!cancelled) {
              setAnswers(restored.answers);
              setWrittenAnswers(restored.writtenAnswers);
              setWrittenGrades(restored.writtenGrades);
              if (local.flagged) setFlagged(local.flagged);
              if (
                Object.keys(restored.answers).length > 0 ||
                Object.keys(restored.writtenAnswers).length > 0 ||
                resumeIdx > 0
              ) {
                setIsResumed(true);
              }
            }
          } else {
            // No existing attempt — create new one
            const startedIso = new Date().toISOString();
            const created = await supabase
              .from("study_practice_attempts")
              .insert({
                user_id: user.id,
                set_id: setId,
                status: "in_progress",
                started_at: startedIso,
              } as any)
              .select("id,started_at")
              .maybeSingle();

            if (!created.error && created.data?.id) {
              effectiveAttemptId = String(created.data.id);
              const st = new Date(String(created.data.started_at ?? startedIso)).getTime();
              startedAtMs = Number.isFinite(st) ? st : Date.now();
              startedAtMsRef.current = startedAtMs;
            }
          }
        }

        // Timer deadline based on startedAtMs — suppressed in study mode
        const mins =
          typeof (setRes.data as any)?.time_limit_minutes === "number"
            ? (setRes.data as any).time_limit_minutes
            : null;

        if (mins && mins > 0 && !studyMode && !isDueMode) {
          const deadline = startedAtMs + mins * 60_000;
          deadlineRef.current = deadline;
          setTimeLeftMs(deadline - Date.now());
        }

        if (cancelled) return;

        setMeta(setRes.data as any);
        setOriginalQuestionCount(cleanQData.length);
        setQuestions(finalQuestions);
        setOptionsByQ(grouped);
        setAttemptId(effectiveAttemptId);
        setIdx(Math.max(0, Math.min(Math.max(0, resumeQuestions.length - 1), resumeIdx)));

        // Apply Due Today pre-filter immediately after questions load.
        // Reuses the retryWeakIds mechanism so the rest of the engine is unchanged.
        if (dueQuestionIds && dueQuestionIds.length > 0) {
          const dueSet = new Set(dueQuestionIds);
          // Only keep IDs that actually exist in this set (guard against stale cache).
          const valid = new Set(cleanQData.map((q) => q.id).filter((id) => dueSet.has(id)));
          if (valid.size > 0) setRetryWeakIds(valid);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load practice set");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  // resetKey is the soft-reset trigger. Incrementing it re-runs this effect
  // without a full page navigation (unlike router.refresh()).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, resetKey]);

  // Sync URL with attempt id (without re-loading data)
  useEffect(() => {
    if (!attemptId) return;
    if (attemptFromUrl === attemptId && !freshFromUrl) return;

    // Avoid a Next.js route transition (and a second loader flash) by updating the URL
    // without triggering navigation.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("attempt", attemptId);
      params.delete("fresh");
      const next = `/study/practice/${encodeURIComponent(setId)}?${params.toString()}`;
      window.history.replaceState(null, "", next);
    }
  }, [attemptId, attemptFromUrl, freshFromUrl, setId]);

  // Timer tick + auto-submit
  useEffect(() => {
    if (!deadlineRef.current) return;
    if (submitted) return;

    const t = setInterval(() => {
      const dl = deadlineRef.current;
      if (!dl) return;
      const left = dl - Date.now();
      setTimeLeftMs(left);
      if (left <= 0) {
        setTimeLeftMs(0);
        setSubmitted(true);
      }
    }, 250);

    return () => clearInterval(t);
  }, [submitted]);

  // Autosave to localStorage (answers + written answers + flags + last viewed question)
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    if (!setId || !attemptId) return;
    if (activeQuestions.length > 0 && !currentQuestionId) return;
    persistProgress(idx, activeQuestions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, writtenAnswers, flagged, currentQuestionId, idx, activeQuestions.length, draftKey, setId, attemptId, loading]);

  // Debounced Supabase autosave for written answers. MCQs still persist immediately on tap.
  useEffect(() => {
    if (submitted) return;
    const userId = userIdRef.current;
    if (!userId || !attemptId) return;
    const writtenQuestions = activeQuestions.filter((q) => isWrittenQuestion(q));
    if (!writtenQuestions.length) return;

    setWrittenSaving(true);
    const timer = setTimeout(() => {
      const now = new Date().toISOString();
      const rows = writtenQuestions.map((q) => ({
        attempt_id: attemptId,
        question_id: q.id,
        text_answer: writtenAnswers[q.id] ?? "",
        answered_at: now,
      }));

      supabase
        .from("study_attempt_answers")
        .upsert(rows as any[], { onConflict: "attempt_id,question_id" })
        .then(async () => {
          await supabase
            .from("study_practice_attempts")
            .update({ updated_at: now } as any)
            .eq("id", attemptId)
            .eq("user_id", userId);
          setWrittenSaving(false);
        });
    }, 650);

    return () => {
      clearTimeout(timer);
    };
  }, [activeQuestions, attemptId, submitted, writtenAnswers]);

  function choose(qid: string, oid: string) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qid]: oid }));

    // Persist answer + award point if correct (best-effort — localStorage is the fallback)
    (async () => {
      try {
        if (!attemptId) return;
        await fetch(
          `/api/study/practice/${encodeURIComponent(attemptId)}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: qid, selectedOptionId: oid }),
          }
        );
      } catch {
        // ignore
      }
    })();
  }

  function writeAnswer(qid: string, text: string) {
    if (submitted) return;
    setWrittenAnswers((prev) => ({ ...prev, [qid]: text }));
  }

  function setWrittenGrade(qid: string, grade: WrittenAnswerGrade | null) {
    setWrittenGrades((prev) => {
      const next = { ...prev };
      if (grade) next[qid] = grade;
      else delete next[qid];
      return next;
    });
  }

  function toggleFlag(qid: string) {
    setFlagged((prev) => ({ ...prev, [qid]: !prev[qid] }));
  }

  function goToQuestion(i: number) {
    setPersistedIdx(i);
  }

  /**
   * Soft reset — clears all session state and reloads data in-memory.
   * No router navigation, no full-page wipe. Works well on slow campus networks.
   */
  function softReset() {
    const idToAbandon = attemptId;
    setRetryWeakIds(null);
    setIsResumed(false);
    initialAttemptRef.current = null;
    setAttemptId(null);
    setResetKey((k) => k + 1);

    if (idToAbandon) {
      fetch(`/api/study/practice/${encodeURIComponent(idToAbandon)}/abandon`, {
        method: "POST",
      }).catch(() => {});
    }
  }

  /**
   * Retry only the questions the student got wrong or left unanswered.
   * Reuses the already-loaded questions/options — no network request.
   * Creates a fresh in-memory session without affecting the original attempt.
   */
  async function retryWeakQuestions() {
    const weakIds = new Set<string>(
      questions
        .filter((q) => {
          if (isWrittenQuestion(q)) return false;
          const chosen = answers[q.id];
          if (!chosen) return true; // unanswered
          const o = (optionsByQ[q.id] ?? []).find((x) => x.id === chosen);
          if (!o?.is_correct) return true; // wrong
          return false;
        })
        .map((q) => q.id)
    );

    if (weakIds.size === 0) return; // nothing to retry

    // Create a fresh attempt row so finalizeAttempt can persist SRS data
    const userId = userIdRef.current;
    let retryAttemptId: string | null = null;
    if (userId) {
      const startedIso = new Date().toISOString();
      const { data: newAttempt } = await supabase
        .from("study_practice_attempts")
        .insert({ user_id: userId, set_id: setId, status: "in_progress", started_at: startedIso } as any)
        .select("id")
        .maybeSingle();
      if (newAttempt?.id) {
        retryAttemptId = String(newAttempt.id);
        startedAtMsRef.current = Date.now();
      }
    }

    setRetryWeakIds(weakIds);
    setAnswers({});
    setWrittenAnswers({});
    setWrittenGrades({});
    setFlagged({});
    setIdx(0);
    setSubmitted(false);
    setReviewTab("all");
    setSubmitPoints(null);
    setSubmitErr(null);
    finalizedRef.current = false;
    setAttemptId(retryAttemptId);
    initialAttemptRef.current = retryAttemptId;

    // Retry weak is a learning flow, so do not run the exam timer.
    deadlineRef.current = null;
    setTimeLeftMs(null);
  }

  async function finalizeAttempt(reason: "manual" | "timeup") {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    setSubmitErr(null);
    setFinalizing(true);

    try {
      const userId = userIdRef.current;
      if (!userId || !attemptId) {
        setFinalizing(false);
        return;
      }

      const submittedIso = new Date().toISOString();
      let timeSpent: number | null = null;

      if (deadlineRef.current && meta?.time_limit_minutes) {
        const limitSec = meta.time_limit_minutes * 60;
        const left = typeof timeLeftMs === "number" ? Math.max(0, Math.floor(timeLeftMs / 1000)) : 0;
        timeSpent = Math.max(0, limitSec - left);
      } else {
        // Untimed session — compute elapsed from attempt start
        timeSpent = Math.max(0, Math.round((Date.now() - startedAtMsRef.current) / 1000));
      }

      const res = await fetch(`/api/study/practice/${encodeURIComponent(attemptId)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          writtenAnswers,
          questionIds: activeQuestions.map((q) => q.id),
          reason,
          timeSpentSeconds: timeSpent,
        }),
      });
      const json = await res.json().catch(() => null) as
        | {
            ok?: boolean;
            message?: string;
            pointsAwarded?: number;
            practicePointsAwarded?: number;
            writtenPointsAwarded?: number;
            practice?: PracticeAccessSummary;
            weakSummary?: Array<{
              questionId: string;
              prompt: string;
              missCount: number;
              nextDueAt: string;
              wasCorrect: boolean;
              reviewReason?: "missed";
            }>;
          }
        | null;

      // 402 = daily limit hit (stale practiceAccess on client) — feed fresh
      // limit data back so the pre-quiz gate renders instead of an error page.
      if (res.status === 402 && json?.practice) {
        setPracticeAccess(json.practice);
        setSubmitted(false);
        finalizedRef.current = false;
        return;
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Could not submit this attempt.");
      }

      setWeakSummary(json.weakSummary ?? []);
      setSubmitPoints({
        pointsAwarded: Math.max(0, Number(json.pointsAwarded ?? 0)),
        practicePointsAwarded: Math.max(0, Number(json.practicePointsAwarded ?? 0)),
        writtenPointsAwarded: Math.max(0, Number(json.writtenPointsAwarded ?? 0)),
      });

      safePushRecent({
        id: `practice:${attemptId}`,
        title: meta?.title ?? "Practice",
        course_code: meta?.course_code ?? undefined,
        when: submittedIso,
        href: `/study/practice/${encodeURIComponent(setId)}?attempt=${encodeURIComponent(attemptId)}`,
      });

      // clear local draft (so it doesn't resurrect after submit)
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    } catch (error) {
      setSubmitErr(error instanceof Error ? error.message : "Could not submit this attempt.");
      setSubmitted(false);
      finalizedRef.current = false;
    } finally {
      setFinalizing(false);
    }
  }

  const reviewItems = useMemo(() => {
    if (!submitted) return [];

    const list = activeQuestions.map((q, i) => {
      const chosen = answers[q.id] ?? null;
      const writtenAnswer = writtenAnswers[q.id] ?? "";
      const isWritten = isWrittenQuestion(q);
      const opts = optionsByQ[q.id] ?? [];
      const correctOpt = opts.find((o) => o.is_correct) ?? null;
      const chosenOpt = chosen ? opts.find((o) => o.id === chosen) ?? null : null;

      const isWrong = !isWritten && !!chosen && !!chosenOpt && !chosenOpt.is_correct;
      const isUnanswered = isWritten ? !writtenAnswer.trim() : !chosen;
      const isFlagged = !!flagged[q.id];

      return {
        q,
        index: i,
        chosen,
        writtenAnswer,
        writtenGrade: writtenGrades[q.id] ?? null,
        chosenOpt,
        correctOpt,
        isWrong,
        isUnanswered,
        isFlagged,
      };
    });

    if (reviewTab === "wrong") return list.filter((x) => x.isWrong);
    if (reviewTab === "flagged") return list.filter((x) => x.isFlagged);
    if (reviewTab === "unanswered") return list.filter((x) => x.isUnanswered);
    return list;
  }, [submitted, activeQuestions, answers, writtenAnswers, writtenGrades, optionsByQ, flagged, reviewTab]);

  return {
    // data
    meta,
    questions: activeQuestions,
    optionsByQ,
    loading,
    err,

    // state
    idx,
    setIdx: setPersistedIdx,
    current,
    opts,
    answers,
    writtenAnswers,
    writtenGrades,
    writtenSaving,
    flagged,
    submitted,
    setSubmitted,
    attemptId,
    timeLeftMs,
    isRetryMode: retryWeakIds !== null && !isDueMode,
    isDueMode,
    studyMode,
    isResumed,

    // review
    reviewTab,
    setReviewTab,
    reviewItems,
    stats,
    finalizing,
    submitPoints,
    submitErr,
    practiceAccess,
    originalQuestionCount,
    weakSummary,

    // actions
    choose,
    writeAnswer,
    setWrittenGrade,
    toggleFlag,
    goToQuestion,
    persistProgress,
    softReset,
    retryWeakQuestions,
    finalizeAttempt,
  };
}
