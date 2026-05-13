"use client";
// app/post/page.tsx

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  clearPostDraft,
  hasPostDraftContent,
  POST_DRAFT_KEY,
  savePostDraft,
} from "@/lib/postDraft";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Phone,
  Save,
  Share2,
  Store,
  X,
  RefreshCcw,
  Sparkles,
  MapPin,
} from "lucide-react";

const PRODUCT_CATEGORIES = [
  "Phones",
  "Laptops",
  "Electronics",
  "Fashion",
  "Provisions",
  "Books & Stationery",
  "Beauty",
  "Others",
] as const;

const SERVICE_CATEGORIES = [
  "Tutoring",
  "Repairs",
  "Food",
  "Delivery",
  "Laundry",
  "Design & Print",
  "Hair & Beauty",
  "Photography",
  "Others",
] as const;

const ALL_CATEGORIES = [...PRODUCT_CATEGORIES, ...SERVICE_CATEGORIES] as const;

type Category = typeof ALL_CATEGORIES[number];

type ListingType = "product" | "service";

type ListingCondition = "new" | "fairly_used" | "used" | "for_parts";

const CONDITIONS: { value: ListingCondition; label: string; hint: string }[] = [
  { value: "new",         label: "New",         hint: "Unopened or unused" },
  { value: "fairly_used", label: "Fairly used",  hint: "Light use, works perfectly" },
  { value: "used",        label: "Used",         hint: "Visible wear, fully working" },
  { value: "for_parts",   label: "For parts",    hint: "Faulty or incomplete" },
];

const MAX_IMAGE_MB = 5;
const MIN_TITLE = 8;
const MIN_DESC_SERVICE = 20;
const MAX_IMAGES = 4;

const LOCATION_PRESETS = [
  "School gate",
  "CBT",
  "Library",
  "Ikeji hostel",
  "Female hostel",
  "Male hostel",
  "Chapel",
  "Sports complex",
] as const;

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

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

