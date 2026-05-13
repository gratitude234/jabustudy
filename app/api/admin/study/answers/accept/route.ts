import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { questionId?: string; answerId?: string } | null;
    const questionId = body?.questionId?.trim();
    const answerId = body?.answerId?.trim();
    if (!questionId || !answerId) {
      return NextResponse.json({ ok: false, error: "Missing questionId/answerId" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Unaccept all, accept selected, mark question solved.
    await admin.from("study_answers").update({ is_accepted: false }).eq("question_id", questionId);
    const { error: u2 } = await admin.from("study_answers").update({ is_accepted: true }).eq("id", answerId);
    if (u2) return NextResponse.json({ ok: false, error: u2.message }, { status: 500 });

    await admin.from("study_questions").update({ solved: true }).eq("id", questionId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
