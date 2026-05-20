import "server-only";

import { generateJson, userMessage } from "@/lib/ai";
import { adminSupabase } from "@/lib/supabase/admin";

const ENGINE_VERSION = "coverage-engine-v1";
const MAP_CHUNK_LIMIT = 160;
const MAP_TEXT_BUDGET = 62_000;
const MAP_TIMEOUT_MS = parsePositiveInt(process.env.GEMINI_OUTLINE_TIMEOUT_MS) ?? 45_000;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.72;

export type CoverageGapStrength = "strong" | "moderate" | "weak";
export type StudyGenerationIntent =
  | "weak_areas"
  | "untested_sections"
  | "application"
  | "hard"
  | "topic"
  | "past_question_style";

export type CoverageMix = Record<string, number>;

export type CoveragePlanItem = {
  courseMapId: string;
  topicId: string;
  subtopicId: string;
  topicTitle: string;
  subtopicTitle: string;
  chunkId: string;
  coveragePercent: number;
  questionCount: number;
  targetQuestionCount: number;
  difficultyMix: CoverageMix;
  cognitiveMix: CoverageMix;
  duplicateRisk: number;
  sourceConfidence: number;
  gapStrength: CoverageGapStrength;
  recommendedQuestionCount: number;
};

export type CoveragePlan = {
  courseId: string;
  courseCode: string | null;
  courseMapId: string;
  items: CoveragePlanItem[];
  summary: CoverageSummary;
};

export type CoverageSummary = {
  courseCode: string | null;
  coveragePercent: number;
  topicsTotal: number;
  topicsStrongGap: number;
  topicsModerateGap: number;
  topicsWeakGap: number;
  duplicateRiskHigh: number;
  sourceConfidenceAverage: number;
};

export type CoverageTopicMetric = {
  topicId: string;
  subtopicId: string;
  label: string;
  questionCount: number;
  targetQuestionCount: number;
  coveragePercent: number;
  gapStrength: CoverageGapStrength;
  difficultyMix: CoverageMix;
  cognitiveMix: CoverageMix;
  duplicateRisk: number;
  sourceConfidence: number;
};

type CourseInfo = {
  id: string;
  course_code: string | null;
};

type MaterialRow = {
  id: string;
  title: string | null;
  course_id: string;
  study_courses?: CourseInfo | CourseInfo[] | null;
};

type ChunkRow = {
  id: string;
  material_id: string;
  page_number: number | null;
  chunk_index: number;
  text: string;
};

type CourseMapRow = {
  id: string;
  course_id: string;
  status: string;
  generated_from_material_ids: unknown;
};

type TopicRow = {
  id: string;
  course_map_id: string;
  course_id: string;
  title: string;
  normalized_key: string;
  summary: string | null;
  importance: number;
  target_question_count: number;
  sort_order: number;
};

type SubtopicRow = {
  id: string;
  topic_id: string;
  title: string;
  normalized_key: string;
  summary: string | null;
  importance: number;
  target_question_count: number;
  sort_order: number;
};

type LinkRow = {
  id: string;
  subtopic_id: string;
  material_id: string;
  chunk_id: string;
  relevance_score: number;
  source_confidence: number;
};

type QuestionRow = {
  prompt: string | null;
  source_chunk_id: string | null;
  source_material_id: string | null;
  source_topic: string | null;
  question_fingerprint: string | null;
  difficulty_level: string | null;
  cognitive_level: string | null;
  generation_meta: Record<string, unknown> | null;
};

export type CoveragePlanIntent = {
  generationIntent?: StudyGenerationIntent | null;
  topicId?: string | null;
  subtopicId?: string | null;
};

type MapDraftTopic = {
  title: string;
  summary?: string | null;
  importance: number;
  targetQuestionCount: number;
  subtopics: Array<{
    title: string;
    summary?: string | null;
    importance: number;
    targetQuestionCount: number;
    chunkIds: string[];
    sourceConfidence: number;
  }>;
};

export function coverageEngineVersion() {
  return ENGINE_VERSION;
}

function parsePositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function cleanTitle(value: unknown, fallback: string) {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return clean ? clean.slice(0, 120) : fallback;
}

