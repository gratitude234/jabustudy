import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
    const id = body?.id?.trim();
    const status = String(body?.status ?? "").trim();
    if (!id || !status) return NextResponse.json({ ok: false, error: "Missing id/status" }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("study_reports").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
