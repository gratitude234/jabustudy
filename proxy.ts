import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16+: use proxy.ts (middleware.ts is deprecated in this project).
 * Keeps Supabase auth cookies refreshed so Route Handlers can read sessions.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

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
    "/me/:path*",
    "/saved/:path*",
    "/post/:path*",
    "/my-orders/:path*",
    "/my-listings/:path*",
    "/vendor/:path*",
    "/rider/:path*",
    "/inbox/:path*",
    "/delivery/requests/:path*",
    "/listing/:id/edit",
    "/study/materials/upload/:path*",
    "/study/materials/my/:path*",
    "/study/history/:path*",
    "/study/onboarding/:path*",
    "/study/apply-rep/:path*",
    "/study/tutors/apply/:path*",
    "/study/gpa/:path*",
    "/admin/:path*",
    "/study-admin/:path*",
  ],
};
