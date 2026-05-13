// app/api/study/search/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeQ(raw: string): string {
  return raw
    .trim()
    .replace(/[%_]/g, "")
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function like(q: string) {
  return `*${q.replace(/\s+/g, "*")}*`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("q") ?? "";
  const q = safeQ(raw);

  if (!q) {
    return NextResponse.json({
      ok: true,
      q: "",
      materials: [],
      courses: [],
      questions: [],
      quizSets: [],
    });
  }

  const pat = like(q);

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [matRes, courseRes, qRes, quizRes] = await Promise.all([
      // Materials: title or course_code ilike
      supabase
        .from("study_materials")
        .select(
          "id,title,material_type,downloads,created_at,course_code,level,semester"
        )
        .eq("approved", true)
        .eq("upload_status", "live")
        .or(`title.ilike.${pat},course_code.ilike.${pat}`)
        .order("downloads", { ascending: false, nullsFirst: false })
        .limit(8),

      // Courses: code, title, or department ilike
      supabase
        .from("study_courses")
        .select(
          "id,course_code,course_title,level,semester,faculty,department"
        )
        .or(
          `course_code.ilike.${pat},course_title.ilike.${pat},department.ilike.${pat}`
        )
        .order("course_code", { ascending: true })
        .limit(8),

      // Q&A questions: title or course_code ilike
      supabase
        .from("study_questions")
        .select("id,title,upvotes_count,answers_count,created_at,course_code")
        .or(`title.ilike.${pat},course_code.ilike.${pat}`)
        .order("created_at", { ascending: false })
        .limit(6),

      // Quiz sets: title or course_code ilike
      user?.id
        ? supabase
            .from("study_quiz_sets")
            .select(
              "id,title,course_code,level,semester,questions_count,created_at"
            )
            .eq("published", true)
            .or(
              [
                `and(visibility.eq.public,title.ilike.${pat})`,
                `and(visibility.eq.public,course_code.ilike.${pat})`,
                `and(created_by.eq.${user.id},title.ilike.${pat})`,
                `and(created_by.eq.${user.id},course_code.ilike.${pat})`,
              ].join(",")
            )
            .order("created_at", { ascending: false })
            .limit(6)
        : supabase
            .from("study_quiz_sets")
            .select(
              "id,title,course_code,level,semester,questions_count,created_at"
            )
            .eq("published", true)
            .eq("visibility", "public")
            .or(`title.ilike.${pat},course_code.ilike.${pat}`)
            .order("created_at", { ascending: false })
            .limit(6),
    ]);

    return NextResponse.json({
      ok: true,
      q: raw,
      materials: (matRes.data ?? []) as object[],
      courses: (courseRes.data ?? []) as object[],
      questions: (qRes.data ?? []) as object[],
      quizSets: (quizRes.data ?? []) as object[],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Search failed" },
      { status: 500 }
    );
  }
}
