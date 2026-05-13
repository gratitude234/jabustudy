import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "../../../../../../lib/studyAdmin/scope";

function idFromUrl(req: Request) {
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    // .../materials/<id>/recheck-storage
    return parts.length >= 2 ? parts[parts.length - 2] : "";
  } catch {
    return "";
  }
}

function splitPath(filePath: string) {
  const parts = (filePath || "").split("/").filter(Boolean);
  const name = parts.pop() || "";
  const dir = parts.join("/");
  return { dir, name };
}

function stripBrokenUploadStamps(value: string | null | undefined) {
  const cleaned = (value || "")
    .split(/\r?\n/)
    .filter((line) => !/\[BROKEN_UPLOAD[^\]]*\]/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || null;
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

    const { data: row, error: readErr } = await admin
      .from("study_materials")
      .select("id, file_path, description")
      .eq("id", id)
      .maybeSingle();

    if (readErr) throw readErr;
    if (!row?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const filePath = (row as any)?.file_path as string | null;
    const priorDescription = (row as any)?.description as string | null;
    const { dir, name } = splitPath(filePath ?? "");
    const exists = !!filePath && !!name
      ? await admin.storage.from("study-materials").list(dir, { search: name }).then(
          ({ data, error }) => !error && Array.isArray(data) && data.some((f: any) => f.name === name)
        )
      : false;

    const nowIso = new Date().toISOString();
    const patch: any = { updated_at: nowIso };
    if (exists) {
      patch.description = stripBrokenUploadStamps(priorDescription);
    } else {
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const note = `[BROKEN_UPLOAD ${stamp}] Client reported completion but file not found in storage.`;
      const base = stripBrokenUploadStamps(priorDescription);
      patch.description = base ? `${base}\n\n${note}` : note;
    }

    const { data, error } = await admin
      .from("study_materials")
      .update(patch)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, exists });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
