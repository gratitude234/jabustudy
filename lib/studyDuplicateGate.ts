import "server-only";

import { adminSupabase } from "@/lib/supabase/admin";

export const DUPLICATE_QUESTION_MESSAGE =
  "These questions are too similar to questions already saved for this course. Generate again from uncovered areas.";

export type DuplicateReason =
  | "same_fingerprint"
  | "near_prompt"
  | "same_chunk_kind_answer"
  | "within_batch";

export type DuplicateGateError = Error & {
  status: 422;
  code: "DUPLICATE_QUESTION";
  duplicateCount: number;
  duplicates: DuplicateMatch[];
};

export type DuplicateCheckQuestion = {
  id?: string;
  question?: string | null;
  prompt?: string | null;
  options?: { A?: string; B?: string; C?: string; D?: string } | null;
  answer?: "A" | "B" | "C" | "D" | string | null;
  questionFingerprint?: string | null;
  question_fingerprint?: string | null;
  sourceChunkId?: string | null;
  source_chunk_id?: string | null;
  questionKind?: string | null;
  question_kind?: string | null;
};

export type DuplicateMatch = {
  reason: DuplicateReason;
  incomingIndex: number;
  existingQuestionId?: string;
  existingSetId?: string | null;
  similarity?: number;
  incomingPrompt: string;
  existingPrompt?: string;
};

type CourseContext = {
  courseId: string | null;
  courseCode: string | null;
  materialIds: string[];
};

type ExistingQuestionRow = {
  id: string;
  set_id: string | null;
  prompt: string | null;
  source_chunk_id: string | null;
  source_material_id: string | null;
  question_kind: string | null;
  question_fingerprint: string | null;
  ai_generated: boolean | null;
  generation_meta: unknown;
  study_ref: unknown;
  study_quiz_options?: Array<{
    text: string | null;
    is_correct: boolean | null;
    position: number | null;
  }> | null;
};

type QuizSetRow = {
  id: string;
  course_code: string | null;
  source_material_id: string | null;
};

type MaterialCourseRow = {
  id: string;
  course_id: string | null;
  course_code: string | null;
  study_courses?: { id?: string | null; course_code?: string | null } | Array<{ id?: string | null; course_code?: string | null }> | null;
};

type ComparableQuestion = {
  id?: string;
  setId?: string | null;
  incomingIndex?: number;
  prompt: string;
  normalizedPrompt: string;
  keywords: Set<string>;
  fingerprint: string;
  sourceChunkId: string;
  questionKind: string;
  answerConcept: string;
  generatedOrSourceBacked: boolean;
};

export async function assertQuestionsNotDuplicateForCourse(args: {
  materialId?: string;
  courseId?: string;
  courseCode?: string | null;
  quizSetId?: string;
  questions: DuplicateCheckQuestion[];
  excludeQuestionIds?: string[];
}) {
  if (!args.questions.length) return;

  const context = await resolveCourseContext(args);
  if (!context.courseCode && !context.materialIds.length) return;

  const incoming = args.questions.map((question, index) => toComparable(question, index));
  const duplicates = findWithinBatchDuplicates(incoming);
  const existing = await loadExistingQuestions(context, {
    excludeQuestionIds: args.excludeQuestionIds,
    excludeQuizSetId: args.quizSetId,
  });

  for (const incomingQuestion of incoming) {
    for (const existingQuestion of existing) {
      const match = compareQuestions(incomingQuestion, existingQuestion);
      if (match) duplicates.push(match);
    }
  }

  throwIfDuplicates(duplicates);
}

export async function assertQuizSetNotDuplicateForCourse(quizSetId: string) {
  const { data, error } = await adminSupabase
    .from("study_quiz_questions")
    .select("id,set_id,prompt,source_chunk_id,source_material_id,question_kind,question_fingerprint,ai_generated,generation_meta,study_ref,study_quiz_options(text,is_correct,position)")
    .eq("set_id", quizSetId);

  if (error) throw error;
  const rows = ((data ?? []) as unknown as ExistingQuestionRow[]);
  if (!rows.length) return;

  const candidates = rows.map((row, index) => toComparable(existingRowToQuestion(row), index, row.id, row.set_id));
  const duplicates = findWithinBatchDuplicates(candidates);
  const excludeQuestionIds = rows.map((row) => row.id);
  const first = rows[0];
  await assertQuestionsNotDuplicateForCourse({
    quizSetId,
    materialId: first.source_material_id ?? undefined,
    questions: rows.map(existingRowToQuestion),
    excludeQuestionIds,
  }).catch((error: unknown) => {
    const duplicateError = error as Partial<DuplicateGateError>;
    if (duplicateError.code === "DUPLICATE_QUESTION" && Array.isArray(duplicateError.duplicates)) {
      duplicates.push(...duplicateError.duplicates);
      return;
    }
    throw error;
  });

  throwIfDuplicates(duplicates);
}

