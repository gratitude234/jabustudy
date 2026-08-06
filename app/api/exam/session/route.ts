import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXAM_DEVICE_COOKIE_NAME,
  examDeviceCookieOptions,
  examDeviceTokenFromRequest,
  prepareExamDeviceSecurity,
} from "@/lib/examSprint/deviceSession";
import { examHttpError } from "@/lib/examSprint/server";

function jsonError(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: value.code || "EXAM_DEVICE_SESSION_FAILED", message: value.message || "Could not check this device." },
    { status: Number(value.status) || 500 },
  );
}

function securityResponse(
  security: Awaited<ReturnType<typeof prepareExamDeviceSecurity>>,
) {
  const response = NextResponse.json({ ok: true, security: security.overview });
  if (security.newToken) {
    response.cookies.set(EXAM_DEVICE_COOKIE_NAME, security.newToken, examDeviceCookieOptions());
  }
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw examHttpError("Sign in to manage Exam Sprint devices.", 401, "UNAUTHORIZED");

    const security = await prepareExamDeviceSecurity({
      userId: user.id,
      token: examDeviceTokenFromRequest(request),
      userAgent: request.headers.get("user-agent"),
      autoRegister: true,
      replaceRevoked: false,
    });
    return securityResponse(security);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw examHttpError("Sign in to manage Exam Sprint devices.", 401, "UNAUTHORIZED");
    const body = await request.json().catch(() => null) as { action?: unknown } | null;
    const action = body?.action;
    if (action !== "takeover" && action !== "trust_current") {
      throw examHttpError("Choose a valid device action.", 400, "INVALID_REQUEST");
    }

    const security = await prepareExamDeviceSecurity({
      userId: user.id,
      token: examDeviceTokenFromRequest(request),
      userAgent: request.headers.get("user-agent"),
      autoRegister: true,
      replaceRevoked: true,
      force: action === "takeover",
    });
    return securityResponse(security);
  } catch (error) {
    return jsonError(error);
  }
}
