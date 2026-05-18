import "server-only";

import {
  type AiContentBlock,
  type AiChatMessage,
  geminiStream,
  geminiText,
  isGeminiConfigured,
} from "./gemini";
import {
  bedrockModelName,
  bedrockStream,
  bedrockText,
  isBedrockConfigured,
} from "./bedrock";

export type { AiChatMessage, AiContentBlock } from "./gemini";

export type AiProvider = "bedrock" | "gemini";

export type AiRequestConfig = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  provider?: AiProvider;
  model?: string;
  modelRole?: "generation" | "fast";
};

export type AiTextResult =
  | { ok: true; text: string; provider: AiProvider; model: string; fallbackProvider?: AiProvider; fallbackReason?: string }
  | { ok: false; error: string; provider?: AiProvider; model?: string };

export type AiJsonResult<T> =
  | { ok: true; data: T; provider: AiProvider; model: string; rawText: string; fallbackProvider?: AiProvider; fallbackReason?: string }
  | { ok: false; error: string; provider?: AiProvider; model?: string; rawText?: string };

export type AiStreamResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; provider: AiProvider; model: string; fallbackProvider?: AiProvider; fallbackReason?: string }
  | { ok: false; error: string; provider?: AiProvider; model?: string };

function errorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "unknown";
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Unknown AI provider error.";
  const cause = (error as Error & { cause?: { code?: unknown; message?: unknown } }).cause;
  const causeName = typeof cause === "object" && cause && "name" in cause
    ? (cause as { name?: unknown }).name
    : undefined;
  const causeCode = cause?.code ? ` (${cause.code})` : causeName ? ` (${causeName})` : "";
  const causeMessage = cause?.message ? `: ${cause.message}` : "";
  return `${error.message}${causeCode}${causeMessage}`;
}

function logAiFailure(provider: AiProvider, operation: string, error: unknown) {
  console.warn(`[ai] ${provider} ${operation} failed (${errorCode(error)}): ${errorMessage(error).slice(0, 500)}`);
}

function isTransientAiError(error: unknown) {
  const code = errorCode(error);
  return code === "network" || code === "timeout" || code === "server";
}

function configured(provider: AiProvider) {
  return provider === "bedrock" ? isBedrockConfigured() : isGeminiConfigured();
}

function modelFor(provider: AiProvider, config: AiRequestConfig) {
  if (provider === "bedrock") return bedrockModelName(config.modelRole, config.model);
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
}

function normalizeProvider(value: string | undefined): AiProvider | null {
  const clean = value?.trim().toLowerCase();
  return clean === "bedrock" || clean === "gemini" ? clean : null;
}

function primaryProvider(config: AiRequestConfig): AiProvider {
  return config.provider ?? normalizeProvider(process.env.AI_PROVIDER) ?? "bedrock";
}

function fallbackProvider(primary: AiProvider): AiProvider | null {
  const fallback = normalizeProvider(process.env.AI_FALLBACK_PROVIDER);
  if (fallback && fallback !== primary) return fallback;
  if (primary === "bedrock" && isGeminiConfigured()) return "gemini";
  return null;
}

function logAiFallback(params: {
  operation: string;
  fromProvider: AiProvider;
  toProvider: AiProvider;
  fromModel: string;
  toModel: string;
  reason: string;
}) {
  console.warn("[ai] fallback activated", params);
}

async function callTextProvider(provider: AiProvider, config: AiRequestConfig) {
  if (provider === "bedrock") return bedrockText(config);
  return { text: await geminiText(config), model: modelFor("gemini", config) };
}

async function callStreamProvider(provider: AiProvider, config: AiRequestConfig) {
  if (provider === "bedrock") return bedrockStream(config);
  return { stream: await geminiStream(config), model: modelFor("gemini", config) };
}

