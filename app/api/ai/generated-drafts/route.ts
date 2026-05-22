import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type DraftSetRow = {
  id: string;
  title: string | null;
  questions_count: number | null;
  created_at: string | null;
  draft_expires_at: string | null;
};

type AttemptRow = {
  id: string;
  status: string | null;
  updated_at: string | null;
};

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Unauthorised" }, { status: 401 });
  }

  const materialId = new URL(req.url).searchParams.get("materialId")?.trim();
  if (!materialId) {
    return NextResponse.json({ ok: false, code: "MISSING_MATERIAL_ID", message: "Missing materialId" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: draft, error } = await adminSupabase
    .from("study_quiz_sets")
    .select("id,title,questions_count,created_at,draft_expires_at")
    .eq("created_by", user.id)
    .eq("source_material_id", materialId)
    .eq("source", "ai_generated")
    .eq("draft_status", "draft")
    .gt("draft_expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, code: "DRAFT_LOOKUP_FAILED", message: error.message }, { status: 500 });
  }
  if (!draft) return NextResponse.json({ ok: true, draft: null });

  const row = draft as DraftSetRow;
  const { data: attempt } = await adminSupabase
    .from("study_practice_attempts")
    .select("id,status,updated_at")
    .eq("user_id", user.id)
    .eq("set_id", row.id)
    .eq("status", "in_progress")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    draft: {
      setId: row.id,
      title: row.title,
      questionsCount: row.questions_count ?? 0,
      createdAt: row.created_at,
      expiresAt: row.draft_expires_at,
      attempt: attempt
        ? {
            id: (attempt as AttemptRow).id,
            status: (attempt as AttemptRow).status,
            updatedAt: (attempt as AttemptRow).updated_at,
          }
        : null,
    },
  });
}
