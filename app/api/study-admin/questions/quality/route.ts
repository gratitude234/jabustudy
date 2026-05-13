import { NextResponse } from "next/server";
import { getQuestionQuality } from "@/lib/studyQuestionQuality";
import { requireStudyModeratorFromRequest } from "@/lib/studyAdmin/requireStudyModeratorFromRequest";

export async function GET(req: Request) {
  try {
    const { scope } = await requireStudyModeratorFromRequest(req);
    const result = await getQuestionQuality(req, scope);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      { ok: false, code: error?.code, error: error?.message || "Failed to load question quality." },
      { status }
    );
  }
}