async function withProviderFallback<T>(
  operation: string,
  config: AiRequestConfig,
  call: (provider: AiProvider) => Promise<T & { model: string }>
): Promise<(T & { provider: AiProvider; model: string; fallbackProvider?: AiProvider; fallbackReason?: string }) | { error: string; provider?: AiProvider; model?: string }> {
  const primary = primaryProvider(config);
  const fallback = fallbackProvider(primary);
  const candidates = [primary, fallback].filter(Boolean) as AiProvider[];
  let lastError: unknown = null;
  let lastProvider: AiProvider | undefined;
  let sawConfiguredProvider = false;
  let primaryFailureReason: string | undefined;

  for (const provider of candidates) {
    lastProvider = provider;
    if (!configured(provider)) {
      lastError = Object.assign(new Error(`${provider} is not configured.`), { code: "not_configured" });
      if (provider === primary) {
        primaryFailureReason = "AI primary provider is not configured.";
        console.warn("[ai] primary provider skipped", {
          operation,
          provider,
          model: modelFor(provider, config),
          reason: primaryFailureReason,
        });
      }
      continue;
    }
    sawConfiguredProvider = true;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await call(provider);
        const usedFallback = provider !== primary;
        if (usedFallback) {
          const reason = primaryFailureReason ?? "Primary provider failed before fallback.";
          logAiFallback({
            operation,
            fromProvider: primary,
            toProvider: provider,
            fromModel: modelFor(primary, config),
            toModel: result.model,
            reason,
          });
        } else {
          console.info("[ai] provider success", {
            operation,
            provider,
            model: result.model,
          });
        }
        return {
          ...result,
          provider,
          fallbackProvider: usedFallback ? provider : undefined,
          fallbackReason: usedFallback ? primaryFailureReason : undefined,
        };
      } catch (error) {
        lastError = error;
        if (provider === primary) {
          primaryFailureReason = errorMessage(error);
        }
        logAiFailure(provider, operation, error);
        if (attempt === 0 && isTransientAiError(error)) continue;
        break;
      }
    }
  }

  return {
    error: sawConfiguredProvider && lastError ? errorMessage(lastError) : "AI service is not configured.",
    provider: lastProvider,
    model: lastProvider ? modelFor(lastProvider, config) : undefined,
  };
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
  const result = await withProviderFallback("generateText", config, (provider) => callTextProvider(provider, config));
  if ("error" in result) {
    return { ok: false, error: result.error, provider: result.provider, model: result.model };
  }
  return { ok: true, text: result.text, provider: result.provider, model: result.model, fallbackProvider: result.fallbackProvider, fallbackReason: result.fallbackReason };
}

export async function generateJson<T>(config: AiRequestConfig): Promise<AiJsonResult<T>> {
  const result = await withProviderFallback("generateJson", config, (provider) => callTextProvider(provider, config));
  if ("error" in result) {
    return { ok: false, error: result.error, provider: result.provider, model: result.model };
  }
  try {
    return {
      ok: true,
      data: parseJsonText<T>(result.text),
      provider: result.provider,
      model: result.model,
      fallbackProvider: result.fallbackProvider,
      fallbackReason: result.fallbackReason,
      rawText: result.text,
    };
  } catch (error) {
    logAiFailure(result.provider, "parseJson", error);
    return {
      ok: false,
      error: errorMessage(error),
      provider: result.provider,
      model: result.model,
      rawText: result.text,
    };
  }
}

export async function streamText(config: AiRequestConfig): Promise<AiStreamResult> {
  const result = await withProviderFallback("streamText", config, (provider) => callStreamProvider(provider, config));
  if ("error" in result) {
    return { ok: false, error: result.error, provider: result.provider, model: result.model };
  }
  return { ok: true, stream: result.stream, provider: result.provider, model: result.model, fallbackProvider: result.fallbackProvider, fallbackReason: result.fallbackReason };
}

export function userMessage(content: string | AiContentBlock[]): AiChatMessage {
  return { role: "user", content };
}

export function systemMessage(content: string | AiContentBlock[]): AiChatMessage {
  return { role: "system", content };
}
