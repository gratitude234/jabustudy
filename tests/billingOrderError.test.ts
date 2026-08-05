import { describe, expect, it } from "vitest";
import { billingOrderInsertError, isBillingReturnPathConstraintError } from "../lib/billingOrderError";

describe("billing order database errors", () => {
  it("does not expose a return-path constraint failure to the customer", () => {
    const failure = billingOrderInsertError({
      code: "23514",
      message: 'new row violates check constraint "study_billing_orders_return_path_check"',
    });

    expect(failure).toEqual({
      message: "Checkout is temporarily unavailable. Please try again shortly.",
      status: 503,
      code: "BILLING_SCHEMA_UPDATE_REQUIRED",
    });
    expect(failure.message).not.toContain("study_billing_orders");
    expect(isBillingReturnPathConstraintError({
      code: "23514",
      message: 'new row violates check constraint "study_billing_orders_return_path_check"',
    })).toBe(true);
  });

  it("keeps other insert failures generic", () => {
    expect(billingOrderInsertError({ code: "42501", message: "private database detail" }))
      .toEqual({
        message: "Could not create checkout. Please try again.",
        status: 500,
        code: "ORDER_CREATE_FAILED",
      });
  });
});
