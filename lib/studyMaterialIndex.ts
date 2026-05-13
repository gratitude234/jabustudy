// Server-only material chunk indexer for guided study hints.

import "server-only";

import { createHash } from "node:crypto";
import path from "node:path";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  extractDocxText,
  extractPdfPageTexts,
  extractPptxSlideTexts,
  type PageTextContent,
} from "@/lib/extractMaterialContent";

const BUCKET = "study-materials";
const MAX_INDEX_BYTES = 20 * 1024 * 1024;
const MIN_TOTAL_TEXT_CHARS = 120;
const MIN_CHUNK_CHARS = 80;
const TARGET_CHUNK_CHARS = 1_300;

type IndexStatus = "ready" | "failed" | "skipped";

type StudyMaterialIndexRow = {
  id: string;
  file_path: string | null;
};

export type MaterialChunkIndexResult = {
  materialId: string;
  status: IndexStatus;
  chunks: number;
  error?: string;
};

function fileExt(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitOversizedParagraph(paragraph: string): string[] {
  if (paragraph.length <= TARGET_CHUNK_CHARS) return [paragraph];

  const sentences = paragraph.match(/[^.!?]+[.!?]+|\S.+$/g) ?? [paragraph];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length > TARGET_CHUNK_CHARS && current.length >= MIN_CHUNK_CHARS) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitIntoChunks(text: string): string[] {
  const normalized = cleanText(text);
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .flatMap((paragraph) => splitOversizedParagraph(paragraph.trim()))
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > TARGET_CHUNK_CHARS && current.length >= MIN_CHUNK_CHARS) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks.map(cleanText).filter((chunk) => chunk.length >= MIN_CHUNK_CHARS);
}

function hashChunk(pageNumber: number | null, text: string): string {
  return createHash("sha256").update(`${pageNumber ?? ""}:${text}`).digest("hex");
}

function buildChunkRows(materialId: string, pages: PageTextContent[]) {
  let chunkIndex = 0;
  return pages.flatMap((page) => {
    const chunks = splitIntoChunks(page.text);
    return chunks.map((text) => ({
      material_id: materialId,
      page_number: page.pageNumber,
      chunk_index: chunkIndex++,
      text,
      text_hash: hashChunk(page.pageNumber, text),
    }));
  });
}

async function markMaterial(materialId: string, status: IndexStatus | "indexing", error?: string) {
  await adminSupabase
    .from("study_materials")
    .update({
      index_status: status,
      indexed_at: status === "ready" ? new Date().toISOString() : null,
      index_error: error ?? null,
    })
    .eq("id", materialId);
}

async function fetchMaterialBytes(filePath: string): Promise<ArrayBuffer> {
  const { data: signed, error } = await adminSupabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 300);

  if (error || !signed?.signedUrl) {
    throw new Error("Could not create a signed download URL.");
  }

  const res = await fetch(signed.signedUrl, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) {
    throw new Error(`Could not download material file (HTTP ${res.status}).`);
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_INDEX_BYTES) {
    throw new Error("File is too large to index.");
  }

  return buffer;
}

async function extractPages(buffer: ArrayBuffer, filePath: string): Promise<PageTextContent[]> {
  const ext = fileExt(filePath);

  if (ext === ".pdf") {
    return extractPdfPageTexts(buffer);
  }

  if (ext === ".docx") {
    const text = await extractDocxText(buffer);
    return text ? [{ pageNumber: null, text }] : [];
  }

  if (ext === ".pptx") {
    return extractPptxSlideTexts(buffer);
  }

  throw new Error("Unsupported file type for indexing.");
}

export async function indexStudyMaterial(materialId: string): Promise<MaterialChunkIndexResult> {
  const { data: material, error: materialError } = await adminSupabase
    .from("study_materials")
    .select("id, file_path")
    .eq("id", materialId)
    .maybeSingle();

  if (materialError || !material) {
    return { materialId, status: "failed", chunks: 0, error: "Material not found." };
  }

  const row = material as StudyMaterialIndexRow;
  if (!row.file_path) {
    await markMaterial(materialId, "skipped", "No file attached to this material.");
    return { materialId, status: "skipped", chunks: 0, error: "No file attached to this material." };
  }

  const ext = fileExt(row.file_path);
  if (ext !== ".pdf" && ext !== ".docx" && ext !== ".pptx") {
    await adminSupabase.from("study_material_chunks").delete().eq("material_id", materialId);
    await markMaterial(materialId, "skipped", "This file type is not indexable yet.");
    return { materialId, status: "skipped", chunks: 0, error: "This file type is not indexable yet." };
  }

  await markMaterial(materialId, "indexing");

  try {
    const buffer = await fetchMaterialBytes(row.file_path);
    const pages = await extractPages(buffer, row.file_path);
    const totalChars = pages.reduce((sum, page) => sum + cleanText(page.text).length, 0);

    if (totalChars < MIN_TOTAL_TEXT_CHARS) {
      throw new Error("Not enough readable text was found in this material.");
    }

    const chunks = buildChunkRows(materialId, pages);
    if (chunks.length === 0) {
      throw new Error("No useful text chunks could be created.");
    }

    await adminSupabase.from("study_material_chunks").delete().eq("material_id", materialId);

    const { error: insertError } = await adminSupabase
      .from("study_material_chunks")
      .insert(chunks);

    if (insertError) {
      throw new Error(insertError.message);
    }

    await markMaterial(materialId, "ready");
    return { materialId, status: "ready", chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Material indexing failed.";
    console.error("[studyMaterialIndex] failed:", materialId, message);
    await markMaterial(materialId, "failed", message);
    return { materialId, status: "failed", chunks: 0, error: message };
  }
}
