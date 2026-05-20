import "server-only";

import { adminSupabase } from "@/lib/supabase/admin";

export const SOURCE_GROUNDING_ERROR_MESSAGE =
  "These questions are not source-backed yet. Reindex the material or generate again.";

export type SourceGroundingCode =
  | "MATERIAL_NOT_INDEXED"
  | "QUESTIONS_MISSING_SOURCE"
  | "INVALID_SOURCE_CHUNK"
  | "PUBLISH_BLOCKED_UNGROUNDED";

export type SourceGroundingError = Error & {
  status: 422;
  code: SourceGroundingCode;
  invalidCount?: number;
};

export type GroundableQuestion = {
  question?: string;
  hint?: string;
  sourceTopic?: string | null;
  studyRef?: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  };
};

export type GroundedQuestionMeta = {
  studyRef: Record<string, string | number>;
  sourceChunkId: string;
  sourceTopic: string | null;
  page: number | null;
};

type ChunkRow = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  text: string;
};

function groundingError(
  message: string,
  code: SourceGroundingCode,
  invalidCount?: number
): SourceGroundingError {
  return Object.assign(new Error(message), {
    status: 422 as const,
    code,
    invalidCount,
  });
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function cleanPage(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const page = Math.floor(value);
  return page >= 1 && page <= 2000 ? page : undefined;
}

function sourceSnippet(text: string, max = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

async function loadChunksById(materialId: string, chunkIds: string[]) {
  if (chunkIds.length === 0) return new Map<string, ChunkRow>();

  const { data, error } = await adminSupabase
    .from("study_material_chunks")
    .select("id,page_number,chunk_index,text")
    .eq("material_id", materialId)
    .in("id", chunkIds);

  if (error) {
    throw groundingError(SOURCE_GROUNDING_ERROR_MESSAGE, "INVALID_SOURCE_CHUNK");
  }

  return new Map(
    ((data ?? []) as ChunkRow[])
      .filter((chunk) => chunk.id && chunk.text?.trim())
      .map((chunk) => [String(chunk.id), chunk])
  );
}

export async function requireIndexedMaterialChunks(materialId: string) {
  const { count, error } = await adminSupabase
    .from("study_material_chunks")
    .select("id", { count: "exact", head: true })
    .eq("material_id", materialId);

  if (error) {
    throw groundingError(error.message || "Could not verify material index.", "MATERIAL_NOT_INDEXED");
  }

  if ((count ?? 0) <= 0) {
    throw groundingError(
      "This material is not indexed yet. Reindex the material before creating source-backed questions.",
      "MATERIAL_NOT_INDEXED"
    );
  }
}

export async function validateSourceBackedQuestions<T extends GroundableQuestion>(
  materialId: string,
  questions: T[]
): Promise<Array<T & GroundedQuestionMeta>> {
  await requireIndexedMaterialChunks(materialId);

  const requestedChunkIds = questions.map((question) => cleanString(question.studyRef?.chunkId));
  const missingCount = requestedChunkIds.filter((id) => !id).length;
  if (missingCount > 0) {
    throw groundingError(
      SOURCE_GROUNDING_ERROR_MESSAGE,
      "QUESTIONS_MISSING_SOURCE",
      missingCount
    );
  }

  const uniqueChunkIds = [...new Set(requestedChunkIds.filter(Boolean) as string[])];
  const chunksById = await loadChunksById(materialId, uniqueChunkIds);
  const invalidCount = uniqueChunkIds.filter((id) => !chunksById.has(id)).length;
  if (invalidCount > 0) {
    throw groundingError(
      SOURCE_GROUNDING_ERROR_MESSAGE,
      "INVALID_SOURCE_CHUNK",
      invalidCount
    );
  }

  return questions.map((question) => {
    const sourceChunkId = cleanString(question.studyRef?.chunkId);
    const chunk = sourceChunkId ? chunksById.get(sourceChunkId) : null;
    if (!sourceChunkId || !chunk) {
      throw groundingError(SOURCE_GROUNDING_ERROR_MESSAGE, "INVALID_SOURCE_CHUNK", 1);
    }

    const topic = cleanString(question.studyRef?.topic) ?? cleanString(question.sourceTopic);
    const instruction =
      cleanString(question.studyRef?.instruction) ??
      cleanString(question.hint) ??
      (topic ? `Review ${topic} before answering.` : "Review the source chunk before answering.");
    const quote = cleanString(question.studyRef?.quote) ?? sourceSnippet(chunk.text);
    const page = cleanPage(question.studyRef?.page) ?? cleanPage(chunk.page_number);
    const studyRef: Record<string, string | number> = {
      chunkId: sourceChunkId,
      instruction,
      quote,
    };

    if (topic) studyRef.topic = topic;
    if (page) studyRef.page = page;

    return {
      ...question,
      studyRef,
      sourceChunkId,
      sourceTopic: topic ?? null,
      page: page ?? null,
    };
  });
}

export async function assertQuizSetQuestionsSourceBacked(quizSetId: string) {
  const { data, error } = await adminSupabase
    .from("study_quiz_questions")
    .select("id,source_material_id,source_chunk_id")
    .eq("set_id", quizSetId);

  if (error) {
    throw groundingError(error.message || "Could not verify question sources.", "PUBLISH_BLOCKED_UNGROUNDED");
  }

  const rows = (data ?? []) as Array<{
    id: string;
    source_material_id: string | null;
    source_chunk_id: string | null;
  }>;

  const invalidBase = rows.filter((row) => !row.source_material_id || !row.source_chunk_id).length;
  const pairs = rows
    .filter((row) => row.source_material_id && row.source_chunk_id)
    .map((row) => ({
      materialId: String(row.source_material_id),
      chunkId: String(row.source_chunk_id),
    }));

  const materialIds = [...new Set(pairs.map((pair) => pair.materialId))];
  let invalidRelation = 0;

  for (const materialId of materialIds) {
    const chunkIds = [
      ...new Set(
        pairs.filter((pair) => pair.materialId === materialId).map((pair) => pair.chunkId)
      ),
    ];
    const chunksById = await loadChunksById(materialId, chunkIds);
    invalidRelation += chunkIds.filter((chunkId) => !chunksById.has(chunkId)).length;
  }

  const invalidCount = invalidBase + invalidRelation;
  if (invalidCount > 0) {
    throw groundingError(
      `Cannot publish this question bank yet. ${invalidCount} question${invalidCount === 1 ? "" : "s"} need verified source chunks.`,
      "PUBLISH_BLOCKED_UNGROUNDED",
      invalidCount
    );
  }
}
