import "server-only";

import { randomBytes } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/admin";
import { billingOrderInsertError, isBillingReturnPathConstraintError } from "@/lib/billingOrderError";
import {
  legacyCompatibleExamReturnPath,
  restoreBillingReturnPath,
  sanitizeBillingReturnPath,
} from "@/lib/billingReturnPath";
import { canReusePaystackCheckout } from "@/lib/billingWorkflow";
import {
  EXAM_SPRINT_MONTHLY_DAYS,
  EXAM_SPRINT_WEEKLY_DAYS,
  getExamSprintPricing,
} from "@/lib/examSprint/config";
import { projectedExamAccessUntil } from "@/lib/examSprint/offer";
import { getExamOfferSummary } from "@/lib/examSprint/server";
import { verifyPaystackTransaction } from "@/lib/paystack";
import {
  EXAM_SPRINT_HOME,
  EXAM_SPRINT_WEEKLY_PLAN_KEY,
  isBillingPlanAllowedInSystemMode,
  isExamSprintBillingPlan,
  isExamSprintOnlyMode,
} from "@/lib/systemMode";

export const FREE_DAILY_PRACTICE_LIMIT = 40;

// Promo window — all practice sets free between these WAT dates (inclusive)
export const PROMO_START = "2026-05-30";
export const PROMO_END   = "2026-06-07";
export const FREE_AI_TRIAL_GENERATIONS = 1;
export const FREE_AI_TRIAL_PERIOD_KEY = "lifetime";
export const FREE_AI_TRIAL_QUESTION_COUNT = 10;
export const RECEIPT_BUCKET =
  process.env.JABUSTUDY_PAYMENT_RECEIPT_BUCKET || process.env.JABU_PAYMENT_RECEIPT_BUCKET || "payment-receipts";

export type BillingPlanKey =
  | "plus_weekly"
  | "plus_monthly"
  | "credits_20"
  | "credits_50"
  | "credits_100";

export type BillingOrderStatus =
  | "initializing"
  | "pending_payment"
  | "pending_review"
  | "approved"
  | "failed"
  | "abandoned"
  | "expired"
  | "rejected"
  | "cancelled";

export type BillingRefundStatus = "none" | "pending_review" | "resolved";

export type BillingPlan = {
  key: BillingPlanKey;
  productType: "plus" | "credits";
  label: string;
  amountNaira: number;
  credits: number;
  plusDays: number | null;
};

export const BILLING_PLANS: Record<BillingPlanKey, BillingPlan> = {
  plus_weekly: {
    key: "plus_weekly",
    productType: "plus",
    label: "JabuStudy Plus Weekly",
    amountNaira: 400,
    credits: 25,
    plusDays: 7,
  },
  plus_monthly: {
    key: "plus_monthly",
    productType: "plus",
    label: "JabuStudy Plus Monthly",
    amountNaira: 1500,
    credits: 100,
    plusDays: 30,
  },
  credits_20: {
    key: "credits_20",
    productType: "credits",
    label: "20 AI Credits",
    amountNaira: 300,
    credits: 20,
    plusDays: null,
  },
  credits_50: {
    key: "credits_50",
    productType: "credits",
    label: "50 AI Credits",
    amountNaira: 600,
    credits: 50,
    plusDays: null,
  },
  credits_100: {
    key: "credits_100",
    productType: "credits",
    label: "100 AI Credits",
    amountNaira: 1000,
    credits: 100,
    plusDays: null,
  },
};

export type BillingOrderRow = {
  id: string;
  user_id: string;
  product_type: "plus" | "credits";
  plan_key: BillingPlanKey;
  amount_naira: number;
  credits: number;
  plus_days: number | null;
  reference: string;
  status: BillingOrderStatus;
  receipt_path: string | null;
  sender_name: string | null;
  sender_bank: string | null;
  transaction_reference: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  payment_method: "manual" | "paystack";
  paystack_reference: string | null;
  provider_status: string | null;
  paystack_authorization_url: string | null;
  initialized_at: string | null;
  last_verified_at: string | null;
  paid_at: string | null;
  failure_detail: string | null;
  return_path: string | null;
  refund_status: BillingRefundStatus;
  refunded_at: string | null;
  refund_amount_naira: number | null;
  refund_note: string | null;
};

export const ACTIVE_PAYSTACK_STATUSES: BillingOrderStatus[] = ["initializing", "pending_payment"];

function httpError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}

function isExamSprintCheckout(plan: BillingPlan, returnPath: string) {
  return isExamSprintBillingPlan(plan.key)
    && (returnPath === EXAM_SPRINT_HOME || returnPath.startsWith(`${EXAM_SPRINT_HOME}/`));
}

