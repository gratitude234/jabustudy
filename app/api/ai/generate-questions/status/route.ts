export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveGenerationDrafts,
  normalizeQuestionGenerationRequest,
} from "@/lib/aiQuestionGenerationTrust";
import { FREE_AI_TRIAL_QUESTION_COUNT, getAiGenerationAccess } from "@/lib/studyBilling";

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

  let effectiveConfig = requestConfig;
  let access = await getAiGenerationAccess(user.id, requestConfig.creditCost);
  if (access.chargeMode === "free_trial") {
    const trialConfig = normalizeQuestionGenerationRequest({
      materialId: requestConfig.materialId,
      count: FREE_AI_TRIAL_QUESTION_COUNT,
      difficulty: requestConfig.difficulty,
      questionFormat: "mcq",
      generationIntent: requestConfig.generationIntent,
      focus: requestConfig.focus,
      topicId: requestConfig.topicId,
      subtopicId: requestConfig.subtopicId,
      forceQuestionCount: true,
    });
    if (trialConfig) {
      effectiveConfig = trialConfig;
      access = await getAiGenerationAccess(user.id, trialConfig.creditCost);
    }
  }

  const drafts = await getActiveGenerationDrafts({
    userId: user.id,
    materialId: effectiveConfig.materialId,
    signature: effectiveConfig.signature,
  });

  const remaining = access.freeTrial.remaining;
  const isTrial = access.chargeMode === "free_trial";

  return NextResponse.json({
    ok: true,
    credits: {
      balance: access.credits.balance,
      cost: isTrial ? 0 : effectiveConfig.creditCost,
      canAfford: access.credits.canAfford,
    },
    plus: access.plus,
    freeTrial: access.freeTrial,
    freeAi: access.freeTrial,
    dailyLimit: {
      limit: access.freeTrial.limit,
      used: access.freeTrial.used,
      remaining,
      retryAfterSeconds: 0,
    },
    effectiveRequest: {
      count: effectiveConfig.questionCount,
      questionFormat: effectiveConfig.questionFormat,
      chargeMode: access.chargeMode,
    },
    matchingDraft: drafts.matchingDraft,
    latestDraft: drafts.latestDraft,
  });
}
