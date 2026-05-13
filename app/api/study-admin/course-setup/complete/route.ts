import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "@/lib/studyAdmin/scope";

function normalizeSemester(value: unknown): "first" | "second" | "summer" | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "first" || s === "1st") return "first";
  if (s === "second" || s === "2nd") return "second";
  if (s === "summer") return "summer";
  return null;
}

function asLevel(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function POST(req: Request) {
  try {
    const { scope, userId } = await requireStudyModeratorFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const departmentId =
      typeof body?.department_id === "string" && body.department_id.trim()
        ? body.department_id.trim()
        : scope.departmentId;
    const level = asLevel(body?.level);
    const semester = normalizeSemester(body?.semester);

    if (!departmentId || !level || !semester) {
      return NextResponse.json(
        { ok: false, code: "MISSING_FIELDS", message: "department_id, level and semester are required." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: dept, error: deptErr } = await admin
      .from("study_departments")
      .select("id, faculty_id")
      .eq("id", departmentId)
      .maybeSingle();

    if (deptErr) throw deptErr;
    if (!dept?.id) {
      return NextResponse.json({ ok: false, code: "INVALID_DEPARTMENT", message: "Department not found." }, { status: 404 });
    }

    const entity = {
      faculty_id: (dept as any).faculty_id ?? null,
      department_id: departmentId,
      level,
    };

    if (!isWithinScope(scope, entity)) {
      return NextResponse.json({ ok: false, code: "OUT_OF_SCOPE", message: "Forbidden" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("study_course_setup_status")
      .upsert(
        {
          faculty_id: entity.faculty_id,
          department_id: departmentId,
          level,
          semester,
          status: "complete",
          created_by: userId,
          completed_by: userId,
          completed_at: now,
          updated_at: now,
        },
        { onConflict: "department_id,level,semester" }
      )
      .select("id, faculty_id, department_id, level, semester, status, completed_at")
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ ok: true, setup: data });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json(
      { ok: false, code: e?.code, message: e?.message || "Error" },
      { status }
    );
  }
}
