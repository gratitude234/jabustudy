"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const REASONS = [
  "Scam / suspicious",
  "Fake product/service",
  "Harassment / inappropriate",
  "Wrong category",
  "Duplicate / spam",
  "Other",
] as const;

function ReportInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const listingId = sp.get("listing")?.trim() || "";
  const courierId = sp.get("courier")?.trim() || "";
  const target = courierId ? "courier" : "listing";

  const [reason, setReason] = useState<(typeof REASONS)[number]>("Scam / suspicious");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => Boolean((listingId || courierId) && reason), [listingId, courierId, reason]);

  useEffect(() => {
    // if user is logged in, prefill email
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userEmail = data.user?.email ?? "";
      if (userEmail) setEmail(userEmail);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!listingId) {
      if (!courierId) {
        setMsg("Missing report target. Go back and try again.");
        return;
      }
    }

    setLoading(true);
    const { error } = target === "courier"
      ? await supabase.from("courier_reports").insert({
          courier_id: courierId,
          reason,
          details: details.trim() || null,
          reporter_email: email.trim() || null,
        })
      : await supabase.from("reports").insert({
          listing_id: listingId,
          reason,
          details: details.trim() || null,
          reporter_email: email.trim() || null,
        });
    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Report submitted ✅ Thanks for helping keep the market safe.");
    setTimeout(() => {
      if (target === "courier") router.push(`/couriers`);
      else router.push(`/listing/${listingId}`);
    }, 900);
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">
          {target === "courier" ? "Report Transport Provider" : "Report Listing"}
        </h1>
        <p className="text-sm text-zinc-600">
          Please tell us what’s wrong. We’ll review it.
        </p>
      </div>

      {msg ? <div className="rounded-2xl border bg-white p-4 text-sm">{msg}</div> : null}

      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-600">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-600">More details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="What happened? Any proof?"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-600">Your email (optional)</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@school.com"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          disabled={!canSubmit || loading}
          className="w-full rounded-2xl bg-black px-4 py-3 text-white font-medium disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit report"}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="w-full rounded-2xl border px-4 py-3 text-sm"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportInner />
    </Suspense>
  );
}
