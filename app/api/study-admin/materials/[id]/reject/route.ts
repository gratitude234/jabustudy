import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "../../../../../../lib/studyAdmin/scope";
import { notifyMaterialRejected } from "../../../../../../lib/studyAdmin/notifyUploader";

function idFromUrl(req: Request) {
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    // .../materials/<id>/reject
    return parts.length >= 2 ? parts[parts.length - 2] : "";
  } catch {
    return "";
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const resolvedParams = await params;

    // Prefer dynamic route param, but fall back to body.id for resilience
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const id = resolvedParams?.id || (typeof body?.id === "string" ? body.id : "") || idFromUrl(req);
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    // Optional note shown to the uploader after rejection.
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 400) : "";

    const admin = createSupabaseAdminClient();

    if (scope.role !== "super") {
      const { data: matRow, error: matErr } = await admin
        .from("study_materials")
        .select("id, course_id, study_courses:course_id(faculty_id, department_id, level)")
        .eq("id", id)
        .maybeSingle();

      if (matErr) throw matErr;
      if (!matRow?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

      const course = (matRow as any).study_courses;
      const ok = isWithinScope(scope, {
        faculty_id: course?.faculty_id ?? null,
        department_id: course?.department_id ?? null,
        level: course?.level ?? null,
      });
      if (!ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Standardized patch (no schema-dependent flags).
    const nowIso = new Date().toISOString();
    const patch: any = { approved: false, updated_at: nowIso };
    if (note) patch.rejection_reason = note;

    const { data, error } = await admin
      .from("study_materials")
      .update(patch)
      .eq("id", id)
      .select("id, uploader_id, title")
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    // Fire notification — best-effort, must not block the response
    const row = data as any;
    if (row?.uploader_id && row?.title) {
      await notifyMaterialRejected(id, String(row.title), String(row.uploader_id), note || undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
