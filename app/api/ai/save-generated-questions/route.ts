// app/api/ai/save-generated-questions/route.ts
// POST /api/ai/save-generated-questions
// Backward-compatible endpoint for saving generated questions as a kept private set.

export const maxDuration = 180;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  saveGeneratedPracticeSet,
  type GeneratedPracticeQuestion,
} from "@/lib/aiGeneratedPractice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { duplicateGateErrorResponse } from "@/lib/studyDuplicateGate";

type RouteError = {
  message?: string;
  status?: number;
  code?: string;
  invalidCount?: number;
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { materialId?: string; questions?: GeneratedPracticeQuestion[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await saveGeneratedPracticeSet({
      userId: user.id,
      materialId: String(body.materialId ?? ""),
      questions: Array.isArray(body.questions) ? body.questions : [],
      asDraft: false,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const routeError = error as RouteError;
    if (routeError.code === "DUPLICATE_QUESTION") {
      return NextResponse.json(
        duplicateGateErrorResponse(error),
        { status: Number(routeError.status) || 422 }
      );
    }

    return NextResponse.json(
      {
        error: routeError.message || "Failed to save questions.",
        code: routeError.code,
        invalidCount: routeError.invalidCount,
      },
      { status: Number(routeError.status) || 500 }
    );
  }
}
