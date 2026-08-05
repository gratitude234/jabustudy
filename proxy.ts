import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
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
  if (modeResponse) return modeResponse;

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!shouldRefreshSession(request.nextUrl.pathname)) return response;

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

  await supabase.auth.getSession();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
