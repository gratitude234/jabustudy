"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Bookmark,
  ChefHat,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  MessageCircle,
  PackagePlus,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import type { RoleFlags, Vendor } from "./types";
import { cn } from "./utils";

type DashboardCounts = {
  listingsCount: number;
  menuItemsCount: number;
  ordersTodayCount: number;
  ordersCount: number;
  savedCount: number;
};

type Tone = "market" | "green" | "blue" | "zinc";

type ActionCard = {
  href: string;
  title: string;
  desc: string;
  icon: ReactNode;
  tone: Tone;
};

const toneClass: Record<Tone, { icon: string }> = {
  market: { icon: "border-orange-100 bg-orange-50 text-orange-700" },
  green: { icon: "border-emerald-100 bg-emerald-50 text-emerald-700" },
  blue: { icon: "border-blue-100 bg-blue-50 text-blue-700" },
  zinc: { icon: "border-zinc-200 bg-zinc-50 text-zinc-700" },
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold text-zinc-900">{children}</h2>;
}

function ActionCard({ action }: { action: ActionCard }) {
  return (
    <Link
      href={action.href}
      className="group rounded-2xl border border-zinc-100 bg-white p-3 no-underline transition hover:border-zinc-200 hover:bg-zinc-50"
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", toneClass[action.tone].icon)}>
          {action.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">{action.title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{action.desc}</span>
        </span>
      </div>
    </Link>
  );
}

function DashboardRow({
  href,
  title,
  desc,
  icon,
  tone,
  badge,
}: {
  href: string;
  title: string;
  desc: string;
  icon: ReactNode;
  tone: Tone;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3.5 no-underline transition hover:border-zinc-200 hover:bg-zinc-50"
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", toneClass[tone].icon)}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-zinc-900">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-zinc-500">{desc}</span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          {badge}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />
    </Link>
  );
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString("en-NG")} ${count === 1 ? singular : plural}`;
}

export default function DashboardTab({
  roles,
  vendor,
  listingsCount,
  menuItemsCount,
  ordersTodayCount,
  ordersCount,
  savedCount,
}: {
  roles: RoleFlags;
  vendor: Vendor | null;
} & DashboardCounts) {
  const quickActions: ActionCard[] = roles.isFoodVendor
    ? [
        {
          href: "/vendor/orders",
          title: "Vendor Orders",
          desc: `${ordersTodayCount.toLocaleString("en-NG")} today`,
          icon: <ShoppingBag className="h-4 w-4" />,
          tone: "market",
        },
        {
          href: "/vendor/menu",
          title: "Menu",
          desc: countLabel(menuItemsCount, "item"),
          icon: <ChefHat className="h-4 w-4" />,
          tone: "green",
        },
        {
          href: "/vendor/setup",
          title: "Food Settings",
          desc: "Profile, bank, hours",
          icon: <Settings className="h-4 w-4" />,
          tone: "zinc",
        },
        {
          href: "/inbox",
          title: "Messages",
          desc: "Buyer chats and order issues",
          icon: <MessageCircle className="h-4 w-4" />,
          tone: "blue",
        },
      ]
    : roles.isVendor
      ? [
          {
            href: "/my-listings",
            title: "My Listings",
            desc: countLabel(listingsCount, "listing"),
            icon: <ClipboardList className="h-4 w-4" />,
            tone: "blue",
          },
          {
            href: "/vendor/orders",
            title: "Vendor Orders",
            desc: "Manage buyer orders",
            icon: <ShoppingBag className="h-4 w-4" />,
            tone: "market",
          },
          {
            href: "/me?tab=verification",
            title: "Verification",
            desc: roles.isVerifiedVendor ? "Store verified" : "Build buyer trust",
            icon: roles.isVerifiedVendor ? <BadgeCheck className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />,
            tone: roles.isVerifiedVendor ? "green" : "zinc",
          },
          {
            href: "/vendor/setup",
            title: "Store Settings",
            desc: "Profile and bank details",
            icon: <Settings className="h-4 w-4" />,
            tone: "zinc",
          },
        ]
      : [
          {
            href: "/my-orders",
            title: "My Orders",
            desc: countLabel(ordersCount, "order"),
            icon: <ShoppingBag className="h-4 w-4" />,
            tone: "market",
          },
          {
            href: "/saved",
            title: "Saved Items",
            desc: countLabel(savedCount, "listing"),
            icon: <Bookmark className="h-4 w-4" />,
            tone: "green",
          },
          {
            href: "/post",
            title: "Post Item",
            desc: "Sell an item or service",
            icon: <PackagePlus className="h-4 w-4" />,
            tone: "blue",
          },
          {
            href: "/inbox",
            title: "Messages",
            desc: "Buyer and seller chats",
            icon: <MessageCircle className="h-4 w-4" />,
            tone: "zinc",
          },
        ];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle>Quick actions</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <ActionCard key={action.title} action={action} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Marketplace</SectionTitle>
        <div className="space-y-2">
          <DashboardRow
            href="/my-orders"
            title="My Orders"
            desc="Track food and marketplace checkout"
            icon={<ShoppingBag className="h-4 w-4" />}
            tone="market"
          />
          <DashboardRow
            href={roles.isVendor ? "/my-listings" : "/post"}
            title={roles.isVendor ? "My Listings" : "Post Item"}
            desc={roles.isVendor ? "Manage posted products and services" : "Create your first marketplace listing"}
            icon={roles.isVendor ? <ClipboardList className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
            tone="blue"
          />
          <DashboardRow
            href="/saved"
            title="Saved Items"
            desc="Listings you want to revisit"
            icon={<Bookmark className="h-4 w-4" />}
            tone="green"
          />
          <DashboardRow
            href="/inbox"
            title="Messages"
            desc="Buyer, seller and order conversations"
            icon={<MessageCircle className="h-4 w-4" />}
            tone="zinc"
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Role tools</SectionTitle>
        <div className="space-y-2">
          {roles.isFoodVendor ? (
            <>
              <DashboardRow
                href="/vendor/menu"
                title="Food Vendor Tools"
                desc="Manage menu, orders and store hours"
                icon={<ChefHat className="h-4 w-4" />}
                tone="green"
                badge="Food"
              />
              <DashboardRow
                href="/vendor/setup"
                title="Vendor Settings"
                desc="Profile, bank details and storefront"
                icon={<Settings className="h-4 w-4" />}
                tone="zinc"
              />
            </>
          ) : roles.isVendor ? (
            <>
              <DashboardRow
                href="/vendor/setup"
                title="Vendor Tools"
                desc="Store setup, bank and contact details"
                icon={<Store className="h-4 w-4" />}
                tone="market"
                badge={roles.isVerifiedVendor ? "Verified" : undefined}
              />
              <DashboardRow
                href="/me?tab=verification"
                title="Verification"
                desc={roles.isVerifiedVendor ? "Your store is verified" : "Upload docs and request review"}
                icon={roles.isVerifiedVendor ? <BadgeCheck className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                tone={roles.isVerifiedVendor ? "green" : "zinc"}
              />
              {vendor?.id ? (
                <DashboardRow
                  href={`/vendors/${vendor.id}`}
                  title="View Storefront"
                  desc={vendor.name ?? "Preview your public vendor page"}
                  icon={<Store className="h-4 w-4" />}
                  tone="blue"
                />
              ) : null}
            </>
          ) : (
            <>
              <DashboardRow
                href="/vendor/create"
                title="Become a Vendor"
                desc="Create a store and start posting listings"
                icon={<Store className="h-4 w-4" />}
                tone="market"
              />
              <DashboardRow
                href="/vendor/register"
                title="Register Food Stall"
                desc="Take structured food orders on campus"
                icon={<UtensilsCrossed className="h-4 w-4" />}
                tone="green"
              />
            </>
          )}

          {roles.isRider ? (
            <DashboardRow
              href="/rider/dashboard"
              title="Rider Dashboard"
              desc="Manage delivery requests and rider status"
              icon={<Truck className="h-4 w-4" />}
              tone="blue"
              badge="Rider"
            />
          ) : (
            <DashboardRow
              href="/rider/apply"
              title="Apply as Rider"
              desc="Help with campus pickups and deliveries"
              icon={<Truck className="h-4 w-4" />}
              tone="blue"
            />
          )}
        </div>
      </section>

      <Link
        href="/study"
        className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3 no-underline transition hover:border-zinc-200 hover:bg-white"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-700">
          <GraduationCap className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zinc-900">Study Hub</span>
          <span className="mt-0.5 block truncate text-xs text-zinc-500">Open your study homepage</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />
      </Link>
    </div>
  );
}
