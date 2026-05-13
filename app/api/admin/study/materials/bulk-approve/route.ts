import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { triggerMaterialIndex } from "@/lib/studyMaterialIndexTrigger";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { ids?: string[] } | null;
    const ids = Array.isArray(body?.ids) ? body!.ids.map((s) => String(s).trim()).filter(Boolean) : [];

    if (!ids.length) {
      return NextResponse.json({ ok: false, error: "Missing ids" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("study_materials").update({ approved: true }).in("id", ids);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    for (const id of ids) {
      triggerMaterialIndex(id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
