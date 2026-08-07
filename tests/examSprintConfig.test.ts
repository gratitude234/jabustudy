import { describe, expect, it } from "vitest";
import {
  EXAM_COURSES,
  EXAM_SPRINT_REGULAR_PRICE_NAIRA,
  examCourseBankNeedsMaterial,
  examCourseDateLabel,
  findExamCourse,
  getExamSprintPricing,
  normalizeExamCourseCode,
} from "../lib/examSprint/config";

const addedCodes = [
  "BIO 101",
  "BIO 107",
  "CHM 101",
  "CHM 107",
  "PHY 101",
  "PHY 107",
  "MTH 101",
  "COS 101",
  "GNS 111",
  "GNS 112",
  "GNS 113",
];

describe("Exam Sprint course catalog", () => {
  it("contains every additional summer course with unique codes and slugs", () => {
    const codes = EXAM_COURSES.map((course) => normalizeExamCourseCode(course.code));
    const slugs = EXAM_COURSES.map((course) => course.slug);

    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const code of addedCodes) expect(codes).toContain(normalizeExamCourseCode(code));
  });

  it("finds codes whether or not the student includes a space", () => {
    expect(findExamCourse("CHM107")?.code).toBe("CHM 107");
    expect(findExamCourse("PHY101")?.code).toBe("PHY 101");
    expect(findExamCourse("gns-113")?.title).toBe("Use of Library");
  });

  it("shows an honest placeholder when the timetable date is unknown", () => {
    const course = findExamCourse("BIO 101");
    expect(course).not.toBeNull();
    expect(examCourseDateLabel(course!)).toBe("Exam date to be announced");
    expect(examCourseDateLabel(findExamCourse("GNS 121")!)).toMatch(/WAT$/);
  });

  it("uses the confirmed summer timetable dates", () => {
    expect(findExamCourse("COS 101")?.examAt).toBe("2026-08-10T11:30:00+01:00");
    expect(findExamCourse("CHM 101")?.examAt).toBe("2026-08-13T08:00:00+01:00");
  });

  it("keeps the mismatched GNS 121 bank out of new mocks until proper material is supplied", () => {
    expect(examCourseBankNeedsMaterial(findExamCourse("GNS 121"))).toBe(true);
    expect(examCourseBankNeedsMaterial(findExamCourse("CHM 101"))).toBe(false);
  });

  it("runs the promo price through 13 August then returns to the regular price", () => {
    const duringPromo = getExamSprintPricing(new Date("2026-08-10T12:00:00+01:00"));
    const afterPromo = getExamSprintPricing(new Date("2026-08-14T00:00:00+01:00"));

    expect(duringPromo.isPromo).toBe(true);
    expect(duringPromo.currentPriceNaira).toBe(1_000);
    expect(afterPromo.isPromo).toBe(false);
    expect(afterPromo.currentPriceNaira).toBe(EXAM_SPRINT_REGULAR_PRICE_NAIRA);
    expect(EXAM_SPRINT_REGULAR_PRICE_NAIRA).toBe(1_500);
  });
});
