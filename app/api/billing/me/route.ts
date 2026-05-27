export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBillingSnapshot } from "@/lib/studyBilling";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "NO_SESSION", message: "Sign in first." }, { status: 401 });

  const snapshot = await getBillingSnapshot(user.id);
  return NextResponse.json({ ok: true, ...snapshot });
}
