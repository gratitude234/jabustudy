"use client";

import Link from "next/link";
import { BadgeCheck, Settings, ShieldCheck, Store, Truck, User } from "lucide-react";
import type { RoleFlags } from "./types";
import { cn, pillTone, avatarGradient } from "./utils";

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border bg-zinc-50 px-3 py-2.5 text-center">
      <span className="block text-base font-bold tabular-nums text-zinc-900">{value}</span>
      <span className="mt-0.5 block truncate text-[11px] font-medium text-zinc-500">{label}</span>
    </div>
  );
}

export default function HeaderCard(props: {
  name: string;
  sub: string;
  avatarText: string;
  roles: RoleFlags;
  vendorName: string | null;
  vendorId?: string | null;
  listingsCount?: number;
  menuItemsCount?: number;
  ordersTodayCount?: number;
  ordersCount?: number;
  savedCount?: number;
}) {
  const { roles } = props;
  const grad = avatarGradient(props.name);
  const stats = roles.isFoodVendor
    ? [
        { label: "Menu items", value: props.menuItemsCount ?? 0 },
        { label: "Orders today", value: props.ordersTodayCount ?? 0 },
        { label: "Saved", value: props.savedCount ?? 0 },
      ]
    : roles.isVendor
      ? [
          { label: "Listings", value: props.listingsCount ?? 0 },
          { label: "Orders", value: props.ordersCount ?? 0 },
          { label: "Saved", value: props.savedCount ?? 0 },
        ]
      : [
          { label: "Orders", value: props.ordersCount ?? 0 },
          { label: "Saved", value: props.savedCount ?? 0 },
          { label: "Listings", value: props.listingsCount ?? 0 },
        ];

  return (
    <div className="rounded-2xl border bg-white px-4 py-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div
          className="flex h-14 w-14 shrink-0 select-none items-center justify-center rounded-2xl text-lg font-bold text-white"
          style={{ background: grad }}
        >
          {props.avatarText}
        </div>
        <Link
          href="/me?tab=account"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
      </div>

      <h1 className="truncate text-lg font-bold leading-tight text-zinc-900">{props.name}</h1>
      <p className="mt-0.5 truncate text-sm text-zinc-400">{props.sub}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {roles.isVendor ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", pillTone("base"))}>
            <Store className="h-3 w-3" /> Vendor
          </span>
        ) : (
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", pillTone("base"))}>
            <User className="h-3 w-3" /> Buyer
          </span>
        )}

        {roles.isVerifiedVendor && (
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", pillTone("good"))}>
            <BadgeCheck className="h-3 w-3" /> Verified
          </span>
        )}

        {roles.isVendor && !roles.isVerifiedVendor && (
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", pillTone("warn"))}>
            <ShieldCheck className="h-3 w-3" /> Not verified
          </span>
        )}

        {roles.isRider && (
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", pillTone("base"))}>
            <Truck className="h-3 w-3" /> Rider
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <StatPill key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      {roles.isVendor && props.vendorName && props.vendorId ? (
        <Link
          href={`/vendors/${props.vendorId}`}
          className="mt-3 flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100"
        >
          <span className="truncate">{props.vendorName}</span>
          <span className="shrink-0 text-zinc-400">View storefront</span>
        </Link>
      ) : null}
    </div>
  );
}
