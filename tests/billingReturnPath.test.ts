import { describe, expect, it } from "vitest";
import { sanitizeBillingReturnPath } from "../lib/billingReturnPath";

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
});