function assertPlanAvailable(plan: BillingPlan, returnPath: string) {
  if (!isBillingPlanAllowedInSystemMode(plan.key, isExamSprintOnlyMode())) {
    throw httpError(
      "Only Exam Sprint passes are available during the examination period.",
      423,
      "SYSTEM_MODE_RESTRICTED"
    );
  }

  if (
    isExamSprintCheckout(plan, returnPath)
    && plan.key === EXAM_SPRINT_WEEKLY_PLAN_KEY
    && !getExamSprintPricing().weeklyAvailable
  ) {
    throw httpError(
      "The 7-day pass becomes available after the current 30-day promotion ends.",
      409,
      "EXAM_WEEKLY_PASS_NOT_AVAILABLE"
    );
  }
}

function billingReturnPathForCurrentMode(value: unknown) {
  const path = sanitizeBillingReturnPath(value);
  if (!isExamSprintOnlyMode()) return path;
  return path === EXAM_SPRINT_HOME || path.startsWith(`${EXAM_SPRINT_HOME}/`)
    ? path
    : EXAM_SPRINT_HOME;
}

function planForCheckout(plan: BillingPlan, returnPath: string): BillingPlan {
  if (!isExamSprintCheckout(plan, returnPath)) return plan;
  const pricing = getExamSprintPricing();
  if (plan.key === EXAM_SPRINT_WEEKLY_PLAN_KEY) {
    return { ...plan, amountNaira: pricing.weeklyPriceNaira, plusDays: EXAM_SPRINT_WEEKLY_DAYS };
  }
  return { ...plan, amountNaira: pricing.currentPriceNaira, plusDays: EXAM_SPRINT_MONTHLY_DAYS };
}

function assertPromisedCheckoutPrice(plan: BillingPlan, returnPath: string, expectedAmountNaira?: unknown) {
  const expected = Number(expectedAmountNaira);
  const examCheckout = isExamSprintCheckout(plan, returnPath);
  if (examCheckout && !Number.isFinite(expected)) {
    throw httpError(
      "The Exam Sprint offer was updated. Refresh this page before opening checkout.",
      409,
      "CHECKOUT_PRICE_REFRESH_REQUIRED"
    );
  }
  if (Number.isFinite(expected) && expected !== plan.amountNaira) {
    throw httpError(
      "The price changed while this page was open. Refresh to see the current Exam Sprint price before paying.",
      409,
      "CHECKOUT_PRICE_CHANGED"
    );
  }
}

export function getBillingPlan(planKey: unknown): BillingPlan {
  const key = typeof planKey === "string" ? planKey.trim() : "";
  const plan = BILLING_PLANS[key as BillingPlanKey];
  if (!plan) throw httpError("Unknown billing plan.", 400, "INVALID_PLAN");
  return plan;
}

export function isPaystackEnabled() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY) && process.env.NEXT_PUBLIC_PAYSTACK_ENABLED === "true";
}

export function getBankDetails() {
  return {
    bankName: process.env.JABUSTUDY_BANK_NAME || process.env.JABU_BANK_NAME || "",
    accountNumber: process.env.JABUSTUDY_BANK_ACCOUNT_NUMBER || process.env.JABU_BANK_ACCOUNT_NUMBER || "",
    accountName: process.env.JABUSTUDY_BANK_ACCOUNT_NAME || process.env.JABU_BANK_ACCOUNT_NAME || "",
  };
}

