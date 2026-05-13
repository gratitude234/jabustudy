"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import StudyAdminShell from "@/components/studyAdmin/StudyAdminShell";
import { supabase } from "@/lib/supabase";

/**
 * Client-side gate for /study-admin.
 *
 * Your current auth flow is client-based (localStorage session). Server layouts
 * can't see that session (no SSR cookies), which caused a redirect loop.
 *
 * We verify access by calling the summary API with a Bearer token.
 */
export default function StudyAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          router.replace(`/login?next=${encodeURIComponent(pathname || "/study-admin")}`);
          return;
        }

        const res = await fetch("/api/study-admin/summary", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname || "/study-admin")}`);
          return;
        }
        if (res.status === 403) {
          router.replace("/study");
          return;
        }
        if (!res.ok) {
          // fallback to study page on unexpected errors
          router.replace("/study");
          return;
        }

        if (mounted) setAllowed(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">Loading admin…</p>
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return <StudyAdminShell>{children}</StudyAdminShell>;
}
