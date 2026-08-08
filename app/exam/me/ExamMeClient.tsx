"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  LockKeyhole,
  LogOut,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ExamDeviceSecurityOverview } from "@/lib/examSprint/device";
import { formatNaira } from "@/lib/utils";
import ExamCommunityCard from "../_components/ExamCommunityCard";

type SecurityPayload = {
  ok?: boolean;
  security?: ExamDeviceSecurityOverview;
  message?: string;
};

function formatPassDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function lastSeenLabel(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently used";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(timestamp));
}

export default function ExamMeClient({
  name,
  email,
  passActive,
  passActiveUntil,
  passWeeklyPriceNaira,
  returnTo,
  communityHref,
}: {
  name: string;
  email: string;
  passActive: boolean;
  passActiveUntil: string | null;
  passWeeklyPriceNaira: number;
  returnTo: string;
  communityHref: string | null;
}) {
  const [security, setSecurity] = useState<ExamDeviceSecurityOverview | null>(null);
  const [loadingSecurity, setLoadingSecurity] = useState(true);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const passEnd = formatPassDate(passActiveUntil);

  const loadSecurity = useCallback(async () => {
    setLoadingSecurity(true);
    setSecurityError(null);
    try {
      const response = await fetch("/api/exam/session", { cache: "no-store" });
      const data = await response.json().catch(() => null) as SecurityPayload | null;
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent("/exam/me")}`);
        return;
      }
      if (!response.ok || !data?.ok || !data.security) throw new Error(data?.message || "Could not load your trusted devices.");
      setSecurity(data.security);
    } catch (cause) {
      setSecurityError(cause instanceof Error ? cause.message : "Could not load your trusted devices.");
    } finally {
      setLoadingSecurity(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSecurity(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSecurity]);

  async function runDeviceAction(action: "takeover" | "trust_current") {
    if (switching) return;
    setSwitching(true);
    setSecurityError(null);
    try {
      const response = await fetch("/api/exam/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => null) as SecurityPayload | null;
      if (!response.ok || !data?.ok || !data.security) throw new Error(data?.message || "Could not switch this device.");
      setSecurity(data.security);
    } catch (cause) {
      setSecurityError(cause instanceof Error ? cause.message : "Could not switch this device.");
    } finally {
      setSwitching(false);
    }
  }

  async function signOutDevice(deviceId: string) {
    if (removingId) return;
    setRemovingId(deviceId);
    setSecurityError(null);
    try {
      const response = await fetch(`/api/exam/session/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Could not sign out that device.");

      // If this phone was waiting for an available slot, claim the newly freed
      // slot immediately so the student does not have to repeat another step.
      const trustResponse = await fetch("/api/exam/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trust_current" }),
      });
      const trustData = await trustResponse.json().catch(() => null) as SecurityPayload | null;
      if (trustResponse.ok && trustData?.ok && trustData.security) setSecurity(trustData.security);
      else await loadSecurity();
    } catch (cause) {
      setSecurityError(cause instanceof Error ? cause.message : "Could not sign out that device.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await fetch("/api/exam/session/logout", { method: "POST" }).catch(() => null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.assign("/login");
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : "Could not log you out. Please try again.");
      setLoggingOut(false);
    }
  }

  const sessionReady = security?.available === false || security?.state === "ok";
  const currentInitial = name.trim().charAt(0).toUpperCase() || "S";

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="account-heading">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground">{currentInitial}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Your account</p>
            <h1 id="account-heading" className="mt-0.5 truncate text-lg font-extrabold">{name}</h1>
            {email ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{email}</p> : null}
          </div>
          <UserRound className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="pass-heading">
        <div className="flex items-start gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${passActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-primary/10 text-primary"}`}>
            {passActive ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Exam Sprint pass</p>
            <h2 id="pass-heading" className="mt-0.5 text-sm font-extrabold">{passActive ? "Full access active" : "Free access"}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {passActive
                ? passEnd ? `Your full mocks and corrections are available through ${passEnd}.` : "Your full mocks and corrections are active."
                : "You get one free 10-question diagnostic every 5 hours. The next check unlocks 5 hours after the last one starts and free checks do not stack; full mocks require an Exam Sprint pass."}
            </p>
            {!passActive ? (
              <Link href="/study/billing?offer=exam-sprint&returnTo=/exam/me" className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-primary no-underline hover:underline">
                View passes · from {formatNaira(passWeeklyPriceNaira)} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="devices-heading">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Security</p>
              <h2 id="devices-heading" className="mt-0.5 text-base font-extrabold">Trusted devices</h2>
              <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">Use up to 2 devices. Only one can actively use Exam Sprint at a time.</p>
            </div>
            {security?.available ? <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{security.devices.length}/{security.maxDevices}</span> : null}
          </div>

          {loadingSecurity ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-secondary/50 px-3 py-3 text-xs font-semibold text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" /> Checking this device…</div>
          ) : securityError ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300" role="alert">
              {securityError}
              <button type="button" onClick={() => void loadSecurity()} className="ml-2 font-extrabold underline">Try again</button>
            </div>
          ) : security?.available === false ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-secondary/50 px-3 py-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>Device controls are being prepared. Your existing Exam Sprint access still works normally.</span></div>
          ) : security ? (
            <>
              {security.state === "session_in_use" ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  <div className="flex items-start gap-2.5"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="text-xs font-extrabold">Exam Sprint is active on {security.activeDeviceLabel || "another device"}</p><p className="mt-0.5 text-[11px] leading-4 opacity-75">Switching here stops the other device from saving new Exam Sprint activity. A running mock timer will not pause.</p></div></div>
                  <button type="button" onClick={() => void runDeviceAction("takeover")} disabled={switching} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-60">{switching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />} Use Exam Sprint on this device</button>
                </div>
              ) : security.state === "device_limit" ? (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="text-xs font-extrabold">2 devices are already trusted</p><p className="mt-0.5 text-[11px] leading-4 opacity-75">Sign out a device below. This phone will take the newly available slot.</p></div></div>
              ) : security.state === "device_revoked" || security.state === "device_required" ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  <div className="flex items-start gap-2.5"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="text-xs font-extrabold">This device is not trusted</p><p className="mt-0.5 text-[11px] leading-4 opacity-75">Trust it again to use timed mocks and corrections here.</p></div></div>
                  <button type="button" onClick={() => void runDeviceAction("trust_current")} disabled={switching} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-60">{switching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />} Trust this device</button>
                </div>
              ) : null}

              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                {security.devices.length > 0 ? security.devices.map((device, index) => (
                  <div key={device.id} className={`flex min-h-[4.25rem] items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-t border-border" : ""}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${device.isCurrent ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}><MonitorSmartphone className="h-4 w-4" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5"><span className="truncate text-xs font-bold">{device.label}</span>{device.isCurrent ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">This device</span> : null}{device.isActive ? <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Active</span> : null}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">Last used {lastSeenLabel(device.lastSeenAt)}</span>
                    </span>
                    {!device.isCurrent ? (
                      <button type="button" onClick={() => void signOutDevice(device.id)} disabled={Boolean(removingId)} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/25">{removingId === device.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <LogOut className="h-3.5 w-3.5" aria-hidden="true" />} Sign out</button>
                    ) : null}
                  </div>
                )) : <p className="px-3 py-4 text-xs text-muted-foreground">No trusted devices are listed yet.</p>}
              </div>

              <p className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> Changing between Wi-Fi and mobile data will not create a new trusted device.</p>
            </>
          ) : null}
        </div>
      </section>

      {sessionReady ? (
        <Link href={returnTo} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground no-underline shadow-sm">
          {returnTo === "/exam" ? "Return to Exam Sprint" : "Continue where you left off"} <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}

      <ExamCommunityCard href={communityHref} compact />

      <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="logout-heading">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><LogOut className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="logout-heading" className="text-sm font-extrabold">Log out of JabuStudy</h2>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">This signs you out and removes this browser from your trusted Exam Sprint devices.</p>
            <button type="button" onClick={() => void handleLogout()} disabled={loggingOut} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/45">{loggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <LogOut className="h-3.5 w-3.5" aria-hidden="true" />} {loggingOut ? "Logging out…" : "Log out"}</button>
            {logoutError ? <p className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-300" role="alert">{logoutError}</p> : null}
          </div>
        </div>
      </section>
    </>
  );
}
