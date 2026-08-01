import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
        <Link href="/study/billing" className="text-sm font-bold text-primary no-underline hover:underline">Back to Billing</Link>
        <PrintReceiptButton />
      </div>
      <article className="rounded-3xl border border-border bg-card p-6 text-foreground shadow-sm sm:p-9 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">JabuStudy receipt</p>
            <h1 className="mt-2 text-2xl font-extrabold">{order.planLabel}</h1>
            <p className="mt-1 text-sm text-muted-foreground">A record of your JabuStudy purchase.</p>
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
      </article>
    </div>
  );
}
