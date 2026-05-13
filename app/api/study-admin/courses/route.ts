import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";
import { isWithinScope } from "@/lib/studyAdmin/scope";
import type { StudyModeratorScope } from "@/lib/studyAdmin/requireStudyModerator";

export const dynamic = "force-dynamic";

type CourseRow = {
  id: string;
  course_code: string;
  course_title: string | null;
  level: number;
  semester: string;
  department: string | null;
  department_id: string | null;
  faculty: string | null;
  faculty_id: string | null;
  status: string;
  created_at: string;
};

type ResolvedDepartment = {
  departmentId: string;
  departmentName: string;
  facultyId: string | null;
  facultyName: string;
};

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function codeKey(value: unknown) {
  return normalizeCode(value).replace(/\s+/g, "");
}

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

function applyScope(query: any, scope: StudyModeratorScope) {
  if (scope.role === "super") return query;
  if (scope.departmentId) query = query.eq("department_id", scope.departmentId);
  if (scope.facultyId) query = query.eq("faculty_id", scope.facultyId);
  if (scope.role === "course_rep") {
    query = query.in("level", scope.levels ?? []);
  }
  return query;
}

async function resolveDepartment(admin: any, departmentId: string): Promise<ResolvedDepartment | null> {
  const { data: deptRow, error: deptErr } = await admin
    .from("study_departments")
    .select("id, name, faculty_id")
    .eq("id", departmentId)
    .maybeSingle();
  if (deptErr) throw deptErr;
  if (!deptRow?.id) return null;

  const facultyId = (deptRow as any).faculty_id ?? null;
  let facultyName = "";
  if (facultyId) {
    const { data: facultyRow, error: facultyErr } = await admin
      .from("study_faculties")
      .select("name")
      .eq("id", facultyId)
      .maybeSingle();
    if (facultyErr) throw facultyErr;
    facultyName = (facultyRow as any)?.name ?? "";
  }

  return {
    departmentId,
    departmentName: (deptRow as any).name ?? "",
    facultyId,
    facultyName,
  };
}

async function findExistingCourse(admin: any, args: {
  departmentId: string;
  level: number;
  semester: string;
  courseCode: string;
  excludeId?: string;
}) {
  const { data, error } = await admin
    .from("study_courses")
    .select("id, course_code")
    .eq("department_id", args.departmentId)
    .eq("level", args.level)
    .eq("semester", args.semester);
  if (error) throw error;

  const target = codeKey(args.courseCode);
  return ((data ?? []) as Array<{ id: string; course_code: string }>).find(
    (course) => course.id !== args.excludeId && codeKey(course.course_code) === target
  ) ?? null;
}

async function ensureSetupInProgress(admin: any, args: {
  userId: string;
  facultyId: string | null;
  departmentId: string;
  level: number;
  semester: string;
}) {
  const { data: existing, error: readErr } = await admin
    .from("study_course_setup_status")
    .select("id")
    .eq("department_id", args.departmentId)
    .eq("level", args.level)
    .eq("semester", args.semester)
    .maybeSingle();
  if (readErr) throw readErr;

  const now = new Date().toISOString();
  if (existing?.id) {
    await admin
      .from("study_course_setup_status")
      .update({ updated_at: now })
      .eq("id", existing.id);
    return;
  }

  await admin.from("study_course_setup_status").insert({
    faculty_id: args.facultyId,
    department_id: args.departmentId,
    level: args.level,
    semester: args.semester,
    status: "in_progress",
    created_by: args.userId,
    updated_at: now,
  });
}

export async function GET(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);

    const url = new URL(req.url);
    const deptId = url.searchParams.get("dept_id") || "";
    const level = url.searchParams.get("level") || "";
    const status = url.searchParams.get("status") || "";
    const semester = normalizeSemester(url.searchParams.get("semester"));
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = 50;
    const offset = (page - 1) * limit;

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("study_courses")
      .select("id, course_code, course_title, level, semester, department, department_id, faculty, faculty_id, status, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    query = applyScope(query, scope);
    if (deptId) query = query.eq("department_id", deptId);
    if (level) query = query.eq("level", Number(level));
    if (semester) query = query.eq("semester", semester);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, items: (data ?? []) as CourseRow[], total: count ?? 0 });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return jsonError(e?.message || "Error", status, e?.code);
  }
}

