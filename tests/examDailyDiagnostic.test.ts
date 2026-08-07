import { describe, expect, it } from "vitest";
import {
  buildExamDiagnosticPreviewPool,
  examAttemptStartedInDiagnosticDay,
  examDiagnosticDayWindow,
} from "../lib/examSprint/dailyDiagnostic";

describe("Exam Sprint daily diagnostic", () => {
  it("resets at midnight WAT rather than UTC midnight", () => {
    const beforeReset = examDiagnosticDayWindow(new Date("2026-08-06T22:59:59.000Z"));
    const afterReset = examDiagnosticDayWindow(new Date("2026-08-06T23:00:00.000Z"));

    expect(beforeReset).toEqual({
      key: "2026-08-06",
      startIso: "2026-08-05T23:00:00.000Z",
      endIso: "2026-08-06T23:00:00.000Z",
    });
    expect(afterReset.key).toBe("2026-08-07");
    expect(afterReset.startIso).toBe("2026-08-06T23:00:00.000Z");
  });

  it("counts only attempts started inside the current WAT day", () => {
    const window = examDiagnosticDayWindow(new Date("2026-08-06T12:00:00.000Z"));
    expect(examAttemptStartedInDiagnosticDay("2026-08-05T23:00:00.000Z", window)).toBe(true);
    expect(examAttemptStartedInDiagnosticDay("2026-08-06T22:59:59.999Z", window)).toBe(true);
    expect(examAttemptStartedInDiagnosticDay("2026-08-06T23:00:00.000Z", window)).toBe(false);
  });

  it("keeps the free preview pool stable, capped, and independent of input order", () => {
    const candidates = Array.from({ length: 80 }, (_, index) => ({ id: `question-${index + 1}` }));
    const first = buildExamDiagnosticPreviewPool(candidates);
    const reversed = buildExamDiagnosticPreviewPool([...candidates].reverse());

    expect(first).toHaveLength(30);
    expect(first.map(({ id }) => id)).toEqual(reversed.map(({ id }) => id));
    expect(new Set(first.map(({ id }) => id)).size).toBe(30);
  });
});
