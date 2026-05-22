import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { setId: string } | Promise<{ setId: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Unauthorised" }, { status: 401 });
  }

  const { setId } = await params;
  if (!setId) {
    return NextResponse.json({ ok: false, code: "MISSING_SET_ID", message: "Missing setId" }, { status: 400 });
  }

  const { data: set, error: setError } = await adminSupabase
    .from("study_quiz_sets")
    .select("id,created_by,draft_status")
    .eq("id", setId)
    .eq("source", "ai_generated")
    .maybeSingle();

  if (setError) {
    return NextResponse.json({ ok: false, code: "DRAFT_LOOKUP_FAILED", message: setError.message }, { status: 500 });
  }
  if (!set) {
    return NextResponse.json({ ok: false, code: "DRAFT_NOT_FOUND", message: "Draft not found." }, { status: 404 });
  }
  if ((set as { created_by?: string | null }).created_by !== user.id) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Forbidden" }, { status: 403 });
  }

  const { error } = await adminSupabase
    .from("study_quiz_sets")
    .update({
      published: true,
      visibility: "private",
      draft_status: "kept",
      draft_expires_at: null,
    })
    .eq("id", setId);

  if (error) {
    return NextResponse.json({ ok: false, code: "DRAFT_KEEP_FAILED", message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
