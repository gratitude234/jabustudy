export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveGenerationDrafts,
  normalizeQuestionGenerationRequest,
} from "@/lib/aiQuestionGenerationTrust";
import { getAiGenerationAccess } from "@/lib/studyBilling";

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

  const [access, drafts] = await Promise.all([
    getAiGenerationAccess(user.id, requestConfig.creditCost),
    getActiveGenerationDrafts({
      userId: user.id,
      materialId: requestConfig.materialId,
      signature: requestConfig.signature,
    }),
  ]);

  const remaining = access.freeAi.remaining;

  return NextResponse.json({
    ok: true,
    credits: {
      balance: access.credits.balance,
      cost: requestConfig.creditCost,
      canAfford: access.credits.canAfford,
    },
    plus: access.plus,
    freeAi: access.freeAi,
    dailyLimit: {
      limit: access.freeAi.limit,
      used: access.freeAi.used,
      remaining,
      retryAfterSeconds: 0,
    },
    matchingDraft: drafts.matchingDraft,
    latestDraft: drafts.latestDraft,
  });
}