function watDate() {
  return new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function formatPlanLabel(planKey: BillingPlanKey) {
  return BILLING_PLANS[planKey]?.label ?? planKey;
}

export function isPlusActive(activeUntil?: string | null) {
  return Boolean(activeUntil && new Date(activeUntil).getTime() > Date.now());
}

async function uniqueReference() {
  for (let i = 0; i < 8; i++) {
    const reference = `JABUSTUDY-${randomBytes(4).toString("hex").toUpperCase()}`;
    const { data } = await adminSupabase
      .from("study_billing_orders")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();
    if (!data?.id) return reference;
  }
  throw httpError("Could not create a payment reference. Try again.", 500, "REFERENCE_FAILED");
}

export async function ensureCreditBalance(userId: string, defaultBalance = 0) {
  await adminSupabase
    .from("study_user_credits")
    .upsert(
      { user_id: userId, balance: defaultBalance, updated_at: new Date().toISOString() },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  const { data } = await adminSupabase
    .from("study_user_credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  return typeof data?.balance === "number" ? data.balance : defaultBalance;
}

async function getPlusRow(userId: string) {
  const { data } = await adminSupabase
    .from("study_plus_entitlements")
    .select("plan_key,active_until,last_order_id,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data as {
    plan_key: BillingPlanKey;
    active_until: string;
    last_order_id: string | null;
    updated_at: string;
  } | null;
}

export async function getPlusAccess(userId: string) {
  const row = await getPlusRow(userId);
  const active = isPlusActive(row?.active_until);
  return {
    active,
    planKey: active ? row?.plan_key ?? null : null,
    activeUntil: row?.active_until ?? null,
  };
}

export async function getFreeAiTrialUsage(userId: string) {
  const { data } = await adminSupabase
    .from("study_monetization_usage")
    .select("used_count")
    .eq("user_id", userId)
    .eq("usage_type", "free_ai_trial_generation")
    .eq("period_key", FREE_AI_TRIAL_PERIOD_KEY)
    .maybeSingle();

  const used = Number(data?.used_count ?? 0);
  return {
    periodKey: FREE_AI_TRIAL_PERIOD_KEY,
    limit: FREE_AI_TRIAL_GENERATIONS,
    used,
    remaining: Math.max(0, FREE_AI_TRIAL_GENERATIONS - used),
    questionCount: FREE_AI_TRIAL_QUESTION_COUNT,
  };
}

export async function getPracticeAccess(userId: string, requestedQuestions = 0) {
  const plus = await getPlusAccess(userId);
  const activityDate = watDate();
  const isPromo = activityDate >= PROMO_START && activityDate <= PROMO_END;

  if (plus.active || isPromo) {
    return {
      plus,
      activityDate,
      limit: null as number | null,
      used: 0,
      remaining: null as number | null,
      allowed: true,
      isPromo,
    };
  }

  const { data } = await adminSupabase
    .from("study_daily_activity")
    .select("questions_answered")
    .eq("user_id", userId)
    .eq("activity_date", activityDate)
    .maybeSingle();

  const used = Number(data?.questions_answered ?? 0);
  const remaining = Math.max(0, FREE_DAILY_PRACTICE_LIMIT - used);
  return {
    plus,
    activityDate,
    limit: FREE_DAILY_PRACTICE_LIMIT,
    used,
    remaining,
    allowed: requestedQuestions <= remaining,
    isPromo: false,
  };
}

export async function getAiGenerationAccess(userId: string, creditCost: number) {
  const [plus, freeTrial, balance] = await Promise.all([
    getPlusAccess(userId),
    getFreeAiTrialUsage(userId),
    ensureCreditBalance(userId, 0),
  ]);
  const cost = Math.max(0, Math.trunc(creditCost));
  const canUseCredits = cost === 0 || balance >= cost;
  const canUseTrial = !plus.active && cost > 0 && !canUseCredits && freeTrial.remaining > 0;

  return {
    plus,
    freeTrial,
    freeAi: freeTrial,
    credits: {
      balance,
      cost,
      canAfford: canUseCredits || canUseTrial,
    },
    chargeMode: canUseCredits ? "credits" as const : canUseTrial ? "free_trial" as const : "credits" as const,
    allowed: canUseCredits || canUseTrial,
  };
}

export async function recordFreeAiTrialGeneration(userId: string, metadata: Record<string, unknown>) {
  const freeTrial = await getFreeAiTrialUsage(userId);
  const { data, error } = await adminSupabase.rpc("increment_study_monetization_usage", {
    p_user_id: userId,
    p_usage_type: "free_ai_trial_generation",
    p_period_key: freeTrial.periodKey,
    p_amount: 1,
    p_limit: FREE_AI_TRIAL_GENERATIONS,
    p_metadata: metadata,
  });

  if (error) {
    throw Object.assign(new Error("Free AI trial could not be recorded."), {
      code: "FREE_AI_TRIAL_RECORD_FAILED",
      cause: error,
    });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.ok) {
    throw Object.assign(new Error("Free AI trial has already been used."), {
      code: row?.code || "AI_LIMIT_REACHED",
    });
  }

  const balance = await ensureCreditBalance(userId, 0);
  await adminSupabase.from("study_credit_ledger").insert({
    user_id: userId,
    delta: 0,
    balance_after: balance,
    reason: "free_trial_generation",
    metadata: {
      ...metadata,
      periodKey: freeTrial.periodKey,
      usedCount: row.used_count,
    },
  } as never);

  return {
    used: Number(row.used_count ?? freeTrial.used + 1),
    remaining: Number(row.remaining ?? Math.max(0, freeTrial.remaining - 1)),
  };
}

export async function createBillingOrder(userId: string, planKey: unknown, returnPath?: unknown, expectedAmountNaira?: unknown) {
  const basePlan = getBillingPlan(planKey);
  const safeReturnPath = billingReturnPathForCurrentMode(returnPath);
  assertPlanAvailable(basePlan, safeReturnPath);
  const plan = planForCheckout(basePlan, safeReturnPath);
  assertPromisedCheckoutPrice(plan, safeReturnPath, expectedAmountNaira);
  const reference = await uniqueReference();
  const now = new Date().toISOString();
  const insert = {
    user_id: userId,
    product_type: plan.productType,
    plan_key: plan.key,
    amount_naira: plan.amountNaira,
    credits: plan.credits,
    plus_days: plan.plusDays,
    reference,
    status: "pending_payment",
    return_path: safeReturnPath,
    updated_at: now,
  };

  let { data, error } = await adminSupabase
    .from("study_billing_orders")
    .insert(insert as never)
    .select("*")
    .single();

  if (isBillingReturnPathConstraintError(error) && safeReturnPath.startsWith("/exam")) {
    ({ data, error } = await adminSupabase
      .from("study_billing_orders")
      .insert({ ...insert, return_path: legacyCompatibleExamReturnPath(safeReturnPath) } as never)
      .select("*")
      .single());
  }

  if (error || !data) {
    const failure = billingOrderInsertError(error);
    throw httpError(failure.message, failure.status, failure.code);
  }
  return normalizeOrder(data as BillingOrderRow);
}

export async function initReceiptUpload(userId: string, orderId: string, fileName: unknown, contentType: unknown) {
  const cleanName = cleanText(fileName, 120).replace(/[^a-zA-Z0-9._-]/g, "-") || "receipt.jpg";
  const cleanType = cleanText(contentType, 80) || "application/octet-stream";
  if (!cleanType.startsWith("image/") && cleanType !== "application/pdf") {
    throw httpError("Upload an image or PDF receipt.", 400, "INVALID_RECEIPT_TYPE");
  }

  const { data: order, error: orderError } = await adminSupabase
    .from("study_billing_orders")
    .select("id,user_id,status,reference")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw httpError(orderError.message, 500, "DB_ERROR");
  if (!order?.id || order.user_id !== userId) throw httpError("Order not found.", 404, "ORDER_NOT_FOUND");
  if (order.status === "approved" || order.status === "rejected") {
    throw httpError("This order has already been reviewed.", 409, "ORDER_CLOSED");
  }

  const path = `${userId}/${order.reference}-${Date.now()}-${cleanName}`;
  type SignedUploadStorage = {
    createSignedUploadUrl: (
      uploadPath: string,
      options?: { contentType?: string }
    ) => Promise<{ data: { token?: string } | null; error: { message?: string } | null }>;
  };
  const storage = adminSupabase.storage.from(RECEIPT_BUCKET) as unknown as SignedUploadStorage;
  const { data, error } = await storage.createSignedUploadUrl(path, { contentType: cleanType });
  if (error || !data?.token) throw httpError(error?.message || "Could not prepare receipt upload.", 500, "RECEIPT_SIGN_FAILED");

  return {
    bucket: RECEIPT_BUCKET,
    path,
    token: data.token as string,
  };
}

export async function submitBillingOrder(args: {
  userId: string;
  orderId: string;
  receiptPath: unknown;
  senderName: unknown;
  senderBank: unknown;
  transactionReference: unknown;
}) {
  const receiptPath = cleanText(args.receiptPath, 500);
  if (!receiptPath) throw httpError("Receipt is required.", 400, "RECEIPT_REQUIRED");

  const senderName = cleanText(args.senderName, 120);
  const senderBank = cleanText(args.senderBank, 120);
  const transactionReference = cleanText(args.transactionReference, 160);
  const now = new Date().toISOString();

  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .update({
      receipt_path: receiptPath,
      sender_name: senderName || null,
      sender_bank: senderBank || null,
      transaction_reference: transactionReference || null,
      status: "pending_review",
      submitted_at: now,
      updated_at: now,
    } as never)
    .eq("id", args.orderId)
    .eq("user_id", args.userId)
    .in("status", ["pending_payment", "pending_review"])
    .select("*")
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "ORDER_SUBMIT_FAILED");
  if (!data?.id) throw httpError("Order not found or already reviewed.", 404, "ORDER_NOT_FOUND");
  return normalizeOrder(data as BillingOrderRow);
}

export async function approveBillingOrder(orderId: string, reviewerId: string, note?: unknown) {
  const { data: rpcData, error } = await adminSupabase.rpc("fulfil_manual_billing_order", {
    p_order_id: orderId,
    p_reviewer_id: reviewerId,
    p_note: cleanText(note, 500) || null,
  });
  if (error) throw httpError(error.message, 500, "ORDER_APPROVE_FAILED");
  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!result?.ok) {
    const code = String(result?.code || "ORDER_APPROVE_FAILED");
    throw httpError(
      code === "ORDER_NOT_FOUND" ? "Order not found." : "Only submitted manual-transfer orders can be approved.",
      code === "ORDER_NOT_FOUND" ? 404 : 409,
      code
    );
  }
  const { data: order, error: orderError } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order?.id) throw httpError(orderError?.message || "Order not found.", 500, "DB_ERROR");
  return normalizeOrder(order as BillingOrderRow);
}

