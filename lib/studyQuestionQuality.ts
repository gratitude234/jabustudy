import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StudyModeratorScope } from "@/lib/studyAdmin/requireStudyModerator";

export type QuestionQualityIssue =
  | "missing_source"
  | "missing_metadata"
  | "duplicate_fingerprint"
  | "thin_explanation"
  | "missing_ref_quote"
  | "missing_ref_page";

export type QuestionQualityItem = {
  id: string;
  setId: string | null;
  prompt: string;
  explanation: string | null;
  position: number | null;
  options: Array<{ id: string; text: string; isCorrect: boolean; position: number | null }>;
  correctAnswer: string | null;
  studyRef: Record<string, unknown> | null;
  sourceChunkId: string | null;
  sourceChunkPage: number | null;
  sourceChunkIndex: number | null;
  sourceMaterialId: string | null;
  sourceMaterialTitle: string | null;
  sourceMaterialType: string | null;
  sourceMaterialPath: string | null;
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
  issues: QuestionQualityIssue[];
};

export type QuestionQualitySummary = {
  total: number;
  sourceBacked: number;
  missingMetadata: number;
  duplicateFingerprints: number;
  issueCounts: Record<QuestionQualityIssue, number>;
  topTopics: Array<{ label: string; count: number }>;
  kindMix: Record<string, number>;
  cognitiveMix: Record<string, number>;
};

type MaterialInfo = {
  id: string;
  title: string | null;
  material_type: string | null;
  file_path: string | null;
  courseCode: string | null;
};

type QueryParams = {
  q: string;
  courseCode: string;
  source: string;
  kind: string;
  cognitive: string;
  issue: string;
  page: number;
  per: number;
};

function safeDecode(value: string | null) {
  let current = value ?? "";
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current.trim();
}

function parseParams(url: URL): QueryParams {
  return {
    q: safeDecode(url.searchParams.get("q")),
    courseCode: safeDecode(url.searchParams.get("courseCode")).toUpperCase(),
    source: safeDecode(url.searchParams.get("source")),
    kind: safeDecode(url.searchParams.get("kind")),
    cognitive: safeDecode(url.searchParams.get("cognitive")),
    issue: safeDecode(url.searchParams.get("issue")),
    page: Math.max(1, Math.floor(Number(url.searchParams.get("page") || 1))),
    per: Math.min(100, Math.max(5, Math.floor(Number(url.searchParams.get("per") || 20)))),
  };
}

function isWithinModeratorScope(scope: StudyModeratorScope | null, entity: { faculty_id?: string | null; department_id?: string | null; level?: number | null }) {
  if (!scope || scope.role === "super") return true;
  if (!scope.departmentId || !entity.department_id || scope.departmentId !== entity.department_id) return false;
  if (scope.facultyId && (!entity.faculty_id || scope.facultyId !== entity.faculty_id)) return false;
  if (scope.role === "dept_librarian") return true;
  return typeof entity.level === "number" && Array.isArray(scope.levels) && scope.levels.includes(entity.level);
}

