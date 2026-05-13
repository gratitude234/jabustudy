// app/api/study/questions/[id]/upvote/route.ts
// POST — Toggle an upvote on a study question.
//        Fires a milestone notification when the new count hits 1/5/10/25/50.
//
// Response:
//   { ok: true; upvoted: boolean; count: number }
//   { ok: false; error: string }

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUpvoteMilestone } from "@/lib/studyNotify";

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
  const questionId = id?.trim();
  if (!questionId) {
    return NextResponse.json({ ok: false, error: "Missing question id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // ── Fetch question ─────────────────────────────────────────────────────────
  const { data: question } = await admin
    .from("study_questions")
    .select("id,title,author_id,upvotes_count")
    .eq("id", questionId)
    .maybeSingle();

  if (!question) {
    return NextResponse.json({ ok: false, error: "Question not found." }, { status: 404 });
  }

  // C-4: Block self-vote
  if (question.author_id && question.author_id === user.id) {
    return NextResponse.json(
      { ok: false, error: 'You cannot upvote your own question.' },
      { status: 403 }
    );
  }

  const currentCount = question.upvotes_count ?? 0;

  // ── Check current vote state ───────────────────────────────────────────────
  const { data: existingVote } = await admin
    .from("study_question_votes")
    .select("id")
    .eq("question_id", questionId)
    .eq("voter_id", user.id)
    .maybeSingle();

  const wasUpvoted = !!existingVote;

  if (wasUpvoted) {
    // ── Remove vote ──────────────────────────────────────────────────────────
    await admin
      .from("study_question_votes")
      .delete()
      .eq("question_id", questionId)
      .eq("voter_id", user.id);

    const newCount = Math.max(0, currentCount - 1);
    await admin
      .from("study_questions")
      .update({ upvotes_count: newCount })
      .eq("id", questionId);

    return NextResponse.json({ ok: true, upvoted: false, count: newCount });
  } else {
    // ── Add vote ─────────────────────────────────────────────────────────────
    const { error: insErr } = await admin
      .from("study_question_votes")
      .insert({ question_id: questionId, voter_id: user.id });

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    const newCount = currentCount + 1;
    await admin
      .from("study_questions")
      .update({ upvotes_count: newCount })
      .eq("id", questionId);

    // ── Fire milestone notification (non-blocking) ───────────────────────────
    if (question.author_id) {
      void notifyUpvoteMilestone({
        questionId,
        questionTitle: question.title ?? "your question",
        questionAuthorId: question.author_id,
        newCount,
        voterId: user.id,
      });
    }

    return NextResponse.json({ ok: true, upvoted: true, count: newCount });
  }
}