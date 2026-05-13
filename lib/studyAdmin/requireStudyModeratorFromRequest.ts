import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getStudyModeratorScopeByUserId } from "@/lib/studyAdmin/requireStudyModerator";
import type { StudyModeratorAuthResult } from "@/lib/studyAdmin/requireStudyModerator";

function httpError(message: string, status: number, code?: string) {
  return Object.assign(new Error(message), { status, code });
}

function getBearerToken(req: Request): string | null {
  const raw = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!raw) return null;

  // Robust against weird spacing/casing
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

/**
 * Same authorization as requireStudyModerator(), but for API Route Handlers where
 * the client sends Authorization: Bearer <access_token>.
 */
export async function requireStudyModeratorFromRequest(req: Request): Promise<StudyModeratorAuthResult> {
  const token = getBearerToken(req);
  if (!token) throw httpError("Unauthorized", 401, "MISSING_BEARER_TOKEN");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw httpError("Server misconfigured: Supabase env missing", 500, "MISSING_SUPABASE_ENV");
  }

  // Use anon client only to validate the JWT and extract the user.
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    throw httpError("Unauthorized", 401, "INVALID_TOKEN");
  }

  const userId = userData.user.id;
  const { scope, isSuper } = await getStudyModeratorScopeByUserId(userId);

  return { userId, scope, isSuper };
}