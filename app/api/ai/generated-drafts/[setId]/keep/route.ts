import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyPracticePoweredImpactIfMilestone } from "@/lib/studyContribution";

export const runtime = "nodejs";

function normalizeMaterialLevel(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string") return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMaterialSemester(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1st" || normalized === "first") return "first";
  if (normalized === "2nd" || normalized === "second") return "second";
  if (normalized === "summer") return "summer";
  return null;
}

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
    .select("id,created_by,draft_status,source_material_id")
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

  const sourceMaterialId = (set as { source_material_id?: string | null }).source_material_id;
  const { data: material } = sourceMaterialId
    ? await adminSupabase
        .from("study_materials")
        .select("level,semester")
        .eq("id", sourceMaterialId)
        .maybeSingle()
    : { data: null };
  const materialLevel = normalizeMaterialLevel((material as { level?: unknown } | null)?.level);
  const materialSemester = normalizeMaterialSemester((material as { semester?: unknown } | null)?.semester);
  const patch: Record<string, unknown> = {
    published: true,
    visibility: "private",
    draft_status: "kept",
    draft_expires_at: null,
  };
  if (materialLevel !== null) patch.level = materialLevel;
  if (materialSemester !== null) patch.semester = materialSemester;

  const { error } = await adminSupabase
    .from("study_quiz_sets")
    .update(patch)
    .eq("id", setId);

  if (error) {
    return NextResponse.json({ ok: false, code: "DRAFT_KEEP_FAILED", message: error.message }, { status: 500 });
  }
  if (sourceMaterialId) {
    void notifyPracticePoweredImpactIfMilestone(sourceMaterialId, adminSupabase);
  }
  return NextResponse.json({ ok: true });
}
