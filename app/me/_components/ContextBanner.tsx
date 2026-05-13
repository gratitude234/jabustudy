"use client";

import Link from "next/link";
import type { RoleFlags, Vendor } from "./types";

export default function ContextBanner({
  roles,
  vendor,
}: {
  roles: RoleFlags;
  vendor: Vendor | null;
}) {
  if (roles.isVendor && !roles.isVerifiedVendor) {
    const status = vendor?.verification_status;

    if (status === "under_review" || status === "requested") {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-amber-900">Verification {status === "under_review" ? "under review" : "requested"}</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Admins are reviewing your documents. You will be notified once a decision is made.
            </p>
          </div>
        </div>
      );
    }

    if (status === "rejected") {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-900">Verification rejected</p>
            <p className="mt-0.5 text-xs text-rose-700">
              {vendor?.rejection_reason ?? "Check the Verification tab for the reason and resubmit."}
            </p>
          </div>
          <Link
            href="/me?tab=verification"
            className="shrink-0 self-center rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
          >
            Retry
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-900">Get your store verified</p>
          <p className="mt-0.5 text-xs text-zinc-500">Verified vendors earn more trust and visibility from buyers.</p>
        </div>
        <Link
          href="/me?tab=verification"
          className="shrink-0 self-center rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
        >
          Start
        </Link>
      </div>
    );
  }

  if (roles.isVendor && roles.isVerifiedVendor) {
    if (vendor?.vendor_type !== "food" && !vendor?.bank_account_number) {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Bank details missing</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Buyers cannot finalize deals until you add your bank account number.
            </p>
          </div>
          <Link
            href="/vendor/setup"
            className="shrink-0 self-center rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Add now
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-900">Your store is verified and ready for customers.</p>
      </div>
    );
  }

  if (!roles.isVendor) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-900">Start selling on JABU Market</p>
            <p className="mt-0.5 text-xs text-zinc-500">Post listings and reach buyers on campus.</p>
          </div>
          <Link
            href="/vendor/create"
            className="shrink-0 self-center rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Sell now
          </Link>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-900">Run a canteen or food stall?</p>
            <p className="mt-0.5 text-xs text-zinc-500">Take structured orders without missed messages.</p>
          </div>
          <Link
            href="/vendor/register"
            className="shrink-0 self-center rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Register
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