export function duplicateGateErrorResponse(error: unknown, ok = false) {
  const duplicateError = error as Partial<DuplicateGateError>;
  return {
    ok,
    code: duplicateError.code || "DUPLICATE_QUESTION",
    error: duplicateError.message || DUPLICATE_QUESTION_MESSAGE,
    duplicateCount: duplicateError.duplicateCount,
    duplicates: duplicateError.duplicates,
  };
}

function throwIfDuplicates(duplicates: DuplicateMatch[]) {
  const compact = compactDuplicates(duplicates);
  if (compact.length === 0) return;
  throw Object.assign(new Error(DUPLICATE_QUESTION_MESSAGE), {
    status: 422 as const,
    code: "DUPLICATE_QUESTION" as const,
    duplicateCount: compact.length,
    duplicates: compact,
  });
}

function compactDuplicates(duplicates: DuplicateMatch[]) {
  const seen = new Set<string>();
  return duplicates.filter((duplicate) => {
    const key = [
      duplicate.reason,
      duplicate.incomingIndex,
      duplicate.existingQuestionId ?? duplicate.existingPrompt ?? "",
      duplicate.similarity ? duplicate.similarity.toFixed(3) : "",
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function findWithinBatchDuplicates(questions: ComparableQuestion[]) {
  const duplicates: DuplicateMatch[] = [];
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const match = compareQuestions(questions[i], questions[j], true);
      if (match) duplicates.push(match);
    }
  }
  return duplicates;
}

function compareQuestions(incoming: ComparableQuestion, existing: ComparableQuestion, withinBatch = false): DuplicateMatch | null {
  const base = {
    incomingIndex: incoming.incomingIndex ?? 0,
    existingQuestionId: existing.id,
    existingSetId: existing.setId,
    incomingPrompt: incoming.prompt.slice(0, 180),
    existingPrompt: existing.prompt.slice(0, 180),
  };

  if (incoming.fingerprint && existing.fingerprint && incoming.fingerprint === existing.fingerprint) {
    return { ...base, reason: withinBatch ? "within_batch" : "same_fingerprint" };
  }

  if (
    incoming.sourceChunkId &&
    existing.sourceChunkId &&
    incoming.sourceChunkId === existing.sourceChunkId &&
    incoming.questionKind &&
    existing.questionKind &&
    incoming.questionKind === existing.questionKind &&
    incoming.answerConcept &&
    existing.answerConcept &&
    incoming.answerConcept === existing.answerConcept
  ) {
    return { ...base, reason: withinBatch ? "within_batch" : "same_chunk_kind_answer" };
  }

  const similarity = jaccard(incoming.keywords, existing.keywords);
  if (similarity >= 0.72) {
    return {
      ...base,
      reason: withinBatch ? "within_batch" : "near_prompt",
      similarity: Math.round(similarity * 1000) / 1000,
    };
  }

  return null;
}

async function resolveCourseContext(args: {
  materialId?: string;
  courseId?: string;
  courseCode?: string | null;
  quizSetId?: string;
}): Promise<CourseContext> {
  let courseId = args.courseId ?? null;
  let courseCode = args.courseCode ?? null;

  if ((!courseId || !courseCode) && args.materialId) {
    const { data } = await adminSupabase
      .from("study_materials")
      .select("id,course_id,course_code,study_courses(id,course_code)")
      .eq("id", args.materialId)
      .maybeSingle();
    const material = data as MaterialCourseRow | null;
    const course = material ? materialCourse(material) : null;
    courseId = courseId ?? material?.course_id ?? course?.id ?? null;
    courseCode = courseCode ?? material?.course_code ?? course?.course_code ?? null;
  }

  if ((!courseId || !courseCode) && args.quizSetId) {
    const { data } = await adminSupabase
      .from("study_quiz_sets")
      .select("id,course_code,source_material_id")
      .eq("id", args.quizSetId)
      .maybeSingle();
    const set = data as QuizSetRow | null;
    courseCode = courseCode ?? set?.course_code ?? null;
    if (!courseId && set?.source_material_id) {
      const resolved = await resolveCourseContext({ materialId: set.source_material_id });
      courseId = resolved.courseId;
      courseCode = courseCode ?? resolved.courseCode;
    }
  }

  if (!courseId && courseCode) {
    const { data } = await adminSupabase
      .from("study_courses")
      .select("id,course_code")
      .eq("course_code", courseCode)
      .limit(1)
      .maybeSingle();
    courseId = (data as { id?: string } | null)?.id ?? null;
  }

  const materialIds = await loadCourseMaterialIds(courseId, courseCode);
  return { courseId, courseCode, materialIds };
}

async function loadCourseMaterialIds(courseId: string | null, courseCode: string | null) {
  if (courseId) {
    const { data } = await adminSupabase
      .from("study_materials")
      .select("id")
      .eq("course_id", courseId)
      .limit(5000);
    return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  }

  if (courseCode) {
    const { data } = await adminSupabase
      .from("study_materials")
      .select("id")
      .eq("course_code", courseCode)
      .limit(5000);
    return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  }

  return [];
}

async function loadExistingQuestions(
  context: CourseContext,
  exclude: { excludeQuestionIds?: string[]; excludeQuizSetId?: string }
) {
  const byId = new Map<string, ExistingQuestionRow>();

  async function addRows(rows: ExistingQuestionRow[] | null) {
    for (const row of rows ?? []) {
      if (exclude.excludeQuestionIds?.includes(row.id)) continue;
      if (exclude.excludeQuizSetId && row.set_id === exclude.excludeQuizSetId) continue;
      if (!looksGeneratedOrSourceBacked(row)) continue;
      byId.set(row.id, row);
    }
  }

  if (context.materialIds.length) {
    const { data, error } = await adminSupabase
      .from("study_quiz_questions")
      .select("id,set_id,prompt,source_chunk_id,source_material_id,question_kind,question_fingerprint,ai_generated,generation_meta,study_ref,study_quiz_options(text,is_correct,position)")
      .in("source_material_id", context.materialIds)
      .limit(3000);
    if (error) throw error;
    await addRows(data as unknown as ExistingQuestionRow[]);
  }

  if (context.courseCode) {
    const { data: sets, error: setError } = await adminSupabase
      .from("study_quiz_sets")
      .select("id")
      .eq("course_code", context.courseCode)
      .limit(1000);
    if (setError) throw setError;
    const setIds = ((sets ?? []) as Array<{ id: string }>).map((set) => set.id);
    if (setIds.length) {
      const { data, error } = await adminSupabase
        .from("study_quiz_questions")
        .select("id,set_id,prompt,source_chunk_id,source_material_id,question_kind,question_fingerprint,ai_generated,generation_meta,study_ref,study_quiz_options(text,is_correct,position)")
        .in("set_id", setIds)
        .limit(3000);
      if (error) throw error;
      await addRows(data as unknown as ExistingQuestionRow[]);
    }
  }

  return [...byId.values()].map((row) => toComparable(existingRowToQuestion(row), undefined, row.id, row.set_id));
}

function existingRowToQuestion(row: ExistingQuestionRow): DuplicateCheckQuestion {
  const correct = (row.study_quiz_options ?? []).find((option) => option.is_correct);
  return {
    id: row.id,
    prompt: row.prompt,
    options: correct?.text ? { A: correct.text } : null,
    answer: correct?.text ? "A" : null,
    question_fingerprint: row.question_fingerprint,
    source_chunk_id: row.source_chunk_id,
    question_kind: row.question_kind,
  };
}

function looksGeneratedOrSourceBacked(row: ExistingQuestionRow) {
  return Boolean(row.ai_generated || row.generation_meta || row.study_ref || row.source_chunk_id || row.question_fingerprint);
}

function toComparable(
  question: DuplicateCheckQuestion,
  incomingIndex?: number,
  existingId?: string,
  existingSetId?: string | null
): ComparableQuestion {
  const prompt = cleanString(question.question) ?? cleanString(question.prompt) ?? "";
  return {
    id: existingId ?? question.id,
    setId: existingSetId,
    incomingIndex,
    prompt,
    normalizedPrompt: normalizeForCompare(prompt),
    keywords: keywordSet(prompt),
    fingerprint: cleanString(question.questionFingerprint) ?? cleanString(question.question_fingerprint) ?? "",
    sourceChunkId: cleanString(question.sourceChunkId) ?? cleanString(question.source_chunk_id) ?? "",
    questionKind: normalizeForCompare(cleanString(question.questionKind) ?? cleanString(question.question_kind) ?? ""),
    answerConcept: correctAnswerConcept(question),
    generatedOrSourceBacked: true,
  };
}

function correctAnswerConcept(question: DuplicateCheckQuestion) {
  const answer = cleanString(question.answer);
  const options = question.options ?? {};
  const answerText =
    answer && answer in options
      ? options[answer as keyof typeof options]
      : options.A;
  return normalizeForCompare(cleanString(answerText) ?? "");
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeForCompare(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function keywordSet(value: string) {
  return new Set(
    normalizeForCompare(value)
      .split(" ")
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function materialCourse(row: MaterialCourseRow) {
  return Array.isArray(row.study_courses) ? row.study_courses[0] : row.study_courses ?? null;
}

const STOP_WORDS = new Set([
  "about",
  "above",
  "after",
  "also",
  "answer",
  "because",
  "before",
  "below",
  "between",
  "correct",
  "describe",
  "during",
  "following",
  "from",
  "into",
  "most",
  "question",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "what",
  "when",
  "where",
  "which",
  "with",
]);
