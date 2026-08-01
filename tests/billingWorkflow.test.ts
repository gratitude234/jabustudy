import { describe, expect, it } from "vitest";
import { billingUiState, canReusePaystackCheckout, isRetryableBillingStatus, selectBillingVisitOrder } from "../lib/billingWorkflow";

const base = {
  paymentMethod: "paystack" as const,
  status: "pending_payment",
  reference: "REF-1",
  planKey: "plus_monthly",
  createdAt: "2026-08-01T10:00:00.000Z",
  authorizationUrl: "https://checkout.paystack.com/test",
};

describe("billing workflow selection", () => {
  it("reuses a recent checkout only for the same plan", () => {
    const now = new Date("2026-08-01T11:00:00.000Z").getTime();
    expect(canReusePaystackCheckout(base, "plus_monthly", now)).toBe(true);
    expect(canReusePaystackCheckout(base, "credits_20", now)).toBe(false);
    expect(canReusePaystackCheckout({ ...base, createdAt: "2026-07-29T10:00:00.000Z" }, "plus_monthly", now)).toBe(false);
  });

  it("prefers the callback order, including an abandoned order that may recover", () => {
    const abandoned = { ...base, status: "abandoned", reference: "OLD" };
    expect(selectBillingVisitOrder([base, abandoned], "OLD")?.reference).toBe("OLD");
  });

  it("selects active Paystack before a legacy manual order", () => {
    const manual = { ...base, paymentMethod: "manual" as const, reference: "MANUAL" };
    expect(selectBillingVisitOrder([manual, base], null)?.reference).toBe("REF-1");
  });
});

describe("billing UI states", () => {
  it("never routes approved Paystack into manual instructions", () => {
    expect(billingUiState({ paymentMethod: "paystack", status: "approved" })).toBe("success");
    expect(billingUiState({ paymentMethod: "manual", status: "pending_payment" })).toBe("manual_payment");
  });

  it.each(["failed", "abandoned", "expired", "rejected"])("marks %s as retryable", (status) => {
    expect(isRetryableBillingStatus(status)).toBe(true);
    expect(billingUiState({ paymentMethod: "paystack", status })).toBe("retry");
  });
});
