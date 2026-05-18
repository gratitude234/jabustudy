import "server-only";

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
  ConverseStreamCommand,
  type ConverseStreamCommandOutput,
  type ContentBlock,
  type ConversationRole,
} from "@aws-sdk/client-bedrock-runtime";
import type { AiChatMessage, AiContentBlock, AiModelRole } from "./gemini";

const DEFAULT_GENERATION_MODEL = "anthropic.claude-sonnet-4-6";
const DEFAULT_FAST_MODEL = "anthropic.claude-haiku-4-5-20251001-v1:0";

export type BedrockTextConfig = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
  modelRole?: AiModelRole;
};

let client: BedrockRuntimeClient | null = null;

function getRegion() {
  return process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || "us-east-1";
}

function sonnet46InferenceProfileId(model: string) {
  const region = getRegion().toLowerCase();
  if (region.startsWith("eu-")) return `eu.${model}`;
  if (region === "ap-southeast-2" || region === "ap-southeast-4" || region === "ap-southeast-6") {
    return `au.${model}`;
  }
  if (region.startsWith("us-") || region.startsWith("ca-")) return `us.${model}`;
  return `global.${model}`;
}

function normalizeModelId(model: string) {
  if (model === DEFAULT_GENERATION_MODEL) return sonnet46InferenceProfileId(model);
  return model;
}

function getClient() {
  if (!client) {
    client = new BedrockRuntimeClient({ region: getRegion() });
  }
  return client;
}

export function bedrockModelName(modelRole: AiModelRole = "generation", explicitModel?: string) {
  if (explicitModel?.trim()) return normalizeModelId(explicitModel.trim());
  if (modelRole === "fast") {
    return normalizeModelId(process.env.BEDROCK_MODEL_FAST?.trim() || DEFAULT_FAST_MODEL);
  }
  return normalizeModelId(process.env.BEDROCK_MODEL_GENERATION?.trim() || DEFAULT_GENERATION_MODEL);
}

export function isBedrockConfigured() {
  const hasBearerToken = Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK?.trim());
  const hasAccessKeyPair = Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
    process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );

  return Boolean(
    getRegion() &&
    (hasBearerToken || hasAccessKeyPair)
  );
}

function sanitizeDocumentName(name: string | undefined, fallback: string) {
  const clean = (name ?? fallback)
    .replace(/[^a-zA-Z0-9\s\-()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return clean || fallback;
}

function bytesFromBase64(data: string) {
  return Uint8Array.from(Buffer.from(data, "base64"));
}

function documentFormat(mimeType: string): "pdf" | "docx" | "txt" | undefined {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mimeType === "text/plain") return "txt";
  return undefined;
}

function imageFormat(mimeType: string): "jpeg" | "png" | "webp" | "gif" | undefined {
  if (mimeType === "image/jpeg") return "jpeg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return undefined;
}

function blockToBedrock(block: AiContentBlock): ContentBlock {
  if (block.type === "text") return { text: block.text };

  const image = imageFormat(block.mimeType);
  if (image) {
    return {
      image: {
        format: image,
        source: { bytes: bytesFromBase64(block.data) },
      },
    };
  }

  const document = documentFormat(block.mimeType);
  if (document) {
    return {
      document: {
        format: document,
        name: sanitizeDocumentName(block.name, "study material"),
        source: { bytes: bytesFromBase64(block.data) },
      },
    };
  }

  return { text: `[Unsupported inline attachment: ${block.mimeType}]` };
}

function messageContent(content: AiChatMessage["content"]): ContentBlock[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map(blockToBedrock);
}

function toBedrockRole(role: AiChatMessage["role"]): ConversationRole {
  return role === "assistant" ? "assistant" : "user";
}

function getSystem(messages: AiChatMessage[]) {
  const system = messages.find((message) => message.role === "system");
  if (!system) return undefined;
  const text = typeof system.content === "string"
    ? system.content
    : system.content.map((block) => block.type === "text" ? block.text : "").filter(Boolean).join("\n\n");
  return text.trim() ? [{ text }] : undefined;
}

function getMessages(messages: AiChatMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: toBedrockRole(message.role),
      content: messageContent(message.content),
    }));
}

function timeoutSignal(timeoutMs: number | undefined) {
  return AbortSignal.timeout(timeoutMs ?? 60_000);
}

function errorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("$metadata" in error)) return undefined;
  const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
  return metadata?.httpStatusCode;
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : undefined;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function responseTextFrom(output: ConverseCommandOutput) {
  const content = output.output?.message?.content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => block?.text ?? "").join("").trim();
}

export async function bedrockText(config: BedrockTextConfig): Promise<{ text: string; model: string }> {
  const model = bedrockModelName(config.modelRole, config.model);
  const command = new ConverseCommand({
    modelId: model,
    system: getSystem(config.messages),
    messages: getMessages(config.messages),
    inferenceConfig: {
      maxTokens: config.maxTokens ?? 600,
      temperature: config.temperature ?? 0.4,
    },
  });

  try {
    const response = await getClient().send(command, { abortSignal: timeoutSignal(config.timeoutMs) });
    const text = responseTextFrom(response);
    if (!text) throw Object.assign(new Error("Bedrock returned an empty response."), { code: "empty" });
    return { text, model };
  } catch (error) {
    const status = errorStatus(error);
    if (errorName(error) === "AbortError" || errorName(error) === "TimeoutError") {
      throw Object.assign(new Error("Bedrock request timed out."), { code: "timeout" });
    }
    throw Object.assign(new Error(errorMessage(error, "Bedrock request failed.")), {
      code: status && status >= 500 ? "server" : "request",
      status,
      cause: error,
    });
  }
}

export async function bedrockStream(config: BedrockTextConfig): Promise<{ stream: ReadableStream<Uint8Array>; model: string }> {
  const model = bedrockModelName(config.modelRole, config.model);
  const command = new ConverseStreamCommand({
    modelId: model,
    system: getSystem(config.messages),
    messages: getMessages(config.messages),
    inferenceConfig: {
      maxTokens: config.maxTokens ?? 600,
      temperature: config.temperature ?? 0.4,
    },
  });

  let response: ConverseStreamCommandOutput;
  try {
    response = await getClient().send(command, { abortSignal: timeoutSignal(config.timeoutMs) });
  } catch (error) {
    const status = errorStatus(error);
    if (errorName(error) === "AbortError" || errorName(error) === "TimeoutError") {
      throw Object.assign(new Error("Bedrock stream request timed out."), { code: "timeout" });
    }
    throw Object.assign(new Error(errorMessage(error, "Bedrock stream request failed.")), {
      code: status && status >= 500 ? "server" : "request",
      status,
      cause: error,
    });
  }

  const source = response.stream;
  if (!source) throw Object.assign(new Error("Bedrock stream body is empty."), { code: "empty" });

  const encoder = new TextEncoder();
  return {
    model,
    stream: new ReadableStream({
      async start(controller) {
        try {
          for await (const item of source) {
            const text = item.contentBlockDelta?.delta?.text;
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    }),
  };
}
