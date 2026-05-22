import "server-only";

const DEFAULT_GENERATION_MODEL = "gemini-2.5-flash";
const DEFAULT_DOCUMENT_MODEL = "gemini-2.5-flash";
const DEFAULT_FAST_MODEL = "gemini-2.5-flash-lite";

export type AiModelRole = "generation" | "fast" | "document";

export type AiTextBlock = { type: "text"; text: string };
export type AiInlineBlock = {
  type: "inline";
  mimeType: string;
  data: string;
  name?: string;
};
export type AiFileBlock = {
  type: "file";
  mimeType: string;
  fileUri: string;
};
export type AiContentBlock = AiTextBlock | AiInlineBlock | AiFileBlock;

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | AiContentBlock[];
};

export type GeminiTextConfig = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
  modelRole?: AiModelRole;
  thinkingBudget?: number;
  responseMimeType?: "application/json";
};

export type GeminiKeyLease = {
  apiKey: string;
  alias: string;
};

type GeminiKeyedResult<T> = {
  value: T;
  keyAlias: string;
};

function configuredGeminiKeys(): GeminiKeyLease[] {
  const multi = (process.env.GEMINI_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const single = process.env.GEMINI_API_KEY?.trim();
  const source = multi.length > 0 ? multi : single ? [single] : [];
  const seen = new Set<string>();
  const keys: GeminiKeyLease[] = [];

  for (const apiKey of source) {
    if (seen.has(apiKey)) continue;
    seen.add(apiKey);
    keys.push({ apiKey, alias: `gemini-key-${keys.length + 1}` });
  }

  return keys;
}

const exhaustedGeminiKeys = new Map<string, number>();
let nextGeminiKeyIndex = 0;

function geminiKeyQuotaCooldownMs() {
  const parsed = Number.parseInt(process.env.GEMINI_KEY_QUOTA_COOLDOWN_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 1000;
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function isQuotaError(error: unknown) {
  return errorStatus(error) === 429;
}

function isInvalidKeyError(error: unknown) {
  const status = errorStatus(error);
  if (status !== 400 && status !== 401 && status !== 403) return false;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("api key") ||
    message.includes("apikey") ||
    message.includes("api_key") ||
    message.includes("permission") ||
    message.includes("credential");
}

function shouldTryAnotherGeminiKey(error: unknown) {
  return isQuotaError(error) || isInvalidKeyError(error);
}

function markGeminiKeyExhausted(alias: string) {
  exhaustedGeminiKeys.set(alias, Date.now() + geminiKeyQuotaCooldownMs());
}

function isGeminiKeyAvailable(alias: string) {
  const exhaustedUntil = exhaustedGeminiKeys.get(alias);
  if (!exhaustedUntil) return true;
  if (Date.now() < exhaustedUntil) return false;
  exhaustedGeminiKeys.delete(alias);
  return true;
}

function nextAvailableGeminiKey(tried: Set<string>) {
  const keys = configuredGeminiKeys();
  if (keys.length === 0) return null;

  for (let offset = 0; offset < keys.length; offset++) {
    const index = (nextGeminiKeyIndex + offset) % keys.length;
    const key = keys[index];
    if (tried.has(key.alias) || !isGeminiKeyAvailable(key.alias)) continue;
    nextGeminiKeyIndex = (index + 1) % keys.length;
    return key;
  }

  return null;
}

export function geminiErrorKeyAlias(error: unknown) {
  if (!error || typeof error !== "object" || !("geminiKeyAlias" in error)) return undefined;
  const alias = (error as { geminiKeyAlias?: unknown }).geminiKeyAlias;
  return typeof alias === "string" ? alias : undefined;
}

function withGeminiKeyAlias(error: unknown, alias: string) {
  if (error && typeof error === "object" && !("geminiKeyAlias" in error)) {
    (error as { geminiKeyAlias?: string }).geminiKeyAlias = alias;
  }
  return error;
}

function geminiHttpError(status: number, body: string, keyAlias: string) {
  return Object.assign(new Error(`Gemini API error ${status}: ${body.slice(0, 240)}`), {
    code: status === 429 ? "quota" : status >= 500 ? "server" : "request",
    status,
    geminiKeyAlias: keyAlias,
  });
}

function geminiKeysExhaustedError(lastError: unknown) {
  return Object.assign(new Error("All Gemini API keys are temporarily exhausted or unavailable."), {
    code: "quota_exhausted",
    status: 429,
    cause: lastError,
  });
}

export async function withGeminiKeyFailover<T>(
  operation: string,
  call: (key: GeminiKeyLease) => Promise<T>
): Promise<GeminiKeyedResult<T>> {
  const keyCount = configuredGeminiKeys().length;
  if (keyCount === 0) {
    throw Object.assign(new Error("GEMINI_API_KEYS or GEMINI_API_KEY is not configured."), { code: "not_configured" });
  }

  const tried = new Set<string>();
  let lastError: unknown = null;

  while (tried.size < keyCount) {
    const key = nextAvailableGeminiKey(tried);
    if (!key) break;
    tried.add(key.alias);

    try {
      const value = await call(key);
      return { value, keyAlias: key.alias };
    } catch (error) {
      lastError = withGeminiKeyAlias(error, key.alias);
      if (!shouldTryAnotherGeminiKey(error)) throw lastError;

      markGeminiKeyExhausted(key.alias);
      console.warn("[ai] gemini key unavailable", {
        operation,
        keyAlias: key.alias,
        reason: isQuotaError(error) ? "quota" : "invalid_key",
        cooldownMs: geminiKeyQuotaCooldownMs(),
      });
    }
  }

  throw geminiKeysExhaustedError(lastError);
}

function contentToText(content: string | AiContentBlock[]) {
  if (typeof content === "string") return content;
  return content
    .map((block) => block.type === "text" ? block.text : block.type === "file" ? `[${block.mimeType} file]` : `[${block.mimeType} attachment: ${block.name ?? "inline file"}]`)
    .join("\n\n");
}

function getSystemInstruction(messages: AiChatMessage[]) {
  const systemContent = messages.find((message) => message.role === "system")?.content;
  const system = systemContent ? contentToText(systemContent).trim() : "";
  return system ? { parts: [{ text: system }] } : undefined;
}

function blockToGeminiPart(block: AiContentBlock) {
  if (block.type === "text") return { text: block.text };
  if (block.type === "file") return { file_data: { mime_type: block.mimeType, file_uri: block.fileUri } };
  return { inline_data: { mime_type: block.mimeType, data: block.data } };
}

function getGeminiParts(messages: AiChatMessage[]) {
  const nonSystem = messages.filter((message) => message.role !== "system");
  const source = nonSystem.length ? nonSystem : messages;
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } } | { file_data: { mime_type: string; file_uri: string } }> = [];

  for (const message of source) {
    parts.push({ text: `${message.role.toUpperCase()}:` });
    if (typeof message.content === "string") {
      parts.push({ text: message.content });
    } else {
      parts.push(...message.content.map(blockToGeminiPart));
    }
  }

  return parts;
}

export function geminiModelName(modelRole: AiModelRole = "generation", explicitModel?: string) {
  if (explicitModel?.trim()) return explicitModel.trim();
  if (modelRole === "fast") {
    return process.env.GEMINI_MODEL_FAST?.trim() ||
      process.env.GEMINI_MODEL?.trim() ||
      DEFAULT_FAST_MODEL;
  }
  if (modelRole === "document") {
    return process.env.GEMINI_MODEL_DOCUMENT?.trim() ||
      process.env.GEMINI_MODEL_GENERATION?.trim() ||
      process.env.GEMINI_MODEL?.trim() ||
      DEFAULT_DOCUMENT_MODEL;
  }
  return process.env.GEMINI_MODEL_GENERATION?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GENERATION_MODEL;
}

export function geminiFallbackModelName(modelRole: AiModelRole = "generation", primaryModel?: string) {
  const fallback = modelRole === "fast"
    ? process.env.GEMINI_MODEL_FAST_FALLBACK?.trim() || DEFAULT_FAST_MODEL
    : modelRole === "document"
      ? process.env.GEMINI_MODEL_DOCUMENT_FALLBACK?.trim() || DEFAULT_FAST_MODEL
      : process.env.GEMINI_MODEL_GENERATION_FALLBACK?.trim() || DEFAULT_FAST_MODEL;

  if (!fallback || fallback === primaryModel) return undefined;
  return fallback;
}

function geminiThinkingBudget(modelRole: AiModelRole = "generation", explicitBudget?: number) {
  if (typeof explicitBudget === "number" && Number.isFinite(explicitBudget)) {
    return Math.max(0, Math.floor(explicitBudget));
  }
  return modelRole === "fast" ? 0 : 1024;
}

function generationConfig(config: GeminiTextConfig) {
  const base: {
    temperature: number;
    maxOutputTokens: number;
    thinkingConfig: { thinkingBudget: number };
    responseMimeType?: "application/json";
  } = {
    temperature: config.temperature ?? 0.4,
    maxOutputTokens: config.maxTokens ?? 600,
    thinkingConfig: {
      thinkingBudget: geminiThinkingBudget(config.modelRole, config.thinkingBudget),
    },
  };
  if (config.responseMimeType) base.responseMimeType = config.responseMimeType;
  return base;
}

function getGenerateUrl(config: GeminiTextConfig, stream = false) {
  const model = geminiModelName(config.modelRole, config.model);
  const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`;
}

export function isGeminiConfigured() {
  return configuredGeminiKeys().length > 0;
}

function unknownErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: unknown }).code;
  }
  return undefined;
}

function unknownErrorName(error: unknown) {
  return error instanceof Error ? error.name : undefined;
}

function unknownErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function unknownErrorCause(error: unknown) {
  return error instanceof Error ? error.cause : undefined;
}

export async function geminiText(config: GeminiTextConfig): Promise<{ text: string; keyAlias: string }> {
  try {
    const result = await withGeminiKeyFailover("text", async (key) => {
      const res = await fetch(`${getGenerateUrl(config, false)}?key=${key.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: getSystemInstruction(config.messages),
          contents: [{ parts: getGeminiParts(config.messages) }],
          generationConfig: generationConfig(config),
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw geminiHttpError(res.status, err, key.alias);
      }

      const data = await res.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text.trim()) throw Object.assign(new Error("Gemini returned an empty response."), { code: "empty" });
      return text.trim();
    });
    return { text: result.value, keyAlias: result.keyAlias };
  } catch (error) {
    if (unknownErrorCode(error)) throw error;
    const name = unknownErrorName(error);
    if (name === "TimeoutError" || name === "AbortError") {
      throw Object.assign(new Error("Gemini request timed out."), { code: "timeout" });
    }
    throw Object.assign(new Error(unknownErrorMessage(error, "Network error calling Gemini.")), {
      code: "network",
      cause: unknownErrorCause(error),
    });
  }
}