export async function cancelBillingOrder(orderId: string, userId: string) {
  const { data: existing } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  const pending = existing as BillingOrderRow | null;
  if (!pending?.id) throw httpError("Order not found.", 404, "ORDER_NOT_FOUND");

  if (pending.payment_method === "paystack") {
    if (pending.status === "approved") {
      throw httpError("This payment is already confirmed and your access is active.", 409, "ORDER_ALREADY_PAID");
    }

    try {
      const verified = await verifyPaystackOrder(pending.reference, userId);
      if (verified?.status === "approved") {
        throw httpError("This payment already went through and your access is active.", 409, "ORDER_ALREADY_PAID");
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "ORDER_ALREADY_PAID") throw error;
      // Abandonment is deliberately recoverable. A later verified success can
      // still fulfil this order, so a temporary Paystack outage cannot lose money.
    }

    const { data, error } = await adminSupabase
      .from("study_billing_orders")
      .update({
        status: "abandoned",
        provider_status: "abandoned_locally",
        failure_detail: "Checkout was closed so the student could start again.",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", orderId)
      .eq("user_id", userId)
      .in("status", ["initializing", "pending_payment", "failed", "expired"])
      .select("*")
      .maybeSingle();

    if (error) throw httpError(error.message, 500, "ORDER_ABANDON_FAILED");
    if (!data?.id) {
      const refreshed = await getOrderByReference(pending.reference, userId);
      if (refreshed?.status === "approved") {
        throw httpError("This payment already went through and your access is active.", 409, "ORDER_ALREADY_PAID");
      }
      throw httpError("Order could not be restarted.", 409, "ORDER_NOT_ABANDONABLE");
    }
    return normalizeOrder(data as BillingOrderRow);
  }

  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
    .eq("id", orderId)
    .eq("user_id", userId)
    .in("status", ["pending_payment"])
    .select("*")
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "ORDER_CANCEL_FAILED");
  if (!data?.id) throw httpError("Order not found or already submitted.", 404, "ORDER_NOT_FOUND");
  return normalizeOrder(data as BillingOrderRow);
}

export async function rejectBillingOrder(orderId: string, reviewerId: string, note?: unknown) {
  const reviewedAt = new Date().toISOString();
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .update({
      status: "rejected",
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt,
      admin_note: cleanText(note, 500) || null,
      updated_at: reviewedAt,
    } as never)
    .eq("id", orderId)
    .in("status", ["pending_payment", "pending_review"])
    .select("*")
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "ORDER_REJECT_FAILED");
  if (!data?.id) throw httpError("Order not found or already reviewed.", 404, "ORDER_NOT_FOUND");
  void notifyBillingUser((data as BillingOrderRow).user_id, {
    title: "Payment needs attention",
    body: cleanText(note, 180) || "Your manual transfer could not be confirmed. Please check your payment details.",
  });
  return normalizeOrder(data as BillingOrderRow);
}

