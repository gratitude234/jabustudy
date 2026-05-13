import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "../../../../../../lib/studyAdmin/scope";

function idFromUrl(req: Request) {
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    // .../course-requests/<id>/reject
    return parts.length >= 2 ? parts[parts.length - 2] : "";
  } catch {
    return "";
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { scope } = await requireStudyModeratorFromRequest(req);
    // Prefer dynamic route param, but fall back to body.id for resilience
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const id =
      resolvedParams?.id ||
      (typeof body?.id === "string" ? body.id : "") ||
      idFromUrl(req);
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 400) : null;

    const admin = createSupabaseAdminClient();

    const { data: row, error: readErr } = await admin
      .from("study_course_requests")
      .select("id, status, faculty_id, department_id, level")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    if (scope.role !== "super") {
      const ok = isWithinScope(scope, {
        faculty_id: row.faculty_id,
        department_id: row.department_id,
        level: row.level,
      });
      if (!ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (row.status !== "pending") {
      return NextResponse.json({ ok: false, error: "Request is not pending" }, { status: 409 });
    }

    const { error } = await admin
      .from("study_course_requests")
      .update({
        status: "rejected",
        admin_note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
