import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../../lib/studyAdmin/requireStudyModeratorFromRequest";

export const dynamic = "force-dynamic";

type InitBody = {
  filename: string;
  filesize: number;
  mimetype: string;
  faculty_id: string;
  department_id: string;
  level: number;
  semester: string;
  course_id?: string | null;
  material_type: string;
  session?: string | null;
  title?: string | null;
  description?: string | null;
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireStudyModeratorFromRequest(req);

    const body = (await req.json()) as InitBody;

    const { filename, filesize, mimetype, faculty_id, department_id, level, semester, material_type } = body;
    if (!filename || !filesize || !faculty_id || !department_id || !level || !semester || !material_type) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "Required fields missing" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Lookup faculty name
    const { data: facultyRow } = await admin
      .from("study_faculties")
      .select("name")
      .eq("id", faculty_id)
      .maybeSingle();
    const facultyName = (facultyRow as { name: string } | null)?.name ?? faculty_id;

    // Lookup department name
    const { data: deptRow } = await admin
      .from("study_departments")
      .select("name")
      .eq("id", department_id)
      .maybeSingle();
    const departmentName = (deptRow as { name: string } | null)?.name ?? department_id;

    // Lookup course code if provided
    let courseCode: string | null = null;
    if (body.course_id) {
      const { data: courseRow } = await admin
        .from("study_courses")
        .select("course_code")
        .eq("id", body.course_id)
        .maybeSingle();
      courseCode = (courseRow as { course_code: string } | null)?.course_code ?? null;
    }

    const materialId = crypto.randomUUID();
    const safe = sanitizeFilename(filename);
    const folder = courseCode ?? "general";
    const filePath = `materials/${department_id}/${folder}/${materialId}-${safe}`;

    const title = (body.title?.trim() || titleFromFilename(filename)) ?? filename;

    const { error: insertErr } = await admin.from("study_materials").insert({
      id: materialId,
      title,
      description: body.description ?? null,
      material_type,
      course_code: courseCode,
      level: level.toString(),
      semester,
      session: body.session ?? null,
      faculty: facultyName,
      faculty_id,
      department: departmentName,
      department_id,
      course_id: body.course_id ?? null,
      file_path: filePath,
      uploader_id: userId,
      uploader_email: null,
      approved: true,
      approved_by: userId,
      approved_at: new Date().toISOString(),
    });

    if (insertErr) throw insertErr;

    const { data: signedData, error: signedErr } = await admin.storage
      .from("study-materials")
      .createSignedUploadUrl(filePath);

    if (signedErr) throw signedErr;

    return NextResponse.json({
      ok: true,
      material_id: materialId,
      signed_url: (signedData as { signedUrl: string }).signedUrl,
      path: filePath,
    });
  } catch (e: unknown) {
    const err = e as { status?: number; code?: string; message?: string };
    const status = Number(err?.status) || 500;
    return NextResponse.json({ ok: false, code: err?.code, message: err?.message || "Error" }, { status });
  }
}