async function notifyBillingUser(userId: string, message: { title: string; body: string }) {
  try {
    await adminSupabase.from("notifications").insert({
      user_id: userId,
      type: "billing",
      title: message.title,
      body: message.body,
      href: "/study/billing",
    } as never);
  } catch {
    // Billing state is already persisted; notifications are best-effort.
  }
}

export async function getBillingSnapshot(userId: string, options?: { includeExamOffer?: boolean }) {
  const [plus, freeTrial, practice, creditBalance, ordersResult, activePaystackResult, examOffer] = await Promise.all([
    getPlusAccess(userId),
    getFreeAiTrialUsage(userId),
    getPracticeAccess(userId),
    ensureCreditBalance(userId, 0),
    adminSupabase
      .from("study_billing_orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    adminSupabase
      .from("study_billing_orders")
      .select("*")
      .eq("user_id", userId)
      .eq("payment_method", "paystack")
      .in("status", ACTIVE_PAYSTACK_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    options?.includeExamOffer ? getExamOfferSummary() : Promise.resolve(null),
  ]);
  if (ordersResult.error) throw httpError(ordersResult.error.message, 500, "DB_ERROR");
  if (activePaystackResult.error) throw httpError(activePaystackResult.error.message, 500, "DB_ERROR");

  const recentRows = (ordersResult.data ?? []) as BillingOrderRow[];
  const activePaystack = activePaystackResult.data as BillingOrderRow | null;
  const visibleRows = activePaystack?.id && !recentRows.some((row) => row.id === activePaystack.id)
    ? [...recentRows, activePaystack].sort((a, b) => b.created_at.localeCompare(a.created_at))
    : recentRows;

  const examPricing = examOffer ? getExamSprintPricing() : null;

  return {
    plus,
    credits: { balance: creditBalance },
    freeTrial,
    freeAi: freeTrial,
    practice,
    bank: getBankDetails(),
    paystackEnabled: isPaystackEnabled(),
    plans: Object.values(BILLING_PLANS),
    examOffer: examOffer ? {
      ...examOffer,
      pricing: examPricing,
      accessUntilIfPurchased: projectedExamAccessUntil({
        activeUntil: plus.activeUntil,
        days: BILLING_PLANS.plus_monthly.plusDays,
      }),
    } : null,
    orders: visibleRows.map(normalizeOrder),
    historyNextCursor: recentRows.length >= 10 ? recentRows.at(-1)?.created_at ?? null : null,
  };
}

export function normalizeOrder(row: BillingOrderRow) {
  return {
    id: row.id,
    userId: row.user_id,
    productType: row.product_type,
    planKey: row.plan_key,
    planLabel: formatPlanLabel(row.plan_key),
    amountNaira: row.amount_naira,
    credits: row.credits,
    plusDays: row.plus_days,
    reference: row.reference,
    status: row.status,
    receiptPath: row.receipt_path,
    senderName: row.sender_name,
    senderBank: row.sender_bank,
    transactionReference: row.transaction_reference,
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: new Date(new Date(row.created_at).getTime() + 48 * 3_600_000).toISOString(),
    paymentMethod: (row.payment_method ?? "manual") as "manual" | "paystack",
    paystackReference: row.paystack_reference ?? null,
    providerStatus: row.provider_status ?? null,
    initializedAt: row.initialized_at ?? null,
    lastVerifiedAt: row.last_verified_at ?? null,
    paidAt: row.paid_at ?? null,
    failureDetail: row.failure_detail ?? null,
    returnPath: restoreBillingReturnPath(row.return_path),
    refundStatus: (row.refund_status ?? "none") as BillingRefundStatus,
    refundedAt: row.refunded_at ?? null,
    refundAmountNaira: row.refund_amount_naira ?? null,
    refundNote: row.refund_note ?? null,
    canResume: row.payment_method === "paystack"
      && row.status === "pending_payment"
      && Boolean(row.paystack_authorization_url),
  };
}

export async function getBillingHistory(
  userId: string,
  options?: { cursor?: string | null; limit?: number }
) {
  const requestedLimit = Number(options?.limit ?? 20);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(50, Math.max(5, Math.trunc(requestedLimit)))
    : 20;
  let query = adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options?.cursor) {
    const cursorDate = new Date(options.cursor);
    if (Number.isNaN(cursorDate.getTime())) throw httpError("Invalid history cursor.", 400, "INVALID_CURSOR");
    query = query.lt("created_at", cursorDate.toISOString());
  }

  const { data, error } = await query;
  if (error) throw httpError(error.message, 500, "DB_ERROR");
  const rows = (data ?? []) as BillingOrderRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    items: page.map(normalizeOrder),
    nextCursor: hasMore ? page.at(-1)?.created_at ?? null : null,
  };
}

