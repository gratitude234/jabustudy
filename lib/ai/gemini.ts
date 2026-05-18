import "server-only";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export type AiTextBlock = { type: "text"; text: string };
export type AiInlineBlock = {
  type: "inline";
  mimeType: string;
  data: string;
  name?: string;
};
export type AiContentBlock = AiTextBlock | AiInlineBlock;

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | AiContentBlock[];
};

export type GeminiTextConfig = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

function getApiKey() {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
}

function contentToText(content: string | AiContentBlock[]) {
  if (typeof content === "string") return content;
  return content
    .map((block) => block.type === "text" ? block.text : `[${block.mimeType} attachment: ${block.name ?? "inline file"}]`)
    .join("\n\n");
}

function getSystemInstruction(messages: AiChatMessage[]) {
  const systemContent = messages.find((message) => message.role === "system")?.content;
  const system = systemContent ? contentToText(systemContent).trim() : "";
  return system ? { parts: [{ text: system }] } : undefined;
}

function blockToGeminiPart(block: AiContentBlock) {
  if (block.type === "text") return { text: block.text };
  return { inline_data: { mime_type: block.mimeType, data: block.data } };
}

function getGeminiParts(messages: AiChatMessage[]) {
  const nonSystem = messages.filter((message) => message.role !== "system");
  const source = nonSystem.length ? nonSystem : messages;
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];

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

function getGenerateUrl(stream = false) {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`;
}

export function isGeminiConfigured() {
  return Boolean(getApiKey());
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

export async function geminiText(config: GeminiTextConfig): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw Object.assign(new Error("GEMINI_API_KEY is not configured."), { code: "not_configured" });
  }

  try {
    const res = await fetch(`${getGenerateUrl(false)}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: getSystemInstruction(config.messages),
        contents: [{ parts: getGeminiParts(config.messages) }],
        generationConfig: {
          temperature: config.temperature ?? 0.4,
          maxOutputTokens: config.maxTokens ?? 600,
        },
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw Object.assign(new Error(`Gemini API error ${res.status}: ${err.slice(0, 240)}`), {
        code: res.status >= 500 ? "server" : "request",
        status: res.status,
      });
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text.trim()) throw Object.assign(new Error("Gemini returned an empty response."), { code: "empty" });
    return text.trim();
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

export async function geminiStream(config: GeminiTextConfig): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw Object.assign(new Error("GEMINI_API_KEY is not configured."), { code: "not_configured" });
  }

  let res: Response;
  try {
    res = await fetch(`${getGenerateUrl(true)}&key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: getSystemInstruction(config.messages),
        contents: [{ parts: getGeminiParts(config.messages) }],
        generationConfig: {
          temperature: config.temperature ?? 0.4,
          maxOutputTokens: config.maxTokens ?? 600,
        },
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 55_000),
    });
  } catch (error) {
    const name = unknownErrorName(error);
    if (name === "TimeoutError" || name === "AbortError") {
      throw Object.assign(new Error("Gemini stream request timed out."), { code: "timeout" });
    }
    throw Object.assign(new Error(unknownErrorMessage(error, "Network error calling Gemini.")), {
      code: "network",
      cause: unknownErrorCause(error),
    });
  }

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`Gemini API error ${res.status}: ${err.slice(0, 240)}`), {
      code: res.status >= 500 ? "server" : "request",
      status: res.status,
    });
  }

  const source = res.body;
  if (!source) throw Object.assign(new Error("Gemini stream body is empty."), { code: "empty" });

  const encoder = new TextEncoder();
  return new ReadableStream({
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
}
