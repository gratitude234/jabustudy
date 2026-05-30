import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  void req;
  const { attemptId: rawAttemptId } = await params;
  const attemptId = rawAttemptId?.trim();
  if (!attemptId) return jsonError("Missing attempt id.", 400, "MISSING_ATTEMPT_ID");

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return jsonError("Sign in first.", 401, "UNAUTHORIZED");

  const admin = createSupabaseAdminClient();

  const { data: attempt, error: attemptError } = await admin
    .from("study_practice_attempts")
    .select("id, user_id, status")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError || !attempt) return jsonError("Attempt not found.", 404, "NOT_FOUND");
  if (attempt.user_id !== user.id) return jsonError("Forbidden.", 403, "FORBIDDEN");
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ ok: true, alreadyFinished: true });
  }

  const { error: updateError } = await admin
    .from("study_practice_attempts")
    .update({ status: "abandoned" })
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .eq("status", "in_progress");

  if (updateError) return jsonError("Failed to abandon attempt.", 500, "UPDATE_FAILED");

  return NextResponse.json({ ok: true });
}
