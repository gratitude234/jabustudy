import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "../../../../../../lib/studyAdmin/scope";
import { isIndexableMaterialPath } from "../../../../../../lib/studyMaterialIndexEligibility";
import { indexStudyMaterial } from "../../../../../../lib/studyMaterialIndex";

function idFromUrl(req: Request) {
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 2] : "";
  } catch {
    return "";
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const resolvedParams = await params;

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const id = resolvedParams?.id || (typeof body?.id === "string" ? body.id : "") || idFromUrl(req);
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("study_materials")
      .select("id, approved, file_path, study_courses:course_id(faculty_id, department_id, level)")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!row?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const course = (row as any).study_courses;
    if (scope.role !== "super") {
      const ok = isWithinScope(scope, {
        faculty_id: course?.faculty_id ?? null,
        department_id: course?.department_id ?? null,
        level: course?.level ?? null,
      });
      if (!ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    if (!(row as any).approved) {
      return NextResponse.json({ ok: false, error: "Only approved materials can be indexed." }, { status: 400 });
    }

    if (!isIndexableMaterialPath((row as any).file_path)) {
      return NextResponse.json({ ok: false, error: "This file type is not indexable." }, { status: 422 });
    }

    const result = await indexStudyMaterial(id);
    return NextResponse.json({ ok: result.status !== "failed", ...result }, { status: result.status === "failed" ? 422 : 200 });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