export async function getBillingOrderDetails(userId: string, orderId: string) {
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw httpError(error.message, 500, "DB_ERROR");
  return data?.id ? normalizeOrder(data as BillingOrderRow) : null;
}

async function getActivePaystackOrder(userId: string) {
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("user_id", userId)
    .eq("payment_method", "paystack")
    .in("status", ACTIVE_PAYSTACK_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "DB_ERROR");
  return data as BillingOrderRow | null;
}

export async function createPaystackBillingOrder(userId: string, planKey: unknown, returnPath?: unknown, expectedAmountNaira?: unknown) {
  const basePlan = getBillingPlan(planKey);
  const safeReturnPath = billingReturnPathForCurrentMode(returnPath);
  assertPlanAvailable(basePlan, safeReturnPath);
  const plan = planForCheckout(basePlan, safeReturnPath);
  assertPromisedCheckoutPrice(plan, safeReturnPath, expectedAmountNaira);
  const now = Date.now();
  const existing = await getActivePaystackOrder(userId);

  if (existing) {
    const ageMs = now - new Date(existing.created_at).getTime();
    const existingAmountIsSafe = Number(existing.amount_naira) <= plan.amountNaira;
    if (existingAmountIsSafe && canReusePaystackCheckout({
      paymentMethod: existing.payment_method,
      status: existing.status,
      planKey: existing.plan_key,
      createdAt: existing.created_at,
      authorizationUrl: existing.paystack_authorization_url,
    }, plan.key, now)) {
      return { order: normalizeOrder(existing), reused: true, authorizationUrl: existing.paystack_authorization_url };
    }

    if (existingAmountIsSafe && existing.plan_key === plan.key && existing.status === "initializing" && ageMs < 120_000) {
      throw httpError("Your secure checkout is still opening. Try again in a moment.", 409, "PAYMENT_INITIALIZING");
    }

    await adminSupabase
      .from("study_billing_orders")
      .update({
        status: ageMs >= 48 * 3_600_000 ? "expired" : "abandoned",
        provider_status: ageMs >= 48 * 3_600_000 ? "expired_locally" : "superseded_locally",
        failure_detail: "Superseded by a new checkout.",
        updated_at: new Date(now).toISOString(),
      } as never)
      .eq("id", existing.id)
      .in("status", ACTIVE_PAYSTACK_STATUSES);
  }

  const reference = await uniqueReference();
  const nowIso = new Date().toISOString();
  const insert = {
    user_id: userId,
    product_type: plan.productType,
    plan_key: plan.key,
    amount_naira: plan.amountNaira,
    credits: plan.credits,
    plus_days: plan.plusDays,
    reference,
    status: "initializing",
    payment_method: "paystack",
    provider_status: "initializing",
    return_path: safeReturnPath,
    updated_at: nowIso,
  };

  let { data, error } = await adminSupabase
    .from("study_billing_orders")
    .insert(insert as never)
    .select("*")
    .single();

  if (isBillingReturnPathConstraintError(error) && safeReturnPath.startsWith("/exam")) {
    ({ data, error } = await adminSupabase
      .from("study_billing_orders")
      .insert({ ...insert, return_path: legacyCompatibleExamReturnPath(safeReturnPath) } as never)
      .select("*")
      .single());
  }

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === "23505") {
      const concurrent = await getActivePaystackOrder(userId);
      if (
        concurrent?.plan_key === plan.key
        && Number(concurrent.amount_naira) <= plan.amountNaira
        && concurrent.paystack_authorization_url
      ) {
        return {
          order: normalizeOrder(concurrent),
          reused: true,
          authorizationUrl: concurrent.paystack_authorization_url,
        };
      }
      throw httpError("Another checkout is already opening. Try again in a moment.", 409, "ACTIVE_CHECKOUT_EXISTS");
    }
    const failure = billingOrderInsertError(error);
    throw httpError(failure.message, failure.status, failure.code);
  }

  return { order: normalizeOrder(data as BillingOrderRow), reused: false, authorizationUrl: null as string | null };
}

