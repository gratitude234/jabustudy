"use client";

import Link from "next/link";
import {
  Bookmark,
  ChefHat,
  LayoutDashboard,
  MessageCircle,
  PlusSquare,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import type { RoleFlags } from "./types";

export default function QuickActions({ roles }: { roles: RoleFlags }) {
  const cards = roles.isFoodVendor
    ? [
        { href: "/vendor/orders", icon: <ShoppingBag className="h-4 w-4" />, title: "View orders", desc: "See pending and active orders" },
        { href: "/vendor/menu", icon: <ChefHat className="h-4 w-4" />, title: "Manage menu", desc: "Add and edit menu items" },
        { href: "/vendor/setup", icon: <Settings className="h-4 w-4" />, title: "Vendor settings", desc: "Hours, profile, avatar" },
        { href: "/inbox", icon: <MessageCircle className="h-4 w-4" />, title: "Messages", desc: "Buyer chats and support" },
      ]
    : roles.isVendor
      ? [
          { href: "/my-listings", icon: <LayoutDashboard className="h-4 w-4" />, title: "My listings", desc: "Manage your active listings" },
          { href: "/vendor/orders", icon: <ShoppingBag className="h-4 w-4" />, title: "Vendor orders", desc: "Manage buyer orders" },
          { href: "/vendor/setup", icon: <Settings className="h-4 w-4" />, title: "Vendor settings", desc: "Profile, bank details" },
          { href: "/post", icon: <PlusSquare className="h-4 w-4" />, title: "Post listing", desc: "Add a product or service" },
          { href: "/me?tab=verification", icon: <ShieldCheck className="h-4 w-4" />, title: "Verification", desc: "Upload docs and request" },
          { href: "/saved", icon: <Bookmark className="h-4 w-4" />, title: "Saved items", desc: "Items you bookmarked" },
        ]
      : [
          { href: "/my-orders", icon: <ShoppingBag className="h-4 w-4" />, title: "My Orders", desc: "Track food and market orders" },
          { href: "/saved", icon: <Bookmark className="h-4 w-4" />, title: "Saved Items", desc: "Items you bookmarked" },
          { href: "/post", icon: <PlusSquare className="h-4 w-4" />, title: "Post Item", desc: "Sell an item or service" },
          { href: "/inbox", icon: <MessageCircle className="h-4 w-4" />, title: "Messages", desc: "Buyer and seller chats" },
          { href: "/vendor/create", icon: <Store className="h-4 w-4" />, title: "Become a Vendor", desc: "Create a market store" },
        ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <Link key={c.title} href={c.href} className="rounded-2xl border bg-white p-3 shadow-sm transition hover:bg-zinc-50">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border bg-white p-2">{c.icon}</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900">{c.title}</div>
              <div className="mt-0.5 text-xs text-zinc-600">{c.desc}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
