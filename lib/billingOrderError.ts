type DatabaseErrorLike = {
  code?: string;
  message?: string;
};

export function isBillingReturnPathConstraintError(error: unknown) {
  const databaseError = error && typeof error === "object"
    ? error as DatabaseErrorLike
    : null;
  return databaseError?.code === "23514"
    && Boolean(databaseError.message?.includes("study_billing_orders_return_path_check"));
}

export function billingOrderInsertError(error: unknown) {
  const databaseError = error && typeof error === "object"
    ? error as DatabaseErrorLike
    : null;

  if (isBillingReturnPathConstraintError(databaseError)) {
    return {
      message: "Checkout is temporarily unavailable. Please try again shortly.",
      status: 503,
      code: "BILLING_SCHEMA_UPDATE_REQUIRED",
    } as const;
  }

  return {
    message: "Could not create checkout. Please try again.",
    status: 500,
    code: "ORDER_CREATE_FAILED",
  } as const;
}