export async function completePaystackInitialization(args: {
  orderId: string;
  userId: string;
  authorizationUrl: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .update({
      status: "pending_payment",
      provider_status: "pending",
      paystack_authorization_url: args.authorizationUrl,
      initialized_at: now,
      failure_detail: null,
      updated_at: now,
    } as never)
    .eq("id", args.orderId)
    .eq("user_id", args.userId)
    .eq("status", "initializing")
    .select("*")
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "ORDER_INIT_UPDATE_FAILED");
  if (!data?.id) throw httpError("Checkout is no longer active.", 409, "CHECKOUT_NOT_ACTIVE");
  return normalizeOrder(data as BillingOrderRow);
}

export async function failPaystackInitialization(orderId: string, detail: string, providerStatus = "initialization_failed") {
  const now = new Date().toISOString();
  await adminSupabase
    .from("study_billing_orders")
    .update({
      status: "failed",
      provider_status: providerStatus,
      failure_detail: cleanText(detail, 500) || "Paystack checkout could not be opened.",
      last_verified_at: now,
      updated_at: now,
    } as never)
    .eq("id", orderId)
    .eq("status", "initializing");
}

export async function resumePaystackBillingOrder(orderId: string, userId: string) {
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "DB_ERROR");
  if (!data?.id) throw httpError("Order not found.", 404, "ORDER_NOT_FOUND");
  const row = data as BillingOrderRow;
  if (isExamSprintOnlyMode() && !isExamSprintBillingPlan(row.plan_key)) {
    throw httpError(
      "This checkout belongs to a study plan that is paused during Exam Sprint mode.",
      423,
      "SYSTEM_MODE_RESTRICTED"
    );
  }
  const rowReturnPath = restoreBillingReturnPath(row.return_path);
  const basePlan = getBillingPlan(row.plan_key);
  assertPlanAvailable(basePlan, rowReturnPath);
  const currentPlan = planForCheckout(basePlan, rowReturnPath);
  if (Number(row.amount_naira) > currentPlan.amountNaira) {
    throw httpError(
      "The price of this pass has changed. Start a new checkout to use the current price.",
      409,
      "CHECKOUT_PRICE_CHANGED"
    );
  }
  if (row.status === "approved") throw httpError("This payment is already confirmed.", 409, "ORDER_ALREADY_PAID");
  if (row.payment_method !== "paystack" || row.status !== "pending_payment" || !row.paystack_authorization_url) {
    throw httpError("This checkout can no longer be resumed. Start a new one.", 409, "CHECKOUT_NOT_RESUMABLE");
  }
  return { authorizationUrl: row.paystack_authorization_url, order: normalizeOrder(row) };
}

export async function approvePaystackBillingOrder(args: {
  reference: string;
  transactionId: string;
  amountKobo: number;
  currency: string;
  paidAt?: string | null;
}) {
  const { data: rpcData, error } = await adminSupabase.rpc("fulfil_paystack_billing_order", {
    p_reference: args.reference,
    p_transaction_id: args.transactionId,
    p_amount_kobo: args.amountKobo,
    p_currency: args.currency,
    p_paid_at: args.paidAt ?? null,
  });

  if (error) throw httpError(error.message, 500, "PAYSTACK_FULFILMENT_FAILED");
  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!result?.ok) {
    const code = String(result?.code || "PAYSTACK_FULFILMENT_FAILED");
    const status = code === "ORDER_NOT_FOUND" ? 404 : code.includes("MISMATCH") ? 400 : 409;
    throw httpError(`Payment could not be fulfilled (${code}).`, status, code);
  }

  const { data: order, error: orderError } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("reference", args.reference)
    .maybeSingle();
  if (orderError || !order?.id) throw httpError(orderError?.message || "Order not found.", 500, "DB_ERROR");

  return normalizeOrder(order as BillingOrderRow);
}

