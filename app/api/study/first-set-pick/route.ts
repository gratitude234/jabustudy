import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type FirstSetSource =
  | "curated"
  | "curated_dept_fallback"
  | "auto_dept_level"
  | "auto_dept"
  | "auto_any";

type StudyPrefsRow = {
  department: string | null;
  department_id: string | null;
  level: number | null;
};

type QuizSetRow = {
  id: string;
  title: string | null;
  course_code: string | null;
  level: number | string | null;
  created_at: string | null;
  questions_count?: number | null;
  total_questions?: number | null;
};

type PickedSet = {
  id: string;
  title: string;
  course_code: string | null;
  level: number | null;
  question_count: number;
  estimated_minutes: number;
  source: FirstSetSource;
};

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function asLevel(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function estimateMinutes(questionCount: number) {
  return Math.max(3, Math.ceil(questionCount * 0.4));
}

function compareSetRows(a: QuizSetRow, b: QuizSetRow) {
  const aCount = Number(a.questions_count ?? a.total_questions ?? Number.MAX_SAFE_INTEGER);
  const bCount = Number(b.questions_count ?? b.total_questions ?? Number.MAX_SAFE_INTEGER);
  if (aCount !== bCount) return aCount - bCount;

  const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
  return bCreated - aCreated;
}

async function countQuestions(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  setId: string
) {
  const { count, error } = await supabase
    .from("study_quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("set_id", setId);

  if (error) throw error;
  return count ?? 0;
}

async function findCandidate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  prefs: StudyPrefsRow | null,
  source: FirstSetSource
): Promise<QuizSetRow | null> {
  const hasDeptScope = Boolean(prefs?.department_id || prefs?.department);
  if (!hasDeptScope && source !== "auto_any") return null;

  const needsLevel = source === "curated" || source === "auto_dept_level";
  const needsCurated = source === "curated" || source === "curated_dept_fallback";

  let query = supabase
    .from("study_quiz_sets")
    .select(
      "id,title,course_code,level,created_at,questions_count,total_questions"
    )
    .eq("published", true)
    .eq("approved", true)
    .or(`visibility.eq.public,created_by.eq.${userId}`);

  if (needsCurated) {
    query = query.eq("is_intro_pick", true);
  }

  if (source !== "auto_any") {
    if (prefs?.department_id) query = query.eq("department_id", prefs.department_id);
    else if (prefs?.department) query = query.ilike("department", `%${prefs.department}%`);
  }

  if (needsLevel && prefs?.level != null) {
    query = query.eq("level", prefs.level);
  } else if (needsLevel) {
    return null;
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(source === "auto_any" ? 24 : 12);

  if (error || !data?.length) return null;

  return [...(data as QuizSetRow[])].sort(compareSetRows)[0] ?? null;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (!userId) {
    return jsonError("Sign in first", 401, "unauthorized");
  }

  const { data: prefsData } = await supabase
    .from("study_preferences")
    .select("department, department_id, level")
    .eq("user_id", userId)
    .maybeSingle();

  const prefs = (prefsData as StudyPrefsRow | null) ?? null;
  const cascade: FirstSetSource[] = prefs?.department_id || prefs?.department
    ? ["curated", "curated_dept_fallback", "auto_dept_level", "auto_dept", "auto_any"]
    : ["auto_any"];

  let picked: PickedSet | null = null;

  for (const source of cascade) {
    const candidate = await findCandidate(supabase, userId, prefs, source);
    if (!candidate) continue;

    const questionCount = await countQuestions(supabase, candidate.id);
    picked = {
      id: candidate.id,
      title: candidate.title?.trim() || "Practice set",
      course_code: candidate.course_code ?? null,
      level: asLevel(candidate.level),
      question_count: questionCount,
      estimated_minutes: estimateMinutes(questionCount),
      source,
    };
    break;
  }

  const response = NextResponse.json({ ok: true, set: picked });
  response.headers.set(
    "Cache-Control",
    "private, max-age=300, stale-while-revalidate=900"
  );
  return response;
}
