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

  // ── Fetch the answer to get its author ────────────────────────────────────
  const { data: answer } = await admin
    .from("study_answers")
    .select("id,author_id,question_id")
    .eq("id", answerId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (!answer) {
    return NextResponse.json({ ok: false, error: "Answer not found." }, { status: 404 });
  }

  // ── Update: unaccept all, accept selected, mark question solved ───────────
  await admin
    .from("study_answers")
    .update({ is_accepted: false })
    .eq("question_id", questionId);

  const { error: acceptErr } = await admin
    .from("study_answers")
    .update({ is_accepted: true })
    .eq("id", answerId);

  if (acceptErr) {
    return NextResponse.json({ ok: false, error: acceptErr.message }, { status: 500 });
  }

  await admin
    .from("study_questions")
    .update({ solved: true })
    .eq("id", questionId);

  // ── Fire notification (non-blocking) ──────────────────────────────────────
  if (answer.author_id) {
    void notifyAnswerAccepted({
      questionId,
      questionTitle: question.title ?? "a question",
      answerAuthorId: answer.author_id,
      acceptorId: user.id,
      answerId,
    });
  }

  return NextResponse.json({ ok: true });
}