import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { triggerMaterialIndex } from "../../../../../lib/studyMaterialIndexTrigger";
import { sendUserPushIfAllowed } from "../../../../../lib/webPush";
import { notifyStudyAdminsNewMaterialUploaded } from "../../../../../lib/studyNotify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireStudyModeratorFromRequest(req);

    const body = (await req.json()) as { material_id: string };
    const { material_id } = body;
    if (!material_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "material_id required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: matRow, error: fetchErr } = await admin
      .from("study_materials")
      .select("file_path, title, course_code, uploader_id, uploader_email")
      .eq("id", material_id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!matRow) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Material not found" }, { status: 404 });
    }

    const filePath = (matRow as { file_path: string | null }).file_path;
    if (!filePath) {
      return NextResponse.json({ ok: false, code: "NO_FILE_PATH", message: "No file_path on record" }, { status: 400 });
    }

    const { data: urlData } = admin.storage.from("study-materials").getPublicUrl(filePath);
    const publicUrl = (urlData as { publicUrl: string }).publicUrl;

    const { error: updateErr } = await admin
      .from("study_materials")
      .update({ file_url: publicUrl, updated_at: new Date().toISOString(), verified: true })
      .eq("id", material_id);

    if (updateErr) throw updateErr;

    triggerMaterialIndex(material_id);

    // Fan-out new-material notification to students in dept/level/semester
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    fetch(`${baseUrl}/api/study/notify-new-material`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CRON_SECRET}` },
      body: JSON.stringify({ material_id }),
    }).catch(() => {});

    // Notify admins first, then confirm to the rep that their upload is live.
    try {
      const uploaderId = (matRow as any)?.uploader_id;
      const matTitle = (matRow as any)?.title;
      const courseCode = (matRow as any)?.course_code;
      const uploaderEmail = (matRow as any)?.uploader_email;
      if (matTitle) {
        notifyStudyAdminsNewMaterialUploaded({
          materialId: material_id,
          title: String(matTitle),
          courseCode: courseCode ?? null,
          uploaderEmail: uploaderEmail ?? null,
        }).catch(() => {});
      }
      if (matTitle && uploaderId) {
        const notifTitle = "Your material is now live ✅";
        const body = `"${matTitle}"${courseCode ? ` (${courseCode})` : ""} is available in the Study Hub.`;
        const href = `/study/materials/${material_id}`;
        await admin.from("notifications").insert({
          user_id: uploaderId,
          type: "material_approved",
          title: notifTitle,
          body,
          href,
          is_read: false,
        });
        void sendUserPushIfAllowed(uploaderId, { title: notifTitle, body, href, tag: `mat-live-${material_id}` }, 'materials');
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; code?: string; message?: string };
    const status = Number(err?.status) || 500;
    return NextResponse.json({ ok: false, code: err?.code, message: err?.message || "Error" }, { status });
  }
}
