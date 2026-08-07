import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { endExamAttemptForSwitch, examHttpError } from "@/lib/examSprint/server";
import { requireExamDeviceSession } from "@/lib/examSprint/deviceSession";

function jsonError(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: value.code || "ATTEMPT_SWITCH_FAILED", message: value.message || "Could not end this attempt safely." },
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
    await requireExamDeviceSession(req, user.id);

    const { attemptId } = await params;
    const body = await req.json().catch(() => ({})) as { mode?: unknown };
    const mode = body.mode === "mistake" || body.mode === "switch" ? body.mode : "auto";
    const ended = await endExamAttemptForSwitch(user.id, attemptId, mode);

    const message = ended.outcome === "mistake_cancelled"
      ? "Accidental start cleared. Choose the course you meant to take."
      : ended.outcome === "ended_early"
        ? "Attempt ended early. You can choose another course now."
        : ended.outcome === "timeup"
          ? "That timer had already expired, so your saved answers were submitted. You can choose another course now."
          : "That attempt was already closed. You can choose another course.";

    return NextResponse.json({ ok: true, outcome: ended.outcome, message });
  } catch (error) {
    return jsonError(error);
  }
}
