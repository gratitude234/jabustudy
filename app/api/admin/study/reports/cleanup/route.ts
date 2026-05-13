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
    const { data: r, error: rErr } = await admin
      .from("study_reports")
      .select("id, material_id, tutor_id, question_id, answer_id")
      .eq("id", id)
      .maybeSingle();

    if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
    if (!r) return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });

    // Delete related entities (best-effort). Mirrors client logic.
    if ((r as any).material_id) {
      await admin.from("study_materials").delete().eq("id", (r as any).material_id);
    }

    if ((r as any).tutor_id) {
      // try to unverify then delete
      await admin.from("study_tutors").update({ verified: false } as any).eq("id", (r as any).tutor_id);
      await admin.from("study_tutors").delete().eq("id", (r as any).tutor_id);
    }

    if ((r as any).answer_id) {
      await admin.from("study_answers").delete().eq("id", (r as any).answer_id);
    }

    if ((r as any).question_id) {
      await admin.from("study_questions").delete().eq("id", (r as any).question_id);
    }

    // Mark report resolved
    await admin.from("study_reports").update({ status: "resolved" }).eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
