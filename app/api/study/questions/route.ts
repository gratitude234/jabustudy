import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { awardCappedStudyPoints, STUDY_POINT_RULES } from "@/lib/studyPoints";
import { notifyRepsNewQuestion } from "@/lib/studyNotify";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return jsonError("Sign in first.", 401, "UNAUTHORIZED");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body.", 400, "INVALID_JSON");
  }

  const title = cleanString(body.title, 180);
  const questionBody = cleanString(body.body, 5000);
  const courseCode = cleanString(body.courseCode ?? body.course_code, 40).toUpperCase() || null;
  const level = cleanString(body.level, 20) || null;

  if (title.length < 8) return jsonError("Title is too short.", 400, "TITLE_TOO_SHORT");
  if (questionBody.length < 10) return jsonError("Please add more detail.", 400, "BODY_TOO_SHORT");

  const admin = createSupabaseAdminClient();
  const { data: question, error } = await admin
    .from("study_questions")
    .insert({
      title,
      body: questionBody,
      course_code: courseCode,
      level,
      author_id: user.id,
      author_email: user.email ?? null,
      solved: false,
      answers_count: 0,
      upvotes_count: 0,
    })
    .select("id")
    .single();

  if (error || !question?.id) {
    return jsonError(error?.message || "Failed to post question.", 500, "CREATE_FAILED");
  }

  void notifyRepsNewQuestion({
    questionId: question.id,
    title,
    courseCode,
    level,
    authorId: user.id,
  });

  const pointsAwarded = await awardCappedStudyPoints({
    userId: user.id,
    eventType: "question_asked",
    sourceTable: "study_questions",
    sourceId: question.id,
    points: STUDY_POINT_RULES.questionAsked,
    dailyCap: STUDY_POINT_RULES.questionDailyCap,
    metadata: { courseCode, level },
  });

  return NextResponse.json({ ok: true, question: { id: question.id }, pointsAwarded });
}
