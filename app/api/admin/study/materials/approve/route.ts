import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { triggerMaterialIndex } from "@/lib/studyMaterialIndexTrigger";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { id?: string; approved?: boolean } | null;

    const id = body?.id?.trim();
    const approved = !!body?.approved;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("study_materials").update({ approved }).eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // C-7: Trigger AI summary + dept notification on approval
    if (approved) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
          ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        void fetch(`${baseUrl}/api/ai/summarize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ material_id: id }),
        });
        void fetch(`${baseUrl}/api/study/notify-new-material`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ material_id: id }),
        });
        triggerMaterialIndex(id);
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
