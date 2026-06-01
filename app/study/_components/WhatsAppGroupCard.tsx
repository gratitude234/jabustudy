import { ArrowRight, UsersRound } from "lucide-react";

import { WHATSAPP_GROUP_URL } from "@/lib/community";

export default function WhatsAppGroupCard() {
  if (!WHATSAPP_GROUP_URL) return null;

  return (
    <a
      href={WHATSAPP_GROUP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5 p-4 no-underline transition hover:border-[#25D366]/50 hover:bg-[#25D366]/10"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#128C4A] dark:text-[#25D366]">
        <UsersRound className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Join the JabuStudy WhatsApp group</p>
        <p className="text-xs text-muted-foreground">Request CBT questions, share materials, and get study updates.</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  );
}
