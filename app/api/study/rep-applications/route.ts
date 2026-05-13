// app/api/study/rep-applications/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Role = "course_rep" | "dept_librarian";

function jsonError(message: string, status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status });
}

function normalizeRole(raw: unknown): Role | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "course_rep") return "course_rep";
  if (v === "dept_librarian") return "dept_librarian";

  // Backwards compatibility
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

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userData.user) {
    return jsonError("Unauthorized", 401, "NO_SESSION");
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const role = normalizeRole(body?.role);
  if (!role) return jsonError("Invalid role", 400, "INVALID_ROLE");

  const department_id = typeof body?.department_id === "string" ? body.department_id : null;
  const faculty_id = typeof body?.faculty_id === "string" ? body.faculty_id : null;

  if (!department_id) return jsonError("Department is required", 400, "MISSING_DEPARTMENT");

  // Validate levels based on role
  const levels = parseLevels(body?.levels);
  if (role === "course_rep" && !levels) {
    return jsonError("Levels are required for course reps", 400, "LEVELS_REQUIRED");
  }

  // If someone sends a single `level`, accept it for backward compatibility
  let legacyLevel: number | null = null;
  if (role === "course_rep" && !levels && body?.level != null) {
    const lvl = Number(body.level);
    if (Number.isFinite(lvl)) legacyLevel = Math.trunc(lvl);
  }

  const admin = createSupabaseAdminClient();
  const user_id = userData.user.id;

  // 1) If already an active rep/librarian, block apply
  const { data: repRow, error: repErr } = await admin
    .from("study_reps")
    .select("user_id, active")
    .eq("user_id", user_id)
    .maybeSingle();

  if (repErr) return jsonError(repErr.message || "DB error", 500, "DB_ERROR");
  if (repRow?.user_id && repRow?.active !== false) {
    return jsonError("You are already approved", 409, "ALREADY_APPROVED");
  }

  // 2) Block duplicate pending/approved applications
  const { data: existingApp, error: existingErr } = await admin
    .from("study_rep_applications")
    .select("id, status, role, department_id")
    .eq("user_id", user_id)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existingErr) return jsonError(existingErr.message || "DB error", 500, "DB_ERROR");
  if (existingApp?.id) {
    return jsonError("You already have an active application", 409, "ALREADY_PENDING", {
      application_id: existingApp.id,
      status: existingApp.status,
    });
  }

  // 3) Create application
  // Prefer `levels` if the DB has it; keep `level` for legacy schemas.
  // We insert both when possible — extra columns will be ignored only if they exist.
  const insertPayload: Record<string, any> = {
    user_id,
    faculty_id,
    department_id,
    role, // store normalized role
    status: "pending",
  };

  // For course_rep, keep legacy level too (for old UIs/DB)
  if (role === "course_rep") {
    insertPayload.levels = levels ?? (legacyLevel ? [legacyLevel] : null);
    insertPayload.level = legacyLevel ?? (levels?.[0] ?? null);
  } else {
    // dept_librarian: all levels implied
    insertPayload.levels = null;
    insertPayload.level = null;
  }

  const { data: created, error: createErr } = await admin
    .from("study_rep_applications")
    .insert(insertPayload)
    .select("id, status, role, department_id, faculty_id, created_at, level, levels")
    .single();

  if (createErr) {
    return jsonError(createErr.message || "Could not submit application", 500, "CREATE_FAILED");
  }

  return NextResponse.json({ ok: true, application: created });
}