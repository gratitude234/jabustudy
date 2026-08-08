import { describe, expect, it } from "vitest";

import {
  EXAM_SPRINT_MONTHLY_PLAN_KEY,
  EXAM_SPRINT_PLAN_KEY,
  EXAM_SPRINT_WEEKLY_PLAN_KEY,
  isBillingPlanAllowedInSystemMode,
  isExamSprintBillingPlan,
  isExamOnlyApiAllowed,
  isExamOnlyBillingEntryAllowed,
  isExamOnlyPageAllowed,
  isExamSprintOnlyMode,
  sanitizeSystemDestination,
} from "../lib/systemMode";

describe("Exam Sprint-only system mode", () => {
  it("is opt-in and accepts common true values", () => {
    expect(isExamSprintOnlyMode({})).toBe(false);
    expect(isExamSprintOnlyMode({ EXAM_SPRINT_ONLY_MODE: "false" })).toBe(false);
    expect(isExamSprintOnlyMode({ EXAM_SPRINT_ONLY_MODE: "true" })).toBe(true);
    expect(isExamSprintOnlyMode({ EXAM_SPRINT_ONLY_MODE: "ON" })).toBe(true);
    expect(isExamSprintOnlyMode({ EXAM_SPRINT_ONLY_MODE: "1" })).toBe(true);
  });

  it.each([
    "/",
    "/exam",
    "/exam/GNS121",
    "/login",
    "/signup",
    "/auth/callback",
    "/study/billing",
    "/study/billing/receipt/order-1",
    "/study-admin/exam-sprint",
    "/support",
    "/offline",
    "/manifest.webmanifest",
    "/google3ea27c3fabbbd9d5.html",
  ])("allows the required page %s", (pathname) => {
    expect(isExamOnlyPageAllowed(pathname)).toBe(true);
  });

  it.each([
    "/study",
    "/study/library",
    "/study/practice/set-1",
    "/notifications",
    "/exam-results",
    "/google3ea27c3fabbbd9d5.html/extra",
    "/not-google3ea27c3fabbbd9d5.html",
  ])("pauses the public Study page %s", (pathname) => {
    expect(isExamOnlyPageAllowed(pathname)).toBe(false);
  });

  it.each([
    "/api/exam/attempts",
    "/api/billing/orders/paystack/init",
    "/api/billing/paystack/webhook",
    "/api/study-admin/exam-sprint",
    "/api/ai/parse-mcq",
    "/api/cron/streak-reminder",
    "/api/health/study-schema",
  ])("allows the required API %s", (pathname) => {
    expect(isExamOnlyApiAllowed(pathname)).toBe(true);
  });

  it.each([
    "/api/study/courses",
    "/api/ai/study-plan",
    "/api/user/push",
  ])("pauses the normal Study API %s", (pathname) => {
    expect(isExamOnlyApiAllowed(pathname)).toBe(false);
  });

  it("only admits the Exam Sprint billing context", () => {
    expect(isExamOnlyBillingEntryAllowed(new URLSearchParams("offer=exam-sprint"))).toBe(true);
    expect(isExamOnlyBillingEntryAllowed(new URLSearchParams("offer=plus"))).toBe(false);
    expect(isExamOnlyBillingEntryAllowed(new URLSearchParams())).toBe(false);
  });

  it("sanitizes paused and external auth destinations directly to Exam Sprint", () => {
    const options = { examOnlyMode: true, fallback: "/exam" };
    expect(sanitizeSystemDestination("/exam/GNS121", options)).toBe("/exam/GNS121");
    expect(sanitizeSystemDestination("/study/library", options)).toBe("/exam");
    expect(sanitizeSystemDestination("https://evil.example", options)).toBe("/exam");
    expect(sanitizeSystemDestination("//evil.example", options)).toBe("/exam");
    expect(sanitizeSystemDestination("/study/billing?offer=exam-sprint&returnTo=%2Fexam", options))
      .toBe("/study/billing?offer=exam-sprint&returnTo=%2Fexam");
  });

  it("preserves normal internal auth destinations when the mode is off", () => {
    expect(sanitizeSystemDestination("/study/library", {
      examOnlyMode: false,
      fallback: "/study",
    })).toBe("/study/library");
  });

  it("restricts new purchases to the two Exam Sprint pass durations", () => {
    expect(isBillingPlanAllowedInSystemMode(EXAM_SPRINT_PLAN_KEY, true)).toBe(true);
    expect(isBillingPlanAllowedInSystemMode(EXAM_SPRINT_WEEKLY_PLAN_KEY, true)).toBe(true);
    expect(isBillingPlanAllowedInSystemMode(EXAM_SPRINT_MONTHLY_PLAN_KEY, true)).toBe(true);
    expect(isExamSprintBillingPlan(EXAM_SPRINT_WEEKLY_PLAN_KEY)).toBe(true);
    expect(isExamSprintBillingPlan(EXAM_SPRINT_MONTHLY_PLAN_KEY)).toBe(true);
    expect(isBillingPlanAllowedInSystemMode("credits_100", true)).toBe(false);
    expect(isBillingPlanAllowedInSystemMode("credits_100", false)).toBe(true);
  });
});
