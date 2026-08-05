import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  legacyCompatibleExamReturnPath,
  restoreBillingReturnPath,
  sanitizeBillingReturnPath,
} from "../lib/billingReturnPath";

describe("sanitizeBillingReturnPath", () => {
  it("preserves a same-origin Study path with query and hash", () => {
    expect(sanitizeBillingReturnPath("/study/practice/set-1?mode=review#question-4"))
      .toBe("/study/practice/set-1?mode=review#question-4");
  });

  it("preserves Exam Sprint landing and exact-course return paths", () => {
    expect(sanitizeBillingReturnPath("/exam")).toBe("/exam");
    expect(sanitizeBillingReturnPath("/exam/cos-101?from=checkout#mock"))
      .toBe("/exam/cos-101?from=checkout#mock");
  });

  it("round-trips Exam Sprint paths through the legacy Study-only database constraint", () => {
    const canonical = "/exam/bio-101?from=checkout#mock";
    const stored = legacyCompatibleExamReturnPath(canonical);

    expect(stored).toBe("/study/exam-return/bio-101?from=checkout#mock");
    expect(restoreBillingReturnPath(stored)).toBe(canonical);
    expect(restoreBillingReturnPath("/study/practice/set-1")).toBe("/study/practice/set-1");
  });

  it.each([
    "https://evil.example/study/practice",
    "//evil.example/study/practice",
    "/study\\practice",
    "/study/%5C%5Cevil.example",
    "/study/billing",
    "/study/billing?ref=abc",
    "/study/billing/receipt/order-1",
    "/marketplace",
    "/exam\\cos-101",
    "/exam/%5C%5Cevil.example",
  ])("rejects unsafe or looping return target %s", (value) => {
    expect(sanitizeBillingReturnPath(value)).toBe("/study");
  });

  it("caps overly long values", () => {
    expect(sanitizeBillingReturnPath(`/study/${"a".repeat(700)}`).length).toBeLessThanOrEqual(500);
  });

  it("ships a database constraint that accepts Study and Exam Sprint paths", () => {
    const migration = readFileSync(
      new URL("../supabase/migrations/20260805_exam_sprint_billing_return_paths.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("return_path ~ '^/(study|exam)(/|[?#]|$)'");
    expect(migration).toContain("return_path !~ '^/study/billing(/|[?#]|$)'");
  });
});
