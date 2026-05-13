import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getQuestionQuality } from "@/lib/studyQuestionQuality";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const result = await getQuestionQuality(req, null);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      { ok: false, code: error?.code, error: error?.message || "Failed to load question quality." },
      { status }
    );
  }
}