export async function POST(req: Request) {
  try {
    const { userId, scope } = await requireStudyModeratorFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const admin = createSupabaseAdminClient();

    const level = asLevel(body?.level);
    const semester = normalizeSemester(body?.semester);
    const departmentId =
      typeof body?.department_id === "string" && body.department_id.trim()
        ? body.department_id.trim()
        : scope.departmentId;

    if (!level || !semester || !departmentId) {
      return jsonError("course_code, level, semester, department_id required", 400, "MISSING_FIELDS");
    }

    const dept = await resolveDepartment(admin, departmentId);
    if (!dept) return jsonError("Department not found", 400, "INVALID_DEPARTMENT");

    const entity = {
      faculty_id: dept.facultyId,
      department_id: dept.departmentId,
      level,
    };
    if (!isWithinScope(scope, entity)) {
      return jsonError("Forbidden", 403, "OUT_OF_SCOPE");
    }

    const now = new Date().toISOString();
    const isBulk = body?.mode === "bulk";
    const inputRows = isBulk
      ? Array.isArray(body?.courses) ? body.courses : []
      : [body];

    if (isBulk && inputRows.length === 0) {
      return jsonError("At least one course is required.", 400, "MISSING_COURSES");
    }

    const seen = new Set<string>();
    const skipped: Array<{ course_code: string; reason: string }> = [];
    const toInsert: Array<Record<string, unknown>> = [];

    for (const row of inputRows.slice(0, 100)) {
      const courseCode = normalizeCode((row as any)?.course_code);
      const key = codeKey(courseCode);
      if (!key || key.length < 3) {
        skipped.push({ course_code: courseCode || "Untitled", reason: "Course code is required." });
        continue;
      }
      if (seen.has(key)) {
        skipped.push({ course_code: courseCode, reason: "Duplicate in pasted list." });
        continue;
      }
      seen.add(key);

      const existing = await findExistingCourse(admin, {
        departmentId: dept.departmentId,
        level,
        semester,
        courseCode,
      });
      if (existing?.id) {
        if (!isBulk) {
          return NextResponse.json(
            { ok: false, code: "COURSE_EXISTS", message: "That course already exists." },
            { status: 409 }
          );
        }
        skipped.push({ course_code: courseCode, reason: "Already exists." });
        continue;
      }

      toInsert.push({
        course_code: courseCode,
        course_title:
          typeof (row as any)?.course_title === "string" && (row as any).course_title.trim()
            ? (row as any).course_title.trim().slice(0, 120)
            : null,
        level,
        semester,
        faculty: dept.facultyName,
        faculty_id: dept.facultyId,
        department: dept.departmentName,
        department_id: dept.departmentId,
        status: "approved",
        created_by: userId,
        approved_by: userId,
        approved_at: now,
        updated_at: now,
      });
    }

    if (!isBulk && toInsert.length === 0) {
      return jsonError(skipped[0]?.reason || "Course code is required.", 400, "MISSING_FIELDS");
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        ok: true,
        created: [],
        skipped,
        message: isBulk ? "No new courses were created." : "No course created.",
      });
    }

    const { data, error } = await admin
      .from("study_courses")
      .insert(toInsert)
      .select("id, course_code, course_title, level, semester, department, department_id, faculty, faculty_id, status, created_at");

    if (error) throw error;

    await ensureSetupInProgress(admin, {
      userId,
      facultyId: dept.facultyId,
      departmentId: dept.departmentId,
      level,
      semester,
    });

    if (!isBulk) return NextResponse.json({ ok: true, course: data?.[0] ?? null });
    return NextResponse.json({ ok: true, created: data ?? [], skipped });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return jsonError(e?.message || "Error", status, e?.code);
  }
}

