import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MaterialRow = {
  id: string;
  title: string | null;
  course_id: string | null;
  downloads: number | null;
  approved: boolean | null;
  upload_status: string | null;
  description: string | null;
  rejection_reason?: string | null;
  created_at: string | null;
  study_courses?: {
    course_code: string | null;
    course_title: string | null;
    level: number | null;
    semester: string | null;
  } | null;
};

type RawMaterialRow = Omit<MaterialRow, "study_courses"> & {
  study_courses?: MaterialRow["study_courses"] | MaterialRow["study_courses"][] | null;
};

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function isRejectedOrBroken(row: MaterialRow) {
  const status = (row.upload_status ?? "").trim().toLowerCase();
  const rejectionReason = (row.rejection_reason ?? "").trim();
  const description = (row.description ?? "").trim();
  return !row.approved && (status === "broken" || rejectionReason.length > 0 || /\[BROKEN_UPLOAD[^\]]*\]/.test(description));
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;

    if (authError || !userId) return jsonError("Unauthorized", 401, "NO_SESSION");

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("study_materials")
      .select(
        `id,title,course_id,downloads,approved,upload_status,description,rejection_reason,created_at,
         study_courses:course_id(course_code,course_title,level,semester)`
      )
      .eq("uploader_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) return jsonError(error.message || "Could not load contribution stats", 500, "DB_ERROR");

    const rows = ((data ?? []) as unknown as RawMaterialRow[]).map((row): MaterialRow => ({
      ...row,
      study_courses: Array.isArray(row.study_courses)
        ? row.study_courses[0] ?? null
        : row.study_courses ?? null,
    }));

    const approvedLiveRows = rows.filter((row) => row.approved === true && row.upload_status === "live");
    const materialIds = rows.map((row) => row.id).filter(Boolean);
    const approvedLiveIds = approvedLiveRows.map((row) => row.id).filter(Boolean);

    let practiceSetsPowered = 0;
    let practiceQuestionsPowered = 0;

    if (materialIds.length > 0) {
      const [setsRes, questionsRes] = await Promise.all([
        admin
          .from("study_quiz_sets")
          .select("id", { count: "exact", head: true })
          .in("source_material_id", materialIds),
        admin
          .from("study_quiz_questions")
          .select("id", { count: "exact", head: true })
          .in("source_material_id", materialIds),
      ]);

      practiceSetsPowered = setsRes.count ?? 0;
      practiceQuestionsPowered = questionsRes.count ?? 0;
    }

    const topRows = approvedLiveRows
      .slice()
      .sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0))
      .slice(0, 5);

    const questionCounts = new Map<string, number>();
    await Promise.all(
      topRows.map(async (row) => {
        const { count } = await admin
          .from("study_quiz_questions")
          .select("id", { count: "exact", head: true })
          .eq("source_material_id", row.id);
        questionCounts.set(row.id, count ?? 0);
      })
    );

    const stats = {
      totalUploads: rows.length,
      approvedUploads: approvedLiveRows.length,
      pendingUploads: rows.filter((row) => !row.approved && !isRejectedOrBroken(row)).length,
      rejectedBrokenUploads: rows.filter(isRejectedOrBroken).length,
      studentsHelped: approvedLiveRows.reduce((sum, row) => sum + (row.downloads ?? 0), 0),
      coursesHelped: new Set(approvedLiveRows.map((row) => row.course_id).filter(Boolean)).size,
      practiceSetsPowered,
      practiceQuestionsPowered,
    };

    const topMaterials = topRows.map((row) => ({
      id: row.id,
      title: row.title,
      downloads: row.downloads ?? 0,
      practiceQuestionsPowered: questionCounts.get(row.id) ?? 0,
      course: row.study_courses
        ? {
            course_code: row.study_courses.course_code,
            course_title: row.study_courses.course_title,
            level: row.study_courses.level,
            semester: row.study_courses.semester,
          }
        : null,
    }));

    return NextResponse.json({ ok: true, stats, topMaterials, capped: rows.length >= 1000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load contribution stats";
    return jsonError(message, 500, "SERVER_ERROR");
  }
}
