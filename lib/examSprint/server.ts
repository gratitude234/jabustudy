import "server-only";

import { randomInt } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  EXAM_CAMPAIGN_KEY,
  EXAM_COURSES,
  findExamCourse,
  normalizeExamCourseCode,
  type ExamCourse,
} from "@/lib/examSprint/config";
import {
  buildExamQuestionHistory,
  calculateExamQuestionCoverage,
  selectExamQuestions,
  type ExamQuestionCoverage,
  type ExamQuestionExposure,
  type ExamQuestionHistory,
} from "@/lib/examSprint/coverage";

export type ExamAttemptKind = "diagnostic" | "mock";
export type ExamAttemptExperience = "exam_diagnostic" | "exam_mock";

export type ExamSnapshotOption = {
  id: string;
  text: string;
};

export type ExamSnapshotQuestion = {
  id: string;
  prompt: string;
  options: ExamSnapshotOption[];
  correctOptionId: string;
  explanation: string;
  sourceTopic: string | null;
};

export type ExamDeliverySnapshot = {
  version: 1;
  campaignKey: string;
  setId: string;
  setTitle: string;
  courseCode: string;
  questions: ExamSnapshotQuestion[];
};

export type ExamAttemptRow = {
  id: string;
  user_id: string;
  set_id: string;
  status: string;
  experience: ExamAttemptExperience;
  campaign_key: string;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  submission_reason: "manual" | "timeup" | null;
  delivery_snapshot: unknown;
  score: number | null;
  total_questions: number | null;
  time_spent_seconds: number | null;
};

export type PublicExamSet = {
  id: string;
  title: string;
  description: string | null;
  courseCode: string;
  timeLimitMinutes: number;
  questionCount: number;
  attemptQuestionCount: number;
  diagnosticQuestionCount: number;
  diagnosticTimeLimitMinutes: number;
};

export type PublicExamSetWithCoverage = PublicExamSet & {
  coverage: ExamQuestionCoverage;
};

export type ExamActiveAttempt = {
  attemptId: string;
  setId: string;
  setTitle: string;
  courseCode: string;
  deadlineAt: string;
  startedAt: string;
  totalQuestions: number;
};

export type ExamRecentAttempt = {
  attemptId: string;
  kind: ExamAttemptKind;
  score: number;
  total: number;
  percentage: number;
  submittedAt: string | null;
};

export function examHttpError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}

function cleanString(value: unknown, max = 5_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function shuffle<T>(items: readonly T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function attemptExperience(kind: ExamAttemptKind): ExamAttemptExperience {
  return kind === "diagnostic" ? "exam_diagnostic" : "exam_mock";
}

export function attemptKind(experience: unknown): ExamAttemptKind {
  return experience === "exam_diagnostic" ? "diagnostic" : "mock";
}

export function parseExamSnapshot(value: unknown): ExamDeliverySnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw examHttpError("This exam attempt has invalid delivery data.", 500, "INVALID_EXAM_SNAPSHOT");
  }

  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || !Array.isArray(raw.questions)) {
    throw examHttpError("This exam attempt has an unsupported delivery version.", 500, "INVALID_EXAM_SNAPSHOT");
  }

  const questions = raw.questions.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw examHttpError("This exam attempt contains an invalid question.", 500, "INVALID_EXAM_SNAPSHOT");
    }
    const question = item as Record<string, unknown>;
    const id = cleanString(question.id, 80);
    const prompt = cleanString(question.prompt);
    const correctOptionId = cleanString(question.correctOptionId, 80);
    const options = Array.isArray(question.options)
      ? question.options.map((option) => {
          const row = option && typeof option === "object" && !Array.isArray(option)
            ? option as Record<string, unknown>
            : {};
          return { id: cleanString(row.id, 80), text: cleanString(row.text) };
        })
      : [];
    if (!id || !prompt || !correctOptionId || options.length < 2 || options.some((option) => !option.id || !option.text)) {
      throw examHttpError("This exam attempt contains incomplete question data.", 500, "INVALID_EXAM_SNAPSHOT");
    }
    return {
      id,
      prompt,
      correctOptionId,
      options,
      explanation: cleanString(question.explanation),
      sourceTopic: cleanString(question.sourceTopic, 200) || null,
    };
  });

  return {
    version: 1,
    campaignKey: cleanString(raw.campaignKey, 100),
    setId: cleanString(raw.setId, 80),
    setTitle: cleanString(raw.setTitle, 300),
    courseCode: cleanString(raw.courseCode, 30),
    questions,
  };
}

