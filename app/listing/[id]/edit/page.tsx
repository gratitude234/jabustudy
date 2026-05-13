"use client";
// app/listing/[id]/edit/page.tsx
import { cn } from "@/lib/utils";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ListingRow } from "@/lib/types";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  MapPin,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const CATEGORIES = [
  "Phones",
  "Laptops",
  "Electronics",
  "Fashion",
  "Provisions",
  "Books & Stationery",
  "Food",
  "Beauty",
  "Services",
  "Repairs",
  "Tutoring",
  "Others",
] as const;

type ListingType = "product" | "service";
type StatusType = "active" | "sold" | "inactive";

const MAX_IMAGE_MB = 5;
const MIN_TITLE = 8;
const MIN_DESC_SERVICE = 20;

function onlyDigits(s: string) {
  return (s || "").replace(/[^\d]/g, "");
}

function formatDigitsAsNairaInput(digits: string) {
  const clean = onlyDigits(digits);
  if (!clean) return "";
  const n = Number(clean);
  if (!Number.isFinite(n)) return clean;
  return n.toLocaleString("en-NG");
}

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function safeUuid() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeNext(next: string) {
  const n = (next || "").trim();
  if (!n) return "/me";
  if (!n.startsWith("/")) return "/me";
  if (n.startsWith("//")) return "/me";

  let decoded = n;
  try {
    decoded = decodeURIComponent(n);
  } catch {
    decoded = n;
  }
  const lowered = decoded.toLowerCase();
  if (lowered.includes("http://") || lowered.includes("https://")) return "/me";

  return n;
}

async function compressImage(
  file: File,
  opts?: { maxDim?: number; quality?: number }
): Promise<File> {
  const maxDim = opts?.maxDim ?? 1600;
  const quality = opts?.quality ?? 0.82;

  if (!file.type.startsWith("image/")) return file;

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb <= 1.2) return file;

  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to read image"));
      el.src = imgUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return file;

    const scale = Math.min(1, maxDim / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) return file;

    const compressed = new File(
      [blob],
      file.name.replace(/\.\w+$/, "") + ".jpg",
      { type: "image/jpeg", lastModified: Date.now() }
    );

    if (compressed.size >= file.size) return file;
    return compressed;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

function Skeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
      <div className="sticky top-0 z-10 -mx-4 border-b bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="h-9 w-28 animate-pulse rounded-full bg-zinc-100" />
          <div className="space-y-1 text-right">
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-4 sm:p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-100" />
        <div className="mt-3 aspect-[4/3] w-full animate-pulse rounded-3xl bg-zinc-100" />
      </div>

      <div className="rounded-3xl border bg-white p-4 sm:p-5">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-100" />
        <div className="mt-3 h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
        <div className="mt-3 h-24 w-full animate-pulse rounded-2xl bg-zinc-100" />
      </div>

      <div className="rounded-3xl border bg-white p-4 sm:p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-10 w-full animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      </div>

      <div className="h-12 w-full animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}

