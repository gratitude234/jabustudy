// app/api/study/answers/[id]/upvote/route.ts
// POST — Toggle an upvote on a study answer.
//
// Uses study_answer_votes (user_id, answer_id) and increments/decrements
// upvotes_count on study_answers.
//
// Response:
//   { ok: true; upvoted: boolean; count: number }
//   { ok: false; error: string }

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyAnswerUpvoteMilestone } from "@/lib/studyNotify";

type ToggleVoteResult = {
  upvoted: boolean;
  count: number;
};

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

  // Fetch answer metadata for notification — needed before RPC since RPC doesn't return author
  const { data: answer } = await admin
    .from("study_answers")
    .select("id, author_id, question_id")
    .eq("id", answerId)
    .maybeSingle();

  const { data: toggleRows, error: toggleError } = await admin.rpc("toggle_study_answer_upvote", {
    p_answer_id: answerId,
    p_user_id: user.id,
  });

  if (toggleError) {
    const message = toggleError.message || "Failed to vote.";
    const status = message.toLowerCase().includes("own answer")
      ? 403
      : message.toLowerCase().includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }

  const result = (Array.isArray(toggleRows) ? toggleRows[0] : toggleRows) as ToggleVoteResult | null;
  const upvoted = Boolean(result?.upvoted);
  const count = Number(result?.count ?? 0);

  if (upvoted && answer?.author_id && answer?.question_id) {
    void notifyAnswerUpvoteMilestone({
      answerId,
      questionId: answer.question_id,
      answerAuthorId: answer.author_id,
      newCount: count,
      voterId: user.id,
    });
  }

  return NextResponse.json({ ok: true, upvoted, count });
}
