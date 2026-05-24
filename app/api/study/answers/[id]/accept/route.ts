// app/api/study/answers/[id]/accept/route.ts
// POST — Accept an answer as the best answer, then notify its author.
//
// Only the question's original author can accept.
// Guards: auth check + ownership check server-side.
//
// Request body:
//   { questionId: string }
//
// Response:
//   { ok: true }  |  { ok: false; error: string }

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyAnswerAccepted } from "@/lib/studyNotify";

type AcceptStudyAnswerResult = {
  previous_answer_id: string | null;
  previous_author_id: string | null;
  accepted_author_id: string | null;
};

export async function POST(
  req: NextRequest,
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

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { questionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const questionId = body.questionId?.trim();
  if (!questionId) {
    return NextResponse.json({ ok: false, error: "Missing questionId" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // ── Verify caller owns the question ───────────────────────────────────────
  const { data: question } = await admin
    .from("study_questions")
    .select("id,title,author_id")
    .eq("id", questionId)
    .maybeSingle();

  if (!question) {
    return NextResponse.json({ ok: false, error: "Question not found." }, { status: 404 });
  }
  if (question.author_id !== user.id) {
    return NextResponse.json(
      { ok: false, error: "Only the question owner can accept an answer." },
      { status: 403 }
    );
  }

  const { data: acceptedRows, error: acceptErr } = await admin.rpc("accept_study_answer", {
    p_question_id: questionId,
    p_answer_id: answerId,
    p_actor_id: user.id,
  });

  if (acceptErr) {
    const message = acceptErr.message || "Could not accept answer.";
    const lower = message.toLowerCase();
    const status = lower.includes("not found")
      ? 404
      : lower.includes("only the question owner")
        ? 403
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }

  const acceptedResult = (Array.isArray(acceptedRows) ? acceptedRows[0] : acceptedRows) as
    | AcceptStudyAnswerResult
    | null;
  const acceptedAuthorId = acceptedResult?.accepted_author_id;

  // ── Fire notification (non-blocking) ──────────────────────────────────────
  if (acceptedAuthorId) {
    void notifyAnswerAccepted({
      questionId,
      questionTitle: question.title ?? "a question",
      answerAuthorId: acceptedAuthorId,
      acceptorId: user.id,
      answerId,
    });
  }

  return NextResponse.json({ ok: true });
}
