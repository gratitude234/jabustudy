"use client";

import { LogOut, Mail } from "lucide-react";
import type { Me } from "./types";

export default function AccountTab({ me, onSignOut }: { me: Me | null; onSignOut: () => Promise<void> }) {
  return (
    <div className="space-y-4">
      {/* Account info */}
      <div className="rounded-xl border bg-zinc-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Signed in as</p>
        <div className="mt-2 flex items-center gap-2">
          <Mail className="h-4 w-4 text-zinc-400 shrink-0" />
          <p className="text-sm font-semibold text-zinc-900 truncate">{me?.email ?? "—"}</p>
        </div>
        <p className="mt-1 text-xs text-zinc-400">JABU student account · cannot be changed</p>
      </div>

      {/* Sign out */}
      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}