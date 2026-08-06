import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { examHttpError, getExamResult } from "@/lib/examSprint/server";
import { requireExamDeviceSession } from "@/lib/examSprint/deviceSession";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw examHttpError("Sign in to view this result.", 401, "UNAUTHORIZED");
    await requireExamDeviceSession(req, user.id);
    const { attemptId } = await params;
    return NextResponse.json({ ok: true, result: await getExamResult(user.id, attemptId) });
  } catch (error) {
    const value = error as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: value.code || "RESULT_LOAD_FAILED", message: value.message || "Could not load this result." },
      { status: Number(value.status) || 500 },
    );
  }
}
