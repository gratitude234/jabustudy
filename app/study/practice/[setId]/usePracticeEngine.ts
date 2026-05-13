"use client";
import { cn, normalize, msToClock, safePushRecent } from "@/lib/utils";
import type { QuizSet, QuizQuestion, QuizOption, ReviewTab } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type LatestRestore = {
  answers?: Record<string, string>;
  flagged?: Record<string, boolean>;
};

function readLocalDraft(key: string): LatestRestore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as any;
    return {
      answers: parsed?.answers && typeof parsed.answers === "object" ? parsed.answers : undefined,
      flagged: parsed?.flagged && typeof parsed.flagged === "object" ? parsed.flagged : undefined,
    };
  } catch {
    return {};
  }
}

export function usePracticeEngine({
  setId,
  attemptFromUrl,
  studyMode = false,
  dueQuestionIds,
}: {
  setId: string;
  attemptFromUrl: string;
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
  const [optionsByQ, setOptionsByQ] = useState<Record<string, QuizOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  const [attemptId, setAttemptId] = useState<string | null>(attemptFromUrl || null);

  // IMPORTANT UX: when we add ?attempt= to the URL (router.replace), we should NOT re-run the whole loader.
  // Capture the initial attempt (if any) only once for this page load.
  const initialAttemptRef = useRef<string | null>(attemptFromUrl || null);

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

  // Review
  const [reviewTab, setReviewTab] = useState<ReviewTab>("all");

  // Soft-reset counter — incrementing triggers a full in-memory reload without
  // a router.refresh() page wipe. This is the dependency that replaces router.
  const [resetKey, setResetKey] = useState(0);

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
  }> | null>(null);

  // Local draft autosave (backup if DB upsert fails)
  const draftKey = useMemo(
    () => `jabu:practiceDraft:${setId}:${attemptId ?? "noattempt"}`,
    [setId, attemptId]
  );

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
  const opts = current ? optionsByQ[current.id] ?? [] : [];

  const stats = useMemo(() => {
    const total = activeQuestions.length;
    const answered = activeQuestions.filter((q) => answers[q.id]).length;
    const flaggedCount = activeQuestions.filter((q) => flagged[q.id]).length;

    let correct = 0;
    if (submitted) {
      for (const q of activeQuestions) {
        const chosen = answers[q.id];
        if (!chosen) continue;
        const o = (optionsByQ[q.id] ?? []).find((x) => x.id === chosen);
        if (o?.is_correct) correct += 1;
      }
    }
    return { total, answered, flaggedCount, correct };
  }, [activeQuestions, answers, flagged, submitted, optionsByQ]);

  // Load + restore/create attempt + timer base
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);
      setSubmitted(false);
      setFinalizing(false);
      finalizedRef.current = false;
      setIdx(0);
      setAnswers({});
      setFlagged({});
      setTimeLeftMs(null);
      deadlineRef.current = null;
      setReviewTab("all");

      try {
        if (!setId) throw new Error("Missing set id");

        // ─── PHASE 1: fire everything we can in parallel ──────────────────
        // auth, quiz set, questions+options (nested join), and attempt
        // validation (if a URL attempt id exists) all start at the same time.
        // On a slow campus network this cuts initial load from ~4 sequential
        // round trips down to 1.

        const setReq = supabase
          .from("study_quiz_sets")
          .select("id,title,description,course_code,level,time_limit_minutes,source_material_id,published,created_by,visibility")
          .eq("id", setId)
          .maybeSingle();

        // Fetch questions AND their options in one query via PostgREST nested
        // select — eliminates the previous options waterfall step entirely.
        const qReq = supabase
          .from("study_quiz_questions")
          .select(
            "id,prompt,explanation,ai_explanation,study_ref,question_kind,difficulty_level,cognitive_level,source_topic,question_fingerprint,generation_meta,position," +
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

        const [authRes, setRes, qRes, attValidateRes] = await Promise.all([
          supabase.auth.getUser(),
          setReq,
          qReq,
          attValidateReq,
        ]);

        const user = authRes.data?.user ?? null;
        userIdRef.current = user?.id ?? null;

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

        // ─── PHASE 2: attempt restore / create ───────────────────────────
        // Attempt creation needs userId (from Phase 1 auth).
        // Answers fetch needs the validated attemptId (from Phase 1 attValidate).
        // These are the only true sequential dependencies left.

        let effectiveAttemptId: string | null = initialAttemptRef.current || null;
        let startedAtMs = Date.now();

        if (user && initialAttemptRef.current) {
          // Use the already-validated attempt data from Phase 1
          const attData = !attValidateRes.error ? (attValidateRes as any).data : null;

          if (attData?.id && String(attData.set_id) === setId) {
            effectiveAttemptId = String(attData.id);
            const st = new Date(String(attData.started_at)).getTime();
            startedAtMs = Number.isFinite(st) ? st : Date.now();
            startedAtMsRef.current = startedAtMs;

            // Answers are the only remaining sequential fetch — they need
            // the confirmed attemptId before we can request them.
            const ansRes = await supabase
              .from("study_attempt_answers")
              .select("question_id,selected_option_id")
              .eq("attempt_id", effectiveAttemptId);

            const amap: Record<string, string> = {};
            (ansRes.data ?? []).forEach((r: any) => {
              if (r?.question_id && r?.selected_option_id)
                amap[String(r.question_id)] = String(r.selected_option_id);
            });

            // Merge local draft (localStorage wins for latest unsaved answers)
            const local = readLocalDraft(`jabu:practiceDraft:${setId}:${effectiveAttemptId}`);
            if (local.answers) Object.assign(amap, local.answers);

            if (!cancelled) {
              setAnswers(amap);
              if (local.flagged) setFlagged(local.flagged);
            }
          }
        }

        // Create new attempt if none was provided via URL
        if (user && !initialAttemptRef.current) {
          // Check for existing in_progress attempt first (deduplication guard)
          const { data: existingAttempt } = await supabase
            .from("study_practice_attempts")
            .select("id, started_at")
            .eq("user_id", user.id)
            .eq("set_id", setId)
            .eq("status", "in_progress")
            .order("created_at", { ascending: false })
            .maybeSingle();

          if (existingAttempt?.id) {
            effectiveAttemptId = String(existingAttempt.id);
            const st = new Date(String(existingAttempt.started_at)).getTime();
            startedAtMs = Number.isFinite(st) ? st : Date.now();
            startedAtMsRef.current = startedAtMs;

            // Restore saved answers from the existing attempt
            const ansRes = await supabase
              .from("study_attempt_answers")
              .select("question_id,selected_option_id")
              .eq("attempt_id", effectiveAttemptId);
            const amap: Record<string, string> = {};
            (ansRes.data ?? []).forEach((r: any) => {
              if (r?.question_id && r?.selected_option_id)
                amap[String(r.question_id)] = String(r.selected_option_id);
            });
            if (!cancelled) setAnswers(amap);
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

        if (mins && mins > 0 && !studyMode) {
          const deadline = startedAtMs + mins * 60_000;
          deadlineRef.current = deadline;
          setTimeLeftMs(deadline - Date.now());
        }

        if (cancelled) return;
        setMeta(setRes.data as any);
        setQuestions(cleanQData);
        setOptionsByQ(grouped);
        setAttemptId(effectiveAttemptId);

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
    if (attemptFromUrl) return;

    // Avoid a Next.js route transition (and a second loader flash) by updating the URL
    // without triggering navigation.
    if (typeof window !== "undefined") {
      const next = `/study/practice/${encodeURIComponent(setId)}?attempt=${encodeURIComponent(attemptId)}`;
      window.history.replaceState(null, "", next);
    }
  }, [attemptId, attemptFromUrl, setId]);

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

  // Autosave to localStorage (answers + flags)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!setId || !attemptId) return;
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ answers, flagged, updatedAt: Date.now() })
      );
    } catch {
      // ignore
    }
  }, [answers, flagged, draftKey, setId, attemptId]);

  function choose(qid: string, oid: string) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qid]: oid }));

    // Persist answer (best-effort)
    (async () => {
      try {
        const userId = userIdRef.current;
        if (!userId || !attemptId) return;
        await supabase.from("study_attempt_answers").upsert(
          {
            attempt_id: attemptId,
            user_id: userId,
            question_id: qid,
            selected_option_id: oid,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "attempt_id,question_id" }
        );
      } catch {
        // ignore
      }
    })();
  }

  function toggleFlag(qid: string) {
    setFlagged((prev) => ({ ...prev, [qid]: !prev[qid] }));
  }

  function goToQuestion(i: number) {
    setIdx(Math.max(0, Math.min(questions.length - 1, i)));
  }

  /**
   * Soft reset — clears all session state and reloads data in-memory.
   * No router navigation, no full-page wipe. Works well on slow campus networks.
   */
  function softReset() {
    // Clear retry-weak filter so the full set is shown again
    setRetryWeakIds(null);
    // Clear per-question UI state (revealed answers, etc.) by resetting
    // session-level state. The load useEffect will re-run on resetKey change
    // and reset answers/flags/timer itself.
    initialAttemptRef.current = null;
    setAttemptId(null);
    setResetKey((k) => k + 1);
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
          const chosen = answers[q.id];
          if (!chosen) return true; // unanswered
          const o = (optionsByQ[q.id] ?? []).find((x) => x.id === chosen);
          return !o?.is_correct; // wrong
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
    setFlagged({});
    setIdx(0);
    setSubmitted(false);
    setReviewTab("all");
    finalizedRef.current = false;
    setAttemptId(retryAttemptId);
    initialAttemptRef.current = retryAttemptId;

    // Timer: restart from full duration for the weak-only subset
    if (meta?.time_limit_minutes) {
      const deadline = Date.now() + meta.time_limit_minutes * 60_000;
      deadlineRef.current = deadline;
      setTimeLeftMs(meta.time_limit_minutes * 60_000);
    } else {
      deadlineRef.current = null;
      setTimeLeftMs(null);
    }
  }

  async function finalizeAttempt(reason: "manual" | "timeup") {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    setFinalizing(true);

    try {
      const userId = userIdRef.current;
      if (!userId || !attemptId) {
        setFinalizing(false);
        return;
      }

      const total = activeQuestions.length;
      let correct = 0;
      for (const q of activeQuestions) {
        const chosen = answers[q.id];
        if (!chosen) continue;
        const o = (optionsByQ[q.id] ?? []).find((x) => x.id === chosen);
        if (o?.is_correct) correct += 1;
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

      // Avoid breaking if optional columns don't exist.
      const attemptUpdate: any = {
        status: "submitted",
        submitted_at: submittedIso,
        score: correct,
        total_questions: total,
        time_spent_seconds: timeSpent,
      };

      await supabase
        .from("study_practice_attempts")
        .update(attemptUpdate)
        .eq("id", attemptId)
        .eq("user_id", userId);

      // Update set-level due_at for spaced repetition
      const pct = total > 0 ? (correct / total) * 100 : 0;
      const daysAhead = pct >= 80 ? 3 : pct >= 60 ? 2 : 1;
      const dueAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
      supabase
        .from("study_quiz_sets")
        .update({ due_at: dueAt } as any)
        .eq("id", setId)
        .then(() => {}); // fire-and-forget

      // Update daily activity/streak (ignore if missing)
      // WAT = UTC+1. Use Nigerian local date, not UTC.
      const watOffsetMs = 60 * 60 * 1000;
      const watDate = new Date(new Date(submittedIso).getTime() + watOffsetMs);
      const activityDate = watDate.toISOString().slice(0, 10);

      // Fetch existing row to accumulate points and increment attempts
      const { data: existingActivity } = await supabase
        .from("study_daily_activity")
        .select("points, attempts")
        .eq("user_id", userId)
        .eq("activity_date", activityDate)
        .maybeSingle();

      const prevPoints = (existingActivity as any)?.points ?? 0;
      const prevAttempts = (existingActivity as any)?.attempts ?? 0;

      await supabase
        .from("study_daily_activity")
        .upsert(
          {
            user_id: userId,
            activity_date: activityDate,
            did_practice: true,
            points: prevPoints + Math.max(1, correct),
            attempts: prevAttempts + 1,
            updated_at: submittedIso,
          } as any,
          { onConflict: "user_id,activity_date" }
        );

      // ── SRS: persist weak/correct signals ──────────────────────────────
      // Fetch existing rows for the questions in this attempt so we can
      // compute the new interval without a round-trip per question.
      const questionIds = activeQuestions.map((q) => q.id);
      const { data: existingRows } = await supabase
        .from("study_weak_questions")
        .select("question_id, miss_count, correct_streak, last_missed_at")
        .eq("user_id", userId)
        .in("question_id", questionIds);

      const existingMap: Record<string, { miss_count: number; correct_streak: number; last_missed_at: string | null }> = {};
      for (const row of (existingRows ?? []) as any[]) {
        existingMap[row.question_id] = {
          miss_count: row.miss_count ?? 0,
          correct_streak: row.correct_streak ?? 0,
          last_missed_at: row.last_missed_at ?? null,
        };
      }

      function computeNextDue(missCount: number, fromIso: string): string {
        // SM-2 lite: interval doubles from miss 3 onwards, capped at 30 days.
        // miss 1 & 2 → 1 day, miss 3 → 2 days, miss 4 → 4 days, miss N → 2^(N-2) days.
        const daysMap: Record<number, number> = { 1: 1, 2: 1 };
        const days = daysMap[missCount] ?? Math.min(Math.pow(2, missCount - 2), 30);
        const base = new Date(fromIso).getTime();
        return new Date(base + days * 86_400_000).toISOString();
      }

      const srsUpserts: any[] = [];
      const summaryRows: typeof weakSummary = [];

      for (const q of activeQuestions) {
        const chosen = answers[q.id];
        const opts = optionsByQ[q.id] ?? [];
        const isCorrect = chosen ? (opts.find((o) => o.id === chosen)?.is_correct ?? false) : false;
        const wasUnanswered = !chosen;
        const existing = existingMap[q.id];

        if (isCorrect && !existing) {
          // Never seen as wrong — no row needed.
          summaryRows.push({ questionId: q.id, prompt: q.prompt, missCount: 0, nextDueAt: "", wasCorrect: true });
          continue;
        }

        if (isCorrect && existing) {
          const newStreak = existing.correct_streak + 1;
          const graduated = newStreak >= 3;
          srsUpserts.push({
            user_id: userId,
            question_id: q.id,
            miss_count: existing.miss_count,
            last_missed_at: existingMap[q.id]?.last_missed_at ?? null,
            next_due_at: computeNextDue(existing.miss_count, submittedIso),
            correct_streak: newStreak,
            graduated_at: graduated ? submittedIso : null,
            updated_at: submittedIso,
          });
          summaryRows.push({ questionId: q.id, prompt: q.prompt, missCount: existing.miss_count, nextDueAt: "", wasCorrect: true });
          continue;
        }

        // Wrong or unanswered
        const prevMiss = existing?.miss_count ?? 0;
        const newMiss = prevMiss + 1;
        const nextDue = computeNextDue(newMiss, submittedIso);
        srsUpserts.push({
          user_id: userId,
          question_id: q.id,
          miss_count: newMiss,
          last_missed_at: submittedIso,
          next_due_at: nextDue,
          correct_streak: 0, // reset streak on any miss
          graduated_at: null,
          updated_at: submittedIso,
        });
        summaryRows.push({ questionId: q.id, prompt: q.prompt, missCount: newMiss, nextDueAt: nextDue, wasCorrect: false });
      }

      if (srsUpserts.length > 0) {
        await supabase
          .from("study_weak_questions")
          .upsert(srsUpserts, { onConflict: "user_id,question_id" });
      }

      // Surface only wrong/unanswered in the summary (skip already-correct rows with no history).
      setWeakSummary(summaryRows.filter((r) => !r.wasCorrect || r.missCount > 0));
      // ── end SRS ────────────────────────────────────────────────────────

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
    } catch {
      // ignore
    } finally {
      setFinalizing(false);
    }
  }

  const reviewItems = useMemo(() => {
    if (!submitted) return [];

    const list = activeQuestions.map((q, i) => {
      const chosen = answers[q.id] ?? null;
      const opts = optionsByQ[q.id] ?? [];
      const correctOpt = opts.find((o) => o.is_correct) ?? null;
      const chosenOpt = chosen ? opts.find((o) => o.id === chosen) ?? null : null;

      const isWrong = !!chosen && !!chosenOpt && !chosenOpt.is_correct;
      const isUnanswered = !chosen;
      const isFlagged = !!flagged[q.id];

      return {
        q,
        index: i,
        chosen,
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
  }, [submitted, activeQuestions, answers, optionsByQ, flagged, reviewTab]);

  return {
    // data
    meta,
    questions: activeQuestions,
    optionsByQ,
    loading,
    err,

    // state
    idx,
    setIdx,
    current,
    opts,
    answers,
    flagged,
    submitted,
    setSubmitted,
    attemptId,
    timeLeftMs,
    isRetryMode: retryWeakIds !== null && !isDueMode,
    isDueMode,
    studyMode,

    // review
    reviewTab,
    setReviewTab,
    reviewItems,
    stats,
    finalizing,
    weakSummary,

    // actions
    choose,
    toggleFlag,
    goToQuestion,
    softReset,
    retryWeakQuestions,
    finalizeAttempt,
  };
}
