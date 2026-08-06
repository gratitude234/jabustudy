import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getExamSprintPricing } from "@/lib/examSprint/config";
import { getMonthlyExamAccess } from "@/lib/examSprint/server";
import { sanitizeExamSecurityReturnPath } from "@/lib/examSprint/device";
import ExamMeClient from "./ExamMeClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Exam Sprint",
  description: "Manage your Exam Sprint pass, trusted devices and account session.",
  robots: { index: false, follow: false, noarchive: true },
};

function displayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  for (const candidate of [metadata.full_name, metadata.name, metadata.display_name]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  const emailName = user.email?.split("@")[0]?.trim();
  return emailName || "Exam Sprint student";
}

export default async function ExamMePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = sanitizeExamSecurityReturnPath(rawReturnTo);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/exam/me")}`);

  const access = await getMonthlyExamAccess(user.id);
  const pricing = getExamSprintPricing();

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <nav aria-label="Account navigation">
        <Link href="/exam" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Exam Sprint
        </Link>
      </nav>

      <ExamMeClient
        name={displayName(user)}
        email={user.email ?? ""}
        passActive={access.active}
        passActiveUntil={access.activeUntil}
        passPriceNaira={pricing.currentPriceNaira}
        returnTo={returnTo}
      />
    </div>
  );
}
