import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Body = {
  id?: string;
  session?: string;
  semester?: "first" | "second" | "summer";
  starts_on?: string; // YYYY-MM-DD
  ends_on?: string;   // YYYY-MM-DD
};

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = (await req.json().catch(() => null)) as Body | null;

    const id = clean(body?.id);
    const session = clean(body?.session);
    const semester = (body?.semester ?? "") as Body["semester"];
    const starts_on = clean(body?.starts_on);
    const ends_on = clean(body?.ends_on);

    if (!session) return NextResponse.json({ ok: false, error: "Missing session" }, { status: 400 });
    if (!semester || !["first", "second", "summer"].includes(semester)) {
      return NextResponse.json({ ok: false, error: "Invalid semester" }, { status: 400 });
    }
    if (!isISODate(starts_on) || !isISODate(ends_on)) {
      return NextResponse.json({ ok: false, error: "Dates must be YYYY-MM-DD" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    if (id) {
      const { error } = await admin
        .from("study_academic_calendar")
        .update({ session, semester, starts_on, ends_on })
        .eq("id", id);

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin.from("study_academic_calendar").insert({ session, semester, starts_on, ends_on });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status });
  }
}
