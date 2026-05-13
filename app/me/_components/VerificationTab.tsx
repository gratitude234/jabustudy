"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RoleFlags, Vendor } from "./types";
import { cn } from "./utils";
import Stepper from "./Stepper";

export default function VerificationTab({
  roles,
  vendor,
  onVendorUpdated,
}: {
  roles: RoleFlags;
  vendor: Vendor | null;
  onVendorUpdated: (v: Vendor) => void;
}) {
  type RequestStatus = "requested" | "under_review" | "approved" | "rejected";
  type RequestRow = {
    id: string;
    vendor_id: string;
    status: RequestStatus;
    note: string | null;
    rejection_reason: string | null;
    created_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
  };

  type DocRow = {
    id: string;
    vendor_id: string;
    doc_type: string;
    file_path: string;
    created_at: string;
  };

  const BUCKET = "vendor-verification";

  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState<RequestRow | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [banner, setBanner] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [docType, setDocType] = useState("id_card");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [note, setNote] = useState("");
  const [requesting, setRequesting] = useState(false);

  const isVerified = !!vendor?.verified || vendor?.verification_status === "verified";
  const pending = req?.status === "requested" || req?.status === "under_review";
  const canUploadDocs = !isVerified && !pending;
  const canDeleteDocs = !isVerified && !pending;

  const canRequest = !!vendor?.id && !isVerified && !pending && !!docs.length && (!req || req.status === "rejected");

  const step = useMemo(() => {
    if (isVerified) return 4;
    if (!req) return 1;
    if (req.status === "requested") return 2;
    if (req.status === "under_review") return 3;
    if (req.status === "approved") return 4;
    if (req.status === "rejected") return 1;
    return 1;
  }, [req, isVerified]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setBanner(null);
      setReq(null);
      setDocs([]);

      if (!roles.isVendor || !vendor?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data: r, error: rErr } = await supabase
          .from("vendor_verification_requests")
          .select("id,vendor_id,status,note,rejection_reason,created_at,reviewed_at,reviewed_by")
          .eq("vendor_id", vendor.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (rErr) throw rErr;
        const latest = (r?.[0] ?? null) as any;

        const { data: d, error: dErr } = await supabase
          .from("vendor_verification_docs")
          .select("id,vendor_id,doc_type,file_path,created_at")
          .eq("vendor_id", vendor.id)
          .order("created_at", { ascending: false });

        const docsRows = dErr ? [] : ((d ?? []) as any);

        if (!mounted) return;
        setReq(latest);
        setDocs(docsRows);
      } catch (e: any) {
        if (!mounted) return;
        setBanner({ type: "error", text: e?.message ?? "Failed to load verification data." });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [roles.isVendor, vendor?.id]);

  async function refreshStatus() {
    if (!roles.isVendor || !vendor?.id) return;

    const { data: r, error: rErr } = await supabase
      .from("vendor_verification_requests")
      .select("id,vendor_id,status,note,rejection_reason,created_at,reviewed_at,reviewed_by")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!rErr) {
      const latest = (r?.[0] ?? null) as any;
      setReq(latest);
    }

    const { data: v2 } = await supabase
      .from("vendors")
      .select("verified,verification_status,verified_at,rejected_at,rejection_reason")
      .eq("id", vendor.id)
      .maybeSingle();

    if (v2) onVendorUpdated({ ...vendor, ...(v2 as any) });
  }

  useEffect(() => {
    if (!roles.isVendor || !vendor?.id) return;
    if (isVerified) return;

    const t = setInterval(() => refreshStatus(), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.isVendor, vendor?.id, isVerified]);

  async function openDoc(path: string) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Could not open document." });
    }
  }

  async function deleteDoc(doc: { id: string; file_path: string }) {
    if (!vendor?.id) return;
    if (!canDeleteDocs) {
      setBanner({ type: "info", text: "You can’t delete documents while a request is pending review." });
      return;
    }

    setBanner(null);
    try {
      const { error: delRowErr } = await supabase.from("vendor_verification_docs").delete().eq("id", doc.id).eq("vendor_id", vendor.id);
      if (delRowErr) throw delRowErr;

      await supabase.storage.from(BUCKET).remove([doc.file_path]);

      setDocs((prev) => prev.filter((x) => x.id !== doc.id));
      setBanner({ type: "success", text: "Document deleted." });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Delete failed." });
    }
  }

  async function uploadDoc() {
    if (!vendor?.id) return;
    if (!file) return setBanner({ type: "error", text: "Choose a file to upload." });
    if (!canUploadDocs) return setBanner({ type: "info", text: "Uploads are locked while your request is being reviewed." });

    setUploading(true);
    setBanner(null);

    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const safeType = docType.replace(/[^\w-]/g, "_");
      const path = `${vendor.id}/${Date.now()}_${safeType}.${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from("vendor_verification_docs")
        .insert({ vendor_id: vendor.id, doc_type: docType, file_path: path })
        .select("id,vendor_id,doc_type,file_path,created_at")
        .single();

      if (insErr) throw insErr;

      setDocs((prev) => [row as any, ...prev]);
      setFile(null);
      setBanner({ type: "success", text: "Document uploaded." });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  async function submitRequest() {
    if (!vendor?.id) return;
    if (!docs.length) return setBanner({ type: "error", text: "Upload at least one document before requesting verification." });
    if (!canRequest) return setBanner({ type: "info", text: "You already have a pending request, or you’re verified." });

    setRequesting(true);
    setBanner(null);

    try {
      const { data: created, error: cErr } = await supabase
        .from("vendor_verification_requests")
        .insert({
          vendor_id: vendor.id,
          status: "requested",
          note: note.trim() || null,
          rejection_reason: null,
        })
        .select("id,vendor_id,status,note,rejection_reason,created_at,reviewed_at,reviewed_by")
        .single();

      if (cErr) throw cErr;

      await supabase.from("vendors").update({ verification_status: "requested" }).eq("id", vendor.id);

      setReq(created as any);
      setNote("");
      setBanner({ type: "success", text: "Verification requested. You’ll be reviewed soon." });

      onVendorUpdated({ ...vendor, verification_status: "requested", verified: false });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? "Request failed." });
    } finally {
      setRequesting(false);
    }
  }

  if (!roles.isVendor || !vendor) {
    return (
      <div className="rounded-2xl border p-3">
        <div className="text-sm font-semibold text-zinc-900">Verification</div>
        <p className="mt-1 text-sm text-zinc-700">Verification is for vendors. Create a vendor profile to request verification.</p>
        <Link href="/vendor/create" className="mt-3 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
          Become a vendor
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 rounded-xl bg-zinc-100" />
        <div className="h-24 rounded-2xl bg-zinc-100" />
        <div className="h-40 rounded-2xl bg-zinc-100" />
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm font-semibold text-emerald-900">✅ Vendor verified</div>
          <p className="mt-1 text-sm text-emerald-800">Your store is verified. Customers will see your verified badge.</p>

          <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-sm text-emerald-900">
            <div>
              <span className="text-emerald-700">Store:</span> <span className="font-semibold">{vendor?.name ?? "—"}</span>
            </div>
            <div className="mt-1">
              <span className="text-emerald-700">Verified at:</span> <span className="font-semibold">{vendor?.verified_at ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-3">
          <div className="text-sm font-semibold text-zinc-900">Next</div>
          <p className="mt-1 text-sm text-zinc-700">Focus on improving your store profile and listings.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/me?tab=profile" className="inline-flex items-center justify-center rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
              Edit profile
            </Link>
            <Link href="/my-listings" className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
              My listings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Explanatory header for normal vendors */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 flex items-start gap-2">
        <span className="text-base leading-none mt-0.5">✓</span>
        <p className="text-sm text-zinc-700">
          <span className="font-semibold">Verified vendors</span> get a ✓ badge on all listings and rank higher in search results.
        </p>
      </div>

      {banner ? (
        <div
          className={cn(
            "rounded-2xl border p-3 text-sm",
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : banner.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-zinc-200 bg-zinc-50 text-zinc-800"
          )}
          role="status"
        >
          {banner.text}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-zinc-50 p-4">
        <p className="text-sm font-semibold text-zinc-900">
          Why get verified?
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-zinc-600">
          <li>✓ Verified badge on all your listings</li>
          <li>✓ Appear higher in search results</li>
          <li>✓ Buyers trust verified sellers more</li>
          <li>✓ Priority support from the Jabumarket team</li>
        </ul>
      </div>

      <Stepper step={step} req={req} vendor={vendor} />

      <div className="rounded-2xl border p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">1) Upload documents</div>
            <p className="mt-1 text-sm text-zinc-600">Upload clear proof to speed up approval (ID card, student ID, business doc, etc).</p>
          </div>
          {pending ? (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">Locked (pending review)</span>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <div className="text-xs font-semibold text-zinc-700">Doc type</div>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className={cn("mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none", canUploadDocs ? "border-zinc-200 bg-white focus:border-zinc-400" : "border-zinc-200 bg-zinc-50 text-zinc-400")}
              disabled={!canUploadDocs}
            >
              <option value="id_card">ID Card</option>
              <option value="student_id">Student ID</option>
              <option value="business_doc">Business Document</option>
              <option value="utility_bill">Utility Bill</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <div className="text-xs font-semibold text-zinc-700">File</div>
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={!canUploadDocs}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={cn("mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none", !canUploadDocs ? "border-zinc-200 bg-zinc-50 text-zinc-400" : "border-zinc-200 bg-white focus:border-zinc-400")}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={uploadDoc}
          disabled={uploading || !file || !canUploadDocs}
          className={cn(
            "mt-3 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold",
            uploading || !file || !canUploadDocs ? "bg-zinc-200 text-zinc-600" : "bg-zinc-900 text-white hover:bg-zinc-800"
          )}
        >
          {uploading ? "Uploading…" : "Upload document"}
        </button>

        {pending ? <p className="mt-2 text-xs text-zinc-500">Your request is being reviewed — uploads and deletions are locked to keep your submission stable.</p> : null}

        <div className="mt-4">
          <div className="text-xs font-semibold text-zinc-700">Uploaded documents</div>

          {docs.length ? (
            <div className="mt-2 space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">{d.doc_type.replace(/_/g, " ")}</div>
                    <div className="truncate text-xs text-zinc-500">{d.file_path}</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openDoc(d.file_path)}
                      className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteDoc({ id: d.id, file_path: d.file_path })}
                      disabled={!canDeleteDocs}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-xs font-semibold",
                        !canDeleteDocs ? "bg-zinc-100 text-zinc-400" : "bg-white text-rose-700 hover:bg-rose-50 border-rose-200"
                      )}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">No documents uploaded yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">2) Request verification</div>
            <p className="mt-1 text-sm text-zinc-600">When you request, admins will review your docs and approve or reject with a reason.</p>
          </div>

          {req ? (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">Status: {req.status.replace(/_/g, " ")}</span>
          ) : null}
        </div>

        {req?.status === "rejected" ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <div className="font-semibold">Rejected</div>
            <div className="mt-1">
              Reason: <span className="font-medium">{req.rejection_reason || vendor.rejection_reason || "—"}</span>
            </div>
            <div className="mt-2 text-rose-700">Fix your docs/details and submit a new request.</div>
          </div>
        ) : null}

        {req && (req.status === "requested" || req.status === "under_review" || req.status === "approved") ? (
          <div className="mt-3 rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-800">
            <div className="font-semibold">Request in progress</div>
            <div className="mt-1 text-zinc-700">
              Your request is <span className="font-medium">{req.status.replace(/_/g, " ")}</span>. You don’t need to submit again.
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block">
              <div className="text-xs font-semibold text-zinc-700">Note (optional)</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything admins should know? e.g. ‘I’m a campus vendor at male hostel gate.’"
                className="mt-1 min-h-[88px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </label>

            <button
              type="button"
              onClick={submitRequest}
              disabled={!canRequest || requesting}
              className={cn(
                "inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold",
                !canRequest || requesting ? "bg-zinc-200 text-zinc-600" : "bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              {requesting ? "Submitting…" : "Request verification"}
            </button>

            {!docs.length ? <p className="text-xs text-zinc-500">Upload at least one document to enable request.</p> : null}
          </div>
        )}
      </div>

      <div className="rounded-2xl border p-3">
        <div className="text-sm font-semibold text-zinc-900">Current status</div>
        <p className="mt-1 text-sm text-zinc-700">
          {isVerified ? "✅ You’re verified." : req ? `Your latest request is: ${req.status.replace(/_/g, " ")}.` : "No request submitted yet."}
        </p>
      </div>
    </div>
  );
}