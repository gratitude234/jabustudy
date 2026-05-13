import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "../../../../../../lib/studyAdmin/scope";

export const dynamic = "force-dynamic";

const BUCKET = "study-materials";

function idFromUrl(req: Request) {
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    // .../materials/<id>/delete
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

    // Fetch info for scope + storage cleanup
    const { data: matRow, error: matErr } = await admin
      .from("study_materials")
      .select("id, course_id, file_path, study_courses:course_id(faculty_id, department_id, level)")
      .eq("id", id)
      .maybeSingle();

    if (matErr) throw matErr;
    if (!matRow?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    if (scope.role !== "super") {
      const course = (matRow as any).study_courses;
      const ok = isWithinScope(scope, {
        faculty_id: course?.faculty_id ?? null,
        department_id: course?.department_id ?? null,
        level: course?.level ?? null,
      });
      if (!ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Best-effort storage delete
    const file_path = (matRow as any).file_path as string | null;
    if (file_path) {
      try {
        await admin.storage.from(BUCKET).remove([file_path] as any);
      } catch {
        // ignore
      }
    }

    const { error: delErr } = await admin.from("study_materials").delete().eq("id", id);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}