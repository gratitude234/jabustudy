import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import {
  EXAM_BANK_MINIMUM,
  EXAM_CAMPAIGN_KEY,
  EXAM_COURSES,
  EXAM_DIAGNOSTIC_DURATION_MINUTES,
  EXAM_DIAGNOSTIC_QUESTION_COUNT,
  EXAM_MOCK_DURATION_MINUTES,
  EXAM_MOCK_QUESTION_COUNT,
  findExamCourse,
  normalizeExamCourseCode,
} from "@/lib/examSprint/config";

function jsonError(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: value.code || "EXAM_ADMIN_FAILED", message: value.message || "Exam Sprint admin request failed." },
    { status: Number(value.status) || 500 },
  );
}

function forbidden() {
  return Object.assign(new Error("Only a super study admin can manage Exam Sprint."), { status: 403, code: "SUPER_ADMIN_REQUIRED" });
}

type ExamQuestionRow = {
  id: string;
  set_id: string;
  exam_verified_at: string | null;
};

async function getExamQuestionRows(setIds: string[]): Promise<ExamQuestionRow[]> {
  if (!setIds.length) return [];

  // Supabase projects commonly cap a single REST response at 1,000 rows. Exam
  // Sprint can exceed that across all banks, so page through the complete result
  // instead of silently treating later banks as empty.
  const pageSize = 1_000;
  const rows: ExamQuestionRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await adminSupabase
      .from("study_quiz_questions")
      .select("id,set_id,exam_verified_at")
      .in("set_id", setIds)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const page = (data ?? []) as ExamQuestionRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStudyModeratorFromRequest(req);
    if (!auth.isSuper) throw forbidden();
    const { data: setRows, error: setError } = await adminSupabase
      .from("study_quiz_sets")
      .select("id,title,description,course_code,published,questions_count,time_limit_minutes,exam_question_count,diagnostic_question_count,exam_published_at,created_at")
      .eq("delivery_mode", "mock_exam")
      .eq("exam_campaign_key", EXAM_CAMPAIGN_KEY)
      .order("created_at", { ascending: true });
    if (setError) throw setError;
    const setIds = (setRows ?? []).map((set) => String(set.id));
    const [questions, { data: attempts, error: attemptError }, { data: orders, error: orderError }] = await Promise.all([
      getExamQuestionRows(setIds),
      adminSupabase
        .from("study_practice_attempts")
        .select("id,user_id,set_id,experience,status")
        .eq("campaign_key", EXAM_CAMPAIGN_KEY),
      adminSupabase
        .from("study_billing_orders")
        .select("id,user_id,amount_naira,status,return_path")
        .eq("plan_key", "plus_monthly")
        .eq("status", "approved")
        .like("return_path", "/exam%"),
    ]);
    if (attemptError) throw attemptError;
    if (orderError) throw orderError;

    const questionRows = questions;
    const attemptRows = (attempts ?? []) as Array<{ user_id: string; set_id: string; experience: string; status: string }>;
    const sets = (setRows ?? []).map((set) => {
      const setQuestions = questionRows.filter((question) => question.set_id === set.id);
      const setAttempts = attemptRows.filter((attempt) => attempt.set_id === set.id);
      const diagnosticAttempts = setAttempts.filter((attempt) => attempt.experience === "exam_diagnostic");
      const mockAttempts = setAttempts.filter((attempt) => attempt.experience === "exam_mock");
      return {
        id: set.id,
        title: set.title,
        courseCode: set.course_code,
        published: Boolean(set.published),
        questions: setQuestions.length,
        verified: setQuestions.filter((question) => question.exam_verified_at).length,
        timeLimitMinutes: Number(set.time_limit_minutes ?? EXAM_MOCK_DURATION_MINUTES),
        attemptQuestionCount: Number(set.exam_question_count ?? EXAM_MOCK_QUESTION_COUNT),
        diagnosticQuestionCount: Number(set.diagnostic_question_count ?? EXAM_DIAGNOSTIC_QUESTION_COUNT),
        diagnosticStarts: diagnosticAttempts.length,
        diagnosticCompletions: diagnosticAttempts.filter((attempt) => attempt.status === "submitted").length,
        paidAttempts: mockAttempts.length,
        paidCompletions: mockAttempts.filter((attempt) => attempt.status === "submitted").length,
        completed: setAttempts.filter((attempt) => attempt.status === "submitted").length,
        learners: new Set(setAttempts.map((attempt) => attempt.user_id)).size,
        publishedAt: set.exam_published_at,
      };
    });

    const conversions = orders ?? [];
    return NextResponse.json({
      ok: true,
      isSuper: true,
      minimumQuestions: EXAM_BANK_MINIMUM,
      courses: EXAM_COURSES.map((course) => ({
        ...course,
        sets: sets.filter((set) => normalizeExamCourseCode(set.courseCode) === normalizeExamCourseCode(course.code)),
      })),
      metrics: {
        diagnosticStarts: attemptRows.filter((attempt) => attempt.experience === "exam_diagnostic").length,
        diagnosticCompletions: attemptRows.filter((attempt) => attempt.experience === "exam_diagnostic" && attempt.status === "submitted").length,
        paidAttempts: attemptRows.filter((attempt) => attempt.experience === "exam_mock").length,
        learners: new Set(attemptRows.map((attempt) => attempt.user_id)).size,
        conversions: conversions.length,
        revenueNaira: conversions.reduce((sum, order) => sum + Number(order.amount_naira ?? 0), 0),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStudyModeratorFromRequest(req);
    if (!auth.isSuper) throw forbidden();
    const body = await req.json().catch(() => null) as { courseCode?: unknown; title?: unknown } | null;
    const course = findExamCourse(body?.courseCode);
    if (!course) return NextResponse.json({ ok: false, code: "UNKNOWN_EXAM_COURSE", message: "Choose a course from the Exam Sprint timetable." }, { status: 422 });
    const title = typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : `${course.code} Exam Sprint Mock`;
    const { data, error } = await adminSupabase
      .from("study_quiz_sets")
      .insert({
        title,
        description: "Private Exam Sprint question bank. Review every question before publishing.",
        course_code: course.code,
        semester: "second",
        difficulty: "hard",
        time_limit_minutes: EXAM_MOCK_DURATION_MINUTES,
        questions_count: 0,
        published: false,
        visibility: "private",
        source: "exam_sprint",
        created_by: auth.userId,
        delivery_mode: "mock_exam",
        exam_campaign_key: EXAM_CAMPAIGN_KEY,
        access_tier: "plus_monthly",
        exam_question_count: EXAM_MOCK_QUESTION_COUNT,
        diagnostic_question_count: EXAM_DIAGNOSTIC_QUESTION_COUNT,
        diagnostic_time_limit_minutes: EXAM_DIAGNOSTIC_DURATION_MINUTES,
      })
      .select("id")
      .single();
    if (error || !data?.id) throw error ?? new Error("Could not create the exam bank.");
    return NextResponse.json({ ok: true, setId: data.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
