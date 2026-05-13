// app/api/study-admin/rep-applications/route.ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudyModerator } from "@/lib/studyAdmin/requireStudyModerator";

type Status = "pending" | "approved" | "rejected" | "all";

function jsonError(message: string, status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, message, ...(extra ?? {}) }, { status });
}

function normalizeRole(raw: unknown): "course_rep" | "dept_librarian" | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "course_rep") return "course_rep";
  if (v === "dept_librarian") return "dept_librarian";
  if (v === "rep") return "course_rep";
  if (v === "librarian") return "dept_librarian";
  return null;
}

function parseIntSafe(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET(req: Request) {
  // Super admin only
  let auth;
  try {
    auth = await requireStudyModerator();
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.status || 401, e?.code || "UNAUTHORIZED");
  }
  if (!auth.isSuper) return jsonError("Forbidden", 403, "FORBIDDEN");

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") as Status) || "pending";
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, parseIntSafe(url.searchParams.get("page"), 1));
  const pageSize = Math.min(100, Math.max(10, parseIntSafe(url.searchParams.get("pageSize"), 25)));

  const admin = createSupabaseAdminClient();

  let query = admin
    .from("study_rep_applications")
    .select(
      "id, created_at, status, role, faculty_id, department_id, level, levels, note, admin_note, decision_reason, user_id",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  // IMPORTANT: 'all' means no filter
  if (status !== "all") query = query.eq("status", status);

  if (q) {
    const like = `%${q}%`;
    query = query.or(
      [
        `role.ilike.${like}`,
        `note.ilike.${like}`,
        `admin_note.ilike.${like}`,
        `decision_reason.ilike.${like}`,
        `user_id::text.ilike.${like}`,
        `department_id::text.ilike.${like}`,
      ].join(",")
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) return jsonError(error.message || "DB error", 500, "DB_ERROR");

  const items = (data ?? []).map((row: any) => {
    const role = normalizeRole(row.role);
    const levels =
      role === "course_rep"
        ? Array.isArray(row.levels)
          ? row.levels
          : typeof row.level === "number"
            ? [row.level]
            : []
        : null;

    return {
      id: row.id,
      created_at: row.created_at,
      status: row.status as Exclude<Status, "all">,
      role,
      user_id: row.user_id,
      faculty_id: row.faculty_id ?? null,
      department_id: row.department_id ?? null,
      level: row.level ?? null,
      levels,
      note: row.note ?? null,
      admin_note: row.admin_note ?? null,
      decision_reason: row.decision_reason ?? null,
      all_levels: role === "dept_librarian",
    };
  });

  return NextResponse.json({
    ok: true,
    page,
    pageSize,
    total: count ?? items.length,
    items,
  });
}