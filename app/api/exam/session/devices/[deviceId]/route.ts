import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { examDeviceTokenFromRequest, revokeExamDevice } from "@/lib/examSprint/deviceSession";
import { examHttpError } from "@/lib/examSprint/server";

function jsonError(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: value.code || "EXAM_DEVICE_REVOKE_FAILED", message: value.message || "Could not sign out that device." },
    { status: Number(value.status) || 500 },
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw examHttpError("Sign in to manage Exam Sprint devices.", 401, "UNAUTHORIZED");
    const { deviceId } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(deviceId)) {
      throw examHttpError("That device reference is invalid.", 400, "INVALID_REQUEST");
    }
    await revokeExamDevice(user.id, deviceId, examDeviceTokenFromRequest(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