function tryParseExamSnapshot(value: unknown) {
  try {
    return parseExamSnapshot(value);
  } catch {
    return null;
  }
}

type ExamHistoryAttempt = {
  id: string;
  submitted_at: string | null;
  delivery_snapshot: unknown;
};

type ExamHistoryAnswer = {
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  flagged: boolean;
};

function historyFromAttempts(
  attempts: readonly ExamHistoryAttempt[],
  answers: readonly ExamHistoryAnswer[] = [],
): ExamQuestionHistory {
  const answersByAttempt = new Map<string, Map<string, ExamHistoryAnswer>>();
  for (const answer of answers) {
    const attemptAnswers = answersByAttempt.get(answer.attempt_id) ?? new Map<string, ExamHistoryAnswer>();
    attemptAnswers.set(String(answer.question_id), answer);
    answersByAttempt.set(answer.attempt_id, attemptAnswers);
  }

  const exposures: ExamQuestionExposure[] = [];
  for (const attempt of attempts) {
    const snapshot = tryParseExamSnapshot(attempt.delivery_snapshot);
    if (!snapshot) continue;
    const attemptAnswers = answersByAttempt.get(attempt.id);
    for (const question of snapshot.questions) {
      const answer = attemptAnswers?.get(question.id);
      const selectedOptionId = answer?.selected_option_id ?? null;
      exposures.push({
        questionId: question.id,
        deliveredAt: attempt.submitted_at ?? 0,
        outcome: !selectedOptionId
          ? "unanswered"
          : selectedOptionId === question.correctOptionId
            ? "correct"
            : "incorrect",
        flagged: Boolean(answer?.flagged),
      });
    }
  }
  return buildExamQuestionHistory(exposures);
}

async function getSubmittedMockHistory(userId: string, setId: string, excludeAttemptId?: string) {
  let query = adminSupabase
    .from("study_practice_attempts")
    .select("id,submitted_at,delivery_snapshot")
    .eq("user_id", userId)
    .eq("set_id", setId)
    .eq("experience", "exam_mock")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });
  if (excludeAttemptId) query = query.neq("id", excludeAttemptId);
  const { data: attemptRows, error: attemptError } = await query;
  if (attemptError) throw examHttpError(attemptError.message, 500, "ATTEMPT_HISTORY_FAILED");
  const attempts = (attemptRows ?? []) as ExamHistoryAttempt[];
  if (attempts.length === 0) return new Map() as ExamQuestionHistory;

  const { data: answerRows, error: answerError } = await adminSupabase
    .from("study_attempt_answers")
    .select("attempt_id,question_id,selected_option_id,flagged")
    .in("attempt_id", attempts.map((attempt) => attempt.id));
  if (answerError) throw examHttpError(answerError.message, 500, "ANSWER_HISTORY_FAILED");
  return historyFromAttempts(attempts, (answerRows ?? []) as ExamHistoryAnswer[]);
}

async function getEligibleQuestionIdsBySet(setIds: readonly string[]) {
  const bySet = new Map<string, string[]>();
  for (const setId of setIds) bySet.set(setId, []);
  if (setIds.length === 0) return bySet;

  // Supabase/PostgREST caps a response at 1,000 rows by default. Exam coverage
  // is catalogue-wide, so silently accepting that cap makes later banks appear
  // empty as soon as the campaign crosses 1,000 verified questions.
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await adminSupabase
      .from("study_quiz_questions")
      .select("id,set_id")
      .in("set_id", [...setIds])
      .eq("question_type", "mcq")
      .not("exam_verified_at", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw examHttpError(error.message, 500, "EXAM_QUESTION_LOAD_FAILED");
    for (const row of data ?? []) {
      const setId = String(row.set_id ?? "");
      if (!bySet.has(setId)) continue;
      bySet.get(setId)!.push(String(row.id));
    }
    if ((data ?? []).length < pageSize) break;
  }
  return bySet;
}

