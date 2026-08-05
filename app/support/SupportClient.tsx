"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Copy, Heart, Server, Sparkles, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  backHref: string;
  backLabel: string;
};

const COSTS = [
  { icon: Server, label: "Hosting", desc: "Keeping the app online for everyone, every day" },
  { icon: Sparkles, label: "AI features", desc: "Summaries, explanations and practice generation" },
  { icon: Wrench, label: "Fixes & upgrades", desc: "Ongoing work so things keep improving" },
];

export default function SupportClient({ bankName, accountNumber, accountName, backHref, backLabel }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    });
  }

  const hasBank = Boolean(bankName && accountNumber);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-28 pt-6 md:pb-10 md:px-6">
      <header className="space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Heart className="h-3.5 w-3.5" />
          Maintenance contribution
        </span>
        <h1 className="font-[family-name:var(--font-bricolage)] text-3xl font-extrabold tracking-tight md:text-4xl">
          Help keep JabuStudy running
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          JabuStudy has been free since day one, and that&rsquo;s not changing. But keeping it
          running costs real money.
        </p>
      </header>

      <section className="space-y-2.5">
        {COSTS.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-4.5 w-4.5 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          With summer session students coming on board soon to prep for their exams, we need it
          running at full strength before then. If it has helped you even once this semester,
          that&rsquo;s a fair trade.
        </p>
        <p className="mt-3 text-sm font-medium leading-relaxed">
          This is a maintenance contribution, not a fee. Give what you can, from{" "}
          <span className="text-primary">&#8358;1,000</span> upward, and help keep it alive for the
          present students and the next set of students.
        </p>
      </section>

      {hasBank ? (
        <section className="space-y-3 rounded-2xl border border-primary/25 bg-primary/[0.04] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
            Contribute here
          </h2>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => copy(accountNumber, "acct")}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition hover:border-primary/40"
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Account number</span>
                <span className="block font-[family-name:var(--font-bricolage)] text-xl font-bold tracking-wider">
                  {accountNumber}
                </span>
              </span>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                  copied === "acct"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {copied === "acct" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
              <span>
                <span className="block text-xs text-muted-foreground">Bank</span>
                <span className="block text-sm font-semibold">{bankName}</span>
              </span>
              {accountName ? (
                <span>
                  <span className="block text-xs text-muted-foreground">Account name</span>
                  <span className="block text-sm font-semibold">{accountName}</span>
                </span>
              ) : null}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            These are the only account details JabuStudy will ever ask you to send to. We will
            never send bank details inside a notification or a chat message &mdash; always check
            this page.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Contribution details are not configured yet.</p>
          <p className="mt-1">
            Set <code className="font-mono text-xs">JABUSTUDY_BANK_NAME</code>,{" "}
            <code className="font-mono text-xs">JABUSTUDY_BANK_ACCOUNT_NUMBER</code> and{" "}
            <code className="font-mono text-xs">JABUSTUDY_BANK_ACCOUNT_NAME</code> to show them
            here.
          </p>
        </section>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Thank you for being part of this.
      </p>

      <div className="flex justify-center">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          {backLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
