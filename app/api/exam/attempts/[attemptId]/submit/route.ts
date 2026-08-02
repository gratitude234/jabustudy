import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  examHttpError,
  finalizeExamAttempt,
  getOwnedExamAttempt,
} from "@/lib/examSprint/server";

function jsonError(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: value.code || "ATTEMPT_SUBMIT_FAILED", message: value.message || "Could not submit this attempt." },
    { status: Number(value.status) || 500 },
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw examHttpError("Sign in to continue.", 401, "UNAUTHORIZED");
    const { attemptId } = await params;
    const body = await req.json().catch(() => ({})) as { reason?: unknown };
    const reason = body.reason === "timeup" ? "timeup" : "manual";
    const attempt = await getOwnedExamAttempt(user.id, attemptId);
    const submitted = await finalizeExamAttempt(attempt, reason);
    const score = Number(submitted.score ?? 0);
    const total = Number(submitted.total_questions ?? 0);
    return NextResponse.json({
      ok: true,
      result: {
        attemptId: submitted.id,
        score,
        total,
        percentage: total > 0 ? Math.round((score / total) * 100) : 0,
        submittedAt: submitted.submitted_at,
      },
      resultUrl: `/exam/result/${encodeURIComponent(submitted.id)}`,
    });
  } catch (error) {
    return jsonError(error);
  }
}
