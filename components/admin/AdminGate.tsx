"use client";
// components/admin/AdminGate.tsx
import { cn } from "@/lib/utils";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";

type Props = {
  children: React.ReactNode;
};

function safeNext(path: string) {
  const p = (path || "").trim();
  if (!p.startsWith("/")) return "/admin";
  if (p.startsWith("//")) return "/admin";
  try {
    const d = decodeURIComponent(p).toLowerCase();
    if (d.includes("http://") || d.includes("https://")) return "/admin";
  } catch {}
  return p;
}

export default function AdminGate({ children }: Props) {
  const router = useRouter();
  const mounted = useRef(true);

  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;

    async function run() {
      setLoading(true);
      setDenied(null);

      const next = safeNext("/admin");

      const { data: userData, error: userErr } = await supabase.auth.getUser();

      if (!mounted.current) return;

      if (userErr) {
        const msg = String(userErr.message ?? "").toLowerCase();
        if (msg.includes("auth session missing") || msg.includes("session missing")) {
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
      }

      const user = userData.user;
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const { data: adminRow, error: adminErr } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted.current) return;

      if (adminErr) {
        setDenied(adminErr.message ?? "Admin check failed.");
        setLoading(false);
        return;
      }

      if (!adminRow?.user_id) {
        setDenied("You don’t have admin access.");
        setLoading(false);
        return;
      }

      setLoading(false);
    }

    run();

    return () => {
      mounted.current = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <div className="mx-auto max-w-xl rounded-3xl border bg-white p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border bg-zinc-50">
              <ShieldCheck className="h-5 w-5 text-zinc-800" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold text-zinc-900">Checking admin access…</p>
                <Loader2 className="h-4 w-4 animate-spin text-zinc-700" />
              </div>
              <p className="mt-1 text-sm text-zinc-600">Please wait a moment.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
          </div>
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <div className={cn("mx-auto max-w-xl rounded-3xl border p-4 sm:p-6", "border-rose-200 bg-rose-50")}>
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border bg-white">
              <AlertTriangle className="h-5 w-5 text-rose-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-rose-900">Access denied</p>
              <p className="mt-1 text-sm text-rose-800">{denied}</p>
              <p className="mt-3 text-xs text-rose-700">
                If you believe this is a mistake, ask a super admin to add your user ID to the <span className="font-semibold">admins</span> table.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