function compactText(value: string, maxChars: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = value || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function keywordSet(value: string) {
  return new Set(
    normalizeKey(value)
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

function gapStrength(coveragePercent: number): CoverageGapStrength {
  if (coveragePercent < 40) return "strong";
  if (coveragePercent < 80) return "moderate";
  return "weak";
}

function materialCourse(row: MaterialRow): CourseInfo | null {
  const course = Array.isArray(row.study_courses) ? row.study_courses[0] : row.study_courses;
  return course ?? null;
}

function selectCatalogChunks(chunks: ChunkRow[]) {
  if (chunks.length <= MAP_CHUNK_LIMIT) return chunks;
  const selected: ChunkRow[] = [];
  const used = new Set<string>();
  const stride = chunks.length / MAP_CHUNK_LIMIT;
  for (let i = 0; i < MAP_CHUNK_LIMIT; i++) {
    const chunk = chunks[Math.floor(i * stride)];
    if (chunk && !used.has(chunk.id)) {
      selected.push(chunk);
      used.add(chunk.id);
    }
  }
  return selected;
}

function buildChunkCatalog(chunks: ChunkRow[]) {
  const budget = Math.max(180, Math.floor(MAP_TEXT_BUDGET / Math.max(1, chunks.length)) - 90);
  let total = 0;
  const lines: string[] = [];
  for (const chunk of chunks) {
    const page = typeof chunk.page_number === "number" ? ` page:${chunk.page_number}` : "";
    const block = `[chunk:${chunk.id} material:${chunk.material_id}${page} index:${chunk.chunk_index}]\n${compactText(chunk.text, budget)}`;
    total += block.length;
    if (total > MAP_TEXT_BUDGET && lines.length > 0) break;
    lines.push(block);
  }
  return lines.join("\n\n");
}

async function loadMaterialCourse(materialId: string) {
  const { data, error } = await adminSupabase
    .from("study_materials")
    .select("id,title,course_id,study_courses(id,course_code)")
    .eq("id", materialId)
    .maybeSingle();

  if (error || !data) return null;
  const material = data as MaterialRow;
  const course = materialCourse(material);
  return course ? { material, course } : null;
}

async function loadCourseMaterials(courseId: string, materialIds?: string[]) {
  let query = adminSupabase
    .from("study_materials")
    .select("id,title,course_id")
    .eq("course_id", courseId)
    .eq("index_status", "ready")
    .eq("approved", true)
    .eq("upload_status", "live")
    .not("file_path", "is", null)
    .order("downloads", { ascending: false, nullsFirst: false })
    .limit(24);

  if (materialIds?.length) query = query.in("id", materialIds);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MaterialRow[];
}

async function loadChunksForMaterials(materialIds: string[]) {
  if (!materialIds.length) return [];
  const { data, error } = await adminSupabase
    .from("study_material_chunks")
    .select("id,material_id,page_number,chunk_index,text")
    .in("material_id", materialIds)
    .order("chunk_index", { ascending: true })
    .limit(1200);

  if (error) throw error;
  return ((data ?? []) as ChunkRow[]).filter((chunk) => chunk.text?.trim());
}

async function loadActiveMap(courseId: string) {
  const { data, error } = await adminSupabase
    .from("study_course_maps")
    .select("id,course_id,status,generated_from_material_ids")
    .eq("course_id", courseId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[studyCoverageEngine] active map load failed:", error.message);
    return null;
  }
  return data as CourseMapRow | null;
}

async function loadMapModel(courseMapId: string) {
  const [{ data: topics, error: topicError }, { data: subtopics, error: subtopicError }, { data: links, error: linkError }] =
    await Promise.all([
      adminSupabase
        .from("study_course_topics")
        .select("id,course_map_id,course_id,title,normalized_key,summary,importance,target_question_count,sort_order")
        .eq("course_map_id", courseMapId)
        .order("sort_order", { ascending: true }),
      adminSupabase
        .from("study_course_subtopics")
        .select("id,topic_id,title,normalized_key,summary,importance,target_question_count,sort_order"),
      adminSupabase
        .from("study_course_subtopic_chunks")
        .select("id,subtopic_id,material_id,chunk_id,relevance_score,source_confidence"),
    ]);

  if (topicError) throw topicError;
  if (subtopicError) throw subtopicError;
  if (linkError) throw linkError;

  const topicRows = (topics ?? []) as TopicRow[];
  const topicIds = new Set(topicRows.map((topic) => topic.id));
  const subtopicRows = ((subtopics ?? []) as SubtopicRow[]).filter((subtopic) => topicIds.has(subtopic.topic_id));
  const subtopicIds = new Set(subtopicRows.map((subtopic) => subtopic.id));
  const linkRows = ((links ?? []) as LinkRow[]).filter((link) => subtopicIds.has(link.subtopic_id));

  return { topics: topicRows, subtopics: subtopicRows, links: linkRows };
}

async function outlineCourseMap(courseCode: string | null, chunks: ChunkRow[]): Promise<MapDraftTopic[]> {
  const catalogued = selectCatalogChunks(chunks);
  const chunkIds = new Set(catalogued.map((chunk) => chunk.id));
  const prompt = `You are creating a durable exam coverage map for a Nigerian university course.
Course: ${courseCode ?? "Unknown course"}

Use only chunk IDs from the catalog. Group the material into broad topics, then examinable subtopics.
Every subtopic must include 1 to 5 chunk IDs. Prioritize topics that can support MCQ practice.

Return ONLY JSON:
{
  "topics": [
    {
      "title": "topic",
      "summary": "short summary",
      "importance": 1,
      "targetQuestionCount": 5,
      "subtopics": [
        {
          "title": "subtopic",
          "summary": "short summary",
          "importance": 1,
          "targetQuestionCount": 2,
          "chunkIds": ["uuid"],
          "sourceConfidence": 0.8
        }
      ]
    }
  ]
}`;

  const result = await generateJson<{ topics?: Array<Record<string, unknown>> }>({
    messages: [userMessage(`SOURCE CHUNK CATALOG:\n\n${buildChunkCatalog(catalogued)}\n\n${prompt}`)],
    temperature: 0.2,
    maxTokens: 3600,
    timeoutMs: MAP_TIMEOUT_MS,
    modelRole: "generation",
  });

  if (!result.ok) return fallbackMap(catalogued);

  const topics = Array.isArray(result.data.topics) ? result.data.topics : [];
  const normalized = topics
    .map((raw, topicIndex): MapDraftTopic => {
      const subtopics = Array.isArray(raw.subtopics) ? raw.subtopics : [];
      return {
        title: cleanTitle(raw.title, `Topic ${topicIndex + 1}`),
        summary: typeof raw.summary === "string" ? raw.summary.trim().slice(0, 400) : null,
        importance: Math.floor(clamp(Number(raw.importance ?? 3), 1, 5)),
        targetQuestionCount: Math.max(2, Math.min(20, Math.floor(Number(raw.targetQuestionCount ?? 5)))),
        subtopics: subtopics
          .map((subtopic, subtopicIndex) => {
            const item = subtopic && typeof subtopic === "object" ? subtopic as Record<string, unknown> : {};
            const rawIds = Array.isArray(item.chunkIds) ? item.chunkIds : [];
            const ids = rawIds.map((id) => String(id)).filter((id) => chunkIds.has(id)).slice(0, 5);
            return {
              title: cleanTitle(item.title, `Subtopic ${subtopicIndex + 1}`),
              summary: typeof item.summary === "string" ? item.summary.trim().slice(0, 400) : null,
              importance: Math.floor(clamp(Number(item.importance ?? raw.importance ?? 3), 1, 5)),
              targetQuestionCount: Math.max(1, Math.min(10, Math.floor(Number(item.targetQuestionCount ?? 2)))),
              chunkIds: ids,
              sourceConfidence: clamp(Number(item.sourceConfidence ?? 0.75), 0.25, 1),
            };
          })
          .filter((subtopic) => subtopic.chunkIds.length > 0)
          .slice(0, 10),
      };
    })
    .filter((topic) => topic.subtopics.length > 0)
    .slice(0, 14);

  return normalized.length ? normalized : fallbackMap(catalogued);
}

function fallbackMap(chunks: ChunkRow[]): MapDraftTopic[] {
  return chunks.slice(0, 12).map((chunk, index) => {
    const title = cleanTitle(chunk.text.split(/[.;:]/)[0], `Topic ${index + 1}`);
    return {
      title,
      summary: "Fallback topic from indexed source chunk.",
      importance: 3,
      targetQuestionCount: 3,
      subtopics: [{
        title,
        summary: "Fallback subtopic from indexed source chunk.",
        importance: 3,
        targetQuestionCount: 2,
        chunkIds: [chunk.id],
        sourceConfidence: 0.55,
      }],
    };
  });
}

async function createCourseMap(args: {
  courseId: string;
  courseCode: string | null;
  materialIds: string[];
  chunks: ChunkRow[];
}) {
  const topics = await outlineCourseMap(args.courseCode, args.chunks);

  await adminSupabase
    .from("study_course_maps")
    .update({ status: "stale", updated_at: new Date().toISOString() })
    .eq("course_id", args.courseId)
    .eq("status", "active");

  const { data: map, error: mapError } = await adminSupabase
    .from("study_course_maps")
    .insert({
      course_id: args.courseId,
      status: "active",
      version: ENGINE_VERSION,
      generated_from_material_ids: args.materialIds,
      coverage_meta: {
        version: ENGINE_VERSION,
        chunksMapped: args.chunks.length,
        topics: topics.length,
      },
    })
    .select("id,course_id,status,generated_from_material_ids")
    .single();

  if (mapError || !map) throw mapError ?? new Error("Could not create course coverage map.");

  const courseMap = map as CourseMapRow;
  for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
    const topic = topics[topicIndex];
    const { data: topicRow, error: topicError } = await adminSupabase
      .from("study_course_topics")
      .insert({
        course_map_id: courseMap.id,
        course_id: args.courseId,
        title: topic.title,
        normalized_key: normalizeKey(topic.title),
        summary: topic.summary ?? null,
        importance: topic.importance,
        target_question_count: topic.targetQuestionCount,
        sort_order: topicIndex,
      })
      .select("id")
      .single();

    if (topicError || !topicRow?.id) throw topicError ?? new Error("Could not create coverage topic.");

    for (let subtopicIndex = 0; subtopicIndex < topic.subtopics.length; subtopicIndex++) {
      const subtopic = topic.subtopics[subtopicIndex];
      const { data: subtopicRow, error: subtopicError } = await adminSupabase
        .from("study_course_subtopics")
        .insert({
          topic_id: topicRow.id,
          title: subtopic.title,
          normalized_key: normalizeKey(subtopic.title),
          summary: subtopic.summary ?? null,
          importance: subtopic.importance,
          target_question_count: subtopic.targetQuestionCount,
          sort_order: subtopicIndex,
        })
        .select("id")
        .single();

      if (subtopicError || !subtopicRow?.id) throw subtopicError ?? new Error("Could not create coverage subtopic.");

      const links = subtopic.chunkIds.flatMap((chunkId) => {
        const chunk = args.chunks.find((item) => item.id === chunkId);
        if (!chunk) return [];
        return [{
          subtopic_id: subtopicRow.id,
          material_id: chunk.material_id,
          chunk_id: chunk.id,
          relevance_score: subtopic.sourceConfidence,
          source_confidence: subtopic.sourceConfidence,
        }];
      });

      if (links.length) {
        const { error: linkError } = await adminSupabase.from("study_course_subtopic_chunks").insert(links);
        if (linkError) throw linkError;
      }
    }
  }

  return courseMap;
}

async function ensureCourseMap(courseId: string, courseCode: string | null, requiredMaterialId?: string) {
  const materials = await loadCourseMaterials(courseId);
  const materialIds = materials.map((material) => material.id);
  if (!materialIds.length) return null;

  let map = await loadActiveMap(courseId);
  if (map) {
    const model = await loadMapModel(map.id);
    const hasLinks = requiredMaterialId
      ? model.links.some((link) => link.material_id === requiredMaterialId)
      : model.links.length > 0;
    if (hasLinks && model.topics.length && model.subtopics.length) return map;
  }

  const chunks = await loadChunksForMaterials(materialIds);
  if (!chunks.length) return null;
  map = await createCourseMap({ courseId, courseCode, materialIds, chunks });
  return map;
}

async function loadCourseQuestions(courseId: string) {
  const { data: materials } = await adminSupabase
    .from("study_materials")
    .select("id")
    .eq("course_id", courseId);
  const materialIds = ((materials ?? []) as Array<{ id: string }>).map((material) => material.id);
  if (!materialIds.length) return [];

  const { data, error } = await adminSupabase
    .from("study_quiz_questions")
    .select("prompt,source_chunk_id,source_material_id,source_topic,question_fingerprint,difficulty_level,cognitive_level,generation_meta")
    .in("source_material_id", materialIds)
    .not("source_chunk_id", "is", null)
    .limit(2000);

  if (error) {
    console.warn("[studyCoverageEngine] question load failed:", error.message);
    return [];
  }

  return (data ?? []) as QuestionRow[];
}

function duplicateRiskForQuestions(questions: QuestionRow[], coveredQuestions: string[]) {
  const fingerprints = questions.map((question) => question.question_fingerprint).filter(Boolean);
  const duplicateFingerprints = fingerprints.length - new Set(fingerprints).size;
  let maxSimilarity = duplicateFingerprints > 0 ? 1 : 0;
  const prompts = questions.map((question) => question.prompt ?? "").filter(Boolean);
  const promptSets = prompts.map(keywordSet);
  for (let i = 0; i < promptSets.length; i++) {
    for (let j = i + 1; j < promptSets.length; j++) {
      maxSimilarity = Math.max(maxSimilarity, jaccard(promptSets[i], promptSets[j]));
    }
  }
  const coveredSets = coveredQuestions.map(keywordSet);
  for (const promptSet of promptSets) {
    for (const coveredSet of coveredSets) {
      maxSimilarity = Math.max(maxSimilarity, jaccard(promptSet, coveredSet));
    }
  }
  return clamp(maxSimilarity, 0, 1);
}

function questionMatchesSubtopic(question: QuestionRow, subtopic: SubtopicRow, topic: TopicRow, links: LinkRow[]) {
  const meta = question.generation_meta ?? {};
  if (meta.subtopicId === subtopic.id || meta.topicId === topic.id) return true;
  if (question.source_chunk_id && links.some((link) => link.chunk_id === question.source_chunk_id)) return true;
  const topicKey = normalizeKey(question.source_topic ?? "");
  return Boolean(topicKey && (topicKey === subtopic.normalized_key || topicKey === topic.normalized_key));
}

async function computeCoverage(args: {
  courseId: string;
  courseCode: string | null;
  courseMapId: string;
  materialId?: string;
  coveredQuestions?: string[];
}) {
  const [{ topics, subtopics, links }, questions] = await Promise.all([
    loadMapModel(args.courseMapId),
    loadCourseQuestions(args.courseId),
  ]);

  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const linksBySubtopic = new Map<string, LinkRow[]>();
  for (const link of links) {
    const current = linksBySubtopic.get(link.subtopic_id) ?? [];
    current.push(link);
    linksBySubtopic.set(link.subtopic_id, current);
  }

  const metrics = subtopics.flatMap((subtopic): CoverageTopicMetric[] => {
    const topic = topicById.get(subtopic.topic_id);
    if (!topic) return [];
    const subtopicLinks = linksBySubtopic.get(subtopic.id) ?? [];
    const scopedLinks = args.materialId
      ? subtopicLinks.filter((link) => link.material_id === args.materialId)
      : subtopicLinks;
    if (!scopedLinks.length) return [];

    const matchedQuestions = questions.filter((question) => questionMatchesSubtopic(question, subtopic, topic, subtopicLinks));
    const targetQuestionCount = Math.max(1, subtopic.target_question_count);
    const questionCount = matchedQuestions.length;
    const coveragePercent = Math.round((questionCount / targetQuestionCount) * 100);
    const sourceConfidence = scopedLinks.reduce((sum, link) => sum + Number(link.source_confidence ?? 0), 0) / scopedLinks.length;
    const duplicateRisk = duplicateRiskForQuestions(matchedQuestions, args.coveredQuestions ?? []);

    return [{
      topicId: topic.id,
      subtopicId: subtopic.id,
      label: `${topic.title} / ${subtopic.title}`,
      questionCount,
      targetQuestionCount,
      coveragePercent,
      gapStrength: gapStrength(coveragePercent),
      difficultyMix: countBy(matchedQuestions.map((question) => question.difficulty_level ?? "unknown")),
      cognitiveMix: countBy(matchedQuestions.map((question) => question.cognitive_level ?? "unknown")),
      duplicateRisk,
      sourceConfidence,
    }];
  });

  const totalTarget = metrics.reduce((sum, metric) => sum + metric.targetQuestionCount, 0);
  const totalQuestions = metrics.reduce((sum, metric) => sum + Math.min(metric.questionCount, metric.targetQuestionCount), 0);
  const confidenceTotal = metrics.reduce((sum, metric) => sum + metric.sourceConfidence, 0);
  const summary: CoverageSummary = {
    courseCode: args.courseCode,
    coveragePercent: totalTarget ? Math.round((totalQuestions / totalTarget) * 100) : 0,
    topicsTotal: metrics.length,
    topicsStrongGap: metrics.filter((metric) => metric.gapStrength === "strong").length,
    topicsModerateGap: metrics.filter((metric) => metric.gapStrength === "moderate").length,
    topicsWeakGap: metrics.filter((metric) => metric.gapStrength === "weak").length,
    duplicateRiskHigh: metrics.filter((metric) => metric.duplicateRisk >= DUPLICATE_SIMILARITY_THRESHOLD).length,
    sourceConfidenceAverage: metrics.length ? Math.round((confidenceTotal / metrics.length) * 100) / 100 : 0,
  };

  return { metrics, summary, model: { topics, subtopics, links }, questions };
}

export async function buildCoveragePlanForMaterial(args: {
  materialId: string;
  count: number;
  focus?: string;
  coveredQuestions?: string[];
  generationIntent?: StudyGenerationIntent | null;
  topicId?: string | null;
  subtopicId?: string | null;
}): Promise<CoveragePlan | null> {
  const loaded = await loadMaterialCourse(args.materialId);
  if (!loaded) return null;

  const map = await ensureCourseMap(loaded.course.id, loaded.course.course_code, args.materialId);
  if (!map) return null;

  const { metrics, summary, model, questions } = await computeCoverage({
    courseId: loaded.course.id,
    courseCode: loaded.course.course_code,
    courseMapId: map.id,
    materialId: args.materialId,
    coveredQuestions: args.coveredQuestions,
  });

  const focus = normalizeKey(args.focus ?? "");
  const intent = args.generationIntent ?? null;
  const sourceChunkQuestionCounts = new Map<string, number>();
  for (const question of questions) {
    if (!question.source_chunk_id) continue;
    sourceChunkQuestionCounts.set(question.source_chunk_id, (sourceChunkQuestionCounts.get(question.source_chunk_id) ?? 0) + 1);
  }
  const linksBySubtopic = new Map<string, LinkRow[]>();
  for (const link of model.links.filter((item) => item.material_id === args.materialId)) {
    const current = linksBySubtopic.get(link.subtopic_id) ?? [];
    current.push(link);
    linksBySubtopic.set(link.subtopic_id, current);
  }
  const topicById = new Map(model.topics.map((topic) => [topic.id, topic]));
  const metricBySubtopic = new Map(metrics.map((metric) => [metric.subtopicId, metric]));

  const ranked = model.subtopics
    .flatMap((subtopic): CoveragePlanItem[] => {
      const topic = topicById.get(subtopic.topic_id);
      const metric = metricBySubtopic.get(subtopic.id);
      const subtopicLinks = linksBySubtopic.get(subtopic.id) ?? [];
      if (!topic || !metric || !subtopicLinks.length) return [];
      if (args.topicId && topic.id !== args.topicId) return [];
      if (args.subtopicId && subtopic.id !== args.subtopicId) return [];
      if (intent === "topic" && focus && !normalizeKey(`${topic.title} ${subtopic.title} ${subtopic.summary ?? ""}`).includes(focus)) {
        return [];
      }
      const focusBoost = focus && normalizeKey(`${topic.title} ${subtopic.title} ${subtopic.summary ?? ""}`).includes(focus) ? 0.5 : 0;
      const sortedLinks = [...subtopicLinks].sort((a, b) => {
        if (intent === "untested_sections") {
          const aCount = sourceChunkQuestionCounts.get(a.chunk_id) ?? 0;
          const bCount = sourceChunkQuestionCounts.get(b.chunk_id) ?? 0;
          if (aCount !== bCount) return aCount - bCount;
        }
        return Number(b.source_confidence) - Number(a.source_confidence);
      });
      const recommendedQuestionCount = Math.max(1, Math.min(args.count, metric.targetQuestionCount - Math.min(metric.questionCount, metric.targetQuestionCount) || 1));
      return sortedLinks.slice(0, Math.max(1, recommendedQuestionCount)).map((link) => ({
        courseMapId: map.id,
        topicId: topic.id,
        subtopicId: subtopic.id,
        topicTitle: topic.title,
        subtopicTitle: subtopic.title,
        chunkId: link.chunk_id,
        coveragePercent: metric.coveragePercent,
        questionCount: metric.questionCount,
        targetQuestionCount: metric.targetQuestionCount,
        difficultyMix: metric.difficultyMix,
        cognitiveMix: metric.cognitiveMix,
        duplicateRisk: intent === "untested_sections" && (sourceChunkQuestionCounts.get(link.chunk_id) ?? 0) > 0
          ? Math.max(metric.duplicateRisk, 0.5)
          : metric.duplicateRisk,
        sourceConfidence: clamp(Number(link.source_confidence ?? metric.sourceConfidence) + focusBoost, 0, 1),
        gapStrength: metric.gapStrength,
        recommendedQuestionCount,
      }));
    })
    .sort((a, b) => {
      const gapRank = { strong: 0, moderate: 1, weak: 2 };
      if (intent === "untested_sections") {
        const aCount = sourceChunkQuestionCounts.get(a.chunkId) ?? 0;
        const bCount = sourceChunkQuestionCounts.get(b.chunkId) ?? 0;
        if (aCount !== bCount) return aCount - bCount;
      }
      if (intent === "weak_areas" || intent === "past_question_style") {
        const gapDiff = gapRank[a.gapStrength] - gapRank[b.gapStrength];
        if (gapDiff !== 0) return gapDiff;
      }
      return (
        gapRank[a.gapStrength] - gapRank[b.gapStrength] ||
        a.coveragePercent - b.coveragePercent ||
        b.sourceConfidence - a.sourceConfidence ||
        a.duplicateRisk - b.duplicateRisk
      );
    });

  return {
    courseId: loaded.course.id,
    courseCode: loaded.course.course_code,
    courseMapId: map.id,
    items: ranked.slice(0, Math.max(args.count + 6, 12)),
    summary,
  };
}

export async function getCoverageForMaterials(materialIds: string[]) {
  const ids = [...new Set(materialIds.filter(Boolean))];
  if (!ids.length) return { summary: null, topics: [] as CoverageTopicMetric[] };

  const { data: materials, error } = await adminSupabase
    .from("study_materials")
    .select("id,course_id,study_courses(id,course_code)")
    .in("id", ids);
  if (error) throw error;

  const courses = new Map<string, string | null>();
  for (const row of (materials ?? []) as MaterialRow[]) {
    const course = materialCourse(row);
    if (course) courses.set(course.id, course.course_code ?? null);
  }

  const allTopics: CoverageTopicMetric[] = [];
  const summaries: CoverageSummary[] = [];
  for (const [courseId, courseCode] of courses) {
    const map = await loadActiveMap(courseId);
    if (!map) continue;
    const { metrics, summary } = await computeCoverage({ courseId, courseCode, courseMapId: map.id });
    allTopics.push(...metrics);
    summaries.push(summary);
  }

  if (!summaries.length) return { summary: null, topics: [] as CoverageTopicMetric[] };

  const totalTopics = summaries.reduce((sum, summary) => sum + summary.topicsTotal, 0);
  const aggregate: CoverageSummary = {
    courseCode: summaries.length === 1 ? summaries[0].courseCode : "Multiple courses",
    coveragePercent: totalTopics
      ? Math.round(summaries.reduce((sum, summary) => sum + summary.coveragePercent * summary.topicsTotal, 0) / totalTopics)
      : 0,
    topicsTotal: totalTopics,
    topicsStrongGap: summaries.reduce((sum, summary) => sum + summary.topicsStrongGap, 0),
    topicsModerateGap: summaries.reduce((sum, summary) => sum + summary.topicsModerateGap, 0),
    topicsWeakGap: summaries.reduce((sum, summary) => sum + summary.topicsWeakGap, 0),
    duplicateRiskHigh: summaries.reduce((sum, summary) => sum + summary.duplicateRiskHigh, 0),
    sourceConfidenceAverage: Math.round(
      (summaries.reduce((sum, summary) => sum + summary.sourceConfidenceAverage, 0) / summaries.length) * 100
    ) / 100,
  };

  return {
    summary: aggregate,
    topics: allTopics
      .sort((a, b) => a.coveragePercent - b.coveragePercent || b.sourceConfidence - a.sourceConfidence)
      .slice(0, 24),
  };
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
