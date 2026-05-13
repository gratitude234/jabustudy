import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/study/practice/due
 *
 * Returns questions that are due today for the authenticated user,
 * grouped by quiz set so the client can launch them as separate sessions.
 *
 * Response shape:
 * {
 *   total: number,            // total due questions across all sets
 *   sets: Array<{
 *     set_id: string,
 *     set_title: string,
 *     course_code: string | null,
 *     question_ids: string[], // ordered by miss_count desc (hardest first)
 *     miss_counts: Record<string, number>,
 *     next_due_ats: Record<string, string>,
 *   }>
 * }
 *
 * Returns 200 with { total: 0, sets: [] } when the table doesn't exist yet
 * (pre-migration), so the UI degrades gracefully.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authData.user.id;

    // ── Fetch all due, non-graduated questions for this user ──────────────
    const now = new Date().toISOString();

    const { data: dueRows, error: dueError } = await supabase
      .from("study_weak_questions")
      .select("question_id, miss_count, next_due_at")
      .eq("user_id", userId)
      .is("graduated_at", null)
      .lte("next_due_at", now)
      .order("miss_count", { ascending: false })
      .limit(200); // safety cap — no student has 200 due questions in one session

    // Table may not exist pre-migration — return empty gracefully.
    if (dueError) {
      if (
        dueError.message?.includes("does not exist") ||
        dueError.code === "42P01"
      ) {
        return NextResponse.json({ total: 0, sets: [] });
      }
      throw dueError;
    }

    if (!dueRows || dueRows.length === 0) {
      return NextResponse.json({ total: 0, sets: [] });
    }

    const questionIds = (dueRows as any[]).map((r: any) => r.question_id as string);

    // ── Resolve which quiz set each question belongs to ──────────────────
    // study_quiz_questions.set_id links back to study_quiz_sets.
    const { data: qRows, error: qError } = await supabase
      .from("study_quiz_questions")
      .select("id, set_id, prompt")
      .in("id", questionIds);

    if (qError) throw qError;

    // ── Fetch set metadata for every unique set_id ────────────────────────
    const setIds = [...new Set((qRows ?? []).map((r: any) => r.set_id as string))];

    const { data: setRows, error: setError } = await supabase
      .from("study_quiz_sets")
      .select("id, title, course_code, created_by, visibility")
      .in("id", setIds)
      .eq("published", true)
      .or(`visibility.eq.public,created_by.eq.${userId}`);

    if (setError) throw setError;

    // ── Build lookup maps ─────────────────────────────────────────────────
    const missCountMap: Record<string, number> = {};
    const nextDueMap: Record<string, string> = {};
    for (const row of (dueRows as any[])) {
      missCountMap[row.question_id] = row.miss_count;
      nextDueMap[row.question_id] = row.next_due_at;
    }

    const questionToSet: Record<string, string> = {};
    const questionPrompts: Record<string, string> = {};
    for (const q of (qRows ?? []) as any[]) {
      questionToSet[q.id] = q.set_id;
      questionPrompts[q.id] = q.prompt ?? "";
    }

    const setMeta: Record<string, { title: string; course_code: string | null }> = {};
    for (const s of (setRows ?? []) as any[]) {
      setMeta[s.id] = { title: s.title ?? "Practice set", course_code: s.course_code ?? null };
    }

    // ── Group questions by set, sort each group hardest-first ─────────────
    const setGroups: Record<string, string[]> = {};
    for (const qId of questionIds) {
      const sid = questionToSet[qId];
      if (!sid) continue; // orphaned question (set deleted) — skip
      if (!setGroups[sid]) setGroups[sid] = [];
      setGroups[sid].push(qId);
    }

    // Filter out questions belonging to unpublished sets
    const publishedSetIds = new Set(Object.keys(setMeta));
    const filteredSetGroups: Record<string, string[]> = {};
    for (const [sid, ids] of Object.entries(setGroups)) {
      if (publishedSetIds.has(sid)) filteredSetGroups[sid] = ids;
    }

    // Sort sets by how many due questions they have (most first).
    const sortedSetIds = Object.keys(filteredSetGroups).sort(
      (a, b) => filteredSetGroups[b].length - filteredSetGroups[a].length
    );

    const sets = sortedSetIds.map((sid) => {
      const ids = filteredSetGroups[sid].sort(
        (a, b) => (missCountMap[b] ?? 0) - (missCountMap[a] ?? 0)
      );
      const mc: Record<string, number> = {};
      const nd: Record<string, string> = {};
      for (const id of ids) {
        mc[id] = missCountMap[id] ?? 0;
        nd[id] = nextDueMap[id] ?? "";
      }
      return {
        set_id: sid,
        set_title: setMeta[sid]?.title ?? "Practice set",
        course_code: setMeta[sid]?.course_code ?? null,
        question_count: ids.length,
        question_ids: ids,
        miss_counts: mc,
        next_due_ats: nd,
      };
    });

    const filteredTotal = Object.values(filteredSetGroups).reduce((n, ids) => n + ids.length, 0);
    return NextResponse.json({
      total: filteredTotal,
      sets,
    });
  } catch (err: any) {
    console.error("[/api/study/practice/due]", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
