import "server-only";

import { randomBytes } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/admin";

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
  | "pending_payment"
  | "pending_review"
  | "approved"
  | "rejected"
  | "cancelled";

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
    amountNaira: 1300,
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
};

function httpError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}

export function getBillingPlan(planKey: unknown): BillingPlan {
  const key = typeof planKey === "string" ? planKey.trim() : "";
  const plan = BILLING_PLANS[key as BillingPlanKey];
  if (!plan) throw httpError("Unknown billing plan.", 400, "INVALID_PLAN");
  return plan;
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

export async function createBillingOrder(userId: string, planKey: unknown) {
  const plan = getBillingPlan(planKey);
  const reference = await uniqueReference();
  const now = new Date().toISOString();

  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .insert({
      user_id: userId,
      product_type: plan.productType,
      plan_key: plan.key,
      amount_naira: plan.amountNaira,
      credits: plan.credits,
      plus_days: plan.plusDays,
      reference,
      status: "pending_payment",
      updated_at: now,
    } as never)
    .select("*")
    .single();

  if (error || !data) throw httpError(error?.message || "Could not create order.", 500, "ORDER_CREATE_FAILED");
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

async function grantCredits(args: {
  userId: string;
  amount: number;
  reason: "purchase" | "plus_grant" | "admin_adjustment";
  orderId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await adminSupabase.rpc("grant_study_user_credits", {
    p_user_id: args.userId,
    p_amount: args.amount,
    p_reason: args.reason,
    p_order_id: args.orderId ?? null,
    p_metadata: args.metadata ?? {},
  });

  if (error) throw httpError(error.message, 500, "CREDIT_GRANT_FAILED");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.ok) throw httpError("Credit grant failed.", 500, row?.code || "CREDIT_GRANT_FAILED");
  return Number(row.balance ?? 0);
}

export async function approveBillingOrder(orderId: string, reviewerId: string, note?: unknown) {
  const { data: order, error } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "DB_ERROR");
  if (!order?.id) throw httpError("Order not found.", 404, "ORDER_NOT_FOUND");

  const row = order as BillingOrderRow;
  if (row.status === "approved") return normalizeOrder(row);
  if (row.status !== "pending_review") {
    throw httpError("Only submitted orders can be approved.", 409, "ORDER_NOT_REVIEWABLE");
  }

  const plan = getBillingPlan(row.plan_key);
  const now = new Date();

  if (plan.productType === "plus" && plan.plusDays) {
    const current = await getPlusRow(row.user_id);
    const baseMs = current?.active_until && new Date(current.active_until).getTime() > now.getTime()
      ? new Date(current.active_until).getTime()
      : now.getTime();
    const activeUntil = new Date(baseMs + plan.plusDays * 86_400_000).toISOString();

    const { error: entitlementError } = await adminSupabase
      .from("study_plus_entitlements")
      .upsert({
        user_id: row.user_id,
        plan_key: plan.key,
        active_until: activeUntil,
        last_order_id: row.id,
        updated_at: now.toISOString(),
      } as never, { onConflict: "user_id" });
    if (entitlementError) throw httpError(entitlementError.message, 500, "PLUS_ACTIVATION_FAILED");

    if (plan.credits > 0) {
      await grantCredits({
        userId: row.user_id,
        amount: plan.credits,
        reason: "plus_grant",
        orderId: row.id,
        metadata: { planKey: plan.key, activeUntil },
      });
    }
  } else if (plan.productType === "credits") {
    await grantCredits({
      userId: row.user_id,
      amount: plan.credits,
      reason: "purchase",
      orderId: row.id,
      metadata: { planKey: plan.key },
    });
  }

  const reviewedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await adminSupabase
    .from("study_billing_orders")
    .update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt,
      admin_note: cleanText(note, 500) || null,
      updated_at: reviewedAt,
    } as never)
    .eq("id", row.id)
    .select("*")
    .single();

  if (updateError || !updated) throw httpError(updateError?.message || "Order approval failed.", 500, "ORDER_APPROVE_FAILED");
  void notifyBillingUser(row.user_id, {
    title: "Payment approved",
    body: `${plan.label} is now active on your account.`,
  });
  return normalizeOrder(updated as BillingOrderRow);
}

