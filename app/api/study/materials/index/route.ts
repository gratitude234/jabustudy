// app/api/study/materials/index/route.ts
// Internal endpoint for rebuilding source chunks for one study material.

export const runtime = "nodejs";
export const maxDuration = 180;

import { NextRequest, NextResponse } from "next/server";
import { indexStudyMaterial } from "@/lib/studyMaterialIndex";

function hasInternalAuth(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  return Boolean(
    (process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export async function POST(req: NextRequest) {
  if (!hasInternalAuth(req)) {
    return NextResponse.json({ ok: false, code: "UNAUTHORISED", message: "Unauthorised" }, { status: 401 });
  }

  let body: { materialId?: string; material_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Invalid JSON body" }, { status: 400 });
  }

  const materialId = body.materialId ?? body.material_id;
  if (!materialId) {
    return NextResponse.json({ ok: false, code: "MISSING_MATERIAL_ID", message: "Missing materialId" }, { status: 400 });
  }

  const result = await indexStudyMaterial(materialId);
  const status = result.status === "ready" || result.status === "skipped" ? 200 : 422;

  return NextResponse.json({ ok: result.status !== "failed", ...result }, { status });
}
