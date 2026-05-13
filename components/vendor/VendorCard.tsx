import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";

type VendorType = "food" | "mall" | "student" | "other";

export type VendorCardVendor = {
  id: string;
  name: string | null;
  location: string | null;
  verified?: boolean | null;
  vendor_type?: VendorType | null;
};

function typeLabel(t?: VendorType | null) {
  if (!t) return "Vendor";
  if (t === "food") return "Food";
  if (t === "mall") return "Mall";
  if (t === "student") return "Student";
  return "Vendor";
}

export default function VendorCard({ vendor }: { vendor: VendorCardVendor }) {
  const name = vendor.name?.trim() || "Unnamed Vendor";
  const loc = vendor.location?.trim();

  return (
    <Link
      href={`/vendors/${vendor.id}`}
      className="group block rounded-3xl border bg-white p-4 shadow-sm transition hover:shadow-md md:rounded-2xl md:p-5"
    >
      <div className="flex items-start justify-between gap-3 md:items-center">
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900 md:text-[15px]">{name}</p>
          <p className="mt-1 text-xs text-zinc-600 md:mt-0 md:text-[12px]">
            {typeLabel(vendor.vendor_type)}
          </p>
        </div>

        {vendor.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            <BadgeCheck className="h-4 w-4" />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
            {vendor.verified === false ? "Unverified" : "Vendor"}
          </span>
        )}
      </div>

      {loc ? (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-600 md:mt-2">
          <MapPin className="h-4 w-4" />
          <span className="truncate">{loc}</span>
        </div>
      ) : null}

      <div className="mt-4 md:mt-3">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-zinc-900 md:text-[15px]">
          View profile
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Link>
  );
}