function Modal({
  open,
  title,
  children,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl p-3 sm:inset-0 sm:flex sm:items-center sm:justify-center">
        <div className="w-full rounded-3xl border bg-white p-4 shadow-xl sm:max-w-lg">
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function EditListingPage() {
  const router = useRouter();
  const routeParams = useParams<{ id?: string | string[] }>();
  const id = Array.isArray(routeParams?.id) ? routeParams.id[0] : routeParams?.id;

  if (!id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border bg-white p-6 text-sm text-zinc-700">
          Invalid listing URL.
        </div>
      </div>
    );
  }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [banner, setBanner] = useState<{ type: "error" | "success" | "info"; text: string } | null>(
    null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [original, setOriginal] = useState<ListingRow | null>(null);

  // form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listingType, setListingType] = useState<ListingType>("product");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Phones");

  // Price UX: keep digits-only state (formatted display)
  const [priceDigits, setPriceDigits] = useState<string>("");
  const [priceLabel, setPriceLabel] = useState<string>("");

  const [location, setLocation] = useState<string>("");
  const [negotiable, setNegotiable] = useState(false);
  const [status, setStatus] = useState<StatusType>("active");

  // image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // upload progress (smooth fake progress)
  const [progress, setProgress] = useState(0);
  const progressTimerRef = useRef<number | null>(null);

  // archive modal
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const previewUrl = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function stopProgressTimer() {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function startFakeProgress() {
    stopProgressTimer();
    setProgress(5);
    progressTimerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        return Math.min(90, p + (p < 30 ? 6 : 2));
      });
    }, 220);
  }

  function finishProgress() {
    stopProgressTimer();
    setProgress(100);
    window.setTimeout(() => setProgress(0), 600);
  }

  const priceDisabled = priceLabel.trim().length > 0;
  const priceLabelDisabled = priceDigits.trim().length > 0;

  const titleCount = title.trim().length;
  const descCount = description.trim().length;

  const dirty = useMemo(() => {
    if (!original) return false;

    const norm = (v: any) => (v ?? "").toString().trim();

    const originalPriceDigits =
      original.price === null || original.price === undefined ? "" : String(original.price);

    const same =
      norm(original.title) === norm(title) &&
      norm(original.description) === norm(description) &&
      norm(original.listing_type) === norm(listingType) &&
      norm(original.category) === norm(category) &&
      norm(originalPriceDigits) === norm(priceDigits) &&
      norm(original.price_label) === norm(priceLabel) &&
      norm(original.location) === norm(location) &&
      Boolean(original.negotiable) === Boolean(negotiable) &&
      (original.status ?? "active") === status;

    return !same || Boolean(imageFile);
  }, [
    original,
    title,
    description,
    listingType,
    category,
    priceDigits,
    priceLabel,
    location,
    negotiable,
    status,
    imageFile,
  ]);

  // warn on refresh/close if dirty
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty || saving) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saving]);

  // Load listing + permission check
  useEffect(() => {
    (async () => {
      setBanner(null);
      setErrors({});
      setLoading(true);

      const nextPath = normalizeNext(`/listing/${id}/edit`);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        const m = String(userErr.message ?? "").toLowerCase();
        if (m.includes("auth session missing") || m.includes("session missing")) {
          router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
          return;
        }
      }

      const user = userData.user;
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      const { data: vendor, error: vErr } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (vErr || !vendor?.id) {
        setBanner({
          type: "error",
          text: "You need a vendor profile before editing listings. Complete your profile first.",
        });
        setLoading(false);
        return;
      }

      setVendorId(vendor.id);

      const { data: listing, error: lErr } = await supabase
        .from("listings")
        .select(
          "id,title,description,listing_type,category,price,price_label,location,image_url,negotiable,vendor_id,status"
        )
        .eq("id", id)
        .single();

      if (lErr || !listing) {
        setBanner({ type: "error", text: lErr?.message ?? "Listing not found." });
        setLoading(false);
        return;
      }

      const row = listing as ListingRow;

      if (row.vendor_id !== vendor.id) {
        setBanner({ type: "error", text: "You don’t have permission to edit this listing." });
        setLoading(false);
        return;
      }

      setOriginal(row);

      setTitle(row.title ?? "");
      setDescription(row.description ?? "");
      setListingType(row.listing_type);
      setCategory(((row.category as any) ?? "Phones") as any);

      setPriceDigits(row.price !== null && row.price !== undefined ? String(row.price) : "");
      setPriceLabel(row.price_label ?? "");
      setLocation(row.location ?? "");
      setNegotiable(Boolean(row.negotiable));
      setStatus((row.status ?? "active") as StatusType);

      setLoading(false);
    })();
  }, [id, router]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function setToast(type: "error" | "success" | "info", text: string) {
    setBanner({ type, text });
  }

  function validate() {
    const next: Record<string, string> = {};
    setBanner(null);

    if (!title.trim()) next.title = "Title is required.";
    else if (title.trim().length < MIN_TITLE)
      next.title = `Title should be at least ${MIN_TITLE} characters.`;

    if (listingType === "service" && description.trim().length > 0 && description.trim().length < MIN_DESC_SERVICE) {
      next.description = `For services, add more detail (min ${MIN_DESC_SERVICE} chars).`;
    }

    if (priceDigits.trim() && !/^\d+$/.test(priceDigits.trim())) next.price = "Price must be digits only.";
    if (priceDigits.trim() && priceLabel.trim()) {
      next.price = "Use either Price OR Price label, not both.";
      next.priceLabel = "Use either Price OR Price label, not both.";
    }

    if (imageFile) {
      const sizeMb = imageFile.size / (1024 * 1024);
      if (sizeMb > MAX_IMAGE_MB) next.image = `Image too large. Max ${MAX_IMAGE_MB}MB.`;
      if (!imageFile.type.startsWith("image/")) next.image = "Invalid file type.";
    }

    setErrors(next);
    return Object.keys(next).filter((k) => next[k]).length === 0;
  }

  function onPickFile(f: File) {
    setErrors((p) => ({ ...p, image: "" }));
    setBanner(null);

    if (!f.type.startsWith("image/")) {
      setErrors((p) => ({ ...p, image: "Please upload an image file (JPG/PNG)." }));
      return;
    }
    const sizeMb = f.size / (1024 * 1024);
    if (sizeMb > MAX_IMAGE_MB) {
      setErrors((p) => ({ ...p, image: `Image too large. Max ${MAX_IMAGE_MB}MB.` }));
      return;
    }
    setImageFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    onPickFile(f);
  }

  async function uploadImageToStorage(file: File, userId: string) {
    setUploading(true);
    startFakeProgress();
    try {
      setProgress(10);
      const compressed = await compressImage(file, { maxDim: 1600, quality: 0.82 });
      setProgress((p) => Math.max(p, 25));

      const path = `listings/${userId}/${safeUuid()}.jpg`;

      const up = await supabase.storage.from("listing-images").upload(path, compressed, {
        cacheControl: "3600",
        upsert: false,
        contentType: compressed.type || "image/jpeg",
      });

      if (up.error) throw up.error;

      setProgress((p) => Math.max(p, 92));
      const pub = supabase.storage.from("listing-images").getPublicUrl(path);
      return pub.data.publicUrl as string;
    } finally {
      setUploading(false);
      finishProgress();
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!vendorId || !original) return;

    setErrors({});
    setBanner(null);

    if (!validate()) return;

    setSaving(true);
    try {
      let imageUrl: string | null = original.image_url;

      // Upload new image if selected
      if (imageFile) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          router.replace(`/login?next=${encodeURIComponent(normalizeNext(`/listing/${id}/edit`))}`);
          return;
        }

        imageUrl = await uploadImageToStorage(imageFile, userId);
      }

      const priceInt =
        priceDigits.trim() === ""
          ? null
          : Number.isFinite(Number(priceDigits))
          ? parseInt(priceDigits, 10)
          : null;

      const { error } = await supabase
        .from("listings")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          listing_type: listingType,
          category,
          price: priceInt,
          price_label: priceLabel.trim() || null,
          location: location.trim() || null,
          image_url: imageUrl,
          negotiable,
          status,
        })
        .eq("id", id)
        .eq("vendor_id", vendorId);

      if (error) throw error;

      // If price dropped, fire-and-forget notification to saved-listing users
      const oldPrice = original.price;
      if (priceInt !== null && oldPrice !== null && priceInt < oldPrice) {
        void fetch("/api/marketplace/price-drop-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing_id: id, old_price: oldPrice, new_price: priceInt }),
        }).catch(() => {});
      }

      setToast("success", "Saved ✅ Redirecting…");
      router.replace(`/listing/${id}`);
      router.refresh();
    } catch (err: any) {
      setToast("error", err?.message ?? "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  function onBack() {
    if (dirty && !saving) {
      const ok = confirm("You have unsaved changes. Leave without saving?");
      if (!ok) return;
    }
    router.back();
  }

  async function archiveListing() {
    if (!vendorId) return;
    setSaving(true);
    setBanner(null);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: "inactive" })
        .eq("id", id)
        .eq("vendor_id", vendorId);

      if (error) throw error;

      setToast("success", "Listing archived ✅");
      router.replace("/my-listings");
      router.refresh();
    } catch (err: any) {
      setToast("error", err?.message ?? "Failed to archive listing.");
    } finally {
      setSaving(false);
      setShowDelete(false);
      setConfirmText("");
    }
  }

  const canSave = useMemo(() => {
    if (!dirty) return false;
    if (saving || uploading) return false;
    if (title.trim().length < MIN_TITLE) return false;
    if (priceDigits.trim() && !/^\d+$/.test(priceDigits.trim())) return false;
    if (priceDigits.trim() && priceLabel.trim()) return false;
    return true;
  }, [dirty, saving, uploading, title, priceDigits, priceLabel]);

  const previewPrice =
    priceDigits.trim() !== ""
      ? formatNaira(parseInt(priceDigits, 10))
      : priceLabel.trim() || "Contact for price";

  if (loading) return <Skeleton />;

  // If we failed permission/vendor/listing load
  if (!original || !vendorId) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
        <div className="rounded-3xl border bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border bg-zinc-50">
              <AlertTriangle className="h-5 w-5 text-zinc-800" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-zinc-900">Can’t open edit page</p>
              <p className="mt-1 text-sm text-zinc-600">
                {banner?.text ?? "Something went wrong. Try again or go back."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => router.back()}
              className="rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Go back
            </button>
            <button
              onClick={() => router.push("/my-listings")}
              className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              My Listings
            </button>
          </div>

          <div className="mt-3">
            <button
              onClick={() => router.push("/me")}
              className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Go to Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bannerTone =
    banner?.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : banner?.type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-zinc-200 bg-zinc-50 text-zinc-800";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
      {/* Delete (archive) modal */}
      <Modal open={showDelete} title="Archive this listing?">
        <p className="text-sm text-zinc-700">
          This will hide the listing from Explore. You can still find it in My Listings.
        </p>

        <div className="mt-3 rounded-2xl border bg-zinc-50 p-3">
          <p className="text-xs font-semibold text-zinc-900">Type DELETE to confirm</p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
            placeholder="DELETE"
          />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setShowDelete(false);
              setConfirmText("");
            }}
            disabled={saving}
            className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={archiveListing}
            disabled={saving || confirmText.trim().toUpperCase() !== "DELETE"}
            className="rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Working…</span> : "Archive listing"}
          </button>
        </div>
      </Modal>

      {/* Top bar */}
      <div className="sticky top-0 z-10 -mx-4 border-b bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold text-zinc-900">Edit listing</p>
            <p className="text-xs text-zinc-500">
              {saving ? "Saving…" : uploading ? "Uploading image…" : dirty ? "Unsaved changes" : "All changes saved"}
            </p>
          </div>
        </div>

        {(saving || uploading) && progress > 0 ? (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-black transition-[width] duration-200"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {uploading ? "Optimizing & uploading image…" : "Saving changes…"}
            </p>
          </div>
        ) : null}

        {banner ? (
          <div className={cn("mt-3 rounded-2xl border p-3 text-sm", bannerTone)} role="status" aria-live="polite">
            <div className="flex items-start gap-2">
              {banner.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
              ) : banner.type === "error" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4" />
              ) : (
                <ShieldCheck className="mt-0.5 h-4 w-4" />
              )}
              <div className="flex-1">{banner.text}</div>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="rounded-xl border bg-white/70 p-2 hover:bg-white"
                aria-label="Close message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* 1) Photo */}
      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">1) Photo</h2>
            <p className="mt-0.5 text-xs text-zinc-600">Update your photo to increase trust.</p>
          </div>

          {imageFile ? (
            <button
              type="button"
              onClick={() => setImageFile(null)}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          ) : null}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "mt-3 overflow-hidden rounded-3xl border bg-zinc-50 transition",
            dragOver && "ring-2 ring-black/10 border-zinc-300"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
            }}
            className="hidden"
          />

          <button type="button" onClick={openFilePicker} className="group relative w-full">
            <div className="relative aspect-[4/3] w-full bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl ?? original.image_url ?? "https://placehold.co/1200x900?text=Listing+photo"}
                alt="Listing photo preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-white">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Tap to change photo</p>
                    <p className="text-xs text-white/80">or drag & drop</p>
                  </div>
                </div>

                <span className="rounded-2xl bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
                  {imageFile ? "Replace" : "Change"}
                </span>
              </div>
            </div>
          </button>
        </div>

        {errors.image ? <p className="mt-2 text-xs text-red-600">{errors.image}</p> : null}
        <p className="mt-2 text-xs text-zinc-500">
          PNG/JPG • max {MAX_IMAGE_MB}MB • we auto-optimize photos for faster upload.
        </p>
      </section>

      {/* 2) Details */}
      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">2) Details</h2>
        <p className="mt-0.5 text-xs text-zinc-600">Clear details = more messages.</p>

        {/* Type segmented */}
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-700">Type</p>
          <div className="mt-2 grid grid-cols-2 rounded-2xl border bg-white p-1">
            <button
              type="button"
              onClick={() => setListingType("product")}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold",
                listingType === "product" ? "bg-black text-white" : "text-zinc-800 hover:bg-zinc-50"
              )}
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => setListingType("service")}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold",
                listingType === "service" ? "bg-black text-white" : "text-zinc-800 hover:bg-zinc-50"
              )}
            >
              Service
            </button>
          </div>
        </div>

        {/* Category chips */}
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-700">Category</p>
          <div className="mt-2 -mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            <style>{`div::-webkit-scrollbar{display:none}`}</style>
            <div className="flex w-max gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold",
                    category === c ? "bg-black text-white border-black" : "bg-white text-zinc-800 hover:bg-zinc-50"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status segmented */}
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-700">Status</p>
          <div className="mt-2 grid grid-cols-3 rounded-2xl border bg-white p-1">
            {(["active", "sold", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-semibold capitalize",
                  status === s ? "bg-black text-white" : "text-zinc-800 hover:bg-zinc-50"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            “Inactive” hides it from Explore. “Sold” keeps it visible but marked.
          </p>
        </div>

        {/* Title */}
        <div className="mt-4">
          <label className="text-xs font-medium text-zinc-700">
            Title <span className="text-red-600">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. iPhone 11 64GB — clean, no issues"
            className={cn("mt-1 w-full rounded-2xl border px-3 py-3 text-sm", errors.title && "border-red-300")}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.title ? <p className="text-xs text-red-600">{errors.title}</p> : <span />}
            <p className={cn("text-[11px]", titleCount < MIN_TITLE ? "text-amber-700" : "text-zinc-500")}>
              {titleCount}/{MIN_TITLE}+ recommended
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="mt-3">
          <label className="text-xs font-medium text-zinc-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Condition, what’s included, any faults, delivery options, etc."
            className={cn(
              "mt-1 min-h-[120px] w-full rounded-2xl border px-3 py-3 text-sm",
              errors.description && "border-red-300"
            )}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.description ? <p className="text-xs text-red-600">{errors.description}</p> : <span />}
            {listingType === "service" ? (
              <p className={cn("text-[11px]", descCount < MIN_DESC_SERVICE ? "text-amber-700" : "text-zinc-500")}>
                {descCount}/{MIN_DESC_SERVICE}+ recommended
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500">{descCount} chars</p>
            )}
          </div>
        </div>
      </section>

      {/* 3) Price & location */}
      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">3) Price & location</h2>
        <p className="mt-0.5 text-xs text-zinc-600">Use a numeric price or a label.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-700">Price (₦)</label>
            <input
              value={formatDigitsAsNairaInput(priceDigits)}
              onChange={(e) => setPriceDigits(onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="e.g. 25,000"
              disabled={priceDisabled}
              className={cn(
                "mt-1 w-full rounded-2xl border px-3 py-3 text-sm disabled:bg-zinc-50 disabled:text-zinc-400",
                errors.price && "border-red-300"
              )}
            />
            {errors.price ? <p className="mt-1 text-xs text-red-600">{errors.price}</p> : null}
            {priceDigits ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                Preview: <span className="font-semibold text-zinc-900">{formatNaira(parseInt(priceDigits, 10))}</span>
              </p>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700">Price label</label>
            <input
              value={priceLabel}
              onChange={(e) => setPriceLabel(e.target.value)}
              placeholder="e.g. Negotiable / Call for price"
              disabled={priceLabelDisabled}
              className={cn(
                "mt-1 w-full rounded-2xl border px-3 py-3 text-sm disabled:bg-zinc-50 disabled:text-zinc-400",
                errors.priceLabel && "border-red-300"
              )}
            />
            {errors.priceLabel ? <p className="mt-1 text-xs text-red-600">{errors.priceLabel}</p> : null}

            {!priceLabelDisabled ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {["Negotiable", "Call for price", "Free"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPriceLabel(t)}
                    className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs font-medium text-zinc-700">Location</label>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border bg-white px-3 py-3">
            <MapPin className="h-4 w-4 text-zinc-500" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Ikeji hostel / CBT / School gate"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border bg-zinc-50 p-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Negotiable</p>
            <p className="text-xs text-zinc-600">Show you’re open to offers.</p>
          </div>

          <button
            type="button"
            onClick={() => setNegotiable((v) => !v)}
            className={cn("relative h-7 w-12 rounded-full transition-colors", negotiable ? "bg-black" : "bg-zinc-300")}
            aria-pressed={negotiable}
            aria-label="Toggle negotiable"
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
                negotiable ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </section>

      {/* Preview */}
      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Preview</h2>
            <p className="mt-0.5 text-xs text-zinc-600">This is how buyers will see it.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-semibold text-zinc-800">
            <Sparkles className="h-4 w-4" />
            Live
          </span>
        </div>

        <div className="mt-3 overflow-hidden rounded-3xl border bg-white">
          <div className="relative aspect-[4/3] bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl ?? original.image_url ?? "https://placehold.co/1200x900?text=Preview"}
              alt="Preview"
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-3 left-3">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-900 backdrop-blur">
                {previewPrice}
              </span>
            </div>
            {negotiable ? (
              <div className="absolute bottom-3 right-3">
                <span className="rounded-full bg-black/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  Negotiable
                </span>
              </div>
            ) : null}
          </div>

          <div className="space-y-1 p-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                {listingType === "product" ? "Product" : "Service"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                {category}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                {status}
              </span>
            </div>
            <p className="line-clamp-2 text-sm font-semibold text-zinc-900">
              {title.trim() || "Your title will appear here"}
            </p>
            <p className="line-clamp-2 text-xs text-zinc-600">
              {description.trim() || "Your description will appear here"}
            </p>
            <p className="text-xs text-zinc-500">{location.trim() || "Location"}</p>
          </div>
        </div>
      </section>

      {/* Desktop actions */}
      <div className="hidden sm:flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          <Trash2 className="h-4 w-4" />
          Archive
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save()}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : uploading ? "Uploading…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="sm:hidden fixed bottom-16 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-2xl rounded-3xl border bg-white/90 p-2 shadow-lg backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-3 text-sm font-semibold text-zinc-900"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="button"
              onClick={openFilePicker}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-3 text-sm font-semibold text-zinc-900"
            >
              <ImageIcon className="h-4 w-4" />
              Photo
            </button>

            <button
              type="button"
              onClick={() => save()}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between rounded-2xl border bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="inline-flex items-center gap-2 text-[11px] font-semibold text-zinc-900 underline underline-offset-4"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Archive listing
            </button>

            <Link
              href={`/listing/${id}`}
              className="inline-flex items-center gap-2 text-[11px] font-semibold text-zinc-900 underline underline-offset-4"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              View
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}