function safeUuid() {
  const g = globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  };

  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

    if (file.type === "image/png") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) return file;

    const compressed = new File([blob], `${file.name.replace(/\.\w+$/, "")}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    if (compressed.size >= file.size) return file;

    return compressed;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
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

export default function PostPage() {
  const router = useRouter();

  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [banner, setBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Vendor setup modal — shown inline when user has no vendor profile
  const [vendorCheckLoading, setVendorCheckLoading] = useState(true);
  const [vendorSetupOpen, setVendorSetupOpen] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupPhone, setSetupPhone] = useState("");
  const [setupType, setSetupType] = useState<"student" | "mall" | "other">("student");
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [listingType, setListingType] = useState<ListingType>("product");
  const [category, setCategory] = useState<Category | "">("");
  const [condition, setCondition] = useState<ListingCondition | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDigits, setPriceDigits] = useState<string>("");
  const [priceLabel, setPriceLabel] = useState<string>("");
  const [location, setLocation] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [priceMode, setPriceMode] = useState<'fixed' | 'label'>('fixed');

  // AI price suggestion
  const [priceSuggesting, setPriceSuggesting] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<{
    label: string;
    reasoning: string;
    min: number;
    max: number;
  } | null>(null);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLElement>(null);
  const conditionRef = useRef<HTMLElement>(null);
  const descRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLElement>(null);
  const priceRef = useRef<HTMLElement>(null);

  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);

  const [postedId, setPostedId] = useState<string | null>(null);
  const [published, setPublished] = useState<{
    id: string; title: string; category: string;
  } | null>(null);

  const [draftFound, setDraftFound] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const draftRef = useRef<{
    listingType?: ListingType;
    category?: string;
    condition?: ListingCondition | null;
    title?: string;
    description?: string;
    priceMode?: 'fixed' | 'label';
    priceDigits?: string;
    priceLabel?: string;
    location?: string;
    negotiable?: boolean;
  } | null>(null);

  const previewUrls = useMemo(() => {
    return imageFiles.map((f) => URL.createObjectURL(f));
  }, [imageFiles]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewUrls]);

  useEffect(() => {
    async function checkVendor() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // not logged in — let publish() handle redirect

        const { data: vendor } = await supabase
          .from('vendors')
          .select('id, vendor_type')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!vendor) {
          setVendorSetupOpen(true);
        } else if (vendor.vendor_type === 'food') {
          router.replace('/vendor/menu');
        }
      } finally {
        setVendorCheckLoading(false);
      }
    }
    checkVendor();
  }, [router]);

  const previewUrl = previewUrls[0] ?? null;

  const titleCount = title.trim().length;
  const descCount = description.trim().length;

  const canPublish = useMemo(() => {
    if (title.trim().length < MIN_TITLE) return false;
    if (!category) return false;
    if (listingType === "product" && imageFiles.length === 0) return false;

    if (listingType === "service" && description.trim().length < MIN_DESC_SERVICE) {
      return false;
    }

    if (priceMode === 'fixed' && priceDigits.trim() && !/^\d+$/.test(priceDigits.trim())) return false;

    return true;
  }, [title, category, imageFiles, priceDigits, priceMode, listingType, description]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) onPickFiles(e.dataTransfer.files);
  }

  function onPickFiles(files: FileList | File[]) {
    setBanner(null);
    setErrors((prev) => ({ ...prev, image: "" }));

    const remaining = MAX_IMAGES - imageFiles.length;
    if (remaining <= 0) {
      setErrors((prev) => ({
        ...prev,
        image: `Max ${MAX_IMAGES} photos allowed.`,
      }));
      return;
    }

    const toAdd: File[] = [];
    let latestImageError = "";

    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) {
        latestImageError = "Only image files (JPG/PNG) are allowed.";
        continue;
      }

      const sizeMb = f.size / (1024 * 1024);
      if (sizeMb > MAX_IMAGE_MB) {
        latestImageError = `"${f.name}" is too large. Max ${MAX_IMAGE_MB}MB per photo.`;
        continue;
      }

      toAdd.push(f);
      if (toAdd.length >= remaining) break;
    }

    if (latestImageError) {
      setErrors((prev) => ({ ...prev, image: latestImageError }));
    }

    if (toAdd.length > 0) {
      setImageFiles((prev) => [...prev, ...toAdd]);
    }
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function moveImage(from: number, to: number) {
    setImageFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  // ── Quality score ──────────────────────────────────────────────────────────
  const qualityScore = useMemo(() => {
    let score = 0;
    // Photos: up to 30 pts
    if (imageFiles.length >= 1) score += 20;
    if (imageFiles.length >= 2) score += 10;
    // Title: up to 20 pts
    const tLen = title.trim().length;
    if (tLen >= MIN_TITLE) score += 10;
    if (tLen >= 20) score += 10;
    // Description: up to 25 pts
    const dLen = description.trim().length;
    if (dLen >= 20) score += 10;
    if (dLen >= 60) score += 15;
    // Price set: 10 pts
    if (priceDigits.trim() || priceLabel.trim()) score += 10;
    // Location: 10 pts
    if (location.trim()) score += 10;
    // Condition (products only): 5 pts
    if (listingType === "product" && condition) score += 5;
    return Math.min(100, score);
  }, [imageFiles, title, description, priceDigits, priceLabel, location, listingType, condition]);

  const qualityTier =
    qualityScore >= 75
      ? ("great" as const)
      : qualityScore >= 45
        ? ("good" as const)
        : ("needs_work" as const);

  const qualityMeta = {
    great:      { label: "Great listing!", color: "text-emerald-700", bg: "bg-emerald-500", tip: "Buyers love this level of detail." },
    good:       { label: "Good listing",   color: "text-amber-700",   bg: "bg-amber-400",  tip: "Add more detail to attract more buyers." },
    needs_work: { label: "Needs work",     color: "text-red-700",     bg: "bg-red-400",    tip: listingType === "product" && !condition ? "Add condition, a price and a description." : "Add a description, price and location." },
  };

  // ── AI price suggestion ────────────────────────────────────────────────────
  async function suggestPrice() {
    if (priceSuggesting) return;
    if (!title.trim() || !category) return;
    setPriceSuggesting(true);
    setPriceSuggestion(null);
    try {
      const res = await fetch("/api/ai/price-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          condition: condition ?? undefined,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const json = await res.json();
      if (json.suggestion) setPriceSuggestion(json.suggestion);
    } catch {
      // silently fail — pricing suggestion is non-critical
    } finally {
      setPriceSuggesting(false);
    }
  }

  function applyPriceSuggestion(value: number) {
    setPriceDigits(String(value));
    setPriceLabel("");
    setPriceSuggestion(null);
  }

  function validate() {
    const next: Record<string, string> = {};
    setBanner(null);

    if (listingType === "product" && imageFiles.length === 0) next.image = "Please add at least one photo.";

    if (!title.trim()) next.title = "Title is required.";
    else if (title.trim().length < MIN_TITLE) {
      next.title = `Title should be at least ${MIN_TITLE} characters.`;
    }

    if (!category) next.category = 'Please select a category.';

    if (
      listingType === "service" &&
      description.trim().length > 0 &&
      description.trim().length < MIN_DESC_SERVICE
    ) {
      next.description = `For services, add a bit more detail (min ${MIN_DESC_SERVICE} chars).`;
    }

    if (priceMode === 'fixed' && priceDigits.trim() && !/^\d+$/.test(priceDigits.trim())) {
      next.price = "Price must be digits only.";
    }

    for (const f of imageFiles) {
      const sizeMb = f.size / (1024 * 1024);
      if (sizeMb > MAX_IMAGE_MB) {
        next.image = `Image too large. Max ${MAX_IMAGE_MB}MB.`;
        break;
      }
      if (!f.type.startsWith("image/")) {
        next.image = "Invalid file type.";
        break;
      }
    }

    setErrors(next);
    return Object.keys(next).filter((k) => next[k]).length === 0;
  }

  // Returns both the storage path (needed for cleanup) and the public URL.
  async function uploadOneImage(
    file: File,
    userId: string
  ): Promise<{ path: string; url: string }> {
    const compressed = await compressImage(file, { maxDim: 1600, quality: 0.82 });
    const path = `listings/${userId}/${safeUuid()}.jpg`;

    const { error } = await supabase.storage
      .from("listing-images")
      .upload(path, compressed, {
        cacheControl: "3600",
        upsert: false,
        contentType: compressed.type || "image/jpeg",
      });

    if (error) throw error;

    const { data: pub } = supabase.storage.from("listing-images").getPublicUrl(path);
    return { path, url: pub.publicUrl };
  }

  // Best-effort cleanup — remove uploaded files that will never be referenced.
  async function deleteStoragePaths(paths: string[]) {
    if (paths.length === 0) return;
    try {
      await supabase.storage.from("listing-images").remove(paths);
    } catch {
      // Non-fatal: storage GC can handle leftovers if this fails.
    }
  }

  async function publish() {
    if (publishing || uploading) return;

    setErrors({});
    setBanner(null);

    if (!validate()) return;

    setPublishing(true);

    // Track uploaded paths so we can roll back on any failure.
    const uploadedPaths: string[] = [];

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();

      if (userErr) {
        const m = String(userErr.message ?? "").toLowerCase();
        if (m.includes("auth session missing") || m.includes("session missing")) {
          router.push(`/login?next=${encodeURIComponent("/post")}`);
          return;
        }
        throw userErr;
      }

      const user = userData.user;
      if (!user) {
        router.push(`/login?next=${encodeURIComponent("/post")}`);
        return;
      }

      const { data: vendor } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!vendor?.id) {
        // Setup modal should have caught this — bail safely
        setPublishing(false);
        setVendorSetupOpen(true);
        return;
      }

      // Upload images sequentially so we can track and clean up on partial failure.
      const imgUrls: string[] = [];
      if (imageFiles.length > 0) {
        setUploading(true);
        try {
          for (let i = 0; i < imageFiles.length; i++) {
            setUploadStatusText(`Uploading image ${i + 1} of ${imageFiles.length}...`);
            const { path, url } = await uploadOneImage(imageFiles[i], user.id);
            uploadedPaths.push(path);
            imgUrls.push(url);
          }
        } catch (uploadErr) {
          // At least one upload failed — delete anything already in storage.
          await deleteStoragePaths(uploadedPaths);
          throw uploadErr;
        } finally {
          setUploading(false);
          setUploadStatusText(null);
        }
      }

      const priceInt = priceDigits.trim()
        ? parseInt(priceDigits.trim(), 10)
        : null;

      const payload = {
        vendor_id: vendor.id,
        title: title.trim(),
        description: description.trim() || null,
        listing_type: listingType,
        category,
        condition: listingType === "product" ? (condition ?? null) : null,
        price: Number.isFinite(priceInt) ? priceInt : null,
        price_label: priceLabel.trim() || null,
        location: location.trim() || null,
        image_url: imgUrls[0] ?? null,
        image_urls: imgUrls.length > 0 ? imgUrls : null,
        negotiable,
        status: "active",
      };

      const { data: created, error: cErr } = await supabase
        .from("listings")
        .insert(payload)
        .select("id")
        .single();

      if (cErr) {
        // Listing insert failed — clean up every file we just uploaded.
        await deleteStoragePaths(uploadedPaths);
        throw cErr;
      }

      try {
        clearPostDraft();
        window.localStorage.setItem('jm_has_listed', '1');
      } catch {}

      setPostedId(created?.id ?? null);
      if (created?.id) {
        setPublished({ id: created.id, title: title.trim(), category });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to post listing.";
      setBanner(message);
    } finally {
      setPublishing(false);
    }
  }

  // Inline vendor setup — creates a minimal vendor profile without leaving /post
  async function createVendorProfile() {
    if (!setupName.trim()) {
      setSetupError("Name is required.");
      return;
    }
    setSetupSaving(true);
    setSetupError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?next=/post"); return; }

      const { error } = await supabase.from("vendors").insert({
        user_id: user.id,
        name: setupName.trim(),
        phone: setupPhone.trim() || null,
        whatsapp: setupPhone.trim() || null,
        vendor_type: setupType,
        verified: false,
        verification_status: "unverified",
        accepts_orders: false,
      });

      if (error) {
        // Handle duplicate — vendor might already exist (race)
        if (error.code === "23505") {
          setVendorSetupOpen(false);
          publish();
          return;
        }
        setSetupError(error.message);
        return;
      }

      setVendorSetupOpen(false);
      // Re-run publish now that the vendor profile exists
      publish();
    } catch (e: any) {
      setSetupError(e?.message ?? "Something went wrong.");
    } finally {
      setSetupSaving(false);
    }
  }

  function resetForm() {
    setBanner(null);
    setErrors({});
    setPostedId(null);
    setPublished(null);

    setListingType("product");
    setCategory("");
    setCondition(null);
    setTitle("");
    setDescription("");
    setPriceMode('fixed');
    setPriceDigits("");
    setPriceLabel("");
    setLocation("");
    setNegotiable(false);
    setImageFiles([]);
    setPriceSuggestion(null);
  }

  const draftPayload = useMemo(() => {
    return {
      v: 1,
      listingType,
      category,
      condition,
      title,
      description,
      priceMode,
      priceDigits,
      priceLabel,
      location,
      negotiable,
      ts: Date.now(),
    };
  }, [
    listingType,
    category,
    condition,
    title,
    description,
    priceMode,
    priceDigits,
    priceLabel,
    location,
    negotiable,
  ]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POST_DRAFT_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        title?: string;
        description?: string;
        priceMode?: 'fixed' | 'label';
        priceDigits?: string;
        priceLabel?: string;
        location?: string;
        listingType?: ListingType;
        category?: string;
        condition?: ListingCondition | null;
        negotiable?: boolean;
      };

      if (!hasPostDraftContent(parsed)) return;

      draftRef.current = parsed;
      setDraftFound(true);
      setShowDraftModal(true);
    } catch {
      //
    }
  }, []);

  useEffect(() => {
    if (postedId || publishing) return;

    const t = window.setTimeout(() => {
      try {
        savePostDraft(draftPayload);
      } catch {
        //
      }
    }, 650);

    return () => window.clearTimeout(t);
  }, [draftPayload, postedId, publishing]);

  function restoreDraft() {
    const d = draftRef.current;
    if (!d) {
      setShowDraftModal(false);
      return;
    }

    const restoredType = d.listingType === "service" ? "service" : "product";
    setListingType(restoredType);
    const activeList = restoredType === 'service' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;
    setCategory(
      (activeList as readonly string[]).includes(d.category ?? "")
        ? (d.category as Category)
        : ""
    );
    const validConditions: ListingCondition[] = ["new", "fairly_used", "used", "for_parts"];
    setCondition(
      d.condition && validConditions.includes(d.condition) ? d.condition : null
    );
    setTitle(d.title ?? "");
    setDescription(d.description ?? "");
    setPriceMode(d.priceMode === 'label' ? 'label' : 'fixed');
    setPriceDigits(d.priceDigits ?? "");
    setPriceLabel(d.priceLabel ?? "");
    setLocation(d.location ?? "");
    setNegotiable(!!d.negotiable);
    setDraftFound(true);
    setShowDraftModal(false);
  }

  function discardDraft() {
    try {
      clearPostDraft();
    } catch {}

    draftRef.current = null;
    setDraftFound(false);
    setShowDraftModal(false);
  }

  if (published) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 px-4 text-center">
        <div className="text-4xl">🎉</div>
        <h1 className="text-xl font-bold text-zinc-900">Your listing is live!</h1>
        <p className="text-sm text-zinc-600">
          &ldquo;{published.title}&rdquo; has been posted. Share it to get your first buyer faster.
        </p>

        <button
          type="button"
          onClick={() => {
            const url = `${window.location.origin}/listing/${published.id}`;
            if (navigator.share) {
              navigator.share({
                title: published.title,
                text: `Check out this listing on Jabumarket: ${published.title}`,
                url,
              });
            } else {
              navigator.clipboard.writeText(url);
            }
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Share2 className="h-4 w-4" />
          Share this listing
        </button>

        <div className="flex gap-3">
          <Link
            href={`/listing/${published.id}`}
            className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 no-underline"
          >
            View listing
          </Link>
          <button
            type="button"
            onClick={() => {
              try { clearPostDraft(); } catch {}
              resetForm();
            }}
            className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Post another
          </button>
        </div>

        <Link
          href="/my-listings"
          className="text-xs text-zinc-500 underline underline-offset-2"
        >
          Manage all listings
        </Link>
      </div>
    );
  }

  if (vendorCheckLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
        <div className="animate-pulse space-y-4">
          <div className="h-20 rounded-3xl bg-zinc-100" />
          <div className="h-56 rounded-3xl bg-zinc-100" />
          <div className="h-56 rounded-3xl bg-zinc-100" />
          <div className="h-64 rounded-3xl bg-zinc-100" />
        </div>
      </div>
    );
  }

  const previewPrice =
    priceDigits.trim() !== ""
      ? formatNaira(parseInt(priceDigits, 10))
      : priceLabel.trim() || "Contact for price";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
      {/* Vendor setup modal — shown when user has no vendor profile yet */}
      <Modal open={vendorSetupOpen} title="Quick setup — one time only">
        <p className="text-sm text-zinc-600">
          Add a few details so buyers know who they're dealing with. You can update these anytime in your profile.
        </p>

        <div className="mt-4 space-y-3">
          {/* Vendor name */}
          <div>
            <label className="text-xs font-medium text-zinc-700">
              Your name / shop name <span className="text-red-500">*</span>
            </label>
            <input
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              placeholder="e.g. Temi's Gadgets, Adaeze"
              className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/10"
              autoFocus
            />
          </div>

          {/* Phone / WhatsApp */}
          <div>
            <label className="text-xs font-medium text-zinc-700">
              WhatsApp / phone number
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-2xl border px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10">
              <Phone className="h-4 w-4 shrink-0 text-zinc-400" />
              <input
                value={setupPhone}
                onChange={(e) => setSetupPhone(e.target.value)}
                placeholder="+2348012345678"
                inputMode="tel"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          {/* Vendor type */}
          <div>
            <label className="text-xs font-medium text-zinc-700">What are you selling?</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  { value: "student", label: "Student seller" },
                  { value: "mall",    label: "Mall / shop" },
                  { value: "other",   label: "Other" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSetupType(opt.value)}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                    setupType === opt.value
                      ? "border-black bg-black text-white"
                      : "bg-white text-zinc-800 hover:bg-zinc-50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Selling food? <a href="/vendor/register" className="underline">Register as a food vendor</a> instead.
            </p>
          </div>

          {setupError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {setupError}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setVendorSetupOpen(false)}
            className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={createVendorProfile}
            disabled={setupSaving || !setupName.trim()}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
              !setupName.trim()
                ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                : "bg-black text-white hover:bg-zinc-800 disabled:opacity-60"
            )}
          >
            {setupSaving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Store className="h-4 w-4" /> Save & continue posting</>
            )}
          </button>
        </div>
      </Modal>

      <Modal open={showDraftModal && !vendorSetupOpen} title="Restore your draft?">
        <p className="text-sm text-zinc-700">
          We found an unfinished post. Do you want to restore it? (Photo can’t be
          restored.)
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={discardDraft}
            className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={restoreDraft}
            className="rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Restore
          </button>
        </div>
      </Modal>

      {!vendorSetupOpen ? (
        <>
      <div className="sticky top-0 z-10 -mx-4 border-b bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-sm font-semibold text-zinc-900">Post a listing</p>
            <p className="text-xs text-zinc-500">
              {publishing
                ? "Publishing..."
                : uploading
                  ? (uploadStatusText ?? `Uploading image 1 of ${imageFiles.length}...`)
                  : "Fill in the details below"}
            </p>
          </div>

          {/* Desktop publish shortcut — hidden on mobile where the fixed bar handles this */}
          <button
            type="button"
            onClick={publish}
            disabled={!canPublish || publishing || uploading}
            className="hidden sm:inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {publishing || uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {publishing ? "Publishing..." : uploading ? "Uploading..." : "Publish"}
          </button>
        </div>

        {(uploading || publishing) ? (
          <div className="mt-3 rounded-2xl border bg-zinc-50 px-3 py-2">
            <p className="text-[11px] text-zinc-500">
              {publishing ? "Publishing listing..." : uploadStatusText ?? "Uploading images..."}
            </p>
          </div>
        ) : null}

        {banner ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div className="flex-1">{banner}</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── 1) Listing info ─────────────────────────────────── */}
      <section ref={titleRef} className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Listing info</h2>
        <p className="mt-0.5 text-xs text-zinc-600">What are you selling?</p>

        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-700">Type</p>
          <div className="mt-2 grid grid-cols-2 rounded-2xl border bg-white p-1">
            <button
              type="button"
              onClick={() => { setListingType("product"); setCategory(""); }}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold",
                listingType === "product"
                  ? "bg-black text-white"
                  : "text-zinc-800 hover:bg-zinc-50"
              )}
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => { setListingType("service"); setCategory(""); }}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold",
                listingType === "service"
                  ? "bg-black text-white"
                  : "text-zinc-800 hover:bg-zinc-50"
              )}
            >
              Service
            </button>
          </div>
        </div>

        {/* Task 2 — native select replaces pill grid */}
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-700">Category</p>
          <div className="relative mt-2">
            {(() => {
              const activeCategories = listingType === 'service' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;
              return (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full appearance-none rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="" disabled>Select a category…</option>
                  {activeCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              );
            })()}
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Pick the best match so buyers find you.
          </p>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium text-zinc-700">
            Title <span className="text-red-600">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. iPhone 11 64GB — clean, no issues"
            className={cn(
              "mt-1 w-full rounded-2xl border px-3 py-3 text-sm",
              errors.title && "border-red-300"
            )}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.title ? <p className="text-xs text-red-600">{errors.title}</p> : <span />}
            <p
              className={cn(
                "text-[11px]",
                titleCount < MIN_TITLE ? "text-amber-700" : "text-zinc-500"
              )}
            >
              {titleCount}/{MIN_TITLE}+ recommended
            </p>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Short + specific titles get more clicks.
          </p>
        </div>
      </section>

      {/* ── 2) Condition (products only) ────────────────────── */}
      {listingType === "product" ? (
        <section ref={conditionRef} className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Condition</h2>
          <p className="mt-0.5 text-xs text-zinc-600">Helps buyers decide.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CONDITIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCondition(prev => prev === c.value ? null : c.value)}
                className={cn(
                  "flex flex-col gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition",
                  condition === c.value
                    ? "border-black bg-black text-white"
                    : "bg-white text-zinc-800 hover:bg-zinc-50"
                )}
              >
                <span className="text-xs font-semibold">{c.label}</span>
                <span className={cn("text-[11px]", condition === c.value ? "text-zinc-300" : "text-zinc-500")}>
                  {c.hint}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── 3) Description ──────────────────────────────────── */}
      <section ref={descRef} className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Description</h2>
        <div className="mt-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={listingType === "service"
              ? "What you offer, turnaround time, your rate, and how to book."
              : "Condition, what’s included, any faults, delivery options, etc."
            }
            className={cn(
              "mt-1 min-h-[120px] w-full rounded-2xl border px-3 py-3 text-sm",
              errors.description && "border-red-300"
            )}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.description ? (
              <p className="text-xs text-red-600">{errors.description}</p>
            ) : (
              <span />
            )}
            {listingType === "service" ? (
              <p
                className={cn(
                  "text-[11px]",
                  descCount < MIN_DESC_SERVICE ? "text-amber-700" : "text-zinc-500"
                )}
              >
                {descCount}/{MIN_DESC_SERVICE}+ recommended
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500">{descCount} chars</p>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">Good descriptions build trust.</p>
        </div>
      </section>

      {/* ── 4) Photos ───────────────────────────────────────── */}
      <section ref={photoRef} className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Add photos</h2>
            <p className="mt-0.5 text-xs text-zinc-600">
              Up to {MAX_IMAGES} photos — first photo is the cover. Clear photos get
              more messages.{listingType === "product" ? (
                <span className="font-semibold text-zinc-900"> Required for products.</span>
              ) : " Optional for services."}
            </p>
          </div>
          {imageFiles.length > 0 ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
              {imageFiles.length} / {MAX_IMAGES}
            </span>
          ) : null}
        </div>

        {imageFiles.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {imageFiles.map((_, i) => (
              <div
                key={i}
                className="group relative aspect-square overflow-hidden rounded-2xl border bg-zinc-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrls[i]}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />

                {i === 0 ? (
                  <div className="absolute bottom-1.5 left-1.5">
                    <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                      Cover
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => moveImage(i, 0)}
                    className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur"
                  >
                    Set cover
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {imageFiles.length < MAX_IMAGES ? (
              <button
                type="button"
                onClick={openFilePicker}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-100"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[11px] font-medium">Add photo</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {imageFiles.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "mt-3 overflow-hidden rounded-3xl border bg-zinc-50 transition",
              dragOver && "border-zinc-300 ring-2 ring-black/10"
            )}
          >
            <button
              type="button"
              onClick={openFilePicker}
              className="group relative w-full"
            >
              <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-zinc-100 text-zinc-400">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-zinc-200 transition group-hover:bg-zinc-300">
                  <Camera className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-zinc-700">
                    Tap to upload photos
                  </p>
                  <p className="text-xs text-zinc-500">
                    or drag & drop — up to {MAX_IMAGES} photos
                  </p>
                </div>
              </div>
            </button>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) onPickFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />

        {errors.image ? (
          <p className="mt-2 text-xs text-red-600">{errors.image}</p>
        ) : null}

        <p className="mt-2 text-xs text-zinc-500">
          PNG/JPG • max {MAX_IMAGE_MB}MB each • photos are auto-optimized on upload.
        </p>
      </section>

      <section ref={priceRef} className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Price & location</h2>
            <p className="mt-0.5 text-xs text-zinc-600">Use a numeric price or a label.</p>
          </div>

          {/* AI pricing hint — only show once title is filled */}
          {title.trim().length >= MIN_TITLE ? (
            <button
              type="button"
              onClick={suggestPrice}
              disabled={priceSuggesting}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              {priceSuggesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {priceSuggesting ? "Thinking…" : "Suggest price"}
            </button>
          ) : null}
        </div>

        {/* AI suggestion card */}
        {priceSuggestion ? (
          <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
                  <p className="text-xs font-semibold text-zinc-900">
                    AI suggests: {priceSuggestion.label}
                  </p>
                </div>
                <p className="mt-1 text-xs text-zinc-600">{priceSuggestion.reasoning}</p>
              </div>
              <button
                type="button"
                onClick={() => setPriceSuggestion(null)}
                className="shrink-0 text-zinc-400 hover:text-zinc-600"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPriceSuggestion(priceSuggestion.min)}
                className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
              >
                Use ₦{priceSuggestion.min.toLocaleString("en-NG")} (low)
              </button>
              <button
                type="button"
                onClick={() => applyPriceSuggestion(Math.round((priceSuggestion.min + priceSuggestion.max) / 2))}
                className="rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Use ₦{Math.round((priceSuggestion.min + priceSuggestion.max) / 2).toLocaleString("en-NG")} (mid)
              </button>
              <button
                type="button"
                onClick={() => applyPriceSuggestion(priceSuggestion.max)}
                className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
              >
                Use ₦{priceSuggestion.max.toLocaleString("en-NG")} (high)
              </button>
            </div>
          </div>
        ) : null}

        {/* Price mode toggle */}
        <div className="mt-4 grid grid-cols-2 rounded-2xl border bg-white p-1">
          <button
            type="button"
            onClick={() => { setPriceMode('fixed'); setPriceLabel(''); }}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-semibold",
              priceMode === 'fixed' ? "bg-black text-white" : "text-zinc-800 hover:bg-zinc-50"
            )}
          >
            Fixed price
          </button>
          <button
            type="button"
            onClick={() => { setPriceMode('label'); setPriceDigits(''); }}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-semibold",
              priceMode === 'label' ? "bg-black text-white" : "text-zinc-800 hover:bg-zinc-50"
            )}
          >
            Custom label
          </button>
        </div>

        {priceMode === 'fixed' ? (
          <div className="mt-3">
            <label className="text-xs font-medium text-zinc-700">Price (₦)</label>
            <input
              value={formatDigitsAsNairaInput(priceDigits)}
              onChange={(e) => setPriceDigits(onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="e.g. 25,000"
              className={cn(
                "mt-1 w-full rounded-2xl border px-3 py-3 text-sm",
                errors.price && "border-red-300"
              )}
            />
            {errors.price ? (
              <p className="mt-1 text-xs text-red-600">{errors.price}</p>
            ) : null}
            {priceDigits ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                Preview:{" "}
                <span className="font-semibold text-zinc-900">
                  {formatNaira(parseInt(priceDigits, 10))}
                </span>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3">
            <label className="text-xs font-medium text-zinc-700">Price label</label>
            <input
              value={priceLabel}
              onChange={(e) => {
                setPriceLabel(e.target.value);
                // Sync: "Negotiable" label auto-enables the negotiable flag
                if (e.target.value.toLowerCase() === 'negotiable') setNegotiable(true);
              }}
              placeholder="e.g. Contact for price"
              className={cn(
                "mt-1 w-full rounded-2xl border px-3 py-3 text-sm",
                errors.priceLabel && "border-red-300"
              )}
            />
            {errors.priceLabel ? (
              <p className="mt-1 text-xs text-red-600">{errors.priceLabel}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {["Negotiable", "Call for price", "Free"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setPriceLabel(t);
                    if (t === 'Negotiable') setNegotiable(true);
                  }}
                  className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

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

          <div className="mt-2 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {LOCATION_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setLocation(p)}
                className="whitespace-nowrap rounded-full border bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                {p}
              </button>
            ))}
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
            className={cn(
              "relative h-7 w-12 rounded-full transition-colors",
              negotiable ? "bg-black" : "bg-zinc-300"
            )}
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

      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Preview</h2>
            <p className="mt-0.5 text-xs text-zinc-600">
              This is how buyers will see it.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-semibold text-zinc-800">
            <Sparkles className="h-4 w-4" />
            Live
          </span>
        </div>

        {/* Quality score meter */}
        <div className="mt-3 rounded-2xl border bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={cn("text-xs font-semibold", qualityMeta[qualityTier].color)}>
                {qualityMeta[qualityTier].label}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{qualityMeta[qualityTier].tip}</p>
            </div>
            <span className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
              qualityTier === "great"      ? "bg-emerald-100 text-emerald-800" :
              qualityTier === "good"       ? "bg-amber-100 text-amber-800" :
                                             "bg-red-100 text-red-800"
            )}>
              {qualityScore}/100
            </span>
          </div>
          {/* Progress bar */}
          <p className="text-xs text-zinc-500 mb-2">
            Listing quality — better listings get more views
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                qualityTier === "great" ? "bg-emerald-500" :
                qualityTier === "good"  ? "bg-amber-400" :
                                          "bg-red-400"
              )}
              style={{ width: `${qualityScore}%` }}
            />
          </div>
          {/* Checklist hints */}
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
            {[
              { done: title.trim().length >= MIN_TITLE,            label: "Title",       ref: titleRef },
              { done: description.trim().length >= 20,             label: "Description", ref: descRef },
              { done: imageFiles.length > 0,                       label: "Photo",       ref: photoRef },
              { done: !!(priceDigits.trim() || priceLabel.trim()), label: "Price",       ref: priceRef },
              { done: !!location.trim(),                           label: "Location",    ref: priceRef },
              ...(listingType === "product"
                ? [{ done: !!condition, label: "Condition", ref: conditionRef }]
                : []),
            ].map((item) => (
              <span
                key={item.label}
                onClick={() => { if (!item.done) item.ref.current?.scrollIntoView({ behavior: "smooth" }); }}
                className={cn(
                  "flex items-center gap-1 text-[11px]",
                  item.done ? "text-emerald-700" : "text-zinc-400 cursor-pointer hover:text-zinc-600"
                )}
              >
                <span className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  item.done ? "bg-emerald-500" : "bg-zinc-300"
                )} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-3xl border bg-white">
          <div className="relative aspect-[4/3] bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl ?? "https://placehold.co/1200x900?text=Preview"}
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                {listingType === "product" ? "Product" : "Service"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                {category}
              </span>
              {condition ? (
                <span className={cn(
                  "rounded-full px-2 py-1 text-xs font-semibold",
                  condition === "new"         ? "bg-emerald-100 text-emerald-800" :
                  condition === "fairly_used" ? "bg-blue-100 text-blue-800" :
                  condition === "used"        ? "bg-amber-100 text-amber-800" :
                                               "bg-red-100 text-red-800"
                )}>
                  {CONDITIONS.find(c => c.value === condition)?.label}
                </span>
              ) : null}
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

      <div className="hidden items-center justify-end gap-2 sm:flex">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish || publishing || uploading}
          className="inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {publishing || uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {publishing ? "Publishing..." : uploading ? "Uploading..." : "Publish"}
        </button>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 sm:hidden">
        <div className="mx-auto max-w-2xl rounded-3xl border bg-white/90 p-2 shadow-lg backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => router.back()}
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

            <div className="flex flex-col items-center gap-0.5">
              <button
                type="button"
                onClick={publish}
                disabled={!canPublish || publishing || uploading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {publishing || uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {publishing ? "Publishing..." : uploading ? "Uploading..." : "Post"}
              </button>
              {!canPublish && !publishing && (
                <p className="text-[10px] text-zinc-500 text-center">
                  {listingType === 'product' && imageFiles.length === 0
                    ? 'Add a photo first'
                    : !title.trim() || title.trim().length < MIN_TITLE
                      ? 'Title too short'
                      : !category
                        ? 'Pick a category'
                        : null}
                </p>
              )}
            </div>
          </div>

          {draftFound ? (
            <div className="mt-2 flex items-center justify-between rounded-2xl border bg-white px-3 py-2">
              <p className="text-[11px] text-zinc-600">Draft autosave is on</p>
              <button
                type="button"
                onClick={() => setShowDraftModal(true)}
                className="inline-flex items-center gap-2 text-[11px] font-semibold text-zinc-900 underline underline-offset-4"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Restore
              </button>
            </div>
          ) : null}
        </div>
      </div>
        </>
      ) : null}

    </div>
  );
}
