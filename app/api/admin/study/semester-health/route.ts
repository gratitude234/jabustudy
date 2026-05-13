import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HealthItem = {
  id: string;
  label: string;
  ok: boolean;
  details?: any;
};

export async function GET(req: Request) {
  try {
    const { userId } = await requireAdmin();

    const url = new URL(req.url);
    const simulateNoSemester = url.searchParams.get("simulate_no_semester") === "1";
    const forcedSession = url.searchParams.get("session") || null;

    const supabase = await createSupabaseServerClient();
    // Ensure session cookie is valid
    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me.user) throw Object.assign(new Error("Unauthorized"), { status: 401 });

    const admin = createSupabaseAdminClient();

    // Load user prefs (use service role for consistency)
    const { data: prefs, error: prefsErr } = await admin
      .from("study_preferences")
      .select("user_id, faculty_id, department_id, level, semester, session, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefsErr) throw Object.assign(new Error(prefsErr.message), { status: 500 });

    // Pick a session:
    // 1) forced session query param
    // 2) saved prefs session
    // 3) newest session in calendar
    let session = forcedSession || (prefs?.session ?? null);
    if (!session) {
      const { data: latestCal, error: latestErr } = await admin
        .from("study_academic_calendar")
        .select("session, starts_on")
        .order("starts_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latestErr && latestCal?.session) session = latestCal.session;
    }

    // RPC: current + fallback
    let detected: string | null = null;
    let detectedFallback: string | null = null;

    if (session) {
      const { data: cur, error: curErr } = await admin.rpc("get_current_semester", { p_session: session });
      if (!curErr && Array.isArray(cur) && cur[0]?.semester) detected = cur[0].semester;

      const { data: fb, error: fbErr } = await admin.rpc("get_current_semester_fallback", { p_session: session });
      if (!fbErr && Array.isArray(fb) && fb[0]?.semester) detectedFallback = fb[0].semester;
    }

    const effectivePrefsSemester = simulateNoSemester ? null : (prefs?.semester ?? null);
    const effectiveSemester = effectivePrefsSemester || detected || detectedFallback || null;

    const items: HealthItem[] = [];

    items.push({
      id: "rpc",
      label: "Semester RPC functions are callable",
      ok: Boolean(session) && (detected !== null || detectedFallback !== null),
      details: { session, detected, detectedFallback },
    });

    items.push({
      id: "prefs",
      label: "User has study_preferences with session + semester (or can be auto-derived)",
      ok: Boolean(prefs?.user_id) && Boolean(session) && Boolean(effectiveSemester),
      details: { prefs: prefs ?? null, effectiveSemester, simulateNoSemester },
    });

    const shouldPrompt =
      Boolean(prefs?.semester) && Boolean(detected || detectedFallback) && (prefs!.semester !== (detected || detectedFallback));
    items.push({
      id: "prompt",
      label: "Existing user: prompt condition can be detected (saved semester differs from calendar)",
      ok: true,
      details: { shouldPrompt, saved: prefs?.semester ?? null, calendar: detected || detectedFallback || null },
    });

    // Materials filter sanity: fetch 1 approved material matching effectiveSemester
    let materialCheckOk = false;
    let materialRow: any = null;
    if (effectiveSemester) {
      const { data: mat, error: matErr } = await admin
        .from("study_materials")
        .select("id, title, course_id, course:study_courses!inner(id, course_code, semester)")
        .eq("approved", true)
        .eq("study_courses.semester", effectiveSemester)
        .limit(1);

      if (!matErr && mat && mat.length > 0) {
        materialRow = mat[0];
        materialCheckOk = materialRow?.course?.semester === effectiveSemester;
      }
    }

    items.push({
      id: "materials",
      label: "Materials filtering matches course semester correctly",
      ok: materialCheckOk,
      details: { effectiveSemester, sample: materialRow },
    });

    // Mine filter resiliency: confirm we have enough scope to build a mine query without name strings
    const scopeOk = Boolean(prefs?.department_id) && Boolean(prefs?.faculty_id) && Boolean(prefs?.level);
    items.push({
      id: "mine",
      label: "Mine filter can scope using IDs (faculty_id, department_id, level)",
      ok: scopeOk,
      details: { faculty_id: prefs?.faculty_id ?? null, department_id: prefs?.department_id ?? null, level: prefs?.level ?? null },
    });

    const ok = items.every((i) => i.ok);

    return NextResponse.json({ ok, items }, { status: ok ? 200 : 200 });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
