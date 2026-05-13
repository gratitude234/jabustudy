"use client";

import { cn } from "@/lib/utils";

export default function ProfileCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-zinc-50 p-4", className)}>
      {children}
    </div>
  );
}
