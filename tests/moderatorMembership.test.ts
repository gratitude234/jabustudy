import { describe, expect, it } from "vitest";

import { hasStudyModeratorMembership } from "../lib/studyAdmin/moderatorMembership";

describe("Study moderator Exam Sprint bypass", () => {
  it("allows a verified super Study Admin", () => {
    expect(hasStudyModeratorMembership({ user_id: "admin-1" }, null)).toBe(true);
  });

  it("allows active, correctly scoped librarians and course reps", () => {
    expect(hasStudyModeratorMembership(null, {
      user_id: "librarian-1",
      role: "dept_librarian",
      department_id: "dept-1",
      levels: null,
      active: true,
    })).toBe(true);
    expect(hasStudyModeratorMembership(null, {
      user_id: "rep-1",
      role: "course_rep",
      department_id: "dept-1",
      levels: [100, 200],
      active: true,
    })).toBe(true);
  });

  it("fails closed for normal, inactive or misconfigured accounts", () => {
    expect(hasStudyModeratorMembership(null, null)).toBe(false);
    expect(hasStudyModeratorMembership(null, {
      user_id: "inactive-rep",
      role: "course_rep",
      department_id: "dept-1",
      levels: [100],
      active: false,
    })).toBe(false);
    expect(hasStudyModeratorMembership(null, {
      user_id: "unscoped-rep",
      role: "course_rep",
      department_id: null,
      levels: [100],
      active: true,
    })).toBe(false);
    expect(hasStudyModeratorMembership(null, {
      user_id: "level-less-rep",
      role: "course_rep",
      department_id: "dept-1",
      levels: [],
      active: true,
    })).toBe(false);
  });
});
