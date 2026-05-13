"use client";

import Link from "next/link";
import type { RoleFlags, Vendor } from "./types";

export default function OverviewTab({
  roles,
  vendor,
}: {
  roles: RoleFlags;
  vendor: Vendor | null;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border p-3">
        <div className="text-sm font-semibold text-zinc-900">What you can do here</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>Track your marketplace orders</li>
          <li>Manage saved items and messages</li>
          <li>Update vendor tools if you sell on JABU Market</li>
        </ul>
      </div>

      {roles.isVendor && !roles.isFoodVendor ? (
        <div className="space-y-2 rounded-2xl border p-3">
          <div className="text-sm font-semibold text-zinc-900">Your store</div>
          <div className="text-sm text-zinc-700">
            <span className="text-zinc-500">Name:</span>{" "}
            <span className="font-medium">{vendor?.name ?? "-"}</span>
          </div>
          <div className="text-sm text-zinc-700">
            <span className="text-zinc-500">Verification:</span>{" "}
            <span className="font-medium">
              {vendor?.verified
                ? "Verified"
                : vendor?.verification_status === "requested" || vendor?.verification_status === "under_review"
                  ? "Under review"
                  : vendor?.verification_status === "rejected"
                    ? "Rejected"
                    : "Not verified"}
            </span>
          </div>
          {vendor?.id ? (
            <Link
              href={`/vendors/${vendor.id}`}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
            >
              View your storefront
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border p-3">
          <div className="text-sm font-semibold text-zinc-900">Want to sell on JABU Market?</div>
          <p className="mt-1 text-sm text-zinc-700">Create a vendor profile and start posting listings.</p>
          <Link href="/vendor/create" className="mt-3 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            Become a vendor
          </Link>
        </div>
      )}
    </div>
  );
}
