"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageCircle,
  Search,
  Store,
  Truck,
  UtensilsCrossed,
  User,
} from "lucide-react";

import { useNavContext } from "@/contexts/NavContext";

export default function BottomNav() {
  const pathname = usePathname();
  const {
    buyerUnread,
    vendorUnread,
    isVendor,
    pendingVendorOrders,
    isRider,
  } = useNavContext();

  const inboxUnread = buyerUnread + vendorUnread;

  const isStudyPage = pathname === "/study" || pathname.startsWith("/study/");
  const isConversationPage = /^\/inbox\/[^/]+$/.test(pathname);
  const isAttemptReviewPage = /^\/study\/history\/[^/]+$/.test(pathname);
  const isUploadPage = /^\/study\/materials\/upload/.test(pathname);
  if (isStudyPage || isConversationPage || isAttemptReviewPage || isUploadPage) return null;

  const meItem = { href: "/me", label: "Me", icon: User, badge: null };
  const riderItem = { href: "/rider/dashboard", label: "Rider", icon: Truck, badge: null };

  const studentItems = [
    { href: "/", label: "Home", icon: Home, badge: null },
    { href: "/explore", label: "Explore", icon: Search, badge: null },
    { href: "/food", label: "Food", icon: UtensilsCrossed, badge: null },
    {
      href: "/inbox",
      label: "Messages",
      icon: MessageCircle,
      badge: inboxUnread > 0 ? (inboxUnread > 99 ? "99+" : String(inboxUnread)) : null,
    },
    ...(isRider ? [riderItem] : []),
    meItem,
  ];

  const vendorItems = [
    { href: "/", label: "Home", icon: Home, badge: null },
    {
      href: "/vendor/orders",
      label: "Orders",
      icon: Store,
      badge:
        pendingVendorOrders > 0
          ? pendingVendorOrders > 9
            ? "9+"
            : String(pendingVendorOrders)
          : null,
      badgeUrgent: pendingVendorOrders > 0,
    },
    { href: "/vendor", label: "Store", icon: Store, badge: null },
    {
      href: "/inbox",
      label: "Messages",
      icon: MessageCircle,
      badge: inboxUnread > 0 ? (inboxUnread > 99 ? "99+" : String(inboxUnread)) : null,
      badgeUrgent: false,
    },
    ...(isRider ? [riderItem] : []),
    meItem,
  ];

  const items = isVendor ? vendorItems : studentItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden [[data-hide-nav=true]_&]:hidden">
      <div className="mx-auto max-w-6xl px-2">
        <div className={`grid h-14 ${items.length === 6 ? "grid-cols-6" : "grid-cols-5"}`}>
          {items.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            const urgent = (item as { badgeUrgent?: boolean }).badgeUrgent === true;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex flex-col items-center justify-center gap-1 text-xs no-underline",
                  active ? "text-brand-market font-semibold" : "text-muted-foreground",
                ].join(" ")}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge ? (
                    <span
                      className={[
                        "absolute -right-2 -top-1.5 min-w-[16px] rounded-full px-1 py-px text-center text-[9px] font-bold leading-none text-white",
                        urgent ? "bg-amber-500" : "bg-red-600",
                      ].join(" ")}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
