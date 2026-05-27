export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBillingOrder, getBankDetails } from "@/lib/studyBilling";

function errorResponse(error: unknown) {
  const e = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: e.code || "SERVER_ERROR", message: e.message || "Server error" },
    { status: Number(e.status) || 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, code: "NO_SESSION", message: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => null) as { planKey?: unknown } | null;
    const order = await createBillingOrder(user.id, body?.planKey);
    return NextResponse.json({ ok: true, order, bank: getBankDetails() });
  } catch (error) {
    return errorResponse(error);
  }
}
