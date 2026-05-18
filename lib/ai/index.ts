import "server-only";

import {
  type AiContentBlock,
  type AiChatMessage,
  type AiModelRole,
  geminiFallbackModelName,
  geminiModelName,
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

export type { AiChatMessage, AiContentBlock, AiModelRole } from "./gemini";

export type AiProvider = "bedrock" | "gemini";

export type AiRequestConfig = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  provider?: AiProvider;
  model?: string;
  modelRole?: AiModelRole;
  thinkingBudget?: number;
  responseMimeType?: "application/json";
};

export type AiTextResult =
  | {
      ok: true;
      text: string;
      provider: AiProvider;
      model: string;
      fallbackProvider?: AiProvider;
      fallbackReason?: string;
      modelFallbackFrom?: string;
      modelFallbackReason?: string;
    }
  | { ok: false; error: string; provider?: AiProvider; model?: string };

export type AiJsonResult<T> =
  | {
      ok: true;
      data: T;
      provider: AiProvider;
      model: string;
      rawText: string;
      fallbackProvider?: AiProvider;
      fallbackReason?: string;
      modelFallbackFrom?: string;
      modelFallbackReason?: string;
      repairedJson?: boolean;
      repairProvider?: AiProvider;
      repairModel?: string;
      originalProvider?: AiProvider;
      originalModel?: string;
    }
  | { ok: false; error: string; provider?: AiProvider; model?: string; rawText?: string };

export type AiStreamResult =
  | {
      ok: true;
      stream: ReadableStream<Uint8Array>;
      provider: AiProvider;
      model: string;
      fallbackProvider?: AiProvider;
      fallbackReason?: string;
      modelFallbackFrom?: string;
      modelFallbackReason?: string;
    }
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

function errorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function logAiFailure(provider: AiProvider, operation: string, error: unknown) {
  console.warn(`[ai] ${provider} ${operation} failed (${errorCode(error)}): ${errorMessage(error).slice(0, 500)}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientAiError(error: unknown) {
  const code = errorCode(error);
  const status = errorStatus(error);
  return code === "network" || code === "timeout" || code === "server" || status === 429 || status === 503;
}

function configured(provider: AiProvider) {
  if (provider === "bedrock" && !isBedrockEnabled()) return false;
  return provider === "bedrock" ? isBedrockConfigured() : isGeminiConfigured();
}

function isBedrockEnabled() {
  return process.env.AI_ENABLE_BEDROCK?.trim().toLowerCase() === "true";
}

function modelFor(provider: AiProvider, config: AiRequestConfig) {
  if (provider === "bedrock") return bedrockModelName(config.modelRole, config.model);
  return geminiModelName(config.modelRole, config.model);
}

function normalizeProvider(value: string | undefined): AiProvider | null {
  const clean = value?.trim().toLowerCase();
  return clean === "bedrock" || clean === "gemini" ? clean : null;
}

function primaryProvider(config: AiRequestConfig): AiProvider {
  const provider = config.provider ?? normalizeProvider(process.env.AI_PROVIDER) ?? "gemini";
  return provider === "bedrock" && !isBedrockEnabled() ? "gemini" : provider;
}

function fallbackProvider(primary: AiProvider): AiProvider | null {
  const fallback = normalizeProvider(process.env.AI_FALLBACK_PROVIDER);
  if (fallback === "bedrock" && !isBedrockEnabled()) return null;
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
  return geminiTextWithModelFallback(config);
}

async function callStreamProvider(provider: AiProvider, config: AiRequestConfig) {
  if (provider === "bedrock") return bedrockStream(config);
  return geminiStreamWithModelFallback(config);
}

async function geminiTextWithModelFallback(config: AiRequestConfig) {
  const primaryModel = geminiModelName(config.modelRole, config.model);
  try {
    return { text: await geminiText(config), model: primaryModel };
  } catch (error) {
    if (!isTransientAiError(error)) throw error;
    await sleep(1200);
    try {
      return { text: await geminiText(config), model: primaryModel };
    } catch (retryError) {
      if (!isTransientAiError(retryError)) throw retryError;
      const fallbackModel = geminiFallbackModelName(config.modelRole, primaryModel);
      if (!fallbackModel) throw retryError;
      console.warn("[ai] gemini model fallback activated", {
        operation: "text",
        fromModel: primaryModel,
        toModel: fallbackModel,
        reason: errorMessage(retryError).slice(0, 500),
      });
      return {
        text: await geminiText({ ...config, model: fallbackModel }),
        model: fallbackModel,
        modelFallbackFrom: primaryModel,
        modelFallbackReason: errorMessage(retryError),
      };
    }
  }
}

async function geminiStreamWithModelFallback(config: AiRequestConfig) {
  const primaryModel = geminiModelName(config.modelRole, config.model);
  try {
    return { stream: await geminiStream(config), model: primaryModel };
  } catch (error) {
    if (!isTransientAiError(error)) throw error;
    await sleep(1200);
    try {
      return { stream: await geminiStream(config), model: primaryModel };
    } catch (retryError) {
      if (!isTransientAiError(retryError)) throw retryError;
      const fallbackModel = geminiFallbackModelName(config.modelRole, primaryModel);
      if (!fallbackModel) throw retryError;
      console.warn("[ai] gemini model fallback activated", {
        operation: "stream",
        fromModel: primaryModel,
        toModel: fallbackModel,
        reason: errorMessage(retryError).slice(0, 500),
      });
      return {
        stream: await geminiStream({ ...config, model: fallbackModel }),
        model: fallbackModel,
        modelFallbackFrom: primaryModel,
        modelFallbackReason: errorMessage(retryError),
      };
    }
  }
}

async function withProviderFallback<T>(
  operation: string,
  config: AiRequestConfig,
  call: (provider: AiProvider) => Promise<T & { model: string; modelFallbackFrom?: string; modelFallbackReason?: string }>
): Promise<(T & {
  provider: AiProvider;
  model: string;
  fallbackProvider?: AiProvider;
  fallbackReason?: string;
  modelFallbackFrom?: string;
  modelFallbackReason?: string;
}) | { error: string; provider?: AiProvider; model?: string }> {
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

    const attempts = provider === "gemini" ? 1 : 2;
    for (let attempt = 0; attempt < attempts; attempt++) {
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

function jsonRepairPrompt(text: string) {
  const clipped = text.length > 80_000
    ? `${text.slice(0, 80_000)}\n\n[TRUNCATED]`
    : text;
  return `Repair the malformed JSON below.
Return ONLY valid JSON.
Do not add markdown, comments, explanations, or extra wrapper text.
Preserve the same data and structure as closely as possible.

Malformed JSON:
${clipped}`;
}

export async function generateText(config: AiRequestConfig): Promise<AiTextResult> {
  const result = await withProviderFallback("generateText", config, (provider) => callTextProvider(provider, config));
  if ("error" in result) {
    return { ok: false, error: result.error, provider: result.provider, model: result.model };
  }
  return {
    ok: true,
    text: result.text,
    provider: result.provider,
    model: result.model,
    fallbackProvider: result.fallbackProvider,
    fallbackReason: result.fallbackReason,
    modelFallbackFrom: result.modelFallbackFrom,
    modelFallbackReason: result.modelFallbackReason,
  };
}

export async function generateJson<T>(config: AiRequestConfig): Promise<AiJsonResult<T>> {
  const jsonConfig: AiRequestConfig = { ...config, responseMimeType: "application/json" };
  const result = await withProviderFallback("generateJson", jsonConfig, (provider) => callTextProvider(provider, jsonConfig));
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
      modelFallbackFrom: result.modelFallbackFrom,
      modelFallbackReason: result.modelFallbackReason,
      rawText: result.text,
    };
  } catch (error) {
    logAiFailure(result.provider, "parseJson", error);
    const repairConfig: AiRequestConfig = {
      ...jsonConfig,
      provider: "gemini",
      messages: [userMessage(jsonRepairPrompt(result.text))],
      temperature: 0,
      maxTokens: Math.max(jsonConfig.maxTokens ?? 600, 1000),
      modelRole: "fast",
      responseMimeType: "application/json",
    };
    const repaired = await withProviderFallback("repairJson", repairConfig, (provider) => callTextProvider(provider, repairConfig));
    if (!("error" in repaired)) {
      try {
        return {
          ok: true,
          data: parseJsonText<T>(repaired.text),
          provider: result.provider,
          model: result.model,
          fallbackProvider: repaired.fallbackProvider,
          fallbackReason: repaired.fallbackReason,
          modelFallbackFrom: result.modelFallbackFrom,
          modelFallbackReason: result.modelFallbackReason,
          rawText: repaired.text,
          repairedJson: true,
          repairProvider: repaired.provider,
          repairModel: repaired.model,
          originalProvider: result.provider,
          originalModel: result.model,
        };
      } catch (repairError) {
        logAiFailure(repaired.provider, "parseRepairedJson", repairError);
      }
    }

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
  return {
    ok: true,
    stream: result.stream,
    provider: result.provider,
    model: result.model,
    fallbackProvider: result.fallbackProvider,
    fallbackReason: result.fallbackReason,
    modelFallbackFrom: result.modelFallbackFrom,
    modelFallbackReason: result.modelFallbackReason,
  };
}

export function userMessage(content: string | AiContentBlock[]): AiChatMessage {
  return { role: "user", content };
}

export function systemMessage(content: string | AiContentBlock[]): AiChatMessage {
  return { role: "system", content };
}
