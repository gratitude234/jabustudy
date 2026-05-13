import "server-only";

import {
  type AiChatMessage,
  geminiStream,
  geminiText,
  isGeminiConfigured,
} from "./gemini";

export type { AiChatMessage } from "./gemini";

export type AiRequestConfig = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type AiTextResult =
  | { ok: true; text: string; provider: "gemini" }
  | { ok: false; error: string; provider?: "gemini" };

export type AiJsonResult<T> =
  | { ok: true; data: T; provider: "gemini"; rawText: string }
  | { ok: false; error: string; provider?: "gemini"; rawText?: string };

export type AiStreamResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; provider: "gemini" }
  | { ok: false; error: string; provider?: "gemini" };

function errorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) return String((error as any).code);
  return "unknown";
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Unknown AI provider error.";
  const cause = (error as any).cause;
  const causeCode = cause?.code ? ` (${cause.code})` : "";
  const causeMessage = cause?.message ? `: ${cause.message}` : "";
  return `${error.message}${causeCode}${causeMessage}`;
}

function logGeminiFailure(operation: string, error: unknown) {
  console.warn(`[ai] gemini ${operation} failed (${errorCode(error)}): ${errorMessage(error).slice(0, 240)}`);
}

function isTransientGeminiError(error: unknown) {
  const code = errorCode(error);
  return code === "network" || code === "timeout" || code === "server";
}

function stripJsonFences(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function parseJsonText<T>(text: string): T {
  const clean = stripJsonFences(text);
  try {
    return JSON.parse(clean) as T;
  } catch {
    const objectStart = clean.indexOf("{");
    const objectEnd = clean.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(clean.slice(objectStart, objectEnd + 1)) as T;
    }

    const arrayStart = clean.indexOf("[");
    const arrayEnd = clean.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(clean.slice(arrayStart, arrayEnd + 1)) as T;
    }

    throw Object.assign(new Error("AI response was not valid JSON."), { code: "invalid_json" });
  }
}

export async function generateText(config: AiRequestConfig): Promise<AiTextResult> {
  if (!isGeminiConfigured()) {
    return { ok: false, error: "AI service is not configured." };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await geminiText(config);
      return { ok: true, text, provider: "gemini" };
    } catch (error) {
      logGeminiFailure("generateText", error);
      if (attempt === 0 && isTransientGeminiError(error)) continue;
      return { ok: false, error: errorMessage(error), provider: "gemini" };
    }
  }

  return { ok: false, error: "Gemini request failed.", provider: "gemini" };
}

export async function generateJson<T>(config: AiRequestConfig): Promise<AiJsonResult<T>> {
  if (!isGeminiConfigured()) {
    return { ok: false, error: "AI service is not configured." };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const rawText = await geminiText(config);
      return {
        ok: true,
        data: parseJsonText<T>(rawText),
        provider: "gemini",
        rawText,
      };
    } catch (error) {
      logGeminiFailure("generateJson", error);
      if (attempt === 0 && isTransientGeminiError(error)) continue;
      return { ok: false, error: errorMessage(error), provider: "gemini" };
    }
  }

  return { ok: false, error: "Gemini request failed.", provider: "gemini" };
}

export async function streamText(config: AiRequestConfig): Promise<AiStreamResult> {
  if (!isGeminiConfigured()) {
    return { ok: false, error: "AI service is not configured." };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const stream = await geminiStream(config);
      return { ok: true, stream, provider: "gemini" };
    } catch (error) {
      logGeminiFailure("streamText", error);
      if (attempt === 0 && isTransientGeminiError(error)) continue;
      return { ok: false, error: errorMessage(error), provider: "gemini" };
    }
  }

  return { ok: false, error: "Gemini request failed.", provider: "gemini" };
}

export function userMessage(content: string): AiChatMessage {
  return { role: "user", content };
}

export function systemMessage(content: string): AiChatMessage {
  return { role: "system", content };
}