export async function verifyPaystackOrder(reference: string, userId: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("reference", reference)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "DB_ERROR");
  if (!data?.id) return null;
  const row = data as BillingOrderRow;
  if (row.payment_method !== "paystack" || row.status === "approved") return normalizeOrder(row);
  if (!secretKey) throw httpError("Payment gateway not configured.", 503, "PAYSTACK_NOT_CONFIGURED");

  const transaction = await verifyPaystackTransaction(secretKey, reference);
  const verifiedAt = new Date().toISOString();

  if (transaction.status === "success") {
    if (transaction.amountKobo === null || !transaction.currency) {
      throw httpError("Paystack returned incomplete payment details.", 502, "PAYSTACK_VERIFY_INCOMPLETE");
    }
    return approvePaystackBillingOrder({
      reference,
      transactionId: transaction.id,
      amountKobo: transaction.amountKobo,
      currency: transaction.currency,
      paidAt: transaction.paidAt,
    });
  }

  const ageMs = Date.now() - new Date(row.created_at).getTime();
  const terminalStatus = transaction.status === "failed"
    ? "failed"
    : transaction.status === "abandoned"
      ? "abandoned"
      : ageMs >= 48 * 3_600_000
        ? "expired"
        : null;

  const update: Record<string, unknown> = {
    provider_status: transaction.rawStatus,
    last_verified_at: verifiedAt,
    failure_detail: terminalStatus === "failed"
      ? "Paystack reported that this payment failed."
      : terminalStatus === "abandoned"
        ? "The Paystack checkout was not completed."
        : terminalStatus === "expired"
          ? "This checkout is more than 48 hours old."
          : null,
    updated_at: verifiedAt,
  };
  if (terminalStatus) update.status = terminalStatus;

  const { data: updated, error: updateError } = await adminSupabase
    .from("study_billing_orders")
    .update(update as never)
    .eq("id", row.id)
    .neq("status", "approved")
    .select("*")
    .maybeSingle();
  if (updateError) throw httpError(updateError.message, 500, "ORDER_VERIFY_UPDATE_FAILED");

  return normalizeOrder((updated ?? row) as BillingOrderRow);
}

export async function verifyPaystackOrderForAdmin(orderId: string) {
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .select("reference,user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw httpError(error.message, 500, "DB_ERROR");
  if (!data?.reference || !data.user_id) throw httpError("Order not found.", 404, "ORDER_NOT_FOUND");
  return verifyPaystackOrder(String(data.reference), String(data.user_id));
}

export async function flagPaystackRefund(args: {
  reference?: string | null;
  transactionId?: string | null;
  amountKobo: number;
  currency: string;
  refundedAt?: string | null;
  note?: string | null;
}) {
  const { data, error } = await adminSupabase.rpc("flag_paystack_refund", {
    p_reference: args.reference ?? null,
    p_transaction_id: args.transactionId ?? null,
    p_amount_kobo: args.amountKobo,
    p_currency: args.currency,
    p_refunded_at: args.refundedAt ?? null,
    p_note: cleanText(args.note, 500) || null,
  });
  if (error) throw httpError(error.message, 500, "REFUND_FLAG_FAILED");
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.ok) {
    const code = String(result?.code || "REFUND_FLAG_FAILED");
    throw httpError(`Refund could not be recorded (${code}).`, code === "ORDER_NOT_FOUND" ? 404 : 409, code);
  }
  return result;
}

export async function recordPaystackFailure(reference: string, providerStatus: string, detail?: string | null) {
  const now = new Date().toISOString();
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .update({
      status: "failed",
      provider_status: cleanText(providerStatus, 80) || "failed",
      failure_detail: cleanText(detail, 500) || "Paystack reported that this payment failed.",
      last_verified_at: now,
      updated_at: now,
    } as never)
    .eq("reference", reference)
    .eq("payment_method", "paystack")
    .neq("status", "approved")
    .select("*")
    .maybeSingle();
  if (error) throw httpError(error.message, 500, "PAYSTACK_FAILURE_UPDATE_FAILED");
  return data?.id ? normalizeOrder(data as BillingOrderRow) : null;
}

export async function resolveBillingRefund(orderId: string, reviewerId: string, note: unknown) {
  const resolutionNote = cleanText(note, 500);
  if (!resolutionNote) throw httpError("Add a reconciliation note before resolving this refund.", 400, "REFUND_NOTE_REQUIRED");
  const now = new Date().toISOString();
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .update({
      refund_status: "resolved",
      refund_note: resolutionNote,
      reviewed_by: reviewerId,
      reviewed_at: now,
      updated_at: now,
    } as never)
    .eq("id", orderId)
    .eq("refund_status", "pending_review")
    .select("*")
    .maybeSingle();
  if (error) throw httpError(error.message, 500, "REFUND_RESOLVE_FAILED");
  if (!data?.id) throw httpError("Refund review was not found or is already resolved.", 409, "REFUND_NOT_REVIEWABLE");
  return normalizeOrder(data as BillingOrderRow);
}

export async function getOrderByReference(reference: string, userId: string) {
  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("reference", reference)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "DB_ERROR");
  if (!data?.id) return null;
  return normalizeOrder(data as BillingOrderRow);
}

export async function signedReceiptUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await adminSupabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
