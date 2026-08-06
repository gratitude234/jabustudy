import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  EXAM_DEVICE_MAX_TRUSTED,
  EXAM_DEVICE_SESSION_LEASE_SECONDS,
  examDeviceLabelFromUserAgent,
  type ExamDeviceSecurityOverview,
  type ExamDeviceSessionState,
  type ExamTrustedDevice,
} from "./device";
import { examHttpError } from "./server";

export const EXAM_DEVICE_COOKIE_NAME = "jabu-exam-device";
const EXAM_DEVICE_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

type DeviceSessionRpcRow = {
  state?: unknown;
  allowed?: unknown;
  current_device_id?: unknown;
  active_device_id?: unknown;
  active_device_label?: unknown;
  active_last_seen_at?: unknown;
  active_expires_at?: unknown;
};

type SessionUse = {
  enforced: boolean;
  state: ExamDeviceSessionState;
  allowed: boolean;
  currentDeviceId: string | null;
  activeDeviceId: string | null;
  activeDeviceLabel: string | null;
  activeLastSeenAt: string | null;
  activeExpiresAt: string | null;
};

function stringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function isSecuritySchemaMissing(error: { code?: string | null; message?: string | null }) {
  const code = String(error.code ?? "");
  const message = String(error.message ?? "").toLowerCase();
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(code)) return true;
  const namesSecurityObject = message.includes("exam_sprint_device")
    || message.includes("study_exam_device");
  return namesSecurityObject && (message.includes("could not find") || message.includes("does not exist"));
}

export function examDeviceTokenHash(token: string | null | undefined) {
  if (!token) return null;
  return createHash("sha256").update(token).digest("hex");
}

function newDeviceToken() {
  return randomBytes(32).toString("base64url");
}

export function examDeviceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: EXAM_DEVICE_COOKIE_MAX_AGE_SECONDS,
  };
}

export function examDeviceTokenFromRequest(request: NextRequest) {
  return request.cookies.get(EXAM_DEVICE_COOKIE_NAME)?.value?.trim() || null;
}

async function claimExamDeviceSession(
  userId: string,
  token: string | null,
  force = false,
): Promise<SessionUse> {
  const { data, error } = await adminSupabase.rpc("use_exam_sprint_device_session", {
    p_user_id: userId,
    p_token_hash: examDeviceTokenHash(token),
    p_force: force,
    p_lease_seconds: EXAM_DEVICE_SESSION_LEASE_SECONDS,
  });

  if (error) {
    if (isSecuritySchemaMissing(error)) {
      // Availability wins during a staged rollout: until the migration exists,
      // the already-working CBT flow continues instead of being taken offline.
      return {
        enforced: false,
        state: "unavailable",
        allowed: true,
        currentDeviceId: null,
        activeDeviceId: null,
        activeDeviceLabel: null,
        activeLastSeenAt: null,
        activeExpiresAt: null,
      };
    }
    throw examHttpError("Device security is temporarily unavailable. Please try again.", 503, "EXAM_SECURITY_UNAVAILABLE");
  }

  const row = (Array.isArray(data) ? data[0] : null) as DeviceSessionRpcRow | null;
  const rawState = stringOrNull(row?.state);
  const state: ExamDeviceSessionState = rawState === "ok"
    || rawState === "session_in_use"
    || rawState === "device_required"
    || rawState === "device_revoked"
    ? rawState
    : "device_required";
  return {
    enforced: true,
    state,
    allowed: row?.allowed === true,
    currentDeviceId: stringOrNull(row?.current_device_id),
    activeDeviceId: stringOrNull(row?.active_device_id),
    activeDeviceLabel: stringOrNull(row?.active_device_label),
    activeLastSeenAt: stringOrNull(row?.active_last_seen_at),
    activeExpiresAt: stringOrNull(row?.active_expires_at),
  };
}

