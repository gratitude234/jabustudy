import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck } from "lucide-react";

import { findExamCourse } from "@/lib/examSprint/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBillingOrderDetails } from "@/lib/studyBilling";
import PrintReceiptButton from "./PrintReceiptButton";

function money(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function exactTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "Africa/Lagos",
  });
}

export default async function BillingReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/study/billing/receipt/${id}`)}`);
  const order = await getBillingOrderDetails(user.id, id);
  if (!order) notFound();
  const isExamPurchase = order.returnPath === "/exam" || order.returnPath.startsWith("/exam/");
  const examCourseSlug = order.returnPath.match(/^\/exam\/([^/?#]+)/)?.[1] ?? null;
  const examCourse = isExamPurchase ? findExamCourse(examCourseSlug) : null;
  const destinationLabel = examCourse?.code ?? (isExamPurchase ? "Exam Sprint" : "Study Hub");
  const backHref = isExamPurchase ? order.returnPath : "/study/billing";

  const rows = [
    ["Order reference", order.reference],
    ["Transaction ID", order.paystackReference || order.transactionReference || "Not recorded"],
    ["Payment method", order.paymentMethod === "paystack" ? "Paystack" : "Bank transfer"],
    ["Payment time", exactTime(order.paidAt || order.reviewedAt || order.submittedAt)],
    ["Fulfilment", order.status.replaceAll("_", " ")],
    ["Refund review", order.refundStatus.replaceAll("_", " ")],
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to {destinationLabel}</Link>
        <PrintReceiptButton />
      </div>
      <article className="rounded-3xl border border-border bg-card p-6 text-foreground shadow-sm sm:p-9 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">JabuStudy receipt</p>
            <h1 className="mt-2 text-2xl font-extrabold">{order.planLabel}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{isExamPurchase ? "Includes 30 days of Exam Sprint access." : "A record of your JabuStudy purchase."}</p>
          </div>
          <p className="text-2xl font-black">{money(order.amountNaira)}</p>
        </div>
        <dl className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr]">
              <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
              <dd className="break-words text-sm font-bold capitalize">{value}</dd>
            </div>
          ))}
        </dl>
        {order.refundNote ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-bold">Refund note</p>
            <p className="mt-1">{order.refundNote}</p>
          </div>
        ) : null}
        {order.status === "approved" ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-100 sm:flex-row sm:items-center print:hidden">
            <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">Access is active</p><p className="mt-0.5 text-xs opacity-75">Your payment has been verified and fulfilled.</p></div>
            <Link href={order.returnPath} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-extrabold text-white no-underline dark:bg-emerald-400 dark:text-emerald-950">Continue to {destinationLabel}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </div>
        ) : null}
      </article>
    </div>
  );
}
