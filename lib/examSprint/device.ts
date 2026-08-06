export const EXAM_DEVICE_MAX_TRUSTED = 2;
export const EXAM_DEVICE_SESSION_LEASE_SECONDS = 15 * 60;

export type ExamDeviceSessionState =
  | "ok"
  | "session_in_use"
  | "device_limit"
  | "device_required"
  | "device_revoked"
  | "unavailable";

export type ExamTrustedDevice = {
  id: string;
  label: string;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
  isActive: boolean;
};

export type ExamDeviceSecurityOverview = {
  available: boolean;
  state: ExamDeviceSessionState;
  maxDevices: number;
  currentDeviceId: string | null;
  activeDeviceId: string | null;
  activeDeviceLabel: string | null;
  activeLastSeenAt: string | null;
  devices: ExamTrustedDevice[];
};

export function examDeviceLabelFromUserAgent(userAgent: string | null | undefined) {
  const value = String(userAgent ?? "");
  let browser = "Browser";
  if (/SamsungBrowser/i.test(value)) browser = "Samsung Internet";
  else if (/EdgA?|Edge/i.test(value)) browser = "Edge";
  else if (/CriOS|Chrome|Chromium/i.test(value)) browser = "Chrome";
  else if (/FxiOS|Firefox/i.test(value)) browser = "Firefox";
  else if (/Safari/i.test(value)) browser = "Safari";

  let device = "device";
  if (/iPhone/i.test(value)) device = "iPhone";
  else if (/iPad/i.test(value)) device = "iPad";
  else if (/Android/i.test(value)) device = "Android";
  else if (/Windows/i.test(value)) device = "Windows";
  else if (/Macintosh|Mac OS X/i.test(value)) device = "Mac";
  else if (/Linux/i.test(value)) device = "Linux";

  return `${browser} on ${device}`;
}

export function isExamDeviceBlockingState(value: unknown): value is Exclude<ExamDeviceSessionState, "ok" | "unavailable"> {
  return value === "session_in_use"
    || value === "device_limit"
    || value === "device_required"
    || value === "device_revoked";
}

export function isExamDeviceGuardErrorCode(value: unknown) {
  return value === "EXAM_SESSION_IN_USE"
    || value === "EXAM_DEVICE_REQUIRED"
    || value === "EXAM_DEVICE_REVOKED";
}

export function sanitizeExamSecurityReturnPath(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return "/exam";
  try {
    const parsed = new URL(candidate, "https://jabustudy.invalid");
    if (parsed.origin !== "https://jabustudy.invalid") return "/exam";
    if (parsed.pathname !== "/exam" && !parsed.pathname.startsWith("/exam/")) return "/exam";
    if (parsed.pathname === "/exam/me") return "/exam";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/exam";
  }
}
