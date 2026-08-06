import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXAM_DEVICE_COOKIE_NAME,
  examDeviceCookieOptions,
  examDeviceTokenFromRequest,
  revokeCurrentExamDevice,
} from "@/lib/examSprint/deviceSession";

export async function POST(request: NextRequest) {
  const token = examDeviceTokenFromRequest(request);
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await revokeCurrentExamDevice(user.id, token);
  } catch (error) {
    // Logout must remain available even if device bookkeeping is degraded.
    console.error("[Exam Sprint] Could not revoke current device during logout:", error);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(EXAM_DEVICE_COOKIE_NAME, "", {
    ...examDeviceCookieOptions(),
    maxAge: 0,
  });
  return response;
}
