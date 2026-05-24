import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { getBankState, jsonError, requireScopedCourse } from "@/lib/repQuestionBank";
import {
  assertQuizSetNotDuplicateForCourse,
  duplicateGateErrorResponse,
} from "@/lib/studyDuplicateGate";
import { assertQuizSetQuestionsSourceBacked } from "@/lib/studyQuestionGrounding";

type BankRunRow = {
  course_id: string;
  quiz_set_id: string;
};

type RouteError = {
  message?: string;
  status?: number;
  code?: string;
  invalidCount?: number;
  duplicateCount?: number;
  duplicates?: unknown;
};

export async function POST(
  req: NextRequest,
  { params }: { params: { runId: string } | Promise<{ runId: string }> }
) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const { runId } = await params;
    if (!runId) return jsonError("Missing runId.", 400, "MISSING_RUN_ID");

    const { data: run, error: runErr } = await adminSupabase
      .from("study_question_bank_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (runErr) throw runErr;
    if (!run) return jsonError("Question bank run not found.", 404, "RUN_NOT_FOUND");
    const bankRun = run as BankRunRow;

    await requireScopedCourse(String(bankRun.course_id), scope);

    const { count } = await adminSupabase
      .from("study_quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("set_id", bankRun.quiz_set_id);

    if ((count ?? 0) <= 0) {
      return jsonError("Generate at least one question before publishing.", 422, "EMPTY_SET");
    }

    try {
      await assertQuizSetQuestionsSourceBacked(String(bankRun.quiz_set_id));
    } catch (error: unknown) {
      const sourceError = error as RouteError;
      return NextResponse.json(
        {
          ok: false,
          code: sourceError.code || "PUBLISH_BLOCKED_UNGROUNDED",
          error:
            sourceError.message ||
            "Cannot publish this question bank until every question has a verified source chunk.",
          invalidCount: sourceError.invalidCount,
        },
        { status: Number(sourceError.status) || 422 }
      );
    }

    try {
      await assertQuizSetNotDuplicateForCourse(String(bankRun.quiz_set_id));
    } catch (error: unknown) {
      const duplicateError = error as RouteError;
      return NextResponse.json(
        duplicateGateErrorResponse(error),
        { status: Number(duplicateError.status) || 422 }
      );
    }

    const now = new Date().toISOString();
    const [{ error: setErr }, { error: runUpdateErr }] = await Promise.all([
      adminSupabase
        .from("study_quiz_sets")
        .update({ published: true, visibility: "public", questions_count: count })
        .eq("id", bankRun.quiz_set_id),
      adminSupabase
        .from("study_question_bank_runs")
        .update({ status: "completed", updated_at: now })
        .eq("id", runId),
    ]);

    if (setErr) throw setErr;
    if (runUpdateErr) throw runUpdateErr;

    // Fan-out study_new_quiz_set notifications to matching students — fire-and-forget
    void (async () => {
      try {
        const { data: course } = await adminSupabase
          .from("study_courses")
          .select("course_code, department_id, level, semester")
          .eq("id", bankRun.course_id)
          .maybeSingle();

        if (!course?.department_id) return;

        const level = (course as any).level;
        const semester = String((course as any).semester ?? "").trim().toLowerCase();

        let usersQuery = adminSupabase
          .from("study_preferences")
          .select("user_id")
          .eq("department_id", (course as any).department_id)
          .limit(200);
        if (level) usersQuery = (usersQuery as any).or(`level.eq.${level},level.is.null`);
        if (semester) usersQuery = (usersQuery as any).or(`semester.eq.${semester},semester.is.null`);

        const { data: users } = await usersQuery;
        if (!users?.length) return;

        const href = `/study/practice/${bankRun.quiz_set_id}`;
        const notifBody = `${(course as any).course_code} — ${count} question${count === 1 ? "" : "s"} ready to practice`;

        const rows = (users as { user_id: string }[]).map((u) => ({
          user_id: u.user_id,
          type: "study_new_quiz_set",
          title: "New practice set available",
          body: notifBody,
          href,
          is_read: false,
        }));

        for (let i = 0; i < rows.length; i += 50) {
          await adminSupabase.from("notifications").insert(rows.slice(i, i + 50));
        }

        // Web push fan-out
        const { sendUserPush, filterPushAllowed } = await import("@/lib/webPush");
        const allUserIds = (users as { user_id: string }[]).map(u => u.user_id);
        const allowedUserIds = await filterPushAllowed(allUserIds, 'quizzes');
        await Promise.allSettled(
          allowedUserIds.map(uid =>
            sendUserPush(uid, {
              title: "New practice set available",
              body: notifBody,
              href,
              tag: `new-quiz-${bankRun.quiz_set_id}`,
            })
          )
        );
      } catch { /* never break publish */ }
    })();

    return NextResponse.json({ ok: true, bank: await getBankState(runId) });
  } catch (e: unknown) {
    const error = e as RouteError;
    return jsonError(error.message || "Failed to publish question bank.", Number(error.status) || 500, error.code);
  }
}
