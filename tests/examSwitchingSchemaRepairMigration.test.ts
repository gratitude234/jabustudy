import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260807_exam_sprint_switching_schema_repair.sql", import.meta.url),
  "utf8",
);

describe("Exam Sprint switching schema repair", () => {
  it("accepts both switching submission reasons", () => {
    expect(migration).toContain("'manual', 'timeup', 'mistake', 'switched'");
  });

  it("quotes the leaderboard position output instead of using the SQL keyword bare", () => {
    expect(migration).toContain('"position" bigint');
    expect(migration).toContain('leaderboard_position as "position"');
  });

  it("keeps abandoned mocks as leaderboard slots but not scored attempts", () => {
    expect(migration).toContain("status in ('submitted', 'abandoned')");
    expect(migration).toContain("where slot.status = 'submitted'");
  });

  it("does not restore the superseded WAT-day diagnostic unique index", () => {
    expect(migration).not.toContain("create unique index study_exam_one_diagnostic_per_wat_day_idx");
  });
});
