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
  const questionId = id?.trim();
  if (!questionId) {
    return NextResponse.json({ ok: false, error: "Missing question id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // ── Fetch question metadata for notification ───────────────────────────────
  const { data: question } = await admin
    .from("study_questions")
    .select("id,title,author_id")
    .eq("id", questionId)
    .maybeSingle();

  if (!question) {
    return NextResponse.json({ ok: false, error: "Question not found." }, { status: 404 });
  }

  const { data: toggleRows, error: toggleError } = await admin.rpc("toggle_study_question_upvote", {
    p_question_id: questionId,
    p_user_id: user.id,
  });

  if (toggleError) {
    const status = toggleError.message.toLowerCase().includes("own question") ? 403 : 500;
    return NextResponse.json({ ok: false, error: toggleError.message }, { status });
  }

  const result = (Array.isArray(toggleRows) ? toggleRows[0] : toggleRows) as ToggleVoteResult | null;
  const upvoted = Boolean(result?.upvoted);
  const count = Number(result?.count ?? 0);

  // ── Fire milestone notification (non-blocking) ───────────────────────────
  if (upvoted && question.author_id) {
    void notifyUpvoteMilestone({
      questionId,
      questionTitle: question.title ?? "your question",
      questionAuthorId: question.author_id,
      newCount: count,
      voterId: user.id,
    });
  }

  return NextResponse.json({ ok: true, upvoted, count });
}
