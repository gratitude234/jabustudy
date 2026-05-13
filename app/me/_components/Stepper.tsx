"use client";

import type { Vendor } from "./types";
import { cn } from "./utils";

export default function Stepper({ step, req, vendor }: { step: number; req: any; vendor: Vendor }) {
  const steps = [
    { n: 1, title: "Upload docs", desc: "Add proof documents" },
    { n: 2, title: "Request", desc: "Submit for review" },
    { n: 3, title: "Review", desc: "Admins check your docs" },
    { n: 4, title: "Result", desc: "Approved / Rejected" },
  ];

  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="text-sm font-semibold text-zinc-900">Verification</div>
      <div className="mt-1 text-sm text-zinc-600">
        Status:{" "}
        <span className="font-semibold text-zinc-800">
          {vendor.verified || vendor.verification_status === "verified"
            ? "verified"
            : req?.status
            ? String(req.status).replace(/_/g, " ")
            : "not started"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {steps.map((s) => {
          const done = s.n < step;
          const active = s.n === step;
          return (
            <div key={s.n} className="min-w-0">
              <div
                className={cn(
                  "flex items-center justify-center rounded-xl border px-2 py-2 text-xs font-semibold",
                  done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600"
                )}
              >
                {s.title}
              </div>
              <div className="mt-1 truncate text-[11px] text-zinc-500">{s.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}