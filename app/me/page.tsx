"use client";
// app/me/page.tsx

import Link from "next/link";
import { useEffect, useMemo, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import HeaderCard from "./_components/HeaderCard";
import Tabs from "./_components/Tabs";
import ProfileTab from "./_components/ProfileTab";
import ListingsTab from "./_components/ListingsTab";
import VerificationTab from "./_components/VerificationTab";
import AccountTab from "./_components/AccountTab";

import DashboardTab from "./_components/DashboardTab";
import type { TabKey, Me, Vendor, RoleFlags } from "./_components/types";
import { initials } from "./_components/utils";
import { clearMealDrafts } from "@/lib/mealDraft";
import { useNavContext } from "@/contexts/NavContext";

/* ─── Loading skeleton ─────────────────────────────────────── */

function MeSkeleton() {
  return (
    <div className="space-y-3 pb-28 md:pb-6 animate-pulse">
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="h-20 bg-zinc-200" />
        <div className="px-4 pb-4 pt-2 space-y-3">
          <div className="flex items-end justify-between -mt-8">
            <div className="h-16 w-16 rounded-2xl bg-zinc-200 border-4 border-white" />
            <div className="h-8 w-20 rounded-xl bg-zinc-100" />
          </div>
          <div className="h-5 w-40 rounded bg-zinc-100" />
          <div className="h-4 w-56 rounded bg-zinc-100" />
          <div className="flex gap-2 mt-4">
            <div className="h-14 w-16 rounded-xl bg-zinc-100" />
            <div className="h-14 w-16 rounded-xl bg-zinc-100" />
            <div className="h-14 flex-1 rounded-xl bg-zinc-100" />
          </div>
        </div>
      </div>
      <div className="h-14 rounded-2xl bg-zinc-100" />
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="h-12 bg-zinc-50" />
        <div className="p-4 space-y-3">
          <div className="h-10 rounded-xl bg-zinc-100" />
          <div className="h-10 rounded-xl bg-zinc-100" />
          <div className="h-10 rounded-xl bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

/* ─── Inner page ────────────────────────────────────────────── */

function MeInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { isRider } = useNavContext();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [listingsCount, setListingsCount] = useState(0);
  const [menuItemsCount, setMenuItemsCount] = useState(0);
  const [ordersTodayCount, setOrdersTodayCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  const activeTab = (sp.get("tab") as TabKey) || "profile";

  const roles: RoleFlags = useMemo(() => {
    const isVendor = !!vendor?.id;
    const isVerifiedVendor = !!vendor?.verified || vendor?.verification_status === "verified";
    const isFoodVendor = !!vendor?.id && vendor?.vendor_type === "food";

    return { isVendor, isVerifiedVendor, isFoodVendor, isRider };
  }, [vendor, isRider]);

  const availableTabs = useMemo(() => {
    if (roles.isFoodVendor) {
      return [
        { key: "profile" as TabKey, label: "Dashboard" },
        { key: "account" as TabKey, label: "Account" },
      ];
    }
    if (!roles.isVendor) {
      return [
        { key: "profile" as TabKey, label: "Dashboard" },
        { key: "account" as TabKey, label: "Account" },
      ];
    }
    return [
      { key: "profile" as TabKey, label: "Dashboard" },
      { key: "listings" as TabKey, label: "Listings" },
      { key: "verification" as TabKey, label: "Verification" },
      { key: "account" as TabKey, label: "Account" },
    ];
  }, [roles.isFoodVendor, roles.isVendor]);

  // Bounce to role-appropriate default tab if current tab is no longer valid
  useEffect(() => {
    const ok = availableTabs.some((t) => t.key === activeTab);
    if (!ok) {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "profile");
      router.replace(url.pathname + url.search);
    }
  }, [roles.isVendor, roles.isFoodVendor, activeTab, availableTabs, router]);

  // Load user + vendor + counts
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const metadata = user.user_metadata as Record<string, unknown>;
      const fullName = typeof metadata.full_name === "string" ? metadata.full_name : null;

      const nextMe: Me = {
        id: user.id,
        email: user.email ?? null,
        full_name: fullName,
      };

      const [vendorRes, ordersRes, savedRes] = await Promise.all([
        supabase
          .from("vendors")
          .select("id,user_id,name,whatsapp,phone,location,vendor_type,verified,verification_status,verified_at,rejected_at,rejection_reason,created_at,bank_name,bank_account_number,bank_account_name")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("buyer_id", user.id),
        supabase
          .from("listing_saves")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (!mounted) return;

      setMe(nextMe);
      setVendor(vendorRes.error || !vendorRes.data ? null : (vendorRes.data as Vendor));
      setOrdersCount(ordersRes.count ?? 0);
      setSavedCount(savedRes.count ?? 0);
      setListingsCount(0);
      setMenuItemsCount(0);
      setOrdersTodayCount(0);

      if (vendorRes.data?.id) {
        const listingsRes = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", vendorRes.data.id);
        if (mounted) setListingsCount(listingsRes.count ?? 0);
      }

      // Food vendor extra stats
      if (!vendorRes.error && vendorRes.data?.vendor_type === "food" && vendorRes.data?.id) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [menuRes, ordersRes] = await Promise.all([
          supabase.from("vendor_menu_items").select("id", { count: "exact", head: true }).eq("vendor_id", vendorRes.data.id),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("vendor_id", vendorRes.data.id).gte("created_at", todayStart.toISOString()),
        ]);
        if (mounted) {
          setMenuItemsCount(menuRes.count ?? 0);
          setOrdersTodayCount(ordersRes.count ?? 0);
        }
      }

      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [router]);

  function setTab(tab: TabKey) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    router.replace(url.pathname + url.search);
  }

  async function signOut() {
    clearMealDrafts();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) return <MeSkeleton />;

  const displayName = me?.full_name || vendor?.name || "My Account";
  const displaySub = me?.email || "—";

  return (
    <div className="space-y-3 pb-28 md:pb-6">
      {/* Hero card */}
      <HeaderCard
        name={displayName}
        sub={displaySub}
        avatarText={initials(displayName || me?.email)}
        roles={roles}
        vendorName={vendor?.name ?? null}
        vendorId={vendor?.id ?? null}
        listingsCount={listingsCount}
        menuItemsCount={menuItemsCount}
        ordersTodayCount={ordersTodayCount}
        ordersCount={ordersCount}
        savedCount={savedCount}
      />

      {/* Tabs + content card */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <Tabs active={activeTab} onChange={setTab} items={availableTabs} />
        <div className="p-4">
          {(activeTab === "profile" || activeTab === "dashboard") && (
            <DashboardTab
              roles={roles}
              vendor={vendor}
              listingsCount={listingsCount}
              menuItemsCount={menuItemsCount}
              ordersTodayCount={ordersTodayCount}
              ordersCount={ordersCount}
              savedCount={savedCount}
            />
          )}

          {activeTab === "listings" && (
            <ListingsTab vendorId={vendor?.id ?? null} />
          )}

          {activeTab === "verification" && roles.isVendor && (
            <VerificationTab
              roles={roles}
              vendor={vendor}
              onVendorUpdated={(v) => setVendor(v)}
            />
          )}

          {activeTab === "verification" && !roles.isVendor && (
            <div className="rounded-xl border bg-zinc-50 p-4 text-center">
              <p className="text-sm font-semibold text-zinc-900">Verification is for vendors</p>
              <p className="mt-1 text-xs text-zinc-500">Create a vendor profile to request verification.</p>
              <Link
                href="/vendor/create"
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Become a vendor
              </Link>
            </div>
          )}

          {activeTab === "account" && (
            <div className="space-y-6">
              <ProfileTab
                roles={roles}
                me={me}
                vendor={vendor}
                onVendorUpdated={(v) => setVendor(v)}
                onMeUpdated={(m) => setMe(m)}
              />
              <AccountTab me={me} onSignOut={signOut} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Page export ────────────────────────────────────────────── */

export default function MePage() {
  return (
    <Suspense fallback={<div className="pb-28 md:pb-6"><div className="animate-pulse space-y-3"><div className="h-40 rounded-2xl bg-zinc-100" /><div className="h-14 rounded-2xl bg-zinc-100" /><div className="h-64 rounded-2xl bg-zinc-100" /></div></div>}>
      <MeInner />
    </Suspense>
  );
}
