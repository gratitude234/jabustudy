import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { id?: string } | null;
    const id = body?.id?.trim();
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const admin = createSupabaseAdminClient();

    // Delete options for questions in this set, then questions, then set.
    const { data: qIds } = await admin.from("study_quiz_questions").select("id").eq("quiz_set_id", id);
    const ids = (qIds ?? []).map((r: any) => r.id).filter(Boolean);
    if (ids.length) {
      await admin.from("study_quiz_options").delete().in("question_id", ids);
    }

    await admin.from("study_quiz_questions").delete().eq("quiz_set_id", id);
    const { error: delErr } = await admin.from("study_quiz_sets").delete().eq("id", id);
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