function guardError(session: SessionUse) {
  if (session.state === "session_in_use") {
    return examHttpError("Exam Sprint is active on another trusted device. Open your account to switch devices.", 409, "EXAM_SESSION_IN_USE");
  }
  if (session.state === "device_revoked") {
    return examHttpError("This device was signed out of Exam Sprint. Open your account to trust it again.", 409, "EXAM_DEVICE_REVOKED");
  }
  return examHttpError("Confirm this device in your Exam Sprint account before continuing.", 409, "EXAM_DEVICE_REQUIRED");
}

/** Server-side guard for every exam attempt API. */
export async function requireExamDeviceSession(request: NextRequest, userId: string) {
  const session = await claimExamDeviceSession(userId, examDeviceTokenFromRequest(request));
  if (session.enforced && !session.allowed) throw guardError(session);
  return session;
}

/** Server Component equivalent used before rendering private corrections. */
export async function getExamPageDeviceSession(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(EXAM_DEVICE_COOKIE_NAME)?.value?.trim() || null;
  return claimExamDeviceSession(userId, token);
}

async function registerExamDevice(userId: string, label: string) {
  const token = newDeviceToken();
  const { data, error } = await adminSupabase.rpc("register_exam_sprint_device", {
    p_user_id: userId,
    p_token_hash: examDeviceTokenHash(token),
    p_device_label: label,
    p_max_devices: EXAM_DEVICE_MAX_TRUSTED,
  });

  if (error) {
    if (isSecuritySchemaMissing(error)) return { state: "unavailable" as const, token: null };
    if (String(error.message ?? "").includes("EXAM_DEVICE_LIMIT")) {
      return { state: "device_limit" as const, token: null };
    }
    throw examHttpError("Could not trust this device. Please try again.", 503, "EXAM_DEVICE_REGISTER_FAILED");
  }

  const row = Array.isArray(data) ? data[0] as { device_id?: unknown } | undefined : undefined;
  if (!stringOrNull(row?.device_id)) {
    throw examHttpError("Could not trust this device. Please try again.", 503, "EXAM_DEVICE_REGISTER_FAILED");
  }
  return { state: "ok" as const, token };
}

