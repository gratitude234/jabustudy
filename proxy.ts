import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  hasStudyModeratorMembership,
  type StudyAdminMembershipRow,
  type StudyRepMembershipRow,
} from "@/lib/studyAdmin/moderatorMembership";
import {
  EXAM_SPRINT_HOME,
  isExamOnlyApiAllowed,
  isExamOnlyBillingEntryAllowed,
  isExamOnlyPageAllowed,
  isExamSprintOnlyMode,
} from "@/lib/systemMode";

const SYSTEM_MODE_MESSAGE = "JabuStudy is currently focused on Exam Sprint. Other study tools are temporarily unavailable.";

function matchesPath(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function shouldRefreshSession(pathname: string) {
  return [
    "/study/materials/upload",
    "/study/materials/my",
    "/study/history",
    "/study/onboarding",
    "/study/apply-rep",
    "/study/tutors/apply",
    "/study/gpa",
    "/study-admin",
    "/api/study-admin",
    "/exam",
    "/api/exam",
    "/study/billing",
    "/api/billing",
  ].some((root) => matchesPath(pathname, root));
}

function bearerToken(request: NextRequest) {
  const value = request.headers.get("authorization");
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function hasVerifiedStudyModeratorAccess(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceRoleKey) return false;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [studyAdminResult, studyRepResult] = await Promise.all([
    admin.from("study_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    admin
      .from("study_reps")
      .select("user_id,role,department_id,levels,active")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (studyAdminResult.error || studyRepResult.error) return false;
  return hasStudyModeratorMembership(
    studyAdminResult.data as StudyAdminMembershipRow,
    studyRepResult.data as StudyRepMembershipRow,
  );
}

function examHomeRedirect(request: NextRequest) {
  const target = request.nextUrl.clone();
  target.pathname = EXAM_SPRINT_HOME;
  target.search = "";
  target.searchParams.set("notice", "exam-sprint-only");
  return NextResponse.redirect(target, 307);
}

function enforceExamOnlyMode(request: NextRequest) {
  if (!isExamSprintOnlyMode()) return null;

  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    if (isExamOnlyApiAllowed(pathname)) return null;
    return NextResponse.json(
      { ok: false, code: "SYSTEM_MODE_RESTRICTED", message: SYSTEM_MODE_MESSAGE },
      { status: 423, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!isExamOnlyPageAllowed(pathname)) return examHomeRedirect(request);

  if (pathname === "/study/billing" && !isExamOnlyBillingEntryAllowed(searchParams)) {
    // Paystack returns to the stable billing path. Preserve its reference and
    // attach the Exam Sprint context before the client reads the query string.
    if (searchParams.has("ref") || searchParams.has("reference") || searchParams.has("trxref")) {
      const target = request.nextUrl.clone();
      target.searchParams.set("offer", "exam-sprint");
      if (!target.searchParams.has("returnTo")) target.searchParams.set("returnTo", EXAM_SPRINT_HOME);
      return NextResponse.redirect(target, 307);
    }
    return examHomeRedirect(request);
  }

  return null;
}

/**
 * Next.js 16+: use proxy.ts (middleware.ts is deprecated in this project).
 * Keeps Supabase auth cookies refreshed so Route Handlers can read sessions.
 */
export async function proxy(request: NextRequest) {
  const modeResponse = enforceExamOnlyMode(request);
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const needsSession = Boolean(modeResponse) || shouldRefreshSession(request.nextUrl.pathname);
  if (!needsSession) return response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  if (modeResponse) {
    const token = bearerToken(request);
    const { data: userData, error: userError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();
    const verifiedUserId = userData.user?.id ?? null;
    const moderatorBypass = !userError && verifiedUserId
      ? await hasVerifiedStudyModeratorAccess(verifiedUserId)
      : false;

    // Fail closed: a missing/expired session, membership lookup error or normal
    // student account receives the original Exam Sprint restriction.
    if (!moderatorBypass) return modeResponse;
    return response;
  }

  await supabase.auth.getSession();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
