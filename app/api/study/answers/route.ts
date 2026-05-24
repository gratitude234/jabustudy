// app/api/study/answers/route.ts
// POST — Create a new answer on a study question, then notify the question author.
//
// Replaces the direct supabase.from("study_answers").insert(...) call in
// QuestionDetailClient so that the notification can be fired server-side
// (service-role key, bypasses RLS) without exposing that key to the browser.
//
// Request body:
//   { questionId: string; body: string }
//
// Response:
//   { ok: true; answer: AnswerRow }  |  { ok: false; error: string }

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyAnswerPosted } from "@/lib/studyNotify";
import { awardCappedStudyPoints, STUDY_POINT_RULES } from "@/lib/studyPoints";

type CreatedAnswer = {
  id: string;
  question_id: string;
  body: string;
  created_at: string | null;
  author_email: string | null;
  author_id: string | null;
  is_accepted: boolean | null;
};

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { questionId?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const questionId = body.questionId?.trim();
  const answerBody = body.body?.trim();

  if (!questionId || !answerBody || answerBody.length < 10) {
    return NextResponse.json(
      { ok: false, error: "questionId and body (min 10 chars) are required." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // ── Fetch question (need author_id + title for notification) ───────────────
  const { data: question, error: qErr } = await admin
    .from("study_questions")
    .select("id,title,author_id,author_email,answers_count")
    .eq("id", questionId)
    .maybeSingle();

  if (qErr || !question) {
    return NextResponse.json({ ok: false, error: "Question not found." }, { status: 404 });
  }

  // ── Insert answer ──────────────────────────────────────────────────────────
  const { data: answer, error: insErr } = await admin
    .from("study_answers")
    .insert({
      question_id: questionId,
      body: answerBody,
      author_id: user.id,
      author_email: user.email ?? null,
      is_accepted: false,
    })
    .select("id,question_id,body,created_at,author_email,author_id,is_accepted")
    .single();

  if (insErr || !answer) {
    return NextResponse.json(
      { ok: false, error: insErr?.message ?? "Failed to post answer." },
      { status: 500 }
    );
  }

  // ── Increment answers_count on the question ────────────────────────────────
  await admin
    .from("study_questions")
    .update({ answers_count: (question.answers_count ?? 0) + 1 })
    .eq("id", questionId);

  // ── Fire notification (non-blocking) ──────────────────────────────────────
  const createdAnswer = answer as CreatedAnswer;

  if (question.author_id) {
    void notifyAnswerPosted({
      questionId,
      questionTitle: question.title ?? "your question",
      questionAuthorId: question.author_id,
      answererEmail: user.email ?? null,
      answerId: createdAnswer.id,
    });
  }

  const pointsAwarded = question.author_id !== user.id
    ? await awardCappedStudyPoints({
        userId: user.id,
        eventType: "answer_posted",
        sourceTable: "study_answers",
        sourceId: createdAnswer.id,
        points: STUDY_POINT_RULES.answerPosted,
        dailyCap: STUDY_POINT_RULES.answerDailyCap,
        metadata: { questionId },
      })
    : 0;

  return NextResponse.json({ ok: true, answer, pointsAwarded });
}
