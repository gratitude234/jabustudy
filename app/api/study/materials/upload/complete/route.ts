// app/api/study/materials/upload/complete/route.ts
// Marks an uploaded material as "upload completed" after the client successfully uploads to Supabase Storage.
// Hardened: verifies the object exists in Storage and flags broken uploads for moderators (without losing file_path).
//
// Migration: add upload_status to study_materials
// ALTER TABLE public.study_materials
//   ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'pending_upload'
//   CHECK (upload_status IN ('pending_upload', 'live', 'broken'));

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { triggerMaterialIndex } from "@/lib/studyMaterialIndexTrigger";

export const dynamic = "force-dynamic";

const BUCKET = "study-materials";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

async function resolveUserId(req: Request): Promise<string | null> {
  // Prefer cookie-based auth
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (uid) return uid;
  } catch {
    // ignore and try bearer
  }

  // Fallback: bearer token
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data?.user?.id ?? null;
}

function splitPath(file_path: string) {
  const parts = (file_path || "").split("/").filter(Boolean);
  const name = parts.pop() || "";
  const dir = parts.join("/");
  return { dir, name };
}

async function objectExists(admin: any, file_path: string): Promise<boolean> {
  if (!file_path) return false;

  const { dir, name } = splitPath(file_path);

  // list() is much lighter than download() — no data transfer, just metadata
  // Retry a couple of times for eventual consistency
  for (let i = 0; i < 3; i++) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(dir, { search: name, limit: 5 });
    if (!error && Array.isArray(data) && data.some((f: any) => f.name === name)) return true;
    if (i < 2) await new Promise((r) => setTimeout(r, 400));
  }

  return false;
}


export async function POST(req: Request) {
  try {
    const uid = await resolveUserId(req);
    if (!uid) return jsonError("Unauthorized", 401, "NO_SESSION");

    const body = (await req.json().catch(() => null)) as any;
    const material_id = typeof body?.material_id === "string" ? body.material_id.trim() : "";
    if (!material_id) return jsonError("Missing material_id", 400, "MISSING_ID");

    const admin = createSupabaseAdminClient();

    // Ensure the caller is the uploader
    const { data: row, error: rowErr } = await admin
      .from("study_materials")
      .select("id, uploader_id, file_path, description")
      .eq("id", material_id)
      .maybeSingle();

    if (rowErr) return jsonError(rowErr.message || "DB error", 500, "DB_ERROR");
    if (!row?.id) return jsonError("Not found", 404, "NOT_FOUND");

    const uploaderId = (row as any).uploader_id as string | null;
    if (uploaderId && uploaderId !== uid) return jsonError("Forbidden", 403, "FORBIDDEN");

    const file_path = (row as any).file_path as string | null;

    const exists = file_path ? await objectExists(admin as any, file_path) : false;
    const nowIso = new Date().toISOString();

    const patch: any = { updated_at: nowIso };
    let autoApprove = false;

    if (exists) {
      const { data: repRow } = await admin
        .from("study_reps")
        .select("user_id")
        .eq("user_id", uid)
        .eq("active", true)
        .maybeSingle();
      const { data: adminRow } = await admin
        .from("study_admins")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();
      autoApprove = process.env.STUDY_AUTO_APPROVE_UPLOADS === "true" || Boolean(repRow || adminRow);
      patch.upload_status = "live";
      patch.approved = autoApprove;
      patch.approved_by = autoApprove ? uid : null;
      patch.approved_at = autoApprove ? nowIso : null;
      patch.file_url = null;
    } else {
      const prior = (row as any).description as string | null;
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const note = `[BROKEN_UPLOAD ${stamp}] Client reported completion but file not found in storage.`;
      patch.description = prior ? `${prior}\n\n${note}` : note;
      patch.upload_status = "broken";
      patch.approved = false;
      patch.approved_by = null;
      patch.approved_at = null;
      patch.file_url = null;
      // keep file_path intact so moderators can re-check storage later
    }

    const { error: updErr } = await admin.from("study_materials").update(patch).eq("id", material_id);
    if (updErr) return jsonError(updErr.message || "Update failed", 500, "DB_ERROR");

    if (exists && autoApprove) {
      triggerMaterialIndex(material_id);
    }

    return NextResponse.json({ ok: true, verified_in_storage: exists });
  } catch (e: any) {
    return jsonError(e?.message || "Error", 500, "SERVER_ERROR");
  }
}
