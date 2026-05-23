export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureStudyCreditBalance,
  getActiveGenerationDrafts,
  getQuestionGenerationLimit,
  normalizeQuestionGenerationRequest,
} from "@/lib/aiQuestionGenerationTrust";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Unauthorised" }, { status: 401 });

  const search = req.nextUrl.searchParams;
  const requestConfig = normalizeQuestionGenerationRequest({
    materialId: search.get("materialId"),
    count: search.get("count"),
    difficulty: search.get("difficulty"),
    questionFormat: search.get("questionFormat"),
    generationIntent: search.get("generationIntent"),
    focus: search.get("focus"),
    topicId: search.get("topicId"),
    subtopicId: search.get("subtopicId"),
  });

  if (!requestConfig) {
    return NextResponse.json({ ok: false, message: "Missing materialId" }, { status: 400 });
  }

  const [balance, limit, drafts] = await Promise.all([
    ensureStudyCreditBalance(user.id),
    getQuestionGenerationLimit(user.id),
    getActiveGenerationDrafts({
      userId: user.id,
      materialId: requestConfig.materialId,
      signature: requestConfig.signature,
    }),
  ]);

  const remaining = Math.max(0, limit.limit - limit.used);

  return NextResponse.json({
    ok: true,
    credits: {
      balance,
      cost: requestConfig.creditCost,
      canAfford: balance >= requestConfig.creditCost,
    },
    dailyLimit: {
      limit: limit.limit,
      used: limit.used,
      remaining,
      retryAfterSeconds: limit.retryAfterSeconds,
    },
    matchingDraft: drafts.matchingDraft,
    latestDraft: drafts.latestDraft,
  });
}