export async function cancelBillingOrder(orderId: string, userId: string) {
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

export async function getBillingSnapshot(userId: string) {
  const [plus, freeTrial, practice, creditBalance, ordersResult] = await Promise.all([
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
  ]);

  return {
    plus,
    credits: { balance: creditBalance },
    freeTrial,
    freeAi: freeTrial,
    practice,
    bank: getBankDetails(),
    plans: Object.values(BILLING_PLANS),
    orders: ((ordersResult.data ?? []) as BillingOrderRow[]).map(normalizeOrder),
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
  };
}

export async function createPaystackBillingOrder(userId: string, planKey: unknown) {
  const plan = getBillingPlan(planKey);
  const reference = await uniqueReference();
  const now = new Date().toISOString();

  const { data, error } = await adminSupabase
    .from("study_billing_orders")
    .insert({
      user_id: userId,
      product_type: plan.productType,
      plan_key: plan.key,
      amount_naira: plan.amountNaira,
      credits: plan.credits,
      plus_days: plan.plusDays,
      reference,
      status: "pending_payment",
      payment_method: "paystack",
      updated_at: now,
    } as never)
    .select("*")
    .single();

  if (error || !data) throw httpError(error?.message || "Could not create order.", 500, "ORDER_CREATE_FAILED");
  return normalizeOrder(data as BillingOrderRow);
}

export async function approvePaystackBillingOrder(orderId: string, paystackTxnId: string) {
  const { data: order, error } = await adminSupabase
    .from("study_billing_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw httpError(error.message, 500, "DB_ERROR");
  if (!order?.id) throw httpError("Order not found.", 404, "ORDER_NOT_FOUND");

  const row = order as BillingOrderRow;
  if (row.status === "approved") return normalizeOrder(row);
  if (row.payment_method !== "paystack") throw httpError("Not a Paystack order.", 409, "WRONG_PAYMENT_METHOD");
  if (row.status !== "pending_payment") throw httpError("Order cannot be approved.", 409, "ORDER_NOT_APPROVABLE");

  const plan = getBillingPlan(row.plan_key);
  const now = new Date();

  if (plan.productType === "plus" && plan.plusDays) {
    const current = await getPlusRow(row.user_id);
    const baseMs = current?.active_until && new Date(current.active_until).getTime() > now.getTime()
      ? new Date(current.active_until).getTime()
      : now.getTime();
    const activeUntil = new Date(baseMs + plan.plusDays * 86_400_000).toISOString();

    const { error: entitlementError } = await adminSupabase
      .from("study_plus_entitlements")
      .upsert({
        user_id: row.user_id,
        plan_key: plan.key,
        active_until: activeUntil,
        last_order_id: row.id,
        updated_at: now.toISOString(),
      } as never, { onConflict: "user_id" });
    if (entitlementError) throw httpError(entitlementError.message, 500, "PLUS_ACTIVATION_FAILED");

    if (plan.credits > 0) {
      await grantCredits({
        userId: row.user_id,
        amount: plan.credits,
        reason: "plus_grant",
        orderId: row.id,
        metadata: { planKey: plan.key, activeUntil },
      });
    }
  } else if (plan.productType === "credits") {
    await grantCredits({
      userId: row.user_id,
      amount: plan.credits,
      reason: "purchase",
      orderId: row.id,
      metadata: { planKey: plan.key },
    });
  }

  const reviewedAt = now.toISOString();
  const { data: updated, error: updateError } = await adminSupabase
    .from("study_billing_orders")
    .update({
      status: "approved",
      reviewed_by: null,
      reviewed_at: reviewedAt,
      admin_note: "paystack-auto",
      paystack_reference: paystackTxnId,
      updated_at: reviewedAt,
    } as never)
    .eq("id", row.id)
    .select("*")
    .single();

  if (updateError || !updated) throw httpError(updateError?.message || "Order approval failed.", 500, "ORDER_APPROVE_FAILED");
  void notifyBillingUser(row.user_id, {
    title: "Payment confirmed",
    body: `${plan.label} is now active on your account.`,
  });
  return normalizeOrder(updated as BillingOrderRow);
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
