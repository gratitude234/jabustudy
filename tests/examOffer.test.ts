import { describe, expect, it } from "vitest";
import {
  buildExamSprintBillingHref,
  examDailyEquivalent,
  projectedExamAccessUntil,
  readExamCheckoutContext,
} from "../lib/examSprint/offer";

describe("Exam Sprint checkout context", () => {
  it("preserves a safe course, score and focus topic", () => {
    const href = buildExamSprintBillingHref({
      returnTo: "/exam/gns-121",
      diagnosticScore: 13,
      focusTopic: "  Windows   and\nFile Management  ",
    });
    const url = new URL(href, "https://jabustudy.com");

    expect(url.pathname).toBe("/study/billing");
    expect(url.searchParams.get("offer")).toBe("exam-sprint");
    expect(url.searchParams.get("returnTo")).toBe("/exam/gns-121");
    expect(readExamCheckoutContext(url.searchParams)).toEqual({
      diagnosticScore: 13,
      focusTopic: "Windows and File Management",
    });
  });

  it("drops invalid persuasion context and rejects an external return path", () => {
    const href = buildExamSprintBillingHref({
      returnTo: "https://evil.example/checkout",
      diagnosticScore: 140,
      focusTopic: "\u0000   ",
    });
    const url = new URL(href, "https://jabustudy.com");

    expect(url.searchParams.get("returnTo")).toBe("/study");
    expect(url.searchParams.has("diagnosticScore")).toBe(false);
    expect(url.searchParams.has("focus")).toBe(false);
  });
});

describe("Exam Sprint price framing", () => {
  it("projects a new pass from today and an extension from the current expiry", () => {
    const nowMs = new Date("2026-08-04T12:00:00.000Z").getTime();
    expect(projectedExamAccessUntil({ days: 30, nowMs }))
      .toBe("2026-09-03T12:00:00.000Z");
    expect(projectedExamAccessUntil({
      activeUntil: "2026-08-20T12:00:00.000Z",
      days: 30,
      nowMs,
    })).toBe("2026-09-19T12:00:00.000Z");
  });

  it("uses a rounded, honest daily equivalent", () => {
    expect(examDailyEquivalent(1_000, 30)).toBe(33);
  });
});
