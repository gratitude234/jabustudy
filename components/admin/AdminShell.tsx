"use client";
// components/admin/AdminShell.tsx
import { cn } from "@/lib/utils";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { clearMealDrafts } from "@/lib/mealDraft";
import {
  LayoutDashboard,
  Store,
  Bike,
  Truck,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/vendors", label: "Vendors", icon: Store },
  { href: "/admin/riders", label: "Delivery Agents", icon: Bike },
  { href: "/admin/couriers", label: "Campus Transport", icon: Truck },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const active = useMemo(() => {
    const p = pathname || "/admin";
    return NAV.find((n) => (n.href === "/admin" ? p === "/admin" : p.startsWith(n.href)))?.href ?? "/admin";
  }, [pathname]);

  async function signOut() {
    clearMealDrafts();
    await supabase.auth.signOut();
    router.replace("/login?next=/admin");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-50">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-zinc-50">
              <Shield className="h-5 w-5 text-zinc-800" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-zinc-900">Admin</p>
              <p className="text-[11px] text-zinc-500">{email ?? "Signed in"}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-2xl border bg-white p-2 hover:bg-zinc-50"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="mx-auto max-w-6xl px-4 pb-3">
            <div className="rounded-3xl border bg-white p-2">
              {NAV.map((n) => {
                const isActive = active === n.href;
                const Icon = n.icon;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold no-underline",
                      isActive ? "bg-black text-white" : "text-zinc-900 hover:bg-zinc-50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={signOut}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[260px_1fr] md:py-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-4 hidden h-fit rounded-3xl border bg-white p-3 md:block">
          <div className="flex items-start gap-3 px-2 py-2">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border bg-zinc-50">
              <Shield className="h-5 w-5 text-zinc-800" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">Admin Panel</p>
              <p className="truncate text-[11px] text-zinc-500">{email ?? "Signed in"}</p>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            {NAV.map((n) => {
              const isActive = active === n.href;
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold no-underline",
                    isActive ? "bg-black text-white" : "text-zinc-900 hover:bg-zinc-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        {/* Main */}
        <main className="min-w-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/90 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-4 gap-1 px-2 py-2">
          {NAV.map((n) => {
            const isActive = active === n.href;
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold no-underline",
                  isActive ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-50"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
