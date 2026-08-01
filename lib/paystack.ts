import "server-only";

const DEFAULT_TIMEOUT_MS = 10_000;

export type PaystackProviderStatus = "success" | "failed" | "abandoned" | "pending" | "unknown";

export type PaystackTransaction = {
  id: string;
  reference: string;
  status: PaystackProviderStatus;
  rawStatus: string;
  amountKobo: number | null;
  currency: string | null;
  paidAt: string | null;
};

export class PaystackRequestError extends Error {
  code: string;
  status: number;
  retryable: boolean;

  constructor(message: string, code: string, status = 502, retryable = true) {
    super(message);
    this.name = "PaystackRequestError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function timeoutMs() {
  const configured = Number(process.env.PAYSTACK_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1_000 ? Math.trunc(configured) : DEFAULT_TIMEOUT_MS;
}

async function paystackFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new PaystackRequestError(
      aborted ? "Paystack took too long to respond. Please try again." : "Could not reach Paystack. Please try again.",
      aborted ? "PAYSTACK_TIMEOUT" : "PAYSTACK_UNAVAILABLE",
      503,
      true
    );
  } finally {
    clearTimeout(timer);
  }
}

export function normalizePaystackStatus(value: unknown): PaystackProviderStatus {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (status === "success") return "success";
  if (status === "failed" || status === "reversed") return "failed";
  if (status === "abandoned") return "abandoned";
  if (status === "pending" || status === "ongoing" || status === "processing" || status === "queued") return "pending";
  return "unknown";
}

export async function initializePaystackTransaction(args: {
  secretKey: string;
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  const response = await paystackFetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: args.email,
      amount: args.amountKobo,
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
    }),
  });

  const payload = await response.json().catch(() => null) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; access_code?: string; reference?: string };
  } | null;

  const authorizationUrl = payload?.data?.authorization_url?.trim() ?? "";
  if (!response.ok || !payload?.status || !authorizationUrl) {
    throw new PaystackRequestError(
      payload?.message || "Could not initialize Paystack payment. Please try again.",
      "PAYSTACK_INIT_FAILED",
      response.status >= 400 && response.status < 500 ? 400 : 502,
      response.status >= 500
    );
  }

  return {
    authorizationUrl,
    accessCode: payload.data?.access_code?.trim() || null,
    reference: payload.data?.reference?.trim() || args.reference,
  };
}

export async function verifyPaystackTransaction(secretKey: string, reference: string): Promise<PaystackTransaction> {
  const response = await paystackFetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );

  const payload = await response.json().catch(() => null) as {
    status?: boolean;
    message?: string;
    data?: {
      id?: number | string;
      reference?: string;
      status?: string;
      amount?: number;
      currency?: string;
      paid_at?: string | null;
      paidAt?: string | null;
    };
  } | null;

  if (!response.ok || !payload?.status || !payload.data) {
    throw new PaystackRequestError(
      payload?.message || "Could not verify this payment with Paystack.",
      response.status === 404 ? "PAYSTACK_TRANSACTION_NOT_FOUND" : "PAYSTACK_VERIFY_FAILED",
      response.status === 404 ? 404 : 502,
      response.status >= 500
    );
  }

  const rawStatus = payload.data.status?.trim().toLowerCase() || "unknown";
  return {
    id: String(payload.data.id ?? reference),
    reference: payload.data.reference?.trim() || reference,
    status: normalizePaystackStatus(rawStatus),
    rawStatus,
    amountKobo: typeof payload.data.amount === "number" ? payload.data.amount : null,
    currency: payload.data.currency?.trim().toUpperCase() || null,
    paidAt: payload.data.paid_at ?? payload.data.paidAt ?? null,
  };
}