async function loadScopedMaterials(scope: StudyModeratorScope | null, courseCode: string) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("study_materials")
    .select("id,title,material_type,file_path,study_courses!inner(id,course_code,course_title,level,faculty_id,department_id)")
    .not("id", "is", null)
    .limit(5000);

  if (courseCode) {
    query = query.ilike("study_courses.course_code", `%${courseCode}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const allowed = rows.filter((row) => {
    const course = Array.isArray(row.study_courses) ? row.study_courses[0] : row.study_courses;
    return isWithinModeratorScope(scope, {
      faculty_id: course?.faculty_id ?? null,
      department_id: course?.department_id ?? null,
      level: typeof course?.level === "number" ? course.level : null,
    });
  });

  const map = new Map<string, MaterialInfo>();
  for (const row of allowed) {
    const course = Array.isArray(row.study_courses) ? row.study_courses[0] : row.study_courses;
    map.set(String(row.id), {
      id: String(row.id),
      title: row.title ?? null,
      material_type: row.material_type ?? null,
      file_path: row.file_path ?? null,
      courseCode: course?.course_code ?? null,
    });
  }
  return map;
}

function studyRefObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function issueList(args: {
  explanation: string | null;
  sourceBacked: boolean;
  studyRef: Record<string, unknown> | null;
  sourceChunkPage: number | null;
  sourceTopic: string | null;
  questionKind: string | null;
  cognitiveLevel: string | null;
  questionFingerprint: string | null;
  duplicateFingerprint: boolean;
}): QuestionQualityIssue[] {
  const issues: QuestionQualityIssue[] = [];
  if (!args.sourceBacked) issues.push("missing_source");
  if (!args.sourceTopic || !args.questionKind || !args.cognitiveLevel) issues.push("missing_metadata");
  if (args.questionFingerprint && args.duplicateFingerprint) issues.push("duplicate_fingerprint");
  if (!args.explanation || args.explanation.trim().length < 40) issues.push("thin_explanation");
  if (!args.studyRef?.quote) issues.push("missing_ref_quote");
  if (!args.studyRef?.page && !args.sourceChunkPage) issues.push("missing_ref_page");
  return issues;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function topCounts(values: string[], limit = 8) {
  return Object.entries(countBy(values.filter(Boolean)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export async function getQuestionQuality(req: Request, scope: StudyModeratorScope | null) {
  const url = new URL(req.url);
  const params = parseParams(url);
  const admin = createSupabaseAdminClient();
  const materialMap = await loadScopedMaterials(scope, params.courseCode);
  const scopedMaterialIds = [...materialMap.keys()];

  if (scope && scope.role !== "super" && scopedMaterialIds.length === 0) {
    return emptyResult(params);
  }
  if (params.courseCode && scopedMaterialIds.length === 0) {
    return emptyResult(params);
  }

  let query = admin
    .from("study_quiz_questions")
    .select(
      [
        "id",
        "set_id",
        "prompt",
        "explanation",
        "position",
        "study_ref",
        "source_chunk_id",
        "source_material_id",
        "source_topic",
        "question_kind",
        "difficulty_level",
        "cognitive_level",
        "question_fingerprint",
        "generation_meta",
        "ai_generated",
        "study_quiz_sets(id,title,course_code,source,source_material_id)",
        "study_quiz_options(id,text,is_correct,position)",
      ].join(",")
    )
    .order("id", { ascending: false })
    .limit(1000);

  if (params.kind) query = query.eq("question_kind", params.kind);
  if (params.cognitive) query = query.eq("cognitive_level", params.cognitive);
  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as any[];
  rows = rows.filter((row) => {
    const quizSet = Array.isArray(row.study_quiz_sets) ? row.study_quiz_sets[0] : row.study_quiz_sets;
    const effectiveMaterialId = row.source_material_id ?? quizSet?.source_material_id ?? null;
    const looksAiGenerated = Boolean(
      row.ai_generated ||
      String(quizSet?.source ?? "").startsWith("ai") ||
      row.generation_meta ||
      row.study_ref
    );
    if (!looksAiGenerated) return false;
    if ((scope && scope.role !== "super") || params.courseCode) {
      return Boolean(effectiveMaterialId && materialMap.has(String(effectiveMaterialId)));
    }
    return true;
  });

  const materialIds = [...new Set(rows.map((row) => {
    const quizSet = Array.isArray(row.study_quiz_sets) ? row.study_quiz_sets[0] : row.study_quiz_sets;
    return row.source_material_id ?? quizSet?.source_material_id ?? null;
  }).filter(Boolean).map(String))];
  for (const id of materialIds) {
    if (materialMap.has(id)) continue;
    const { data: mat } = await admin
      .from("study_materials")
      .select("id,title,material_type,file_path,study_courses(course_code)")
      .eq("id", id)
      .maybeSingle();
    if (mat) {
      const course = Array.isArray((mat as any).study_courses) ? (mat as any).study_courses[0] : (mat as any).study_courses;
      materialMap.set(id, {
        id,
        title: (mat as any).title ?? null,
        material_type: (mat as any).material_type ?? null,
        file_path: (mat as any).file_path ?? null,
        courseCode: course?.course_code ?? null,
      });
    }
  }

  const chunkIds = [...new Set(rows.map((row) => row.source_chunk_id).filter(Boolean).map(String))];
  const chunkMap = new Map<string, { page_number: number | null; chunk_index: number | null }>();
  if (chunkIds.length > 0) {
    const { data: chunks } = await admin
      .from("study_material_chunks")
      .select("id,page_number,chunk_index")
      .in("id", chunkIds);
    for (const chunk of chunks ?? []) {
      chunkMap.set(String((chunk as any).id), {
        page_number: typeof (chunk as any).page_number === "number" ? (chunk as any).page_number : null,
        chunk_index: typeof (chunk as any).chunk_index === "number" ? (chunk as any).chunk_index : null,
      });
    }
  }

  if (params.q) {
    const needle = params.q.toLowerCase();
    rows = rows.filter((row) => {
      const quizSet = Array.isArray(row.study_quiz_sets) ? row.study_quiz_sets[0] : row.study_quiz_sets;
      const effectiveMaterialId = row.source_material_id ?? quizSet?.source_material_id ?? null;
      const material = effectiveMaterialId ? materialMap.get(String(effectiveMaterialId)) : null;
      return [
        row.prompt,
        row.source_topic,
        row.question_kind,
        row.cognitive_level,
        material?.title,
        material?.courseCode,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }

  const fingerprintCounts = countBy(
    rows
      .map((row) => typeof row.question_fingerprint === "string" ? row.question_fingerprint : "")
      .filter(Boolean)
  );

  let items = rows.map((row): QuestionQualityItem => {
    const options: QuestionQualityItem["options"] = (Array.isArray(row.study_quiz_options) ? row.study_quiz_options : [])
      .map((option: any) => ({
        id: String(option.id),
        text: String(option.text ?? ""),
        isCorrect: Boolean(option.is_correct),
        position: typeof option.position === "number" ? option.position : null,
      }))
      .sort((a: QuestionQualityItem["options"][number], b: QuestionQualityItem["options"][number]) => (a.position ?? 0) - (b.position ?? 0));
    const correct = options.find((option) => option.isCorrect) ?? null;
    const studyRef = studyRefObject(row.study_ref);
    const sourceChunkId = row.source_chunk_id ? String(row.source_chunk_id) : null;
    const sourceChunk = sourceChunkId ? chunkMap.get(sourceChunkId) : null;
    const sourceBacked = Boolean(sourceChunkId || studyRef?.chunkId);
    const quizSet = Array.isArray(row.study_quiz_sets) ? row.study_quiz_sets[0] : row.study_quiz_sets;
    const effectiveMaterialId = row.source_material_id ?? quizSet?.source_material_id ?? null;
    const material = effectiveMaterialId ? materialMap.get(String(effectiveMaterialId)) : null;
    const questionFingerprint = typeof row.question_fingerprint === "string" ? row.question_fingerprint : null;
    const sourceTopic = typeof row.source_topic === "string" ? row.source_topic : null;
    const questionKind = typeof row.question_kind === "string" ? row.question_kind : null;
    const cognitiveLevel = typeof row.cognitive_level === "string" ? row.cognitive_level : null;

    const issues = issueList({
      explanation: row.explanation ?? null,
      sourceBacked,
      studyRef,
      sourceChunkPage: sourceChunk?.page_number ?? null,
      sourceTopic,
      questionKind,
      cognitiveLevel,
      questionFingerprint,
      duplicateFingerprint: Boolean(questionFingerprint && (fingerprintCounts[questionFingerprint] ?? 0) > 1),
    });

    return {
      id: String(row.id),
      setId: row.set_id ? String(row.set_id) : null,
      prompt: String(row.prompt ?? ""),
      explanation: row.explanation ?? null,
      position: typeof row.position === "number" ? row.position : null,
      options,
      correctAnswer: correct?.text ?? null,
      studyRef,
      sourceChunkId,
      sourceChunkPage: sourceChunk?.page_number ?? null,
      sourceChunkIndex: sourceChunk?.chunk_index ?? null,
      sourceMaterialId: effectiveMaterialId ? String(effectiveMaterialId) : null,
      sourceMaterialTitle: material?.title ?? null,
      sourceMaterialType: material?.material_type ?? null,
      sourceMaterialPath: material?.file_path ?? null,
      quizSetTitle: quizSet?.title ?? null,
      quizSetCourseCode: quizSet?.course_code ?? material?.courseCode ?? null,
      quizSetSource: quizSet?.source ?? null,
      sourceTopic,
      questionKind,
      difficultyLevel: row.difficulty_level ?? null,
      cognitiveLevel,
      questionFingerprint,
      generationMeta: studyRefObject(row.generation_meta),
      sourceBacked,
      issues,
    };
  });

  if (params.source === "backed") items = items.filter((item) => item.sourceBacked);
  if (params.source === "missing") items = items.filter((item) => !item.sourceBacked);
  if (params.issue) items = items.filter((item) => item.issues.includes(params.issue as QuestionQualityIssue));

  const total = items.length;
  const summary = buildSummary(items);
  const start = (params.page - 1) * params.per;
  const paged = items.slice(start, start + params.per);

  return {
    ok: true,
    items: paged,
    summary,
    page: params.page,
    per: params.per,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.per)),
  };
}

function buildSummary(items: QuestionQualityItem[]): QuestionQualitySummary {
  const issueCounts = {
    missing_source: 0,
    missing_metadata: 0,
    duplicate_fingerprint: 0,
    thin_explanation: 0,
    missing_ref_quote: 0,
    missing_ref_page: 0,
  } satisfies Record<QuestionQualityIssue, number>;

  for (const item of items) {
    for (const issue of item.issues) issueCounts[issue]++;
  }

  return {
    total: items.length,
    sourceBacked: items.filter((item) => item.sourceBacked).length,
    missingMetadata: issueCounts.missing_metadata,
    duplicateFingerprints: issueCounts.duplicate_fingerprint,
    issueCounts,
    topTopics: topCounts(items.map((item) => item.sourceTopic ?? (typeof item.studyRef?.topic === "string" ? item.studyRef.topic : ""))),
    kindMix: countBy(items.map((item) => item.questionKind ?? "unknown")),
    cognitiveMix: countBy(items.map((item) => item.cognitiveLevel ?? "unknown")),
  };
}

function emptyResult(params: QueryParams) {
  return {
    ok: true,
    items: [],
    summary: buildSummary([]),
    page: params.page,
    per: params.per,
    total: 0,
    totalPages: 1,
  };
}
