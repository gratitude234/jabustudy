import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isIndexableMaterialPath } from "@/lib/studyMaterialIndexEligibility";
import { indexStudyMaterial } from "@/lib/studyMaterialIndex";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { id?: string } | null;
    const id = body?.id?.trim();

    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("study_materials")
      .select("id, approved, file_path")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!row?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (!(row as any).approved) {
      return NextResponse.json({ ok: false, error: "Only approved materials can be indexed." }, { status: 400 });
    }
    if (!isIndexableMaterialPath((row as any).file_path)) {
      return NextResponse.json({ ok: false, error: "This file type is not indexable." }, { status: 422 });
    }

    const result = await indexStudyMaterial(id);
    return NextResponse.json({ ok: result.status !== "failed", ...result }, { status: result.status === "failed" ? 422 : 200 });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
