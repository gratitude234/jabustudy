import { describe, expect, it } from "vitest";
import {
  examDeviceLabelFromUserAgent,
  isExamDeviceBlockingState,
  isExamDeviceGuardErrorCode,
  sanitizeExamSecurityReturnPath,
} from "../lib/examSprint/device";

describe("Exam Sprint device security", () => {
  it("creates useful device labels without IP or fingerprint data", () => {
    expect(examDeviceLabelFromUserAgent(
      "Mozilla/5.0 (Linux; Android 16; SM-A165F) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 SamsungBrowser/28.0",
    )).toBe("Samsung Internet on Android");
    expect(examDeviceLabelFromUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    )).toBe("Safari on iPhone");
    expect(examDeviceLabelFromUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    )).toBe("Chrome on Windows");
  });

  it("only permits internal Exam Sprint return paths", () => {
    expect(sanitizeExamSecurityReturnPath("/exam/gns-121?from=security")).toBe("/exam/gns-121?from=security");
    expect(sanitizeExamSecurityReturnPath("/exam/result/abc#corrections")).toBe("/exam/result/abc#corrections");
    expect(sanitizeExamSecurityReturnPath("/study/me")).toBe("/exam");
    expect(sanitizeExamSecurityReturnPath("//evil.example/exam")).toBe("/exam");
    expect(sanitizeExamSecurityReturnPath("/exam/me")).toBe("/exam");
  });

  it("recognises every state that must stop an exam action", () => {
    for (const state of ["session_in_use", "device_limit", "device_required", "device_revoked"]) {
      expect(isExamDeviceBlockingState(state)).toBe(true);
    }
    expect(isExamDeviceBlockingState("ok")).toBe(false);
    expect(isExamDeviceBlockingState("unavailable")).toBe(false);
    expect(isExamDeviceGuardErrorCode("EXAM_SESSION_IN_USE")).toBe(true);
    expect(isExamDeviceGuardErrorCode("EXAM_DEVICE_REQUIRED")).toBe(true);
    expect(isExamDeviceGuardErrorCode("EXAM_DEVICE_REVOKED")).toBe(true);
    expect(isExamDeviceGuardErrorCode("ATTEMPT_SUBMITTED")).toBe(false);
  });
});
