"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ChefHat, Settings, ShoppingBag, Store } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Me, RoleFlags, Vendor, VendorType } from "./types";
import { cn, defaultVendorNameFromEmail, normalizePhone } from "./utils";
import Field from "./Field";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
      {children}
    </p>
  );
}

export default function ProfileTab({
  roles,
  me,
  vendor,
  onVendorUpdated,
  onMeUpdated,
}: {
  roles: RoleFlags;
  me: Me | null;
  vendor: Vendor | null;
  onVendorUpdated: (v: Vendor) => void;
  onMeUpdated: (m: Me) => void;
}) {
  const [fullName, setFullName] = useState(me?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const nameDirty = (me?.full_name ?? "") !== fullName;

  async function saveName() {
    const next = fullName.trim();
    if (!next) return;

    setSavingName(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ data: { full_name: next } });
      if (error) throw error;

      const metadata = data.user?.user_metadata as Record<string, unknown> | undefined;

      onMeUpdated({
        id: data.user?.id ?? me?.id ?? "",
        email: data.user?.email ?? me?.email ?? null,
        full_name: typeof metadata?.full_name === "string" ? metadata.full_name : next,
      });
    } finally {
      setSavingName(false);
    }
  }

  const [vendorForm, setVendorForm] = useState({
    name: vendor?.name ?? "",
    whatsapp: vendor?.whatsapp ?? "",
    phone: vendor?.phone ?? "",
    location: vendor?.location ?? "",
    vendor_type: (vendor?.vendor_type ?? "student") as VendorType,
  });

  const [vendorTouched, setVendorTouched] = useState({
    name: false,
    whatsapp: false,
    phone: false,
    location: false,
  });

  const [vendorSaving, setVendorSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const vendorValidation = useMemo(() => {
    const errors: Record<string, string> = {};
    const name = vendorForm.name.trim();
    const whatsappDigits = normalizePhone(vendorForm.whatsapp);
    const phoneDigits = normalizePhone(vendorForm.phone);

    if (!name) errors.name = "Store/Display name is required.";
    if (vendorForm.whatsapp.trim() && whatsappDigits.length < 7) errors.whatsapp = "Enter a valid WhatsApp number.";
    if (vendorForm.phone.trim() && phoneDigits.length < 7) errors.phone = "Enter a valid phone number.";

    return { errors, canSave: Object.keys(errors).length === 0 };
  }, [vendorForm]);

  const vendorDirty = useMemo(() => {
    if (!vendor) return false;
    return (
      (vendor.name ?? "") !== vendorForm.name ||
      (vendor.whatsapp ?? "") !== vendorForm.whatsapp ||
      (vendor.phone ?? "") !== vendorForm.phone ||
      (vendor.location ?? "") !== vendorForm.location ||
      (vendor.vendor_type ?? "student") !== vendorForm.vendor_type
    );
  }, [vendor, vendorForm]);

  async function saveVendor() {
    if (!vendor) return;

    setVendorTouched({ name: true, whatsapp: true, phone: true, location: true });
    if (!vendorValidation.canSave) {
      setBanner({ type: "error", text: "Please fix the highlighted fields." });
      return;
    }

    setVendorSaving(true);
    setBanner(null);

    try {
      const payload = {
        name: vendorForm.name.trim(),
        whatsapp: vendorForm.whatsapp.trim() || null,
        phone: vendorForm.phone.trim() || null,
        location: vendorForm.location.trim() || null,
        vendor_type: vendorForm.vendor_type === "food" ? vendor.vendor_type : vendorForm.vendor_type,
      };

      const { error } = await supabase.from("vendors").update(payload).eq("id", vendor.id);
      if (error) throw error;

      onVendorUpdated({ ...vendor, ...payload });
      setBanner({ type: "success", text: "Vendor profile saved." });
      setVendorTouched({ name: false, whatsapp: false, phone: false, location: false });
    } catch (e) {
      setBanner({ type: "error", text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setVendorSaving(false);
    }
  }

  function cancelVendor() {
    if (!vendor) return;
    setVendorForm({
      name: vendor.name ?? "",
      whatsapp: vendor.whatsapp ?? "",
      phone: vendor.phone ?? "",
      location: vendor.location ?? "",
      vendor_type: (vendor.vendor_type ?? "student") as VendorType,
    });
    setVendorTouched({ name: false, whatsapp: false, phone: false, location: false });
    setBanner(null);
  }

  const vendErr = vendorValidation.errors;
  const isFoodVendor = roles.isFoodVendor;

  return (
    <div className="space-y-6">
      {banner ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm font-medium",
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : banner.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-zinc-200 bg-zinc-50 text-zinc-800",
          )}
          role="status"
        >
          {banner.text}
        </div>
      ) : null}

      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="grid gap-3">
          <Field
            label="Full name"
            value={fullName}
            onChange={setFullName}
            placeholder="e.g. Gratitude Olawale"
          />

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-400">Email</p>
            <input
              value={me?.email ?? ""}
              disabled
              readOnly
              className="w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-400 outline-none"
            />
            <p className="mt-1 text-[11px] text-zinc-400">Your JABU email cannot be changed.</p>
          </div>

          {nameDirty ? (
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFullName(me?.full_name ?? "")}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                disabled={savingName}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveName}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                  savingName ? "bg-zinc-200 text-zinc-500" : "bg-zinc-900 text-white hover:bg-zinc-800",
                )}
                disabled={savingName || !fullName.trim()}
              >
                {savingName ? "Saving..." : "Save name"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-100" />
          <SectionLabel>
            {roles.isVendor && vendor ? "Vendor Profile" : "Sell on JABU"}
          </SectionLabel>
          <div className="h-px flex-1 bg-zinc-100" />
        </div>

        {roles.isVendor && vendor ? (
          isFoodVendor ? (
            <div className="space-y-3 rounded-xl border bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">Food Vendor Portal</p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/vendor/orders"
                  className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
                >
                  <ShoppingBag className="h-4 w-4 shrink-0 text-zinc-400" /> Orders
                </Link>
                <Link
                  href="/vendor/menu"
                  className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
                >
                  <ChefHat className="h-4 w-4 shrink-0 text-zinc-400" /> Menu
                </Link>
                <Link
                  href="/vendor/setup"
                  className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
                >
                  <Settings className="h-4 w-4 shrink-0 text-zinc-400" /> Settings
                </Link>
                <Link
                  href={`/vendors/${vendor.id}`}
                  className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
                >
                  <Store className="h-4 w-4 shrink-0 text-zinc-400" /> Storefront
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <Field
                label="Store / Display name"
                value={vendorForm.name}
                onChange={(v) => setVendorForm((s) => ({ ...s, name: v }))}
                onBlur={() => setVendorTouched((t) => ({ ...t, name: true }))}
                placeholder={defaultVendorNameFromEmail(me?.email)}
                error={vendorTouched.name ? vendErr.name : undefined}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="WhatsApp"
                  value={vendorForm.whatsapp}
                  onChange={(v) => setVendorForm((s) => ({ ...s, whatsapp: v }))}
                  onBlur={() => setVendorTouched((t) => ({ ...t, whatsapp: true }))}
                  placeholder="+234 801 234 5678"
                  error={vendorTouched.whatsapp ? vendErr.whatsapp : undefined}
                />
                <Field
                  label="Phone"
                  value={vendorForm.phone}
                  onChange={(v) => setVendorForm((s) => ({ ...s, phone: v }))}
                  onBlur={() => setVendorTouched((t) => ({ ...t, phone: true }))}
                  placeholder="+234 701 234 5678"
                  error={vendorTouched.phone ? vendErr.phone : undefined}
                />
              </div>

              <Field
                label="Location"
                value={vendorForm.location}
                onChange={(v) => setVendorForm((s) => ({ ...s, location: v }))}
                onBlur={() => setVendorTouched((t) => ({ ...t, location: true }))}
                placeholder="e.g. JABU Campus / Male Hostels"
                error={vendorTouched.location ? vendErr.location : undefined}
              />

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400">Vendor type</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["mall", "student", "other"] as VendorType[]).map((t) => {
                    const active = vendorForm.vendor_type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setVendorForm((s) => ({ ...s, vendor_type: t }))}
                        className={cn(
                          "rounded-xl border py-2.5 text-sm font-semibold capitalize transition-colors",
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {vendorDirty ? (
                <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-white/95 px-4 py-3 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-zinc-500">
                      Unsaved changes
                      {!vendorValidation.canSave ? (
                        <span className="ml-1.5 font-semibold text-rose-600">- fix errors first</span>
                      ) : null}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={cancelVendor}
                        className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                        disabled={vendorSaving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveVendor}
                        disabled={vendorSaving || !vendorValidation.canSave}
                        className={cn(
                          "rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                          vendorSaving || !vendorValidation.canSave
                            ? "bg-zinc-200 text-zinc-500"
                            : "bg-zinc-900 text-white hover:bg-zinc-800",
                        )}
                      >
                        {vendorSaving ? "Saving..." : "Save vendor"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {!vendorDirty && vendor.id ? (
                <Link
                  href={`/vendors/${vendor.id}`}
                  className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:underline"
                >
                  View your storefront
                </Link>
              ) : null}
            </div>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-center">
            <p className="text-sm font-semibold text-zinc-900">Start selling on JABU Market</p>
            <p className="mt-1 text-xs text-zinc-500">Create a vendor profile to post listings and reach buyers on campus.</p>
            <Link
              href="/vendor/create"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Become a vendor
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
