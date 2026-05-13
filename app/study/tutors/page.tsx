"use client";
// app/study/tutors/page.tsx
import { cn } from "@/lib/utils";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getWhatsAppLink } from "@/lib/whatsapp";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  SlidersHorizontal,
  X,
  ShieldCheck,
  Star,
  Phone,
  MessageCircle,
  MapPin,
  BadgeCheck,
  Loader2,
  GraduationCap,
  Sparkles,
} from "lucide-react";

type Banner = { type: "error" | "info"; text: string } | null;

type ModeKey = "all" | "online" | "physical" | "hybrid";
type SortKey = "recommended" | "price_asc" | "price_desc" | "rating_desc" | "newest";

const LEVELS = ["100", "200", "300", "400", "500"] as const;

function normalize(v: string) {
  return v.trim().replace(/\s+/g, " ");
}

function asInt(v: string | null, fallback: number) {
  const n = Number(v ?? "");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function buildHref(path: string, params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    const s = String(v).trim();
    if (!s) return;
    sp.set(k, s);
  });
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

function BannerBox({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  if (!banner) return null;
  const tone =
    banner.type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-zinc-200 bg-white text-zinc-700";
  return (
    <div className={cn("rounded-2xl border p-4 text-sm", tone)} role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <p>{banner.text}</p>
        <button type="button" onClick={onClose} className="rounded-xl p-1 hover:bg-black/5" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition",
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
        className
      )}
    >
      {children}
    </button>
  );
}

