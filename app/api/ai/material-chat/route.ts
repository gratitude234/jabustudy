// app/api/ai/material-chat/route.ts
// POST /api/ai/material-chat
// Streams a Gemini response grounded in a study material.
// Supports: PDF, JPG/PNG/WEBP images (uploaded to Gemini Files API, URI cached),
//           DOCX, PPTX (text extracted and injected as context).

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  extractMaterialContent,
  isGeminiInlineSupported,
  getMimeType,
  truncateText,
} from "@/lib/extractMaterialContent";

const FILE_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";

function geminiModelName() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
}

function geminiStreamUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName()}:streamGenerateContent?alt=sse`;
}

type HistoryEntry = { role: "user" | "model"; text: string };
type StudyMaterialRow = {
  id: string;
  title: string | null;
  file_url: string | null;
  file_path: string | null;
  gemini_file_uri: string | null;
};
type GeminiFileUploadResponse = {
  file?: { uri?: string | null } | null;
};
type GeminiPart =
  | { text: string }
  | { file_data: { mime_type: string; file_uri: string } };
type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};
type GeminiStreamChunk = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};
// Upload a file to the Gemini Files API and return its hosted URI.
// Used for PDF and images so the file is cached and reused across chat turns.
async function uploadFileToGemini(
  apiKey: string,
  buffer: ArrayBuffer,
  mimeType: string,
  displayName: string
): Promise<string> {
  const startRes = await fetch(`${FILE_UPLOAD_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(buffer.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!startRes.ok) {
    const errText = await startRes.text().catch(() => startRes.statusText);
    throw new Error(`Gemini upload init failed: ${errText}`);
  }

  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini upload URL missing.");

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(buffer.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: Buffer.from(buffer),
    signal: AbortSignal.timeout(60_000),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => uploadRes.statusText);
    throw new Error(`Gemini upload failed: ${errText}`);
  }

  const uploadData = (await uploadRes.json()) as GeminiFileUploadResponse;
  const fileUri = uploadData.file?.uri?.trim();
  if (!fileUri) throw new Error("Gemini file URI missing.");
  return fileUri;
}

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { materialId?: string; message?: string; history?: HistoryEntry[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { materialId, message, history = [] } = body;
  if (!materialId || !message?.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // ── Fetch material ─────────────────────────────────────────────────────────
  const admin = adminSupabase;
  const { data: mat, error: matErr } = await admin
    .from("study_materials")
    .select("id, title, file_url, file_path, gemini_file_uri")
    .eq("id", materialId)
    .maybeSingle();

  if (matErr || !mat) return NextResponse.json({ error: "Material not found." }, { status: 404 });

  const material = mat as StudyMaterialRow;
  const filePath = material.file_path;
  if (!filePath) return NextResponse.json({ error: "No file attached to this material." }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured." }, { status: 500 });

  // ── Resolve file content ───────────────────────────────────────────────────
  // For PDF/images: upload to Gemini Files API (or use cached URI) → file_data part
  // For DOCX/PPTX: extract text → inject as text context (no URI to cache)

  const useFilesApi = isGeminiInlineSupported(filePath);
  const systemInstruction = `You are a study assistant for Nigerian university students.
Answer questions strictly based on the provided document.
If the answer cannot be found in the document, say: "I couldn't find that in this material."
Keep answers concise and student-friendly.
Do not invent information outside the document.
Use plain text only — no asterisks, no markdown, no bold/italic symbols.
For lists, put each item on its own line with a dash prefix (e.g. "- item").`;

  let contents: GeminiContent[];

  if (useFilesApi) {
    // ── PDF / Image path: Gemini Files API ────────────────────────────────────
    let fileUri = material.gemini_file_uri?.trim() ?? "";

    if (!fileUri) {
      // Resolve download URL
      let downloadUrl: string | null = material.file_url ?? null;
      if (!downloadUrl) {
        const { data: signed } = await admin.storage
          .from("study-materials")
          .createSignedUrl(filePath, 300);
        downloadUrl = signed?.signedUrl ?? null;
      }
      if (!downloadUrl) return NextResponse.json({ error: "File URL not available." }, { status: 404 });

      // Fetch file bytes
      let fileBuffer: ArrayBuffer;
      try {
        const fetchRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
        if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
        fileBuffer = await fetchRes.arrayBuffer();
      } catch {
        return NextResponse.json({ error: "Failed to fetch file." }, { status: 502 });
      }

      // Upload to Gemini Files API
      try {
        const mimeType = getMimeType(filePath);
        fileUri = await uploadFileToGemini(
          apiKey,
          fileBuffer,
          mimeType,
          material.title ?? `material-${material.id}`
        );
      } catch (e: unknown) {
        console.error("[material-chat] Gemini file upload error:", e instanceof Error ? e.message : e);
        return NextResponse.json({ error: "Chat failed." }, { status: 500 });
      }

      // Cache URI for future turns
      const { error: updateError } = await admin
        .from("study_materials")
        .update({ gemini_file_uri: fileUri })
        .eq("id", material.id);
      if (updateError) {
        console.error("[material-chat] Failed to persist gemini_file_uri:", updateError.message);
      }
    }

    const mimeType = getMimeType(filePath);
    contents = [
      {
        role: "user",
        parts: [
          { text: "I'm sharing this document with you. Please use it to answer my questions." },
          { file_data: { mime_type: mimeType, file_uri: fileUri } },
        ],
      },
      {
        role: "model",
        parts: [{ text: "I've received the document. I'll answer your questions based on its contents." }],
      },
      ...history.map((entry) => ({ role: entry.role, parts: [{ text: entry.text }] })),
      { role: "user", parts: [{ text: message.trim() }] },
    ];
  } else {
    // ── DOCX / PPTX path: text extraction ─────────────────────────────────────
    let downloadUrl: string | null = material.file_url ?? null;
    if (!downloadUrl) {
      const { data: signed } = await admin.storage
        .from("study-materials")
        .createSignedUrl(filePath, 300);
      downloadUrl = signed?.signedUrl ?? null;
    }
    if (!downloadUrl) return NextResponse.json({ error: "File URL not available." }, { status: 404 });

    let fileBuffer: ArrayBuffer;
    try {
      const fetchRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
      if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
      fileBuffer = await fetchRes.arrayBuffer();
    } catch {
      return NextResponse.json({ error: "Failed to fetch file." }, { status: 502 });
    }

    const extracted = await extractMaterialContent(fileBuffer, filePath);
    if (extracted.kind === "unsupported") {
      return NextResponse.json({ error: extracted.message }, { status: 422 });
    }
    if (extracted.kind !== "text") {
      return NextResponse.json({ error: "Unexpected content kind." }, { status: 500 });
    }

    const docText = truncateText(extracted.text);
    contents = [
      {
        role: "user",
        parts: [
          {
            text: `I'm sharing this document with you. Please use it to answer my questions.\n\n--- DOCUMENT START ---\n${docText}\n--- DOCUMENT END ---`,
          },
        ],
      },
      {
        role: "model",
        parts: [{ text: "I've received the document content. I'll answer your questions based on it." }],
      },
      ...history.map((entry) => ({ role: entry.role, parts: [{ text: entry.text }] })),
      { role: "user", parts: [{ text: message.trim() }] },
    ];
  }

  // ── Call Gemini (streaming) ────────────────────────────────────────────────
  const geminiBody = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  };

  let geminiRes: Response;
  try {
    geminiRes = await fetch(`${geminiStreamUrl()}&key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e: unknown) {
    console.error("[material-chat] Gemini fetch error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Chat failed." }, { status: 500 });
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => geminiRes.statusText);
    console.error("[material-chat] Gemini error:", errText);
    return NextResponse.json({ error: "Chat failed." }, { status: 500 });
  }

  // ── Stream response back to client ────────────────────────────────────────
  const encoder = new TextEncoder();
  const geminiStream = geminiRes.body;

  const stream = new ReadableStream({
    async start(controller) {
      if (!geminiStream) { controller.close(); return; }

      const reader = geminiStream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const chunk = JSON.parse(json) as GeminiStreamChunk;
              const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // Ignore malformed chunks
            }
          }
        }
      } catch (e: unknown) {
        console.error("[material-chat] stream read error:", e instanceof Error ? e.message : e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