export async function getMonthlyExamAccess(userId: string | null | undefined) {
  if (!userId) return { active: false, activeUntil: null as string | null };

  const now = Date.now();
  const [{ data: entitlement }, { data: orders }] = await Promise.all([
    adminSupabase
      .from("study_plus_entitlements")
      .select("plan_key,active_until")
      .eq("user_id", userId)
      .maybeSingle(),
    adminSupabase
      .from("study_billing_orders")
      .select("plan_key,status,plus_days,paid_at,reviewed_at,created_at")
      .eq("user_id", userId)
      .eq("plan_key", "plus_monthly")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const entitlementUntil = entitlement?.active_until ? new Date(entitlement.active_until).getTime() : 0;
  const entitlementQualifies = entitlement?.plan_key === "plus_monthly" && entitlementUntil > now;
  let orderUntil = 0;
  for (const order of orders ?? []) {
    const activatedAt = order.paid_at || order.reviewed_at || order.created_at;
    const activatedMs = new Date(activatedAt).getTime();
    const days = Math.max(1, Number(order.plus_days ?? 30));
    if (Number.isFinite(activatedMs)) orderUntil = Math.max(orderUntil, activatedMs + days * 86_400_000);
  }

  const activeUntilMs = Math.max(entitlementQualifies ? entitlementUntil : 0, orderUntil);
  return {
    active: activeUntilMs > now,
    activeUntil: activeUntilMs > 0 ? new Date(activeUntilMs).toISOString() : null,
  };
}

function publicExamSet(row: Record<string, unknown>): PublicExamSet {
  return {
    id: String(row.id),
    title: cleanString(row.title, 300) || "Exam Sprint Mock",
    description: cleanString(row.description) || null,
    courseCode: cleanString(row.course_code, 30).toUpperCase(),
    timeLimitMinutes: Math.max(1, Number(row.time_limit_minutes ?? 40)),
    questionCount: Math.max(0, Number(row.questions_count ?? 0)),
    attemptQuestionCount: Math.max(1, Number(row.exam_question_count ?? 40)),
    diagnosticQuestionCount: Math.max(1, Number(row.diagnostic_question_count ?? 10)),
    diagnosticTimeLimitMinutes: Math.max(1, Number(row.diagnostic_time_limit_minutes ?? 10)),
  };
}

export async function getPublishedExamSets(course?: ExamCourse | null) {
  const query = adminSupabase
    .from("study_quiz_sets")
    .select("id,title,description,course_code,time_limit_minutes,questions_count,exam_question_count,diagnostic_question_count,diagnostic_time_limit_minutes,created_at")
    .eq("delivery_mode", "mock_exam")
    .eq("exam_campaign_key", EXAM_CAMPAIGN_KEY)
    .eq("published", true)
    .order("created_at", { ascending: true });

  const { data, error } = await query;
  if (error) throw examHttpError(error.message, 500, "EXAM_CATALOG_FAILED");
  const sets = ((data ?? []) as Array<Record<string, unknown>>).map(publicExamSet);
  if (!course) return sets;
  const wanted = normalizeExamCourseCode(course.code);
  return sets.filter((set) => normalizeExamCourseCode(set.courseCode) === wanted);
}

export async function getExamCatalog(userId?: string | null) {
  const [sets, access, attemptsResult] = await Promise.all([
    getPublishedExamSets(),
    getMonthlyExamAccess(userId),
    userId
      ? adminSupabase
          .from("study_practice_attempts")
          .select("id,set_id,experience,status,score,total_questions,started_at,submitted_at,deadline_at,delivery_snapshot")
          .eq("user_id", userId)
          .eq("campaign_key", EXAM_CAMPAIGN_KEY)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (attemptsResult.error) throw examHttpError(attemptsResult.error.message, 500, "ATTEMPT_HISTORY_FAILED");
  const attempts = (attemptsResult.data ?? []) as Array<Record<string, unknown>>;
  const setById = new Map(sets.map((set) => [set.id, set]));
  const eligibleQuestionIdsBySet = await getEligibleQuestionIdsBySet(sets.map((set) => set.id));
  const coverageBySet = new Map<string, ExamQuestionCoverage>();
  for (const set of sets) {
    const submittedMockAttempts = attempts
      .filter((attempt) => attempt.status === "submitted"
        && attempt.experience === "exam_mock"
        && String(attempt.set_id) === set.id)
      .map((attempt) => ({
        id: String(attempt.id),
        submitted_at: typeof attempt.submitted_at === "string" ? attempt.submitted_at : null,
        delivery_snapshot: attempt.delivery_snapshot,
      }));
    coverageBySet.set(
      set.id,
      calculateExamQuestionCoverage(
        eligibleQuestionIdsBySet.get(set.id) ?? [],
        historyFromAttempts(submittedMockAttempts),
      ),
    );
  }
  // The free diagnostic is one-per-campaign, so a single attempt row decides the
  // state of every course page. Callers need more than a boolean: an attempt that
  // is still running has to stay resumable, and a finished one should link to its
  // result instead of dead-ending on "already used".
  const diagnosticRow = attempts.find((attempt) => attempt.experience === "exam_diagnostic") ?? null;
  const diagnostic = diagnosticRow
    ? (() => {
        const deadlineMs = new Date(String(diagnosticRow.deadline_at ?? "")).getTime();
        const total = Number(diagnosticRow.total_questions ?? 0);
        const score = Number(diagnosticRow.score ?? 0);
        return {
          attemptId: String(diagnosticRow.id),
          setId: String(diagnosticRow.set_id),
          courseCode: setById.get(String(diagnosticRow.set_id))?.courseCode ?? null,
          // Expired-but-unsubmitted counts as finished: getExamResult finalizes it on open.
          resumable: diagnosticRow.status === "in_progress"
            && Number.isFinite(deadlineMs)
            && deadlineMs > Date.now(),
          submitted: diagnosticRow.status === "submitted",
          percentage: total > 0 ? Math.round((score / total) * 100) : 0,
        };
      })()
    : null;
  const diagnosticUsed = diagnostic !== null;
  const activeAttempts: ExamActiveAttempt[] = attempts.flatMap((attempt) => {
    if (attempt.status !== "in_progress" || attempt.experience !== "exam_mock") return [];
    const deadlineAt = String(attempt.deadline_at ?? "");
    const deadlineMs = new Date(deadlineAt).getTime();
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) return [];
    const snapshot = tryParseExamSnapshot(attempt.delivery_snapshot);
    const set = setById.get(String(attempt.set_id));
    const courseCode = snapshot?.courseCode || set?.courseCode || "";
    if (!courseCode) return [];
    return [{
      attemptId: String(attempt.id),
      setId: String(attempt.set_id),
      setTitle: snapshot?.setTitle || set?.title || "Exam Sprint Mock",
      courseCode,
      deadlineAt,
      startedAt: String(attempt.started_at ?? ""),
      totalQuestions: snapshot?.questions.length || Math.max(0, Number(attempt.total_questions ?? 0)),
    }];
  });
  const progress = new Map<string, {
    bestDiagnostic: number;
    bestMock: number;
    diagnosticAttempts: number;
    mockAttempts: number;
  }>();
  for (const attempt of attempts) {
    if (attempt.status !== "submitted") continue;
    const set = setById.get(String(attempt.set_id));
    const key = normalizeExamCourseCode(set?.courseCode);
    if (!key) continue;
    const total = Number(attempt.total_questions ?? 0);
    const score = Number(attempt.score ?? 0);
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const current = progress.get(key) ?? {
      bestDiagnostic: 0,
      bestMock: 0,
      diagnosticAttempts: 0,
      mockAttempts: 0,
    };
    if (attempt.experience === "exam_mock") {
      current.bestMock = Math.max(current.bestMock, pct);
      current.mockAttempts += 1;
    } else if (attempt.experience === "exam_diagnostic") {
      current.bestDiagnostic = Math.max(current.bestDiagnostic, pct);
      current.diagnosticAttempts += 1;
    }
    progress.set(key, current);
  }

  return {
    access,
    diagnosticUsed,
    diagnostic,
    activeAttempts,
    courses: EXAM_COURSES.map((course) => {
      const courseKey = normalizeExamCourseCode(course.code);
      const courseSets = sets.filter(
        (set) => normalizeExamCourseCode(set.courseCode) === courseKey,
      ).map((set) => ({
        ...set,
        coverage: coverageBySet.get(set.id) ?? calculateExamQuestionCoverage([], new Map()),
      } satisfies PublicExamSetWithCoverage));
      const recentAttempts: ExamRecentAttempt[] = attempts
        .filter((attempt) => attempt.status === "submitted")
        .filter((attempt) => normalizeExamCourseCode(
          setById.get(String(attempt.set_id))?.courseCode
          || tryParseExamSnapshot(attempt.delivery_snapshot)?.courseCode,
        ) === courseKey)
        .map((attempt) => {
          const total = Math.max(0, Number(attempt.total_questions ?? 0));
          const score = Math.max(0, Number(attempt.score ?? 0));
          return {
            attemptId: String(attempt.id),
            kind: attemptKind(attempt.experience),
            score,
            total,
            percentage: total > 0 ? Math.round((score / total) * 100) : 0,
            submittedAt: typeof attempt.submitted_at === "string" ? attempt.submitted_at : null,
          };
        });
      return {
        ...course,
        sets: courseSets,
        activeAttempt: activeAttempts.find((attempt) => normalizeExamCourseCode(attempt.courseCode) === courseKey) ?? null,
        recentAttempts,
        progress: (() => {
          const value = progress.get(courseKey);
          if (!value) return null;
          return {
            bestPercentage: value.mockAttempts > 0 ? value.bestMock : value.bestDiagnostic,
            attempts: value.mockAttempts + value.diagnosticAttempts,
            basedOn: value.mockAttempts > 0 ? "mock" as const : "diagnostic" as const,
          };
        })(),
      };
    }),
  };
}

export async function getPublishedExamSet(setId: string) {
  const { data, error } = await adminSupabase
    .from("study_quiz_sets")
    .select("id,title,description,course_code,time_limit_minutes,questions_count,exam_question_count,diagnostic_question_count,diagnostic_time_limit_minutes,delivery_mode,exam_campaign_key,access_tier,published")
    .eq("id", setId)
    .maybeSingle();
  if (error) throw examHttpError(error.message, 500, "EXAM_SET_LOAD_FAILED");
  if (!data || data.delivery_mode !== "mock_exam" || data.exam_campaign_key !== EXAM_CAMPAIGN_KEY || !data.published) {
    throw examHttpError("This mock exam is not available.", 404, "EXAM_SET_NOT_FOUND");
  }
  const course = findExamCourse(data.course_code);
  if (!course) throw examHttpError("This mock is not attached to a campaign course.", 422, "UNKNOWN_EXAM_COURSE");
  return { row: data as Record<string, unknown>, set: publicExamSet(data as Record<string, unknown>), course };
}

export async function buildExamSnapshot(args: {
  setId: string;
  setTitle: string;
  courseCode: string;
  questionCount: number;
  userId: string;
  kind: ExamAttemptKind;
}) {
  const { data, error } = await adminSupabase
    .from("study_quiz_questions")
    .select("id,prompt,explanation,source_topic,question_type,exam_verified_at,study_quiz_options(id,text,is_correct,position)")
    .eq("set_id", args.setId)
    .eq("question_type", "mcq")
    .not("exam_verified_at", "is", null)
    .order("position", { ascending: true });
  if (error) throw examHttpError(error.message, 500, "EXAM_QUESTION_LOAD_FAILED");

  const candidates = ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    const options = Array.isArray(row.study_quiz_options)
      ? (row.study_quiz_options as Array<Record<string, unknown>>)
      : [];
    const correct = options.filter((option) => option.is_correct === true);
    if (options.length !== 4 || correct.length !== 1) return [];
    const shuffledOptions = shuffle(options).map((option) => ({
      id: String(option.id),
      text: cleanString(option.text),
    }));
    if (shuffledOptions.some((option) => !option.text)) return [];
    return [{
      id: String(row.id),
      prompt: cleanString(row.prompt),
      explanation: cleanString(row.explanation),
      sourceTopic: cleanString(row.source_topic, 200) || null,
      correctOptionId: String(correct[0].id),
      options: shuffledOptions,
    } satisfies ExamSnapshotQuestion];
  });

  if (candidates.length < args.questionCount) {
    throw examHttpError(
      `This mock needs ${args.questionCount} verified questions but only ${candidates.length} are ready.`,
      422,
      "EXAM_BANK_NOT_READY",
    );
  }

  const selected = args.kind === "mock"
    ? selectExamQuestions({
        candidates,
        history: await getSubmittedMockHistory(args.userId, args.setId),
        questionCount: args.questionCount,
        shuffle,
      }).questions
    : shuffle(candidates).slice(0, args.questionCount);

  return {
    version: 1,
    campaignKey: EXAM_CAMPAIGN_KEY,
    setId: args.setId,
    setTitle: args.setTitle,
    courseCode: args.courseCode,
    questions: selected,
  } satisfies ExamDeliverySnapshot;
}

export async function getOwnedExamAttempt(userId: string, attemptId: string) {
  const { data, error } = await adminSupabase
    .from("study_practice_attempts")
    .select("id,user_id,set_id,status,experience,campaign_key,started_at,deadline_at,submitted_at,submission_reason,delivery_snapshot,score,total_questions,time_spent_seconds")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw examHttpError(error.message, 500, "ATTEMPT_LOAD_FAILED");
  if (!data || data.user_id !== userId) throw examHttpError("Exam attempt not found.", 404, "ATTEMPT_NOT_FOUND");
  if (data.experience !== "exam_diagnostic" && data.experience !== "exam_mock") {
    throw examHttpError("This is not an Exam Sprint attempt.", 400, "INVALID_ATTEMPT_TYPE");
  }
  return data as ExamAttemptRow;
}

export function attemptExpired(attempt: Pick<ExamAttemptRow, "deadline_at">, now = Date.now()) {
  return new Date(attempt.deadline_at).getTime() <= now;
}

export async function finalizeExamAttempt(
  attempt: ExamAttemptRow,
  requestedReason: "manual" | "timeup" = "manual",
) {
  if (attempt.status === "submitted") return attempt;
  if (attempt.status !== "in_progress") {
    throw examHttpError("This exam attempt cannot be submitted.", 409, "ATTEMPT_SUBMITTED");
  }

  const { data, error } = await adminSupabase.rpc("submit_exam_attempt", {
    p_attempt_id: attempt.id,
    p_user_id: attempt.user_id,
    p_reason: requestedReason,
  });
  if (error) {
    if (error.message.includes("ATTEMPT_NOT_FOUND")) {
      throw examHttpError("Exam attempt not found.", 404, "ATTEMPT_NOT_FOUND");
    }
    if (error.message.includes("ATTEMPT_SUBMITTED")) {
      throw examHttpError("This exam attempt cannot be submitted.", 409, "ATTEMPT_SUBMITTED");
    }
    throw examHttpError(error.message, 500, "ATTEMPT_SUBMIT_FAILED");
  }
  const updated = (Array.isArray(data) ? data[0] : data) as ExamAttemptRow | null;
  if (!updated?.id) throw examHttpError("The submitted attempt could not be loaded.", 500, "ATTEMPT_SUBMIT_FAILED");
  return updated;
}

export async function getExamResult(userId: string, attemptId: string) {
  let attempt = await getOwnedExamAttempt(userId, attemptId);
  if (attempt.status === "in_progress" && attemptExpired(attempt)) {
    attempt = await finalizeExamAttempt(attempt, "timeup");
  }
  if (attempt.status !== "submitted") {
    throw examHttpError("Submit this attempt before viewing its result.", 409, "ATTEMPT_NOT_SUBMITTED");
  }

  const snapshot = parseExamSnapshot(attempt.delivery_snapshot);
  const { data, error } = await adminSupabase
    .from("study_attempt_answers")
    .select("question_id,selected_option_id,flagged")
    .eq("attempt_id", attempt.id);
  if (error) throw examHttpError(error.message, 500, "ANSWER_LOAD_FAILED");
  const answers = new Map(
    ((data ?? []) as Array<{ question_id: string; selected_option_id: string | null; flagged: boolean }>).map((row) => [
      String(row.question_id),
      row,
    ]),
  );
  const items = snapshot.questions.map((question, index) => {
    const answer = answers.get(question.id);
    return {
      position: index + 1,
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      selectedOptionId: answer?.selected_option_id ?? null,
      correctOptionId: question.correctOptionId,
      correct: answer?.selected_option_id === question.correctOptionId,
      flagged: Boolean(answer?.flagged),
      explanation: question.explanation,
      sourceTopic: question.sourceTopic,
    };
  });
  const missedTopics = new Map<string, number>();
  for (const item of items) {
    if (!item.correct && item.sourceTopic) {
      missedTopics.set(item.sourceTopic, (missedTopics.get(item.sourceTopic) ?? 0) + 1);
    }
  }
  const score = Number(attempt.score ?? 0);
  const total = Number(attempt.total_questions ?? snapshot.questions.length);
  let coverageBefore: number | null = null;
  let coverageAfter: number | null = null;
  let newQuestionsThisAttempt: number | null = null;
  let bankTotal: number | null = null;
  let coverageComplete: boolean | null = null;
  if (attempt.experience === "exam_mock") {
    const eligibleQuestionIds = (await getEligibleQuestionIdsBySet([snapshot.setId])).get(snapshot.setId) ?? [];
    const [beforeHistory, afterHistory] = await Promise.all([
      getSubmittedMockHistory(userId, snapshot.setId, attempt.id),
      getSubmittedMockHistory(userId, snapshot.setId),
    ]);
    const before = calculateExamQuestionCoverage(eligibleQuestionIds, beforeHistory);
    const after = calculateExamQuestionCoverage(eligibleQuestionIds, afterHistory);
    coverageBefore = before.delivered;
    coverageAfter = after.delivered;
    newQuestionsThisAttempt = Math.max(0, after.delivered - before.delivered);
    bankTotal = after.bankTotal;
    coverageComplete = after.complete;
  }
  return {
    attemptId: attempt.id,
    kind: attemptKind(attempt.experience),
    setId: snapshot.setId,
    setTitle: snapshot.setTitle,
    courseCode: snapshot.courseCode,
    score,
    total,
    answered: items.filter((item) => item.selectedOptionId).length,
    percentage: total > 0 ? Math.round((score / total) * 100) : 0,
    timeSpentSeconds: Number(attempt.time_spent_seconds ?? 0),
    // Derived from this attempt's own window rather than the set, so a later
    // edit to the set's time limit cannot rewrite the pace of a past attempt.
    allowedSeconds: Math.max(0, Math.round(
      (new Date(attempt.deadline_at).getTime() - new Date(attempt.started_at).getTime()) / 1000,
    )),
    submittedAt: attempt.submitted_at,
    submissionReason: attempt.submission_reason,
    coverageBefore,
    coverageAfter,
    newQuestionsThisAttempt,
    bankTotal,
    coverageComplete,
    weakTopics: [...missedTopics.entries()]
      .map(([topic, missed]) => ({ topic, missed }))
      .sort((a, b) => b.missed - a.missed),
    items,
  };
}

export function examExperience(kind: ExamAttemptKind) {
  return attemptExperience(kind);
}
