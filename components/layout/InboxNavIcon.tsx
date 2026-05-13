"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useNavContext } from "@/contexts/NavContext";

export default function InboxNavIcon({ className }: { className?: string }) {
  const { user } = useAuth();
  const { buyerUnread, vendorUnread, loading } = useNavContext();
  const count = buyerUnread + vendorUnread;

  const icon = (
    <span className="relative inline-flex items-center justify-center">
      <MessageCircle className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-2 -top-2 min-w-[18px] rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
  );

  if (loading) {
    return (
      <button
        type="button"
        className={`inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 shadow-sm hover:bg-secondary ${className ?? ""}`}
        aria-label="Messages"
      >
        {icon}
      </button>
    );
  }

  return (
    <Link
      href={user ? "/inbox" : "/login?next=/inbox"}
      className={`inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 shadow-sm hover:bg-secondary ${className ?? ""}`}
      aria-label="Messages"
    >
      {icon}
    </Link>
  );
}
