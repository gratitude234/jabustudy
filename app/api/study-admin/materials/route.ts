import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../lib/studyAdmin/requireStudyModeratorFromRequest";

function applyScopeToMaterialsQuery(query: any, scope: any) {
  // super sees everything
  if (scope.role === "super") return query;

  // For both dept_librarian & course_rep we require a department scope
  if (!scope.departmentId) {
    const err: any = new Error("Moderator scope misconfigured (missing department).");
    err.status = 403;
    err.code = "REP_SCOPE_MISCONFIGURED";
    throw err;
  }

  query = query.eq("study_courses.department_id", scope.departmentId);

  // optional faculty restriction
  if (scope.facultyId) query = query.eq("study_courses.faculty_id", scope.facultyId);

  // course reps are level-scoped
  if (scope.role === "course_rep") {
    if (!scope.levels || !Array.isArray(scope.levels) || scope.levels.length === 0) {
      const err: any = new Error("Moderator scope misconfigured (missing levels).");
      err.status = 403;
      err.code = "REP_SCOPE_MISCONFIGURED";
      throw err;
    }
    query = query.in("study_courses.level", scope.levels);
  }

  // dept_librarian => all levels, no level filter
  return query;
}

function safeDecodeURIComponent(v: string) {
  let cur = v || "";
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(cur);
      if (next === cur) break;
      cur = next;
    } catch {
      break;
    }
  }
  return cur;
}

export async function GET(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "pending") as "pending" | "approved" | "all";
    const q = safeDecodeURIComponent(url.searchParams.get("q") || "").trim();
    const brokenOnly = (url.searchParams.get("broken") || "") === "1";
    const limit = Math.min(100, Math.max(5, Number(url.searchParams.get("limit") || 30)));

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("study_materials")
      .select(
        [
          "id",
          "title",
          "material_type",
          "department",
          "session",
          "file_url",
          "file_path",
          "created_at",
          "approved",
          "verified",
          "featured",
          "file_hash",
          "uploader_email",
          "index_status",
          "indexed_at",
          "index_error",
          "study_courses!inner(id, course_code, course_title, level, semester, faculty_id, department_id)",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "pending") query = query.eq("approved", false);
    if (status === "approved") query = query.eq("approved", true);

    if (brokenOnly) {
      // items that need attention: missing path or missing public URL
      query = query.or("file_url.is.null,file_path.is.null");
    }

    query = applyScopeToMaterialsQuery(query, scope);

    if (q) {
      const qSafe = (q || "")
        .replace(/[%_]/g, "")
        .replace(/[(),]/g, " ")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

      // Same whitespace-safe trick as the public materials route.
      const like = `*${qSafe.replace(/\s+/g, "*")}*`;

      query = query.or(`title.ilike.${like},study_courses.course_code.ilike.${like}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json(
      { ok: false, code: e?.code, error: e?.message || "Error" },
      { status }
    );
  }
}
