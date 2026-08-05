import { describe, expect, it } from "vitest";
import { dedupeExamCourses } from "../lib/examSprint/catalog";

describe("Exam Sprint catalogue", () => {
  it("deduplicates differently formatted course codes and keeps the richest row", () => {
    const courses = [
      { code: "GNS 121", slug: "gns-121", sets: [], activeAttempt: null, progress: null },
      { code: "gns-121", slug: "gns-121-copy", sets: [{ id: "set-1" }], activeAttempt: null, progress: { attempts: 1 } },
      { code: "BIO 101", slug: "bio-101", sets: [], activeAttempt: null, progress: null },
    ];

    expect(dedupeExamCourses(courses)).toEqual([courses[1], courses[2]]);
  });
});
