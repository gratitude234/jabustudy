import { describe, expect, it } from "vitest";
import {
  buildExamMaterialRequestWhatsAppUrl,
  getExamMaterialRequestPhone,
  normalizeExamMaterialWhatsAppNumber,
} from "../lib/examSprint/materialRequest";

describe("Exam Sprint material requests", () => {
  it("normalizes the local Nigerian support number for wa.me", () => {
    expect(normalizeExamMaterialWhatsAppNumber("07041022336")).toBe("2347041022336");
    expect(normalizeExamMaterialWhatsAppNumber("+234 704 102 2336")).toBe("2347041022336");
  });

  it("uses the Exam Sprint support number when no override is configured", () => {
    expect(getExamMaterialRequestPhone({})).toBe("2347041022336");
  });

  it("prefills a known course material request", () => {
    const url = buildExamMaterialRequestWhatsAppUrl({
      phone: "07041022336",
      courseCode: "GNS 123",
      courseTitle: "Nigeria People and Culture",
    });
    expect(url).toContain("https://wa.me/2347041022336?text=");
    expect(decodeURIComponent(url)).toContain("GNS 123 — Nigeria People and Culture");
    expect(decodeURIComponent(url)).toContain("needs course material");
  });

  it("prefills the student's missing-course search", () => {
    const url = buildExamMaterialRequestWhatsAppUrl({
      phone: "2347041022336",
      searchQuery: "ACC 101",
    });
    expect(decodeURIComponent(url)).toContain("couldn't find “ACC 101”");
    expect(decodeURIComponent(url)).toContain("Course code:");
  });
});
