export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBillingSnapshot } from "@/lib/studyBilling";
import { EXAM_SPRINT_PLAN_KEY, isExamSprintOnlyMode } from "@/lib/systemMode";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "NO_SESSION", message: "Sign in first." }, { status: 401 });

  const snapshot = await getBillingSnapshot(user.id, {
    includeExamOffer: req.nextUrl.searchParams.get("include") === "exam-offer",
  });
  if (!isExamSprintOnlyMode()) return NextResponse.json({ ok: true, ...snapshot });

  const examPassActive = snapshot.plus.active && snapshot.plus.planKey === EXAM_SPRINT_PLAN_KEY;
  return NextResponse.json({
    ok: true,
    ...snapshot,
    plus: examPassActive
      ? snapshot.plus
      : { active: false, planKey: null, activeUntil: null },
    plans: snapshot.plans.filter((plan) => plan.key === EXAM_SPRINT_PLAN_KEY),
    orders: snapshot.orders.filter((order) => order.planKey === EXAM_SPRINT_PLAN_KEY),
  });
}