async function listExamDevices(
  userId: string,
  currentDeviceId: string | null,
  preferredState: ExamDeviceSessionState,
  sessionHint?: SessionUse,
): Promise<ExamDeviceSecurityOverview> {
  const [{ data: deviceRows, error: deviceError }, { data: sessionRow, error: sessionError }] = await Promise.all([
    adminSupabase
      .from("study_exam_devices")
      .select("id,device_label,created_at,last_seen_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false }),
    adminSupabase
      .from("study_exam_device_sessions")
      .select("device_id,last_seen_at,expires_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (deviceError || sessionError) {
    const error = deviceError || sessionError!;
    if (isSecuritySchemaMissing(error)) {
      return {
        available: false,
        state: "unavailable",
        maxDevices: EXAM_DEVICE_MAX_TRUSTED,
        currentDeviceId: null,
        activeDeviceId: null,
        activeDeviceLabel: null,
        activeLastSeenAt: null,
        devices: [],
      };
    }
    throw examHttpError("Could not load your trusted devices. Please try again.", 503, "EXAM_DEVICE_LOAD_FAILED");
  }

  const now = Date.now();
  const sessionExpires = sessionRow?.expires_at ? new Date(sessionRow.expires_at).getTime() : 0;
  const activeDeviceId = sessionExpires > now ? stringOrNull(sessionRow?.device_id) : null;
  const rows = (deviceRows ?? []) as Array<Record<string, unknown>>;
  const devices: ExamTrustedDevice[] = rows.map((row) => ({
    id: String(row.id),
    label: String(row.device_label || "Browser on device"),
    createdAt: String(row.created_at || ""),
    lastSeenAt: String(row.last_seen_at || ""),
    isCurrent: String(row.id) === currentDeviceId,
    isActive: String(row.id) === activeDeviceId,
  })).sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
    return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
  });
  const activeDevice = devices.find((device) => device.id === activeDeviceId) ?? null;

  return {
    available: true,
    state: preferredState,
    maxDevices: EXAM_DEVICE_MAX_TRUSTED,
    currentDeviceId,
    activeDeviceId,
    activeDeviceLabel: sessionHint?.activeDeviceLabel || activeDevice?.label || null,
    activeLastSeenAt: sessionHint?.activeLastSeenAt || (activeDevice?.lastSeenAt ?? null),
    devices,
  };
}

export async function prepareExamDeviceSecurity({
  userId,
  token,
  userAgent,
  force = false,
  autoRegister = true,
  replaceRevoked = false,
}: {
  userId: string;
  token: string | null;
  userAgent?: string | null;
  force?: boolean;
  autoRegister?: boolean;
  replaceRevoked?: boolean;
}) {
  let session = await claimExamDeviceSession(userId, token, force);
  if (!session.enforced) {
    return {
      overview: await listExamDevices(userId, null, "unavailable").catch(() => ({
        available: false,
        state: "unavailable" as const,
        maxDevices: EXAM_DEVICE_MAX_TRUSTED,
        currentDeviceId: null,
        activeDeviceId: null,
        activeDeviceLabel: null,
        activeLastSeenAt: null,
        devices: [],
      })),
      newToken: null as string | null,
    };
  }

  let newToken: string | null = null;
  const shouldRegister = autoRegister && (
    session.state === "device_required"
    || (session.state === "device_revoked" && replaceRevoked)
  );
  if (shouldRegister) {
    const registration = await registerExamDevice(userId, examDeviceLabelFromUserAgent(userAgent));
    if (registration.state === "unavailable") {
      return {
        overview: {
          available: false,
          state: "unavailable" as const,
          maxDevices: EXAM_DEVICE_MAX_TRUSTED,
          currentDeviceId: null,
          activeDeviceId: null,
          activeDeviceLabel: null,
          activeLastSeenAt: null,
          devices: [],
        },
        newToken: null,
      };
    }
    if (registration.state === "device_limit") {
      return {
        overview: await listExamDevices(userId, null, "device_limit"),
        newToken: null,
      };
    }
    newToken = registration.token;
    session = await claimExamDeviceSession(userId, newToken, force);
  }

  const overview = await listExamDevices(userId, session.currentDeviceId, session.state, session);
  return { overview, newToken };
}

export async function revokeExamDevice(userId: string, deviceId: string, currentToken: string | null) {
  const currentHash = examDeviceTokenHash(currentToken);
  const { data: target, error: loadError } = await adminSupabase
    .from("study_exam_devices")
    .select("id,token_hash,revoked_at")
    .eq("id", deviceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) {
    if (isSecuritySchemaMissing(loadError)) throw examHttpError("Device controls are not ready yet.", 503, "EXAM_SECURITY_UNAVAILABLE");
    throw examHttpError("Could not load that device.", 500, "EXAM_DEVICE_LOAD_FAILED");
  }
  if (!target || target.revoked_at) throw examHttpError("That trusted device was not found.", 404, "EXAM_DEVICE_NOT_FOUND");
  if (currentHash && target.token_hash === currentHash) {
    throw examHttpError("Use Log out to sign out this device.", 400, "EXAM_DEVICE_CURRENT");
  }

  const now = new Date().toISOString();
  const { error: revokeError } = await adminSupabase
    .from("study_exam_devices")
    .update({ revoked_at: now })
    .eq("id", deviceId)
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (revokeError) throw examHttpError("Could not sign out that device.", 500, "EXAM_DEVICE_REVOKE_FAILED");
  await adminSupabase
    .from("study_exam_device_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("device_id", deviceId);
}

export async function revokeCurrentExamDevice(userId: string, token: string | null) {
  const tokenHash = examDeviceTokenHash(token);
  if (!tokenHash) return;
  const { data: target } = await adminSupabase
    .from("study_exam_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!target?.id) return;
  const now = new Date().toISOString();
  await adminSupabase
    .from("study_exam_devices")
    .update({ revoked_at: now })
    .eq("id", target.id)
    .eq("user_id", userId);
  await adminSupabase
    .from("study_exam_device_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("device_id", target.id);
}
