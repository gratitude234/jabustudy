import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260807_exam_sprint_five_hour_diagnostic.sql"),
  "utf8",
);

describe("Exam Sprint five-hour diagnostic migration", () => {
  it("removes the WAT-day uniqueness rule that would block same-day cooldown refreshes", () => {
    expect(migration).toContain("drop index if exists public.study_exam_one_diagnostic_per_wat_day_idx");
  });

  it("adds a latest-diagnostic lookup index while excluding grace cancellations", () => {
    expect(migration).toContain("study_exam_diagnostic_cooldown_lookup_idx");
    expect(migration).toContain("where experience = 'exam_diagnostic' and status <> 'cancelled'");
  });
});
