// app/api/study/materials/upload/route.ts
// Creates a pending material row + returns a signed upload token for Supabase Storage.
// Open to any authenticated student — uploads are queued as approved=false for rep/admin review.
//
// Migration: add upload_status to study_materials
// ALTER TABLE public.study_materials
//   ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'pending_upload'
//   CHECK (upload_status IN ('pending_upload', 'live', 'broken'));

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyRepsNewPendingMaterial } from "@/lib/studyNotify";

export const dynamic = "force-dynamic";

const BUCKET = "study-materials";

function jsonError(message: string, status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, message, ...(extra || {}) }, { status });
}

function safeFilename(name: string) {
  const raw = (name || "file").trim();
  // Keep it readable but safe for paths
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9._\- ()]/g, "")
    .trim()
    .slice(0, 120);

  // Avoid empty
  return cleaned || "file";
}

export async function POST(req: Request) {
  try {
    // Any logged-in student may upload — materials land in the approval queue (approved=false)
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData?.user) return jsonError("Unauthorized", 401, "NO_SESSION");
    const userId = userData.user.id;
    const uploader_email = (userData.user.email as string | undefined) ?? null;

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return jsonError("Invalid JSON", 400, "BAD_REQUEST");

    const course_id = typeof body.course_id === "string" ? body.course_id.trim() : "";
    if (!course_id) return jsonError("Missing course", 400, "MISSING_COURSE");

    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    if (!title) return jsonError("Missing title", 400, "MISSING_TITLE");

    const material_type = typeof body.material_type === "string" ? body.material_type.trim() : "other";
    const session = typeof body.session === "string" ? body.session.trim().slice(0, 40) : null;
    const past_question_year = typeof body.past_question_year === "number" ? body.past_question_year : null;
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : null;

    const file_name = typeof body.file_name === "string" ? body.file_name.trim() : "file";
    const mime_type = typeof body.mime_type === "string" ? body.mime_type.trim() : null;
    const file_size = typeof body.file_size === "number" ? body.file_size : null;
    const file_hash = typeof body.file_hash === "string" ? body.file_hash.trim() : null;

    // M-1: Server-side MIME type allowlist
    const ALLOWED_MIME_TYPES = new Set([
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]);

    if (mime_type && !ALLOWED_MIME_TYPES.has(mime_type)) {
      return jsonError(
        'File type not allowed. Accepted: PDF, images, Office documents.',
        400,
        'MIME_NOT_ALLOWED'
      );
    }

    // Server-side file size guard: reject anything over 50 MB
    const MAX_FILE_SIZE = 52_428_800; // 50 MB
    if (file_size !== null && file_size > MAX_FILE_SIZE) {
      return jsonError(`File too large (max 50 MB, got ${(file_size / 1_048_576).toFixed(1)} MB)`, 400, "FILE_TOO_LARGE");
    }

    const admin = createSupabaseAdminClient();

    // Resolve whether the uploader is an active rep/librarian.
    // Reps bypass the approval queue — their uploads are auto-approved.
    const { data: repRow } = await admin
      .from("study_reps")
      .select("user_id, role, department_id, faculty_id")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();

    const isRep = !!repRow;

    // Also honour study_admins as auto-approvers
    const { data: adminRow } = await admin
      .from("study_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    const autoApprove = process.env.STUDY_AUTO_APPROVE_UPLOADS === "true" || isRep || !!adminRow;

    // 1) Verify course exists
    const { data: courseRow, error: courseErr } = await admin
      .from("study_courses")
      .select("id, faculty_id, department_id, level, semester, course_code, faculty, department")
      .eq("id", course_id)
      .maybeSingle();

    if (courseErr) return jsonError(courseErr.message || "DB error", 500, "DB_ERROR");
    if (!courseRow?.id) return jsonError("Course not found", 404, "COURSE_NOT_FOUND");

    // 2) Duplicate check (authoritative)
    if (file_hash) {
      const { data: dup, error: dupErr } = await admin
        .from("study_materials")
        .select("id, title, created_at")
        .eq("file_hash", file_hash)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dupErr) return jsonError(dupErr.message || "DB error", 500, "DB_ERROR");
      if (dup?.id) {
        return jsonError(
          "Duplicate found",
          409,
          "DUPLICATE_FOUND",
          { duplicate_of: { id: dup.id, title: (dup as any)?.title ?? null, created_at: (dup as any)?.created_at ?? null } }
        );
      }
    }

    // 3) Create pending row (approved=false) with file_path that we will upload to.
    // We use the returned id as part of the path to guarantee uniqueness.

    const { data: inserted, error: insErr } = await admin
      .from("study_materials")
      .insert({
        course_id,
        title,
        session,
        approved: false,
        approved_by: null,
        approved_at: null,
        upload_status: "pending_upload",
        material_type,
        downloads: 0,
        file_hash: file_hash || null,
        uploader_id: userId,
        uploader_email: uploader_email,
        past_question_year: past_question_year || null,
        description: description || null,
        // denormalised course fields for direct filtering (C-1/C-2)
        course_code:   (courseRow as any)?.course_code   ?? null,
        department:    (courseRow as any)?.department    ?? null,
        faculty:       (courseRow as any)?.faculty       ?? null,
        level:         (courseRow as any)?.level != null
                         ? String((courseRow as any).level)
                         : null,
        semester:      (courseRow as any)?.semester      ?? null,
        faculty_id:    (courseRow as any)?.faculty_id    ?? null,
        department_id: (courseRow as any)?.department_id ?? null,
        // placeholders; updated below
        file_path: null,
        file_url: null,
      } as any)
      .select("id")
      .maybeSingle();

    if (insErr) {
      // If some optional columns don't exist on the user's DB, fall back to a minimal insert.
      const msg = (insErr.message || "").toLowerCase();
      const mightBeMissingColumns = msg.includes("column") && msg.includes("does not exist");
      if (!mightBeMissingColumns) return jsonError(insErr.message || "Insert failed", 500, "DB_ERROR");

      const { data: inserted2, error: insErr2 } = await admin
        .from("study_materials")
        .insert({
          course_id,
          title,
          session,
          approved: false,
          approved_by: null,
          approved_at: null,
          upload_status: "pending_upload",
          uploader_id: userId,
          uploader_email: uploader_email,
          material_type: material_type || null,
          downloads: 0,
          course_code:   (courseRow as any)?.course_code   ?? null,
          department:    (courseRow as any)?.department    ?? null,
          faculty:       (courseRow as any)?.faculty       ?? null,
          level:         (courseRow as any)?.level != null
                           ? String((courseRow as any).level)
                           : null,
          semester:      (courseRow as any)?.semester      ?? null,
          faculty_id:    (courseRow as any)?.faculty_id    ?? null,
          department_id: (courseRow as any)?.department_id ?? null,
        } as any)
        .select("id")
        .maybeSingle();

      if (insErr2) return jsonError(insErr2.message || "Insert failed", 500, "DB_ERROR");
      if (!inserted2?.id) return jsonError("Insert failed", 500, "DB_ERROR");
      console.error("Primary insert failed, used fallback:", insErr);

      // Continue with inserted2
      (inserted as any).id = inserted2.id;
    }

    const material_id = (inserted as any)?.id as string;
    if (!material_id) return jsonError("Insert failed", 500, "DB_ERROR");

    const dept = (courseRow as any)?.department_id ?? "dept";
    const code = String((courseRow as any)?.course_code ?? "COURSE").trim().replace(/[^A-Z0-9_-]/gi, "");

    const ext = (() => {
      const n = safeFilename(file_name);
      const idx = n.lastIndexOf(".");
      if (idx > 0 && idx < n.length - 1) return n.slice(idx);
      return mime_type?.includes("pdf") ? ".pdf" : "";
    })();

    const finalName = safeFilename(file_name).replace(/\.[^.]+$/, "") + ext;
    const file_path = `materials/${dept}/${code}/${material_id}-${finalName}`;

    // Update the material row with file_path (no public URL yet — the complete endpoint resolves this)
    const { error: updErr } = await admin
      .from("study_materials")
      .update(
        {
          file_path,
          mime_type: mime_type || null,
          file_size: file_size || null,
          updated_at: new Date().toISOString(),
        } as any
      )
      .eq("id", material_id);

    // If schema drift or permissions prevent updating optional columns, at least persist the essentials.
    if (updErr) {
      console.error("study_materials update failed:", updErr);
      await admin
        .from("study_materials")
        .update({ file_path, updated_at: new Date().toISOString() } as any)
        .eq("id", material_id);
    }

// 4) Create signed upload token
    const storageAny: any = admin.storage.from(BUCKET) as any;
    if (typeof storageAny.createSignedUploadUrl !== "function") {
      return jsonError(
        "Storage client missing createSignedUploadUrl(). Update @supabase/supabase-js.",
        500,
        "STORAGE_UNSUPPORTED"
      );
    }

    const { data: signed, error: signedErr } = await storageAny.createSignedUploadUrl(file_path);
    if (signedErr) return jsonError(signedErr.message || "Failed to sign upload", 500, "SIGN_UPLOAD_FAILED");

    const token = (signed as any)?.token as string | undefined;
    const signedPath = (signed as any)?.path as string | undefined;

    if (!token || !signedPath) {
      return jsonError("Signed upload response missing token/path", 500, "SIGN_UPLOAD_FAILED");
    }

    // For non-rep uploads: notify reps of the course's department so they
    // can review from the study-admin panel. Fire-and-forget — never blocks.
    if (!autoApprove && material_id) {
      notifyRepsNewPendingMaterial({
        materialId: material_id,
        title,
        courseCode: String((courseRow as any)?.course_code ?? ""),
        departmentId: (courseRow as any)?.department_id ?? null,
        uploaderEmail: uploader_email,
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      material_id,
      bucket: BUCKET,
      path: signedPath,
      token,
      auto_approved: autoApprove,
    });
  } catch (e: any) {
    const code = typeof e?.code === "string" ? e.code : undefined;
    const status = Number(e?.status) || 500;
    const msg = e?.message || "Error";

    if (code === "NO_SESSION") return jsonError("Unauthorized", 401, "NO_SESSION");
    return jsonError(msg, status, code || "SERVER_ERROR");
  }
}
