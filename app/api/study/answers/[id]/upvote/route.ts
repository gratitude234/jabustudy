// app/api/study/answers/[id]/upvote/route.ts
// POST — Toggle an upvote on a study answer.
//
// Uses study_answer_votes (voter_id, answer_id) and increments/decrements
// upvotes_count on study_answers.
//
// Response:
//   { ok: true; upvoted: boolean; count: number }
//   { ok: false; error: string }

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;
  const answerId = id?.trim();
  if (!answerId) {
    return NextResponse.json({ ok: false, error: "Missing answer id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // ── Fetch answer ───────────────────────────────────────────────────────────
  const { data: answer } = await admin
    .from("study_answers")
    .select("id,upvotes_count,author_id")
    .eq("id", answerId)
    .maybeSingle();

  if (!answer) {
    return NextResponse.json({ ok: false, error: "Answer not found." }, { status: 404 });
  }

  // Prevent authors from upvoting their own answers
  if (answer.author_id && answer.author_id === user.id) {
    return NextResponse.json({ ok: false, error: "You cannot upvote your own answer." }, { status: 403 });
  }

  const currentCount = answer.upvotes_count ?? 0;

  // ── Check current vote state ───────────────────────────────────────────────
  const { data: existingVote } = await admin
    .from("study_answer_votes")
    .select("id")
    .eq("answer_id", answerId)
    .eq("voter_id", user.id)
    .maybeSingle();

  const wasUpvoted = !!existingVote;

  if (wasUpvoted) {
    // ── Remove vote ──────────────────────────────────────────────────────────
    await admin
      .from("study_answer_votes")
      .delete()
      .eq("answer_id", answerId)
      .eq("voter_id", user.id);

    const newCount = Math.max(0, currentCount - 1);
    await admin
      .from("study_answers")
      .update({ upvotes_count: newCount })
      .eq("id", answerId);

    return NextResponse.json({ ok: true, upvoted: false, count: newCount });
  } else {
    // ── Add vote ─────────────────────────────────────────────────────────────
    const { error: insErr } = await admin
      .from("study_answer_votes")
      .insert({ answer_id: answerId, voter_id: user.id });

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    const newCount = currentCount + 1;
    await admin
      .from("study_answers")
      .update({ upvotes_count: newCount })
      .eq("id", answerId);

    return NextResponse.json({ ok: true, upvoted: true, count: newCount });
  }
}