export async function DELETE(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const courseId = typeof body?.course_id === "string" ? body.course_id : "";
    if (!courseId) return jsonError("course_id required", 400, "MISSING_FIELDS");

    const admin = createSupabaseAdminClient();
    const { data: course, error: courseErr } = await admin
      .from("study_courses")
      .select("id, faculty_id, department_id, level")
      .eq("id", courseId)
      .maybeSingle();
    if (courseErr) throw courseErr;
    if (!course?.id) return jsonError("Course not found", 404, "NOT_FOUND");
    if (!isWithinScope(scope, course as any)) return jsonError("Forbidden", 403, "OUT_OF_SCOPE");

    const { data: materials, error: matFetchErr } = await admin
      .from("study_materials")
      .select("id, file_path")
      .eq("course_id", courseId);

    if (matFetchErr) throw matFetchErr;

    const materialCount = materials?.length ?? 0;
    if (materialCount > 0) {
      const filePaths = (materials ?? [])
        .map((m: { file_path: string | null }) => m.file_path)
        .filter((p): p is string => !!p);

      if (filePaths.length > 0) {
        try {
          await admin.storage.from("study-materials").remove(filePaths);
        } catch {
          // Best-effort cleanup.
        }
      }

      const { error: matDelErr } = await admin
        .from("study_materials")
        .delete()
        .eq("course_id", courseId);
      if (matDelErr) throw matDelErr;
    }

    const { error: delErr } = await admin.from("study_courses").delete().eq("id", courseId);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true, deleted_materials: materialCount });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return jsonError(e?.message || "Error", status, e?.code);
  }
}

export async function PATCH(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!body?.id) return jsonError("id required", 400, "MISSING_ID");

    const admin = createSupabaseAdminClient();
    const { data: existing, error: existingErr } = await admin
      .from("study_courses")
      .select("id, course_code, level, semester, faculty_id, department_id")
      .eq("id", body.id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing?.id) return jsonError("Course not found", 404, "NOT_FOUND");
    if (!isWithinScope(scope, existing as any)) return jsonError("Forbidden", 403, "OUT_OF_SCOPE");

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.course_code !== undefined) updates.course_code = normalizeCode(body.course_code);
    if (body.course_title !== undefined) updates.course_title = body.course_title?.trim() ?? null;
    if (body.deactivate) updates.status = "rejected";

    if (body.department_id !== undefined) {
      const nextDepartmentId = String(body.department_id ?? "").trim();
      if (!nextDepartmentId) return jsonError("department_id cannot be empty", 400, "MISSING_DEPARTMENT");

      const dept = await resolveDepartment(admin, nextDepartmentId);
      if (!dept) return jsonError("Department not found", 400, "INVALID_DEPARTMENT");

      const nextEntity = {
        faculty_id: dept.facultyId,
        department_id: dept.departmentId,
        level: (existing as any).level,
      };
      if (!isWithinScope(scope, nextEntity)) return jsonError("Forbidden", 403, "OUT_OF_SCOPE");

      updates.department_id = dept.departmentId;
      updates.department = dept.departmentName;
      updates.faculty_id = dept.facultyId;
      updates.faculty = dept.facultyName;
    }

    if (updates.course_code || updates.department_id) {
      const duplicate = await findExistingCourse(admin, {
        departmentId: String(updates.department_id ?? (existing as any).department_id),
        level: Number((existing as any).level),
        semester: String((existing as any).semester),
        courseCode: String(updates.course_code ?? (existing as any).course_code),
        excludeId: String((existing as any).id),
      });
      if (duplicate?.id) return jsonError("That course already exists.", 409, "COURSE_EXISTS");
    }

    const { error } = await admin.from("study_courses").update(updates).eq("id", body.id);
    if (error) throw error;

    if (body.department_id !== undefined) {
      const materialUpdates = {
        department_id: updates.department_id,
        department: updates.department,
        faculty_id: updates.faculty_id,
        faculty: updates.faculty,
      };

      const { error: matErr } = await admin
        .from("study_materials")
        .update(materialUpdates)
        .eq("course_id", body.id);
      if (matErr) throw matErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return jsonError(e?.message || "Error", status, e?.code);
  }
}
