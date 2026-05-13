"use client";
// app/rider/apply/page.tsx
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

const ZONES = ["Campus", "Male Hostels", "Female Hostels", "Town"];

function normalizePhone(input: string) {
  return (input ?? "").replace(/[^\d]/g, "");
}

function isLikelyValidNigeriaPhone(digits: string) {
  // Simple: accept 10–13 digits to avoid blocking legit formats
  return digits.length >= 10 && digits.length <= 13;
}

const FEE_CHIPS = [
  "₦300–₦600 depending distance",
  "Negotiable (depends on location)",
  "₦500 within campus",
  "Call for price",
];

export default function RiderApplyPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [zone, setZone] = useState(ZONES[0]);
  const [feeNote, setFeeNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const phoneDigits = useMemo(() => normalizePhone(phone), [phone]);
  const waDigits = useMemo(() => normalizePhone(whatsapp), [whatsapp]);

  const nameOk = name.trim().length >= 2;
  const phoneOk = isLikelyValidNigeriaPhone(phoneDigits);

  const canSubmit = nameOk && phoneOk;

  function applyChip(text: string) {
    setFeeNote(text);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setErr(null);

    if (!canSubmit) {
      setErr("Please enter your name and a valid phone number.");
      return;
    }

    setLoading(true);

    const payload = {
      name: name.trim(),
      phone: phoneDigits,
      whatsapp: sameAsPhone ? phoneDigits : waDigits ? waDigits : null,
      zone: zone ?? null,
      fee_note: feeNote.trim() ? feeNote.trim() : null,
      // verified stays false by default / RLS
      // is_available defaults true
    };

    const { error } = await supabase.from("riders").insert(payload);

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setOk("Application submitted ✅. You'll appear after admin verification.");
    setName("");
    setPhone("");
    setWhatsapp("");
    setSameAsPhone(true);
    setZone(ZONES[0]);
    setFeeNote("");
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <Link href="/delivery" className="text-sm font-semibold text-zinc-700 hover:text-black no-underline">
          ← Back to Delivery
        </Link>
        <span className="text-xs text-zinc-500">Delivery Agent Application</span>
      </div>

      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Become a Delivery Agent</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Submit your details. Admin will verify you before you show in the delivery list.
        </p>

        <div className="mt-4 rounded-3xl border bg-zinc-50 p-4">
          <p className="text-xs font-semibold text-zinc-900">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
            <li>Fill the form and submit.</li>
            <li>Admin verifies your details.</li>
            <li>You appear on the Delivery page for buyers.</li>
          </ol>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {err}
          </div>
        ) : null}

        {ok ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{ok}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link
                href="/delivery"
                className="rounded-2xl bg-black px-4 py-2 text-center text-sm font-semibold text-white no-underline hover:bg-zinc-800"
              >
                Go to Delivery page
              </Link>
              <button
                type="button"
                onClick={() => setOk(null)}
                className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Submit another
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-900">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tobi A."
              className={cn(
                "h-11 w-full rounded-2xl border bg-white px-3 text-sm outline-none",
                name && !nameOk && "border-rose-300"
              )}
            />
            {name && !nameOk ? (
              <p className="text-xs text-rose-700">Name should be at least 2 characters.</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-900">Phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 08012345678"
              className={cn(
                "h-11 w-full rounded-2xl border bg-white px-3 text-sm outline-none",
                phone && !phoneOk && "border-rose-300"
              )}
            />
            <p className="text-xs text-zinc-500">Use the number customers can call.</p>
            {phone && !phoneOk ? (
              <p className="text-xs text-rose-700">Enter a valid phone number.</p>
            ) : null}
          </div>

          <div className="rounded-2xl border bg-zinc-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">WhatsApp number</p>
                <p className="text-xs text-zinc-600">Use same as phone or provide another.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !sameAsPhone;
                  setSameAsPhone(next);
                  if (next) setWhatsapp("");
                }}
                className={cn(
                  "h-9 w-16 rounded-full border p-1 transition",
                  sameAsPhone ? "bg-black" : "bg-white"
                )}
                aria-pressed={sameAsPhone}
              >
                <span
                  className={cn(
                    "block h-7 w-7 rounded-full bg-white shadow transition",
                    sameAsPhone ? "translate-x-7" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {!sameAsPhone ? (
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp (if different from phone)"
                className="mt-3 h-11 w-full rounded-2xl border bg-white px-3 text-sm outline-none"
              />
            ) : (
              <p className="mt-3 text-xs text-zinc-600">
                WhatsApp will use your phone: <span className="font-semibold">{phoneDigits ? `+${phoneDigits}` : "—"}</span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-900">Coverage zone</label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="h-11 w-full rounded-2xl border bg-white px-3 text-sm outline-none"
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-900">Delivery fee note (optional)</label>

            <div className="flex flex-wrap gap-2">
              {FEE_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => applyChip(c)}
                  className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {c}
                </button>
              ))}
            </div>

            <input
              value={feeNote}
              onChange={(e) => setFeeNote(e.target.value)}
              placeholder='e.g. "₦300–₦600 depending distance"'
              className="h-11 w-full rounded-2xl border bg-white px-3 text-sm outline-none"
            />
          </div>

          <button
            disabled={loading || !canSubmit}
            className={cn(
              "w-full h-11 rounded-2xl text-sm font-semibold",
              loading || !canSubmit
                ? "bg-zinc-200 text-zinc-500"
                : "bg-black text-white hover:bg-zinc-800"
            )}
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
              </span>
            ) : (
              "Submit application"
            )}
          </button>

          <p className="text-xs text-zinc-500">
            By applying, you agree to be contacted by buyers/vendors for delivery.
          </p>
        </form>
      </div>
    </div>
  );
}
