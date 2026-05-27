export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { initReceiptUpload } from "@/lib/studyBilling";

function errorResponse(error: unknown) {
  const e = error as { message?: string; status?: number; code?: string };
  return NextResponse.json(
    { ok: false, code: e.code || "SERVER_ERROR", message: e.message || "Server error" },
    { status: Number(e.status) || 500 }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, code: "NO_SESSION", message: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => null) as { fileName?: unknown; contentType?: unknown } | null;
    const upload = await initReceiptUpload(user.id, id, body?.fileName, body?.contentType);
    return NextResponse.json({ ok: true, ...upload });
  } catch (error) {
    return errorResponse(error);
  }
}