export async function geminiStream(config: GeminiTextConfig): Promise<{ stream: ReadableStream<Uint8Array>; keyAlias: string }> {
  let keyedResponse: GeminiKeyedResult<Response>;
  try {
    keyedResponse = await withGeminiKeyFailover("stream", async (key) => {
      const res = await fetch(`${getGenerateUrl(config, true)}&key=${key.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: getSystemInstruction(config.messages),
          contents: [{ parts: getGeminiParts(config.messages) }],
          generationConfig: generationConfig(config),
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 55_000),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw geminiHttpError(res.status, err, key.alias);
      }

      return res;
    });
  } catch (error) {
    if (unknownErrorCode(error)) throw error;
    const name = unknownErrorName(error);
    if (name === "TimeoutError" || name === "AbortError") {
      throw Object.assign(new Error("Gemini stream request timed out."), { code: "timeout" });
    }
    throw Object.assign(new Error(unknownErrorMessage(error, "Network error calling Gemini.")), {
      code: "network",
      cause: unknownErrorCause(error),
    });
  }

  const source = keyedResponse.value.body;
  if (!source) throw Object.assign(new Error("Gemini stream body is empty."), { code: "empty" });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = source.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function processLine(line: string) {
        if (!line.startsWith("data: ")) return;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") return;
        try {
          const chunk = JSON.parse(jsonStr);
          const text: string = chunk?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        } catch {
          // Skip malformed SSE lines.
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) processLine(line.trimEnd());
        }
        if (buffer.trim()) processLine(buffer.trimEnd());
      } finally {
        controller.close();
      }
    },
  });
  return { stream, keyAlias: keyedResponse.keyAlias };
}
