import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { EXAM_CAMPAIGN_KEY } from "@/lib/examSprint/config";
import {
  attemptExpired,
  buildExamSnapshot,
  examExperience,
  examHttpError,
  finalizeExamAttempt,
  getExamPassAccess,
  getOwnedExamAttempt,
  getPublishedExamSet,
  type ExamAttemptKind,
  type ExamAttemptRow,
} from "@/lib/examSprint/server";
import { partitionTimedExamAttempts } from "@/lib/examSprint/workflow";
import { requireExamDeviceSession } from "@/lib/examSprint/deviceSession";
import {
  examDiagnosticCooldownEndsAt,
  examDiagnosticCooldownIsActive,
} from "@/lib/examSprint/dailyDiagnostic";

function jsonError(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: value.code || "EXAM_START_FAILED", message: value.message || "Could not start this exam." },
    { status: Number(value.status) || 500 },
  );
}

function startPayload(
  attempt: ExamAttemptRow,
  resumed: boolean,
  resumeReason: "same_set" | "active_session" | null = null,
) {
  return {
    ok: true,
    resumed,
    resumeReason,
    message: resumeReason === "active_session"
      ? "You already have a timed Exam Sprint session running. We brought you back to it."
      : null,
    attempt: {
      id: attempt.id,
      setId: attempt.set_id,
      kind: attempt.experience === "exam_diagnostic" ? "diagnostic" : "mock",
      status: attempt.status,
      startedAt: attempt.started_at,
      deadlineAt: attempt.deadline_at,
      totalQuestions: Array.isArray((attempt.delivery_snapshot as { questions?: unknown[] } | null)?.questions)
        ? (attempt.delivery_snapshot as { questions: unknown[] }).questions.length
        : Number(attempt.total_questions ?? 0),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw examHttpError("Sign in to start Exam Sprint.", 401, "UNAUTHORIZED");
    await requireExamDeviceSession(req, user.id);

    const body = await req.json().catch(() => null) as { setId?: unknown; kind?: unknown } | null;
    const setId = typeof body?.setId === "string" ? body.setId.trim() : "";
    const kind: ExamAttemptKind | null = body?.kind === "diagnostic" || body?.kind === "mock" ? body.kind : null;
    if (!setId || !kind) throw examHttpError("setId and a valid attempt kind are required.", 400, "INVALID_REQUEST");

    const { row: setRow, set, course } = await getPublishedExamSet(setId);

    const experience = examExperience(kind);
    const { data: currentRows, error: currentError } = await adminSupabase
      .from("study_practice_attempts")
      .select("id,user_id,set_id,status,experience,campaign_key,started_at,deadline_at,submitted_at,submission_reason,delivery_snapshot,score,total_questions,time_spent_seconds")
      .eq("user_id", user.id)
      .eq("campaign_key", EXAM_CAMPAIGN_KEY)
      .in("experience", ["exam_diagnostic", "exam_mock"])
      .eq("status", "in_progress")
      .order("deadline_at", { ascending: true });
    if (currentError) throw examHttpError(currentError.message, 500, "ATTEMPT_LOAD_FAILED");
    const running = partitionTimedExamAttempts((currentRows ?? []) as ExamAttemptRow[]);
    if (running.expired.length > 0) {
      await Promise.all(running.expired.map((attempt) => finalizeExamAttempt(attempt, "timeup")));
    }
    if (running.primary) {
      const sameSession = running.primary.set_id === setId && running.primary.experience === experience;
      return NextResponse.json(startPayload(
        running.primary,
        true,
        sameSession ? "same_set" : "active_session",
      ));
    }

    if (kind === "diagnostic") {
      const { data: used, error: usedError } = await adminSupabase
        .from("study_practice_attempts")
        .select("id,user_id,set_id,status,experience,campaign_key,started_at,deadline_at,submitted_at,submission_reason,delivery_snapshot,score,total_questions,time_spent_seconds")
        .eq("user_id", user.id)
        .eq("campaign_key", EXAM_CAMPAIGN_KEY)
        .eq("experience", "exam_diagnostic")
        .neq("status", "cancelled")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (usedError) throw examHttpError(usedError.message, 500, "ATTEMPT_LOAD_FAILED");
      if (used && examDiagnosticCooldownIsActive(used.started_at)) {
        const previous = used as ExamAttemptRow;
        if (previous.status === "in_progress" && !attemptExpired(previous) && previous.set_id === setId) {
          return NextResponse.json(startPayload(previous, true, "same_set"));
        }
        if (previous.status === "in_progress" && attemptExpired(previous)) {
          await finalizeExamAttempt(previous, "timeup");
        }
        const nextAvailableAt = new Date(examDiagnosticCooldownEndsAt(previous.started_at));
        const nextAvailableLabel = new Intl.DateTimeFormat("en-NG", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Africa/Lagos",
        }).format(nextAvailableAt);
        throw examHttpError(
          `Your next free 10-question diagnostic unlocks at ${nextAvailableLabel} WAT. Free checks return 5 hours after the previous one starts, or you can unlock Exam Sprint now.`,
          409,
          "DIAGNOSTIC_COOLDOWN_ACTIVE",
        );
      }
    } else {
      const access = await getExamPassAccess(user.id);
      if (!access.active || setRow.access_tier !== "plus_monthly") {
        return NextResponse.json(
          {
            ok: false,
            code: "EXAM_ACCESS_REQUIRED",
            message: "An active Exam Sprint Pass is required for full mocks.",
            checkoutUrl: `/study/billing?offer=exam-sprint&returnTo=${encodeURIComponent(`/exam/${course.slug}`)}`,
          },
          { status: 402 },
        );
      }
    }

    const questionCount = kind === "diagnostic" ? set.diagnosticQuestionCount : set.attemptQuestionCount;
    const durationMinutes = kind === "diagnostic" ? set.diagnosticTimeLimitMinutes : set.timeLimitMinutes;
    const snapshot = await buildExamSnapshot({
      setId,
      setTitle: set.title,
      courseCode: course.code,
      questionCount,
      userId: user.id,
      kind,
    });
    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + durationMinutes * 60_000);
    const { data: created, error: createError } = await adminSupabase
      .from("study_practice_attempts")
      .insert({
        user_id: user.id,
        set_id: setId,
        status: "in_progress",
        experience,
        campaign_key: EXAM_CAMPAIGN_KEY,
        started_at: startedAt.toISOString(),
        deadline_at: deadlineAt.toISOString(),
        delivery_snapshot: snapshot,
        total_questions: snapshot.questions.length,
      })
      .select("id,user_id,set_id,status,experience,campaign_key,started_at,deadline_at,submitted_at,submission_reason,delivery_snapshot,score,total_questions,time_spent_seconds")
      .single();

    if (createError) {
      if (createError.code === "23505" || createError.message.includes("ACTIVE_EXAM_EXISTS")) {
        const { data: duplicate } = await adminSupabase
          .from("study_practice_attempts")
          .select("id")
          .eq("user_id", user.id)
          .eq("campaign_key", EXAM_CAMPAIGN_KEY)
          .in("experience", ["exam_diagnostic", "exam_mock"])
          .eq("status", "in_progress")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (duplicate?.id) {
          const existing = await getOwnedExamAttempt(user.id, String(duplicate.id));
          if (existing.status === "in_progress" && !attemptExpired(existing)) {
            return NextResponse.json(startPayload(
              existing,
              true,
              existing.set_id === setId && existing.experience === experience ? "same_set" : "active_session",
            ));
          }
        }
        if (kind === "diagnostic") {
          throw examHttpError(
            "Your next free diagnostic is not available yet. Refresh in a moment to check the 5-hour cooldown, or unlock Exam Sprint to keep practising now.",
            409,
            "DIAGNOSTIC_COOLDOWN_ACTIVE",
          );
        }
      }
      throw examHttpError(createError.message, 500, "ATTEMPT_CREATE_FAILED");
    }

    return NextResponse.json(startPayload(created as ExamAttemptRow, false), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
