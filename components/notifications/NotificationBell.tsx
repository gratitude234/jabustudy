// components/notifications/NotificationBell.tsx
"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useMemo } from "react";
import { useNotificationsCount } from "@/contexts/NotificationsContext";

export default function NotificationBell({ className }: { className?: string }) {
  const count = useNotificationsCount();

  const icon = useMemo(
    () => (
      <span className="relative inline-flex items-center justify-center">
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-2 -top-2 min-w-[18px] rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
    ),
    [count]
  );

  return (
    <Link
      href="/notifications"
      className={`inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 shadow-sm hover:bg-secondary ${className ?? ""}`}
      aria-label="Notifications"
    >
      {icon}
    </Link>
  );
}