// app/api/study/rep-applications/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Role = "course_rep" | "dept_librarian";
type Status = "not_applied" | "pending" | "approved" | "rejected";

function normalizeRole(raw: unknown): Role | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "course_rep") return "course_rep";
  if (v === "dept_librarian") return "dept_librarian";
  if (v === "rep") return "course_rep";
  if (v === "librarian") return "dept_librarian";
  return null;
}

function parseLevels(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const nums = raw
    .map((x) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.trunc(n));
  const uniq = Array.from(new Set(nums)).filter((n) => n >= 100 && n <= 700);
  return uniq.length ? uniq : null;
}

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return jsonError("Unauthorized", 401, "NO_SESSION");
  }

  const admin = createSupabaseAdminClient();
  const user_id = userData.user.id;

  // 1) If user is already approved in study_reps, that is the source of truth.
  const { data: repRow, error: repErr } = await admin
    .from("study_reps")
    .select("user_id, role, faculty_id, department_id, levels, active, created_at")
    .eq("user_id", user_id)
    .maybeSingle();

  if (repErr) return jsonError(repErr.message || "DB error", 500, "DB_ERROR");

  if (repRow?.user_id && repRow.active !== false) {
    const role = normalizeRole((repRow as any)?.role) ?? "course_rep";
    const levels = role === "course_rep" ? parseLevels((repRow as any)?.levels) : null;

    return NextResponse.json({
      ok: true,
      status: "approved" as Status,
      role,
      scope: {
        faculty_id: (repRow as any)?.faculty_id ?? null,
        department_id: (repRow as any)?.department_id ?? null,
        levels,
        all_levels: role === "dept_librarian",
      },
      rep: {
        created_at: repRow.created_at,
        active: repRow.active,
      },
      application: null,
    });
  }

  // 2) Otherwise, return latest application (any status)
  const { data: appRow, error: appErr } = await admin
    .from("study_rep_applications")
    .select("id, created_at, status, role, faculty_id, department_id, level, levels, decision_reason, note")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (appErr) return jsonError(appErr.message || "DB error", 500, "DB_ERROR");

  if (!appRow?.id) {
    return NextResponse.json({
      ok: true,
      status: "not_applied" as Status,
      role: null,
      scope: null,
      rep: null,
      application: null,
    });
  }

  const role = normalizeRole((appRow as any)?.role);
  const levels = role === "course_rep" ? parseLevels((appRow as any)?.levels) : null;

  let status: Status = "pending";
  if (appRow.status === "approved") status = "approved";
  else if (appRow.status === "rejected") status = "rejected";
  else status = "pending";

  return NextResponse.json({
    ok: true,
    status,
    role,
    scope: role
      ? {
          faculty_id: (appRow as any)?.faculty_id ?? null,
          department_id: (appRow as any)?.department_id ?? null,
          levels,
          all_levels: role === "dept_librarian",
        }
      : null,
    rep: null,
    application: {
      id: appRow.id,
      created_at: appRow.created_at,
      status: appRow.status,
      role: appRow.role,
      faculty_id: appRow.faculty_id,
      department_id: appRow.department_id,
      // Keep legacy fields too
      level: (appRow as any)?.level ?? null,
      levels: (appRow as any)?.levels ?? null,
      decision_reason: (appRow as any)?.decision_reason ?? null,
      note: (appRow as any)?.note ?? null,
    },
  });
}