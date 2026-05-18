// lib/extractMaterialContent.ts
// Server-side utility that turns uploaded study materials into text or inline
// file payloads for the configured AI provider. Supports PDF, images, DOCX, and PPTX.
// Never import this from a "use client" file.

import JSZip from "jszip";
import mammoth from "mammoth";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type InlineContent = {
  kind: "inline";
  mimeType: string;
  base64: string;
  reason?: string;
};

export type TextContent = {
  kind: "text";
  text: string;
};

export type UnsupportedContent = {
  kind: "unsupported";
  message: string;
};

export type MaterialContent = InlineContent | TextContent | UnsupportedContent;

export type PageTextContent = {
  pageNumber: number | null;
  text: string;
};

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const MIN_EXTRACTED_PDF_CHARS = 120;
let pdfWorkerConfigured = false;
type PDFParseConstructor = typeof import("pdf-parse").PDFParse;

async function ensurePdfCanvasPolyfills() {
  const target = globalThis as typeof globalThis & Record<string, unknown> & {
    DOMMatrix?: unknown;
    ImageData?: unknown;
    Path2D?: unknown;
  };

  if (target.DOMMatrix && target.ImageData && target.Path2D) return;

  try {
    const runtimeRequire = new Function("moduleName", "return require(moduleName)") as (moduleName: string) => any;
    const canvas = runtimeRequire("@napi-rs/canvas");
    target.DOMMatrix ??= canvas.DOMMatrix;
    target.ImageData ??= canvas.ImageData;
    target.Path2D ??= canvas.Path2D;
  } catch {
    // pdfjs will surface a clearer runtime warning/error if these are required.
  }
}

function shouldExtractPdfText(): boolean {
  const explicitEnable = process.env.ENABLE_PDF_TEXT_EXTRACTION?.trim().toLowerCase();
  if (explicitEnable === "true") return true;

  const explicitDisable = process.env.DISABLE_PDF_TEXT_EXTRACTION?.trim().toLowerCase();
  if (explicitDisable === "true") return false;

  // Vercel's Node runtime can miss native canvas polyfills required by pdfjs.
  // In that case, send the PDF directly to the AI provider unless extraction
  // has been explicitly enabled.
  if (process.env.VERCEL === "1") return false;

  // Prefer extracted text locally whenever a PDF has selectable text. If
  // pdf-parse fails in a runtime, the AI provider can read the PDF directly.
  return true;
}

function getExt(filePath: string): string {
  const p = (filePath ?? "").toLowerCase();
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.slice(i) : "";
}

export function getMimeType(filePath: string): string {
  const ext = getExt(filePath);
  if (ext === ".pdf") return "application/pdf";
  if (IMAGE_MIME[ext]) return IMAGE_MIME[ext];
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

export function isGeminiInlineSupported(filePath: string): boolean {
  const ext = getExt(filePath);
  return ext === ".pdf" || !!IMAGE_MIME[ext];
}

async function loadPdfParse(): Promise<PDFParseConstructor> {
  await ensurePdfCanvasPolyfills();
  const mod = await import("pdf-parse");
  return mod.PDFParse;
}

function configurePdfWorker(PDFParse: PDFParseConstructor) {
  if (pdfWorkerConfigured) return;

  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdf-parse",
    "dist",
    "pdf-parse",
    "esm",
    "pdf.worker.mjs"
  );

  PDFParse.setWorker(pathToFileURL(workerPath).href);
  pdfWorkerConfigured = true;
}

function normalizeExtractedText(text: string): string {
  return text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  const warnings = result.messages.filter((m) => m.type === "warning");
  if (warnings.length) {
    console.warn("[extractDocxText] mammoth warnings:", warnings.map((w) => w.message).join("; "));
  }
  return result.value.trim();
}

export async function extractPdfPageTexts(buffer: ArrayBuffer): Promise<PageTextContent[]> {
  const PDFParse = await loadPdfParse();
  configurePdfWorker(PDFParse);

  const parser = new PDFParse({
    data: Buffer.from(buffer),
    disableFontFace: true,
    useWorkerFetch: false,
  });

  try {
    const result = await parser.getText();
    const pages = Array.isArray(result.pages) ? result.pages : [];
    if (pages.length > 0) {
      return pages
        .map((page) => ({
          pageNumber: typeof page.num === "number" ? page.num : null,
          text: normalizeExtractedText(page.text ?? ""),
        }))
        .filter((page) => page.text.length > 0);
    }

    const text = normalizeExtractedText(result.text ?? "");
    return text ? [{ pageNumber: null, text }] : [];
  } finally {
    await parser.destroy();
  }
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pages = await extractPdfPageTexts(buffer);
  return pages.map((page) => page.text).join("\n\n").trim();
}

