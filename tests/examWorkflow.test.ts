import { describe, expect, it } from "vitest";
import {
  EXAM_MISTAKE_GRACE_MS,
  examMistakeGraceEndsAt,
  examMistakeGraceIsOpen,
  examTabLeaseBelongsToAnotherTab,
  parseExamTabLease,
  partitionTimedExamAttempts,
} from "../lib/examSprint/workflow";

describe("Exam Sprint accidental-start grace", () => {
  const startedAt = "2026-08-07T10:00:00.000Z";
  const startedMs = new Date(startedAt).getTime();

  it("keeps the mistake window open for exactly the first 60 seconds", () => {
    expect(EXAM_MISTAKE_GRACE_MS).toBe(60_000);
    expect(examMistakeGraceEndsAt(startedAt)).toBe(startedMs + 60_000);
    expect(examMistakeGraceIsOpen(startedAt, startedMs + 59_999)).toBe(true);
    expect(examMistakeGraceIsOpen(startedAt, startedMs + 60_000)).toBe(false);
  });

  it("fails closed for an invalid start timestamp", () => {
    expect(examMistakeGraceEndsAt("not-a-date")).toBe(0);
    expect(examMistakeGraceIsOpen("not-a-date", startedMs)).toBe(false);
  });
});

describe("Exam Sprint timed-attempt workflow", () => {
  const now = new Date("2026-08-04T20:00:00.000Z").getTime();

  it("returns the live attempt with the nearest deadline and separates expired rows", () => {
    const attempts = [
      { id: "later", status: "in_progress", deadline_at: "2026-08-04T20:35:00.000Z", started_at: "2026-08-04T19:55:00.000Z" },
      { id: "expired", status: "in_progress", deadline_at: "2026-08-04T19:59:59.000Z", started_at: "2026-08-04T19:20:00.000Z" },
      { id: "urgent", status: "in_progress", deadline_at: "2026-08-04T20:05:00.000Z", started_at: "2026-08-04T19:25:00.000Z" },
      { id: "submitted", status: "submitted", deadline_at: "2026-08-04T20:01:00.000Z", started_at: "2026-08-04T19:21:00.000Z" },
    ];

    const result = partitionTimedExamAttempts(attempts, now);
    expect(result.primary?.id).toBe("urgent");
    expect(result.active.map(({ id }) => id)).toEqual(["urgent", "later"]);
    expect(result.expired.map(({ id }) => id)).toEqual(["expired"]);
  });

  it("uses the oldest start as a deterministic tie-breaker", () => {
    const attempts = [
      { id: "newer", status: "in_progress", deadline_at: "2026-08-04T20:20:00.000Z", started_at: "2026-08-04T19:50:00.000Z" },
      { id: "older", status: "in_progress", deadline_at: "2026-08-04T20:20:00.000Z", started_at: "2026-08-04T19:40:00.000Z" },
    ];

    expect(partitionTimedExamAttempts(attempts, now).primary?.id).toBe("older");
  });
});

describe("Exam Sprint tab lease", () => {
  const now = 1_000;

  it("blocks a different tab only while its lease is live", () => {
    const live = JSON.stringify({ tabId: "tab-a", expiresAt: 2_000 });
    expect(examTabLeaseBelongsToAnotherTab(live, "tab-b", now)).toBe(true);
    expect(examTabLeaseBelongsToAnotherTab(live, "tab-a", now)).toBe(false);
    expect(examTabLeaseBelongsToAnotherTab(live, "tab-b", 2_001)).toBe(false);
  });

  it("ignores corrupt lease data", () => {
    expect(parseExamTabLease("not-json")).toBeNull();
    expect(parseExamTabLease(JSON.stringify({ tabId: "", expiresAt: "later" }))).toBeNull();
    expect(examTabLeaseBelongsToAnotherTab("not-json", "tab-b", now)).toBe(false);
  });
});
