import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { id?: string; key?: string; value?: boolean } | null;
    const id = body?.id?.trim();
    const key = String(body?.key ?? "").trim();
    const value = !!body?.value;

    if (!id || !key) {
      return NextResponse.json({ ok: false, error: "Missing id/key" }, { status: 400 });
    }

    // Restrict which columns can be modified.
    const allowed = new Set(["verified", "is_verified", "approved"]);
    if (!allowed.has(key)) {
      return NextResponse.json({ ok: false, error: "Invalid key" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("study_tutors").update({ [key]: value } as any).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
