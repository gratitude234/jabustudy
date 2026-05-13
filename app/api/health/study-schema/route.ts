import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.rpc("study_schema_health");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "health_check_failed",
          details: error.message,
        },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    // data is jsonb already
    return NextResponse.json(data ?? { ok: false }, {
      status: (data && (data as any).ok) ? 200 : 500,
      headers: { "cache-control": "no-store" },
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "unknown_error";
    const isMissingKey = msg.toLowerCase().includes("missing supabase_service_role_key");

    return NextResponse.json(
      {
        ok: false,
        error: isMissingKey ? "missing_service_role_key" : "server_error",
        details: isMissingKey
          ? "Set SUPABASE_SERVICE_ROLE_KEY on the server (Vercel / .env.local) to enable schema health checks."
          : msg,
      },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
