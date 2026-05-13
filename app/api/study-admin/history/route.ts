import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireStudyModeratorFromRequest } from "../../../../lib/studyAdmin/requireStudyModeratorFromRequest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireStudyModeratorFromRequest(req);

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const dept = url.searchParams.get("dept") || "";
    const levelParam = url.searchParams.get("level") || "";
    const typeParam = url.searchParams.get("type") || "";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const uploader = url.searchParams.get("uploader") || "";

    const limit = 30;
    const offset = (page - 1) * limit;

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("study_materials")
      .select(
        [
          "id",
          "title",
          "course_code",
          "department",
          "department_id",
          "level",
          "semester",
          "session",
          "material_type",
          "file_url",
          "file_path",
          "approved",
          "created_at",
          "uploader_id",
          "profiles:uploader_id(full_name, email)",
        ].join(","),
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (dept) query = query.eq("department_id", dept);
    if (levelParam) query = query.eq("level", levelParam);
    if (typeParam) query = query.eq("material_type", typeParam);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to + "T23:59:59.999Z");

    const { data, error, count } = await query;
    if (error) throw error;

    // Filter by uploader name/email in JS (Supabase doesn't support ilike on joined fields easily)
    let items = (data ?? []) as unknown[];
    if (uploader.trim()) {
      const q = uploader.trim().toLowerCase();
      items = items.filter((row) => {
        const r = row as { profiles?: { full_name?: string; email?: string } | null };
        const name = r.profiles?.full_name?.toLowerCase() ?? "";
        const email = r.profiles?.email?.toLowerCase() ?? "";
        return name.includes(q) || email.includes(q);
      });
    }

    return NextResponse.json({ ok: true, items, total: count ?? 0 });
  } catch (e: unknown) {
    const err = e as { status?: number; code?: string; message?: string };
    const status = Number(err?.status) || 500;
    return NextResponse.json({ ok: false, code: err?.code, message: err?.message || "Error" }, { status });
  }
}
