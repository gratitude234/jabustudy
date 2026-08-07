import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260807_exam_sprint_course_switching.sql", import.meta.url),
  "utf8",
);

describe("Exam Sprint course-switching migration", () => {
  it("supports explicit mistake and switched outcomes", () => {
    expect(migration).toContain("'manual', 'timeup', 'mistake', 'switched'");
  });

  it("kept grace-cancelled diagnostics out of the prior allowance index", () => {
    expect(migration).toContain("experience = 'exam_diagnostic' and status <> 'cancelled'");
  });

  it("uses ended-early mocks as leaderboard slots without turning them into scores", () => {
    expect(migration).toContain("a.status in ('submitted', 'abandoned')");
    expect(migration).toContain("where s.status = 'submitted'");
  });
});
