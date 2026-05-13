import "server-only";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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

function messagesToPrompt(messages: AiChatMessage[]) {
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
}

function getSystemInstruction(messages: AiChatMessage[]) {
  const system = messages.find((message) => message.role === "system")?.content?.trim();
  return system ? { parts: [{ text: system }] } : undefined;
}

function getUserPrompt(messages: AiChatMessage[]) {
  const nonSystem = messages.filter((message) => message.role !== "system");
  return nonSystem.length ? messagesToPrompt(nonSystem) : messagesToPrompt(messages);
}

function getGenerateUrl(stream = false) {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`;
}

export function isGeminiConfigured() {
  return Boolean(getApiKey());
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
        contents: [{ parts: [{ text: getUserPrompt(config.messages) }] }],
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
  } catch (error: any) {
    if (error?.code) throw error;
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw Object.assign(new Error("Gemini request timed out."), { code: "timeout" });
    }
    throw Object.assign(new Error(error?.message ?? "Network error calling Gemini."), {
      code: "network",
      cause: error?.cause,
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
        contents: [{ parts: [{ text: getUserPrompt(config.messages) }] }],
        generationConfig: {
          temperature: config.temperature ?? 0.4,
          maxOutputTokens: config.maxTokens ?? 600,
        },
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 55_000),
    });
  } catch (error: any) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw Object.assign(new Error("Gemini stream request timed out."), { code: "timeout" });
    }
    throw Object.assign(new Error(error?.message ?? "Network error calling Gemini."), {
      code: "network",
      cause: error?.cause,
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
