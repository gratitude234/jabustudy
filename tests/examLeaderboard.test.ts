import { describe, expect, it } from "vitest";
import {
  examLeaderboardAlias,
  examLeaderboardWeekBounds,
  examLeaderboardWeekLabel,
} from "../lib/examSprint/leaderboard";

describe("Exam Sprint weekly leaderboard", () => {
  it("uses Monday 00:00 WAT as the weekly boundary", () => {
    const bounds = examLeaderboardWeekBounds(new Date("2026-08-05T03:00:00.000Z"));
    expect(bounds.start.toISOString()).toBe("2026-08-02T23:00:00.000Z");
    expect(bounds.endExclusive.toISOString()).toBe("2026-08-09T23:00:00.000Z");
    expect(examLeaderboardWeekLabel(bounds.start, bounds.endExclusive)).toBe("3\u20139 Aug");
  });

  it("rolls into a new week exactly at Monday midnight WAT", () => {
    const before = examLeaderboardWeekBounds(new Date("2026-08-09T22:59:59.999Z"));
    const after = examLeaderboardWeekBounds(new Date("2026-08-09T23:00:00.000Z"));
    expect(before.start.toISOString()).toBe("2026-08-02T23:00:00.000Z");
    expect(after.start.toISOString()).toBe("2026-08-09T23:00:00.000Z");
  });

  it("creates a stable public alias without exposing the auth id", () => {
    const userId = "8f49f5b0-2341-4b65-a123-98e171ae7777";
    const alias = examLeaderboardAlias(userId);
    expect(alias).toMatch(/^Student [A-Z0-9]{4}$/);
    expect(examLeaderboardAlias(userId)).toBe(alias);
    expect(alias).not.toContain(userId.slice(0, 8));
  });
});
