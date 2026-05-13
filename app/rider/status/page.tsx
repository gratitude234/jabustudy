"use client";
// app/rider/status/page.tsx
// No auth required — phone-number based lookup

import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, CheckCircle2, Loader2, Phone, Truck, User } from "lucide-react";

type RiderStatus = {
  id: string;
  name: string | null;
  phone: string | null;
  zone: string | null;
  is_available: boolean;
  verified: boolean;
  pin_hash: string | null;
};

function normalizePhone(input: string) {
  return input.replace(/[^\d]/g, "");
}

export default function RiderStatusPage() {
  const [phone, setPhone] = useState("");
  const [looking, setLooking] = useState(false);
  const [rider, setRider] = useState<RiderStatus | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // PIN state
  const [pinVerified, setPinVerified] = useState(false);
  const [pinStep, setPinStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinWorking, setPinWorking] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const digits = normalizePhone(phone);
  const canLookup = digits.length >= 10;

  async function lookup() {
    if (!canLookup) return;
    setLooking(true);
    setLookupError(null);
    setRider(null);
    setSuccessMsg(null);

    try {
      // Try phone or whatsapp match
      const { data, error } = await supabase
        .from("riders")
        .select("id, name, phone, zone, is_available, verified, pin_hash")
        .or(`phone.eq.${digits},whatsapp.eq.${digits}`)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setLookupError(
          "No rider found with that number. Make sure you use the same number you registered with."
        );
        return;
      }

      setRider(data as RiderStatus);
      startPinFlow(data as RiderStatus);
    } catch (err: any) {
      setLookupError(err?.message ?? "Lookup failed. Please try again.");
    } finally {
      setLooking(false);
    }
  }

  async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function setupPin() {
    if (pinInput.length !== 4) { setPinError('PIN must be 4 digits'); return; }
    if (pinInput !== pinConfirm) { setPinError('PINs do not match'); return; }
    if (!rider) return;
    setPinWorking(true);
    setPinError(null);
    try {
      const hash = await hashPin(pinInput);
      const res = await fetch('/api/rider/pin/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rider_id: rider.id, pin_hash: hash }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Failed to set PIN');
      setRider({ ...rider, pin_hash: hash });
      setPinVerified(true);
      setPinStep('idle');
      setPinInput('');
      setPinConfirm('');
    } catch (e: any) {
      setPinError(e.message ?? 'Failed');
    } finally {
      setPinWorking(false);
    }
  }

  async function verifyPin() {
    if (pinInput.length !== 4) { setPinError('Enter your 4-digit PIN'); return; }
    if (!rider) return;
    setPinWorking(true);
    setPinError(null);
    try {
      const hash = await hashPin(pinInput);
      const res = await fetch('/api/rider/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rider_id: rider.id, pin_hash: hash }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error('Incorrect PIN. Try again.');
      setPinVerified(true);
      setPinStep('idle');
      setPinInput('');
    } catch (e: any) {
      setPinError(e.message ?? 'Incorrect PIN');
    } finally {
      setPinWorking(false);
    }
  }

  // Trigger PIN step after lookup
  function startPinFlow(r: RiderStatus) {
    setPinStep(r.pin_hash ? 'verify' : 'setup');
    setPinInput('');
    setPinConfirm('');
    setPinError(null);
  }

  async function toggleAvailability() {
    if (!rider) return;
    setToggling(true);
    setSuccessMsg(null);

    const next = !rider.is_available;

    try {
      const { error } = await supabase
        .from("riders")
        .update({ is_available: next })
        .eq("id", rider.id);

      if (error) throw error;

      setRider({ ...rider, is_available: next });
      setSuccessMsg(
        next
          ? "You're now marked as Available. Buyers can see you're ready."
          : "You're now marked as Busy. You won't appear as available."
      );
    } catch (err: any) {
      setLookupError(err?.message ?? "Update failed. Please try again.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-28 md:pb-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/delivery"
          className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Update Availability</h1>
          <p className="text-xs text-zinc-500">Riders only</p>
        </div>
      </div>

      {/* Lookup card */}
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-100">
            <Truck className="h-5 w-5 text-zinc-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Rider status</p>
            <p className="text-xs text-zinc-500">Enter your registered phone number</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-2xl border bg-zinc-50 px-3 py-2.5">
            <Phone className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setLookupError(null); setRider(null); setSuccessMsg(null); }}
              placeholder="e.g. 08012345678"
              className="w-full bg-transparent text-sm outline-none"
              inputMode="tel"
              onKeyDown={(e) => { if (e.key === "Enter") lookup(); }}
            />
          </div>

          {lookupError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {lookupError}
            </p>
          )}

          <button
            type="button"
            onClick={lookup}
            disabled={!canLookup || looking}
            className={cn(
              "w-full rounded-2xl py-3 text-sm font-semibold transition",
              !canLookup || looking
                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                : "bg-zinc-900 text-white hover:bg-zinc-700"
            )}
          >
            {looking ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Looking up…
              </span>
            ) : (
              "Find my profile"
            )}
          </button>
        </div>
      </div>

      {/* PIN step — shown after lookup, before availability controls */}
      {rider && !pinVerified && (
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
          <p className="text-sm font-bold text-zinc-900">
            {pinStep === 'setup' ? 'Set up a PIN' : 'Enter your PIN'}
          </p>
          <p className="text-xs text-zinc-500">
            {pinStep === 'setup'
              ? 'Create a 4-digit PIN to secure your rider profile.'
              : 'Enter your 4-digit PIN to continue.'}
          </p>

          <input
            type="number"
            inputMode="numeric"
            maxLength={4}
            value={pinInput}
            onChange={(e) => { setPinInput(e.target.value.slice(0, 4)); setPinError(null); }}
            placeholder={pinStep === 'setup' ? 'Choose a 4-digit PIN' : 'Enter PIN'}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm tracking-widest text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />

          {pinStep === 'setup' && (
            <input
              type="number"
              inputMode="numeric"
              maxLength={4}
              value={pinConfirm}
              onChange={(e) => { setPinConfirm(e.target.value.slice(0, 4)); setPinError(null); }}
              placeholder="Confirm PIN"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm tracking-widest text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          )}

          {pinError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{pinError}</p>
          )}

          <button
            type="button"
            disabled={pinWorking}
            onClick={pinStep === 'setup' ? setupPin : verifyPin}
            className={cn(
              "w-full rounded-2xl py-3 text-sm font-semibold transition",
              pinWorking ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" : "bg-zinc-900 text-white hover:bg-zinc-700"
            )}
          >
            {pinWorking ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {pinStep === 'setup' ? 'Setting up…' : 'Verifying…'}
              </span>
            ) : pinStep === 'setup' ? 'Set PIN' : 'Verify PIN'}
          </button>
        </div>
      )}

      {/* Rider found */}
      {rider && pinVerified && (
        <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">

          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100">
              <User className="h-5 w-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">{rider.name ?? "Unnamed rider"}</p>
              <p className="text-xs text-zinc-500">Zone: {rider.zone ?? "—"}</p>
              {rider.verified && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              )}
            </div>
          </div>

          {/* Current status display */}
          <div className={cn(
            "flex items-center justify-between rounded-2xl border px-4 py-3",
            rider.is_available
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          )}>
            <div>
              <p className={cn(
                "text-sm font-bold",
                rider.is_available ? "text-emerald-900" : "text-amber-900"
              )}>
                {rider.is_available ? "Available" : "Busy"}
              </p>
              <p className={cn(
                "text-xs mt-0.5",
                rider.is_available ? "text-emerald-700" : "text-amber-700"
              )}>
                {rider.is_available
                  ? "Buyers can see you're ready for deliveries"
                  : "You appear as unavailable to buyers"}
              </p>
            </div>
            <div className={cn(
              "h-6 w-6 rounded-full border-2",
              rider.is_available ? "bg-emerald-500 border-emerald-600" : "bg-amber-400 border-amber-500"
            )} />
          </div>

          {/* Toggle */}
          <button
            type="button"
            onClick={toggleAvailability}
            disabled={toggling}
            className={cn(
              "w-full rounded-2xl py-3.5 text-sm font-semibold transition",
              rider.is_available
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-emerald-600 text-white hover:bg-emerald-700",
              toggling && "opacity-60 cursor-not-allowed"
            )}
          >
            {toggling ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Updating…
              </span>
            ) : rider.is_available ? (
              "Mark as Busy"
            ) : (
              "Mark as Available"
            )}
          </button>

          {successMsg && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {successMsg}
            </div>
          )}

          <p className="text-center text-[11px] text-zinc-400">
            Your status updates immediately on the delivery page.
          </p>

          <Link
            href="/rider/my-deliveries"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 py-3 text-sm font-semibold text-zinc-700 no-underline hover:bg-zinc-100"
          >
            <Truck className="h-4 w-4" />
            View my deliveries →
          </Link>
        </div>
      )}

      {/* Not registered yet */}
      <div className="rounded-3xl border bg-zinc-50 p-4">
        <p className="text-xs font-semibold text-zinc-700">Not registered yet?</p>
        <p className="mt-1 text-xs text-zinc-500">
          Apply to become a delivery rider — admin will verify and add you to the directory.
        </p>
        <Link
          href="/rider/apply"
          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-xs font-semibold text-white no-underline hover:bg-zinc-800"
        >
          <Truck className="h-3.5 w-3.5" />
          Apply as a rider
        </Link>
      </div>
    </div>
  );
}