export async function extractPptxSlideTexts(buffer: ArrayBuffer): Promise<PageTextContent[]> {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
      return na - nb;
    });

  const slideTexts: PageTextContent[] = [];

  for (const slideName of slideFiles) {
    const xml = await zip.files[slideName].async("string");

    const texts = Array.from(xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g))
      .map((m) =>
        m[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim()
      )
      .filter(Boolean);

    if (texts.length) {
      const slideNum = slideFiles.indexOf(slideName) + 1;
      slideTexts.push({
        pageNumber: slideNum,
        text: normalizeExtractedText(texts.join(" ")),
      });
    }
  }

  return slideTexts;
}

async function extractPptxText(buffer: ArrayBuffer): Promise<string> {
  const slides = await extractPptxSlideTexts(buffer);
  return slides.map((slide) => `[Slide ${slide.pageNumber ?? "?"}]\n${slide.text}`).join("\n\n");
}

/**
 * Extracts content from a study material buffer for AI generation.
 *
 * - Text PDFs    -> selectable text extracted before sending to Gemini
 * - PDFs on Vercel/scanned PDFs -> inline file payload for the AI provider
 * - Images       -> inline file payload for Gemini
 * - DOCX         -> text extracted with mammoth
 * - PPTX         -> slide text extracted from DrawingML XML via jszip
 */
export async function extractMaterialContent(
  buffer: ArrayBuffer,
  filePath: string
): Promise<MaterialContent> {
  const ext = getExt(filePath);

  if (ext === ".pdf") {
    if (shouldExtractPdfText()) {
      try {
        const text = await extractPdfText(buffer);
        if (text.length >= MIN_EXTRACTED_PDF_CHARS) {
          return { kind: "text", text };
        }
      } catch (e: any) {
        console.warn("[extractMaterialContent] PDF text extraction failed; falling back to inline file:", e?.message);
        return {
          kind: "inline",
          mimeType: "application/pdf",
          base64: Buffer.from(buffer).toString("base64"),
          reason: "The AI provider read the PDF directly.",
        };
      }
    } else {
      console.info("[extractMaterialContent] PDF text extraction disabled by env; using inline file fallback.");
      return {
        kind: "inline",
        mimeType: "application/pdf",
        base64: Buffer.from(buffer).toString("base64"),
        reason: "The AI provider read the PDF directly.",
      };
    }

    return {
      kind: "inline",
      mimeType: "application/pdf",
      base64: Buffer.from(buffer).toString("base64"),
      reason: "The AI provider read the PDF directly.",
    };
  }

  if (IMAGE_MIME[ext]) {
    return {
      kind: "inline",
      mimeType: IMAGE_MIME[ext],
      base64: Buffer.from(buffer).toString("base64"),
      reason: "Images are read directly by Gemini.",
    };
  }

  if (ext === ".docx") {
    try {
      const text = await extractDocxText(buffer);
      if (!text) {
        return { kind: "unsupported", message: "The DOCX file appears to be empty or has no readable text." };
      }
      return { kind: "text", text };
    } catch (e: any) {
      console.error("[extractMaterialContent] DOCX error:", e?.message);
      return { kind: "unsupported", message: "Could not read the DOCX file." };
    }
  }

  if (ext === ".pptx") {
    try {
      const text = await extractPptxText(buffer);
      if (!text) {
        return { kind: "unsupported", message: "The PPTX file appears to be empty or has no readable text." };
      }
      return { kind: "text", text };
    } catch (e: any) {
      console.error("[extractMaterialContent] PPTX error:", e?.message);
      return { kind: "unsupported", message: "Could not read the PPTX file." };
    }
  }

  return {
    kind: "unsupported",
    message: `File type "${ext || "unknown"}" is not supported for AI features. Upload a PDF, image, DOCX, or PPTX.`,
  };
}

// Max characters of extracted text we send to AI providers to stay within token limits.
// Roughly 60,000 chars is about 15,000 tokens.
export const MAX_TEXT_CHARS = 60_000;

export function truncateText(text: string, maxChars = MAX_TEXT_CHARS): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[Document truncated - showing first portion only]";
}
