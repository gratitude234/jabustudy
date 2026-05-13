import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "study-materials";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { id?: string } | null;
    const id = body?.id?.trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Fetch file_path for storage cleanup.
    const { data: row, error: readErr } = await admin
      .from("study_materials")
      .select("file_path")
      .eq("id", id)
      .maybeSingle();

    if (readErr) {
      return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    }

    const filePath = (row as any)?.file_path as string | null | undefined;

    const { error: delErr } = await admin.from("study_materials").delete().eq("id", id);
    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }

    // Best-effort storage removal.
    if (filePath) {
      await admin.storage.from(BUCKET).remove([filePath]);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
