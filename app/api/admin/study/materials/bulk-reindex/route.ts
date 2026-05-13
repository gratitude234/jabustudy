import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isIndexableMaterialPath } from "@/lib/studyMaterialIndexEligibility";
import { triggerMaterialIndex } from "@/lib/studyMaterialIndexTrigger";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { ids?: string[] } | null;
    const ids = Array.isArray(body?.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean).slice(0, 200) : [];

    if (!ids.length) return NextResponse.json({ ok: false, error: "Missing ids" }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: rows, error } = await admin
      .from("study_materials")
      .select("id, approved, file_path")
      .in("id", ids);

    if (error) throw error;

    const foundIds = new Set((rows ?? []).map((row: any) => String(row.id)));
    const missing = ids.filter((id) => !foundIds.has(id)).length;
    const eligible = (rows ?? []).filter((row: any) => Boolean(row.approved) && isIndexableMaterialPath(row.file_path));

    for (const row of eligible) {
      triggerMaterialIndex(String((row as any).id));
    }

    return NextResponse.json({
      ok: true,
      queued: eligible.length,
      skipped: Math.max(0, ids.length - eligible.length - missing),
      missing,
    });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