function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cn("fixed inset-0 z-50 transition", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        className={cn("absolute inset-0 bg-black/40 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-t-3xl border bg-white shadow-xl transition-transform",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <p className="text-base font-semibold text-zinc-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white hover:bg-zinc-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
        {footer ? <div className="border-t p-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <label className="block rounded-2xl border bg-white p-3">
      <span className="text-xs font-semibold text-zinc-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none"
      >
        <option value="">{placeholder ?? "All"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function titleCase(v: string) {
  return v
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function TutorCard({
  t,
  onQuickFilterCourse,
}: {
  t: any;
  onQuickFilterCourse: (course: string) => void;
}) {
  const name = normalize(String(t?.name ?? t?.full_name ?? t?.display_name ?? "Tutor"));
  const headline = normalize(String(t?.headline ?? t?.bio_headline ?? seenString(t?.title) ?? "")) || "";
  const location = normalize(String(t?.location ?? t?.campus ?? t?.city ?? "")) || "";
  const verified = Boolean(t?.verified ?? t?.is_verified ?? t?.approved);
  const rating = safeNumber(t?.rating, 0);
  const reviews = safeNumber(t?.reviews_count ?? t?.review_count, 0);
  const priceMin = safeNumber(t?.price_min ?? t?.min_price, 0);
  const priceMax = safeNumber(t?.price_max ?? t?.max_price, 0);
  const modeRaw = normalize(String(t?.mode ?? t?.teaching_mode ?? t?.delivery_mode ?? "")) || "";
  const mode = modeRaw ? titleCase(modeRaw) : "";

  // courses could be array, string, or missing
  const courses: string[] = (() => {
    const c = t?.courses ?? t?.course_codes ?? t?.subjects;
    if (!c) return [];
    if (Array.isArray(c)) return c.map((x) => normalize(String(x))).filter(Boolean).slice(0, 6);
    const s = normalize(String(c));
    if (!s) return [];
    // split by comma / slash / pipe
    return s
      .split(/[,/|]/g)
      .map((x) => normalize(x))
      .filter(Boolean)
      .slice(0, 6);
  })();

  const phone = normalize(String(t?.phone ?? t?.mobile ?? "")) || "";
  const whatsapp = normalize(String(t?.whatsapp ?? t?.whatsapp_number ?? phone)) || "";

  const waText = encodeURIComponent(
    `Hi ${name}, I found you on Jabu Study. I need help with: \n\nCourse: (type course code)\nLevel: \nTopic: \nPreferred time: \nMode (online/physical): \n\nThanks!`
  );

  const waHref = whatsapp ? getWhatsAppLink(whatsapp, waText) : "";
  const telHref = phone ? `tel:${phone.replace(/\s+/g, "")}` : "";

  function seenString(v: any) {
    const s = normalize(String(v ?? ""));
    return s || "";
  }

  return (
    <div className="rounded-3xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-zinc-900">{name}</p>
            {verified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            ) : null}
          </div>

          {headline ? (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{headline}</p>
          ) : (
            <p className="mt-1 text-sm text-zinc-600">Private tutor for your courses.</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
              <Star className="h-3.5 w-3.5" />
              {rating > 0 ? rating.toFixed(1) : "New"}
              {reviews > 0 ? <span className="text-zinc-500">({reviews})</span> : null}
            </span>

            {mode ? (
              <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                {mode}
              </span>
            ) : null}

            {location ? (
              <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
            ) : null}

            {priceMin || priceMax ? (
              <span className="rounded-full border bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                ₦{Math.max(0, priceMin).toLocaleString("en-NG")}
                {priceMax && priceMax !== priceMin ? `–₦${Math.max(0, priceMax).toLocaleString("en-NG")}` : ""} / hr
              </span>
            ) : null}
          </div>

          {courses.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {courses.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onQuickFilterCourse(c)}
                  className="rounded-full border bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border bg-zinc-50">
          <GraduationCap className="h-5 w-5 text-zinc-800" />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <a
          href={waHref || "#"}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition no-underline",
            waHref
              ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
              : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-500"
          )}
          aria-disabled={!waHref}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>

        <a
          href={telHref || "#"}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition no-underline",
            telHref ? "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50" : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-500"
          )}
          aria-disabled={!telHref}
        >
          <Phone className="h-4 w-4" />
          Call
        </a>

        <Link
          href={`/study/report?tutor=${encodeURIComponent(String(t?.id ?? ""))}`}
          className="inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50"
        >
          Report
        </Link>
      </div>
    </div>
  );
}

export default function TutorsPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6" />}>
      <TutorsPageInner />
    </Suspense>
  );
}

function TutorsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // URL params
  const qParam = sp.get("q") ?? "";
  const courseParam = sp.get("course") ?? "";
  const levelParam = sp.get("level") ?? "";
  const modeParam = (sp.get("mode") ?? "all") as ModeKey;
  const verifiedParam = sp.get("verified") ?? ""; // "1" = yes
  const sortParam = (sp.get("sort") ?? "recommended") as SortKey;
  const pageParam = asInt(sp.get("page"), 1);

  const PAGE_SIZE = 12;

  // UI state
  const [q, setQ] = useState(qParam);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Draft filters (apply button)
  const [draftCourse, setDraftCourse] = useState(courseParam);
  const [draftLevel, setDraftLevel] = useState(levelParam);
  const [draftMode, setDraftMode] = useState<ModeKey>(modeParam);
  const [draftVerified, setDraftVerified] = useState(verifiedParam);
  const [draftSort, setDraftSort] = useState<SortKey>(sortParam);

  // Data
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<Banner>(null);
  const [rawTutors, setRawTutors] = useState<any[]>([]);

  // Keep input synced with URL nav
  useEffect(() => setQ(qParam), [qParam]);

  // Fetch tutors (schema-safe: select("*"), no column assumptions)
  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setBanner(null);

      const res = await supabase.from("study_tutors").select("*").limit(500);

      if (!mounted) return;

      if (res.error) {
        // If table doesn't exist yet, surface a friendly message
        setBanner({
          type: "error",
          text:
            res.error.message.includes("relation") || res.error.message.includes("does not exist")
              ? "Tutors database isn’t set up yet (study_tutors table missing). Create the table, then this page will start showing tutors."
              : res.error.message,
        });
        setRawTutors([]);
        setLoading(false);
        return;
      }

      setRawTutors((res.data as any[]) ?? []);
      setLoading(false);
    }
    run();
    return () => {
      mounted = false;
    };
  }, []);

  // Client-side filtering (works even if DB columns differ)
  const filtered = useMemo(() => {
    const qn = normalize(qParam).toLowerCase();
    const courseN = normalize(courseParam).toLowerCase();
    const lvlN = normalize(levelParam);
    const modeN = normalize(modeParam).toLowerCase();
    const wantVerified = verifiedParam === "1";

    const list = rawTutors.filter((t) => {
      const hay = normalize(
        `${t?.name ?? ""} ${t?.full_name ?? ""} ${t?.headline ?? ""} ${t?.bio ?? ""} ${t?.department ?? ""} ${t?.faculty ?? ""} ${
          Array.isArray(t?.courses) ? t.courses.join(" ") : t?.courses ?? t?.course_codes ?? ""
        }`
      ).toLowerCase();

      if (qn && !hay.includes(qn)) return false;

      if (courseN) {
        const c = t?.courses ?? t?.course_codes ?? t?.subjects ?? "";
        const courseHay = (Array.isArray(c) ? c.join(" ") : String(c)).toLowerCase();
        if (!courseHay.includes(courseN)) return false;
      }

      if (lvlN) {
        const lv = String(t?.level ?? t?.levels ?? t?.teaches_level ?? "");
        if (lv && !lv.includes(lvlN)) return false;
        // If tutor has no level info, don't block them
      }

      if (modeN !== "all") {
        const m = normalize(String(t?.mode ?? t?.teaching_mode ?? t?.delivery_mode ?? "")).toLowerCase();
        if (m) {
          if (modeN === "hybrid") {
            if (!(m.includes("hybrid") || (m.includes("online") && m.includes("physical")))) return false;
          } else {
            if (!m.includes(modeN)) return false;
          }
        }
        // If tutor has no mode info, don't block them
      }

      if (wantVerified) {
        const v = Boolean(t?.verified ?? t?.is_verified ?? t?.approved);
        if (!v) return false;
      }

      return true;
    });

    // Sorting
    const sorted = list.slice();
    const score = (t: any) => {
      const rating = safeNumber(t?.rating, 0);
      const reviews = safeNumber(t?.reviews_count ?? t?.review_count, 0);
      const verified = Boolean(t?.verified ?? t?.is_verified ?? t?.approved) ? 1 : 0;
      // simple recommended ranking: verified + rating + review count
      return verified * 10 + rating * 3 + Math.min(50, reviews);
    };

    if (sortParam === "price_asc") {
      sorted.sort((a, b) => safeNumber(a?.price_min ?? a?.min_price, 0) - safeNumber(b?.price_min ?? b?.min_price, 0));
    } else if (sortParam === "price_desc") {
      sorted.sort((a, b) => safeNumber(b?.price_min ?? b?.min_price, 0) - safeNumber(a?.price_min ?? a?.min_price, 0));
    } else if (sortParam === "rating_desc") {
      sorted.sort((a, b) => safeNumber(b?.rating, 0) - safeNumber(a?.rating, 0));
    } else if (sortParam === "newest") {
      // try best-effort created_at
      sorted.sort((a, b) => String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")));
    } else {
      sorted.sort((a, b) => score(b) - score(a));
    }

    return sorted;
  }, [rawTutors, qParam, courseParam, levelParam, modeParam, verifiedParam, sortParam]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(pageParam, 1), totalPages);

  const pageItems = useMemo(() => {
    const from = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(from, from + PAGE_SIZE);
  }, [filtered, safePage]);

  const showingFrom = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(total, safePage * PAGE_SIZE);

  // Debounced search -> replace URL (no history spam)
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const qNorm = normalize(q);
    if (qNorm === normalize(qParam)) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      router.replace(
        buildHref(pathname, {
          q: qNorm || null,
          course: courseParam || null,
          level: levelParam || null,
          mode: modeParam !== "all" ? modeParam : null,
          verified: verifiedParam || null,
          sort: sortParam !== "recommended" ? sortParam : null,
          page: null,
        })
      );
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, qParam, router, pathname, courseParam, levelParam, modeParam, verifiedParam, sortParam]);

  function openFilters() {
    setDraftCourse(courseParam);
    setDraftLevel(levelParam);
    setDraftMode(modeParam);
    setDraftVerified(verifiedParam);
    setDraftSort(sortParam);
    setDrawerOpen(true);
  }

  function applyFilters() {
    router.replace(
      buildHref(pathname, {
        q: normalize(q) || null,
        course: normalize(draftCourse) || null,
        level: draftLevel || null,
        mode: draftMode !== "all" ? draftMode : null,
        verified: draftVerified || null,
        sort: draftSort !== "recommended" ? draftSort : null,
        page: null,
      })
    );
    setDrawerOpen(false);
  }

  function clearAll() {
    setQ("");
    router.replace(pathname);
  }

  function goPage(next: number) {
    router.replace(
      buildHref(pathname, {
        q: qParam || null,
        course: courseParam || null,
        level: levelParam || null,
        mode: modeParam !== "all" ? modeParam : null,
        verified: verifiedParam || null,
        sort: sortParam !== "recommended" ? sortParam : null,
        page: next !== 1 ? next : null,
      })
    );
  }

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (qParam)
      chips.push({
        key: "q",
        label: `“${qParam}”`,
        clear: () => router.replace(buildHref(pathname, { ...Object.fromEntries(sp.entries()), q: null, page: null })),
      });
    if (courseParam)
      chips.push({
        key: "course",
        label: `Course: ${courseParam}`,
        clear: () => router.replace(buildHref(pathname, { ...Object.fromEntries(sp.entries()), course: null, page: null })),
      });
    if (levelParam)
      chips.push({
        key: "level",
        label: `${levelParam}L`,
        clear: () => router.replace(buildHref(pathname, { ...Object.fromEntries(sp.entries()), level: null, page: null })),
      });
    if (modeParam && modeParam !== "all")
      chips.push({
        key: "mode",
        label: `Mode: ${modeParam}`,
        clear: () => router.replace(buildHref(pathname, { ...Object.fromEntries(sp.entries()), mode: null, page: null })),
      });
    if (verifiedParam === "1")
      chips.push({
        key: "verified",
        label: "Verified",
        clear: () => router.replace(buildHref(pathname, { ...Object.fromEntries(sp.entries()), verified: null, page: null })),
      });
    if (sortParam && sortParam !== "recommended")
      chips.push({
        key: "sort",
        label: `Sort: ${sortParam.replace("_", " ")}`,
        clear: () => router.replace(buildHref(pathname, { ...Object.fromEntries(sp.entries()), sort: null, page: null })),
      });
    return chips;
  }, [qParam, courseParam, levelParam, modeParam, verifiedParam, sortParam, router, pathname, sp]);

  const hasAnyFilters = Boolean(activeChips.length);

  function quickFilterCourse(course: string) {
    const c = normalize(course);
    if (!c) return;
    router.replace(
      buildHref(pathname, {
        q: normalize(q) || null,
        course: c,
        level: levelParam || null,
        mode: modeParam !== "all" ? modeParam : null,
        verified: verifiedParam || null,
        sort: sortParam !== "recommended" ? sortParam : null,
        page: null,
      })
    );
  }

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      {/* Sticky header (mobile-first) */}
      <div className="sticky top-0 z-30 -mx-4 border-b bg-zinc-50/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <header className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href="/study"
                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 no-underline hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Study
              </Link>

              <div className="mt-3 flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-zinc-50">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-zinc-900">Tutors</p>
                  <p className="text-sm text-zinc-600">Find verified tutors for your course (WhatsApp & call).</p>
                </div>
              </div>

              <div className="mt-2 text-xs font-semibold text-zinc-600">
                {loading ? "Loading…" : total === 0 ? "No tutors found" : `Showing ${showingFrom}–${showingTo} of ${total}`}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Link
                href="/study/tutors/apply"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white no-underline hover:bg-zinc-800"
              >
                <Sparkles className="h-4 w-4" />
                Become a tutor
              </Link>

              <button
                type="button"
                onClick={openFilters}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
              <Search className="h-5 w-5 text-zinc-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tutor name, course code (e.g. GST101)…"
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                inputMode="search"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="grid h-8 w-8 place-items-center rounded-xl hover:bg-zinc-50"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-zinc-600" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Active chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {activeChips.slice(0, 10).map((c) => (
              <Chip key={c.key} active onClick={c.clear} className="gap-1">
                {c.label} <X className="h-4 w-4" />
              </Chip>
            ))}
            {hasAnyFilters ? (
              <Chip onClick={clearAll} className="border-zinc-200 bg-zinc-50">
                Clear all <X className="h-4 w-4" />
              </Chip>
            ) : (
              <span className="text-xs text-zinc-500">No filters applied</span>
            )}
          </div>
        </header>
      </div>

      <BannerBox banner={banner} onClose={() => setBanner(null)} />

      {/* Content */}
      {loading ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-3xl border bg-white p-4 shadow-sm">
              <div className="h-5 w-1/2 rounded bg-zinc-100" />
              <div className="mt-2 h-4 w-full rounded bg-zinc-100" />
              <div className="mt-2 h-4 w-4/5 rounded bg-zinc-100" />
              <div className="mt-4 flex gap-2">
                <div className="h-8 w-20 rounded-full bg-zinc-100" />
                <div className="h-8 w-24 rounded-full bg-zinc-100" />
              </div>
              <div className="mt-4 h-11 w-full rounded-2xl bg-zinc-100" />
            </div>
          ))}
        </section>
      ) : pageItems.length === 0 ? (
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <p className="text-base font-semibold text-zinc-900">No tutors found</p>
          <p className="mt-1 text-sm text-zinc-600">
            Try clearing filters or searching with a course code like <span className="font-semibold">GST101</span>.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Clear filters
            </button>
            <Link
              href="/study/tutors/apply"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white no-underline hover:bg-zinc-800"
            >
              Become a tutor
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((t) => (
              <TutorCard key={String(t?.id ?? Math.random())} t={t} onQuickFilterCourse={quickFilterCourse} />
            ))}
          </section>

          {/* Pagination */}
          <div className="rounded-3xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-zinc-900">
                Page {safePage} of {totalPages}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => goPage(safePage - 1)}
                  disabled={safePage <= 1}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                    safePage <= 1
                      ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-500"
                      : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Prev
                </button>

                <button
                  type="button"
                  onClick={() => goPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                    safePage >= totalPages
                      ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-500"
                      : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                  )}
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Filters drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftCourse("");
                setDraftLevel("");
                setDraftMode("all");
                setDraftVerified("");
                setDraftSort("recommended");
              }}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Apply
            </button>
          </div>
        }
      >
        {/* Course */}
        <label className="block rounded-2xl border bg-white p-3">
          <span className="text-xs font-semibold text-zinc-600">Course (code)</span>
          <input
            value={draftCourse}
            onChange={(e) => setDraftCourse(e.target.value)}
            placeholder="e.g. GST101"
            className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          <p className="mt-1 text-[11px] text-zinc-500">Matches tutors who listed this course.</p>
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <SelectRow
            label="Level"
            value={draftLevel}
            onChange={setDraftLevel}
            placeholder="All levels"
            options={LEVELS.map((lv) => ({ value: lv, label: `${lv}L` }))}
          />

          <SelectRow
            label="Mode"
            value={draftMode === "all" ? "" : draftMode}
            onChange={(v) => setDraftMode((v || "all") as ModeKey)}
            placeholder="All modes"
            options={[
              { value: "online", label: "Online" },
              { value: "physical", label: "Physical" },
              { value: "hybrid", label: "Hybrid" },
            ]}
          />
        </div>

        <div className="mt-3 rounded-3xl border bg-white p-3">
          <p className="text-sm font-semibold text-zinc-900">Verified</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip active={draftVerified !== "1"} onClick={() => setDraftVerified("")}>
              Any
            </Chip>
            <Chip active={draftVerified === "1"} onClick={() => setDraftVerified("1")}>
              Verified only
            </Chip>
          </div>
        </div>

        <div className="mt-3 rounded-3xl border bg-white p-3">
          <p className="text-sm font-semibold text-zinc-900">Sort</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["recommended", "Recommended"],
                ["rating_desc", "Top rated"],
                ["price_asc", "Price: low to high"],
                ["price_desc", "Price: high to low"],
                ["newest", "Newest"],
              ] as Array<[SortKey, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDraftSort(key)}
                className={cn(
                  "inline-flex items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                  draftSort === key
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                )}
              >
                <span>{label}</span>
                {draftSort === key ? <span className="text-xs font-semibold">Selected</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border bg-zinc-50 p-3">
          <p className="text-xs text-zinc-600">
            Tip: Filters apply when you tap <span className="font-semibold">Apply</span>. Search updates automatically.
          </p>
        </div>
      </Drawer>
    </div>
  );
}