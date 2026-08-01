export const PAYSTACK_ACTIVE_STATUSES = ["initializing", "pending_payment"] as const;
export const BILLING_RETRYABLE_STATUSES = ["failed", "abandoned", "expired", "rejected"] as const;

type WorkflowOrder = {
  paymentMethod: "manual" | "paystack";
  status: string;
  reference: string;
  planKey: string;
  createdAt: string;
  authorizationUrl?: string | null;
};

export function isRetryableBillingStatus(status: string) {
  return (BILLING_RETRYABLE_STATUSES as readonly string[]).includes(status);
}

export function canReusePaystackCheckout(
  order: Pick<WorkflowOrder, "paymentMethod" | "status" | "planKey" | "createdAt" | "authorizationUrl">,
  planKey: string,
  nowMs = Date.now()
) {
  return order.paymentMethod === "paystack"
    && order.status === "pending_payment"
    && order.planKey === planKey
    && Boolean(order.authorizationUrl)
    && nowMs - new Date(order.createdAt).getTime() < 48 * 3_600_000;
}

export function selectBillingVisitOrder<T extends WorkflowOrder>(orders: T[], callbackReference?: string | null) {
  const callbackOrder = callbackReference
    ? orders.find((order) => order.paymentMethod === "paystack" && order.reference === callbackReference)
    : undefined;
  if (callbackOrder) return callbackOrder;
  return orders.find(
    (order) => order.paymentMethod === "paystack"
      && (PAYSTACK_ACTIVE_STATUSES as readonly string[]).includes(order.status)
  ) ?? orders.find(
    (order) => order.paymentMethod === "manual"
      && (order.status === "pending_payment" || order.status === "pending_review")
  ) ?? null;
}

export function billingUiState(order: Pick<WorkflowOrder, "paymentMethod" | "status"> | null) {
  if (!order) return "plans" as const;
  if (order.status === "approved") return "success" as const;
  if (order.paymentMethod === "manual" && order.status === "pending_payment") return "manual_payment" as const;
  if (order.paymentMethod === "manual" && order.status === "pending_review") return "manual_review" as const;
  if (order.paymentMethod === "paystack" && order.status === "initializing") return "initializing" as const;
  if (order.paymentMethod === "paystack" && order.status === "pending_payment") return "paystack_pending" as const;
  if (isRetryableBillingStatus(order.status)) return "retry" as const;
  return "plans" as const;
}
