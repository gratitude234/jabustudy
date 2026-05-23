import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { adminSupabase } from "@/lib/supabase/admin";

export type AiUsageStatus = "success" | "failure" | "blocked";

export type AiUsageContext = {
  userId?: string | null;
  endpoint: string;
  route?: string;
  materialId?: string | null;
  courseId?: string | null;
  requestedCount?: number | null;
  metadata?: Record<string, unknown>;
  suppressProviderUsageEvents?: boolean;
};

export type AiUsageEvent = AiUsageContext & {
  provider?: string | null;
  model?: string | null;
  status: AiUsageStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type AiLimitResult = {
  allowed: boolean;
  limit: number;
  used: number;
  retryAfterSeconds: number;
};

const usageStorage = new AsyncLocalStorage<AiUsageContext>();

function envInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function aiLimitFromEnv(name: string, fallback: number) {
  return envInt(name, fallback);
}

export function currentAiUsageContext() {
  return usageStorage.getStore() ?? null;
}

export function withAiUsageContext<T>(
  context: AiUsageContext,
  fn: () => T
): T {
  return usageStorage.run(context, fn);
}

export async function recordAiUsageEvent(event: AiUsageEvent) {
  try {
    const metadata = {
      ...(event.metadata ?? {}),
      ...(event.errorCode ? { errorCode: event.errorCode } : {}),
    };

    const { error } = await adminSupabase.from("ai_usage_events").insert({
      user_id: event.userId ?? null,
      endpoint: event.endpoint,
      route: event.route ?? null,
      provider: event.provider ?? null,
      model: event.model ?? null,
      status: event.status,
      requested_count: event.requestedCount ?? null,
      material_id: event.materialId ?? null,
      course_id: event.courseId ?? null,
      error_code: event.errorCode ?? null,
      error_message: event.errorMessage?.slice(0, 1000) ?? null,
      metadata,
    } as never);

    if (error) {
      console.warn("[ai-usage] event write failed:", error.message);
    }
  } catch (error) {
    console.warn("[ai-usage] event write failed:", error instanceof Error ? error.message : error);
  }
}

export async function checkAiUsageLimit(args: {
  userId?: string | null;
  endpoint: string;
  limit: number;
  windowMs: number;
  materialId?: string | null;
  courseId?: string | null;
}): Promise<AiLimitResult> {
  if (args.limit <= 0) {
    return { allowed: false, limit: args.limit, used: 0, retryAfterSeconds: Math.ceil(args.windowMs / 1000) };
  }

  const sinceDate = new Date(Date.now() - args.windowMs);
  const since = sinceDate.toISOString();

  try {
    let query = adminSupabase
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("endpoint", args.endpoint)
      .gte("created_at", since)
      .in("status", ["success", "failure"]);

    query = args.userId ? query.eq("user_id", args.userId) : query.is("user_id", null);
    if (args.materialId) query = query.eq("material_id", args.materialId);
    if (args.courseId) query = query.eq("course_id", args.courseId);

    const { count, error } = await query;
    if (error) {
      console.warn("[ai-usage] limit check failed:", error.message);
      return { allowed: true, limit: args.limit, used: 0, retryAfterSeconds: 0 };
    }

    const used = count ?? 0;
    const allowed = used < args.limit;
    return {
      allowed,
      limit: args.limit,
      used,
      retryAfterSeconds: allowed ? 0 : Math.ceil(args.windowMs / 1000),
    };
  } catch (error) {
    console.warn("[ai-usage] limit check failed:", error instanceof Error ? error.message : error);
    return { allowed: true, limit: args.limit, used: 0, retryAfterSeconds: 0 };
  }
}

export async function recordBlockedAiUsage(context: AiUsageContext, reason: string) {
  await recordAiUsageEvent({
    ...context,
    status: "blocked",
    errorCode: "RATE_LIMITED",
    errorMessage: reason,
  });
}

export function aiRateLimitMessage(result: AiLimitResult) {
  return `AI limit reached (${result.used}/${result.limit}). Try again later.`;
}
