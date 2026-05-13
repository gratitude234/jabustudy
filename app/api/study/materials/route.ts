import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeQuery(v: string) {
  return (v || "").trim().replace(/\s+/g, " ");
}

function safeDecodeURIComponent(v: string) {
  // Some pages pass an already URL-encoded q (e.g. "CSC%20209").
  // PostgREST filter strings can't contain raw '%' tokens, so decode it first.
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

function asPosInt(v: string | null, fallback: number) {
  const n = Number(v ?? "");
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

function mapSemesterParamToDb(v: string) {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "1st" || s === "first") return "first";
  if (s === "2nd" || s === "second") return "second";
  if (s === "summer") return "summer";
  return "";
}

type SortKey = "newest" | "oldest" | "downloads_desc" | "downloads_asc";

async function getUserScope(supabase: any) {
  // Single source of truth: study_preferences.
  // If a user hasn't onboarded yet we return null and the API behaves like "All materials".
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (!user) return null;

  const { data, error } = await supabase
    .from("study_preferences")
    .select("faculty_id,department_id,level,semester,session")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const faculty_id = (data as any)?.faculty_id ?? null;
  const department_id = (data as any)?.department_id ?? null;
  const level = (data as any)?.level ?? null;
  const session = (data as any)?.session ? String((data as any).session).trim() : "2025/2026";
  let semester = (data as any)?.semester ? String((data as any).semester).trim() : "";

  // If semester is missing, auto-detect from the academic calendar for this session.
  if (!semester) {
    try {
      const { data: rows } = await supabase.rpc("get_current_semester", { p_session: session });
      semester = Array.isArray(rows) && rows.length ? String((rows[0] as any)?.semester ?? "") : "";
      if (!semester) {
        const { data: rows2 } = await supabase.rpc("get_current_semester_fallback", { p_session: session });
        semester = Array.isArray(rows2) && rows2.length ? String((rows2[0] as any)?.semester ?? "") : "";
      }
    } catch {
      // ignore — semester stays empty, caller handles gracefully
    }
  }

  return { faculty_id, department_id, level, semester, session };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const q = normalizeQuery(safeDecodeURIComponent(url.searchParams.get("q") || ""));
    const level = (url.searchParams.get("level") || "").trim();
    const semester = (url.searchParams.get("semester") || "").trim();
    const faculty = (url.searchParams.get("faculty") || "").trim();
    const faculty_id = (url.searchParams.get("faculty_id") || "").trim();
    const dept = (url.searchParams.get("dept") || "").trim();
    const dept_id = (url.searchParams.get("dept_id") || "").trim();
    const course = (url.searchParams.get("course") || "").trim();
    const session = (url.searchParams.get("session") || "").trim();
    const type = (url.searchParams.get("type") || "").trim();
    const verifiedOnly = (url.searchParams.get("verified") || "") === "1";
    const featuredOnly = (url.searchParams.get("featured") || "") === "1";
    const personalized = (url.searchParams.get("personalized") || "1") !== "0";
    const sort = ((url.searchParams.get("sort") || "newest") as SortKey) || "newest";
    const mineOnly = (url.searchParams.get("mine") || "") === "1";

    const page = asPosInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(48, Math.max(6, asPosInt(url.searchParams.get("page_size"), 18)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = await createSupabaseServerClient();
    const scope = personalized ? await getUserScope(supabase) : null;

    if (mineOnly) {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
      // Override the base query: filter by uploader_id, remove the approved:true default
      let mineQuery = supabase
        .from("study_materials")
        .select(
          `id,title,description,file_path,session,approved,created_at,downloads,up_votes,
           course_id,material_type,featured,verified,ai_summary,
           study_courses:course_id(id,faculty,department,level,semester,course_code,course_title,faculty_id,department_id)`,
          { count: "exact" }
        )
        .eq("uploader_id", uid);

      // Apply the same filters as the main branch
      if (q) {
        const qSafe = q
          .replace(/[%_]/g, "")
          .replace(/[(),]/g, " ")
          .trim()
          .replace(/\s+/g, " ");
        const like = `*${qSafe.replace(/\s+/g, "*")}*`;
        mineQuery = mineQuery.or(
          `title.ilike.${like},course_code.ilike.${like},department.ilike.${like},faculty.ilike.${like}`
        );
      }
      if (level) {
        const lv = Number(level);
        if (Number.isFinite(lv)) mineQuery = mineQuery.eq("level", String(lv));
      }
      if (faculty_id) mineQuery = mineQuery.eq("faculty_id", faculty_id);
      else if (faculty) mineQuery = mineQuery.eq("faculty", faculty);
      if (dept_id) mineQuery = mineQuery.eq("department_id", dept_id);
      else if (dept) mineQuery = mineQuery.eq("department", dept);
      if (course) mineQuery = mineQuery.eq("course_code", course.trim().toUpperCase());
      if (type && type !== "all") mineQuery = mineQuery.eq("material_type", type);
      if (semester) {
        const sem = mapSemesterParamToDb(semester);
        if (sem) mineQuery = mineQuery.eq("semester", sem);
      }
      if (session) mineQuery = mineQuery.eq("session", session);

      if (sort === "oldest") mineQuery = mineQuery.order("created_at", { ascending: true });
      else if (sort === "downloads_desc") mineQuery = mineQuery.order("downloads", { ascending: false, nullsFirst: false });
      else if (sort === "downloads_asc") mineQuery = mineQuery.order("downloads", { ascending: true, nullsFirst: false });
      else mineQuery = mineQuery.order("created_at", { ascending: false });

      const mineRes = await mineQuery.range(from, to);
      if (mineRes.error) {
        return NextResponse.json({ ok: false, error: mineRes.error.message }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        items: (mineRes.data as any[]) ?? [],
        total: mineRes.count ?? 0,
        page,
        page_size: pageSize,
      });
    }

    let query = supabase
      .from("study_materials")
      .select(
        `id,title,description,file_path,session,approved,created_at,downloads,up_votes,
         course_id,material_type,featured,verified,ai_summary,
         study_courses:course_id(id,faculty,department,level,semester,course_code,course_title,faculty_id,department_id)`,
        { count: "exact" }
      )
      .eq("approved", true)
      .eq("upload_status", "live");

    if (q) {
      // PostgREST `.or()` logic strings are whitespace-sensitive.
      // Instead of trying to quote/escape spaces (which is inconsistent across PostgREST versions),
      // we transform whitespace into `*` so the pattern contains NO spaces.
      // Example: "CSC 209" -> "*CSC*209*" (still matches "CSC 209", "CSC-209", etc.).
      const qSafe = q
        .replace(/[%_]/g, "") // strip LIKE wildcards
        .replace(/[(),]/g, " ") // remove syntax-breaking chars
        .trim()
        .replace(/\s+/g, " ");

      const like = `*${qSafe.replace(/\s+/g, "*")}*`;

      // Search on study_materials' own denormalised columns — NOT on embedded join columns.
      query = query.or(
        `title.ilike.${like},course_code.ilike.${like},department.ilike.${like},faculty.ilike.${like}`
      );
    }

    if (level) {
      const lv = Number(level);
      if (Number.isFinite(lv)) query = query.eq("level", String(lv));
    } else if (scope?.level != null) {
      query = query.eq("level", String(scope.level));
    }

    if (semester) {
      const sem = mapSemesterParamToDb(semester);
      if (sem) query = query.eq("semester", sem);
    } else if (scope?.semester) {
      const sem = mapSemesterParamToDb(scope.semester);
      if (sem) query = query.eq("semester", sem);
    }

    if (faculty_id) query = query.eq("faculty_id", faculty_id);
    else if (faculty) query = query.eq("faculty", faculty);
    else if (scope?.faculty_id) query = query.eq("faculty_id", scope.faculty_id);
    if (dept_id) query = query.eq("department_id", dept_id);
    else if (dept) query = query.eq("department", dept);
    else if (scope?.department_id) query = query.eq("department_id", scope.department_id);
    if (course) query = query.eq("course_code", course.trim().toUpperCase());
    if (session) query = query.ilike("session", `%${session}%`);
    if (type && type !== "all") query = query.eq("material_type", type);
    if (verifiedOnly) query = query.eq("verified", true);
    if (featuredOnly) query = query.eq("featured", true);

    if (sort === "oldest") query = query.order("created_at", { ascending: true });
    else if (sort === "downloads_desc") query = query.order("downloads", { ascending: false, nullsFirst: false });
    else if (sort === "downloads_asc") query = query.order("downloads", { ascending: true, nullsFirst: false });
    else query = query.order("created_at", { ascending: false });

    const res = await query.range(from, to);
    if (res.error) {
      const msg = res.error.message || "Unknown error";
      const schemaHint =
        msg.includes("material_type") || msg.includes("featured") || msg.includes("verified")
          ? "Your database is missing some columns (material_type / featured / verified). Add them to study_materials, then refresh."
          : undefined;
      return NextResponse.json({ ok: false, error: msg, schemaHint }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      items: (res.data as any[]) ?? [],
      total: res.count ?? 0,
      page,
      page_size: pageSize,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}
