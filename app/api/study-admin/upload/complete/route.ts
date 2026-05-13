import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { triggerMaterialIndex } from "../../../../../lib/studyMaterialIndexTrigger";

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
      .select("file_path")
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

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; code?: string; message?: string };
    const status = Number(err?.status) || 500;
    return NextResponse.json({ ok: false, code: err?.code, message: err?.message || "Error" }, { status });
  }
}
