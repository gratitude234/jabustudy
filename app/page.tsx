// app/page.tsx
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Search,
  ShoppingBag,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ListingImage from "@/components/ListingImage";
import { isOpenNow } from "@/lib/vendorSchedule";

export const revalidate = 60;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNaira(amount: number | null | undefined) {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

function getGreeting() {
  const hour = (new Date().getUTCHours() + 1) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  return fullName.trim().split(" ")[0];
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ListingPreview = {
  id: string;
  title: string | null;
  price: number | null;
  price_label: string | null;
  category: string | null;
  listing_type: string | null;
  location: string | null;
  image_url: string | null;
  negotiable: boolean | null;
  created_at: string | null;
  status?: string | null;
};

type FoodVendorPreview = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  accepts_orders: boolean | null;
  accepts_delivery: boolean | null;
  opens_at: string | null;
  closes_at: string | null;
  day_schedule: unknown;
  verified: boolean | null;
  verification_status: string | null;
  _menuItems?: string[];
  _rating?: { avg: number; count: number };
};

// ── Static data ───────────────────────────────────────────────────────────────

const quickAccess = [
  { label: "Market", icon: ShoppingBag, href: "/explore", bg: "bg-orange-50", color: "text-[#ff5c00]" },
  { label: "Food", icon: UtensilsCrossed, href: "/food", bg: "bg-[#FAEEDA]", color: "text-[#854F0B]" },
  { label: "Study Hub", icon: BookOpen, href: "/study", bg: "bg-[#EAF3DE]", color: "text-[#3B6D11]" },
  { label: "Delivery", icon: Bike, href: "/delivery", bg: "bg-[#FBEAF0]", color: "text-[#993356]" },
];

const categoryChips = [
  { label: "Phones", href: "/explore?category=Phones" },
  { label: "Laptops", href: "/explore?category=Laptops" },
  { label: "Fashion", href: "/explore?category=Fashion" },
  { label: "Books", href: "/explore?category=Books+%26+Stationery" },
  { label: "Services", href: "/explore?type=service" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const greeting = getGreeting();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, latestListingsRes, foodVendorsRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("full_name").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("listings")
      .select(
        "id, title, price, price_label, category, listing_type, location, image_url, negotiable, created_at, status",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("vendors")
      .select(
        "id, name, avatar_url, accepts_orders, accepts_delivery, opens_at, closes_at, day_schedule, verified, verification_status",
      )
      .eq("vendor_type", "food")
      .or("verified.eq.true,verification_status.eq.verified")
      .not("name", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const firstName = getFirstName((profileRes.data as { full_name?: string } | null)?.full_name);
  const listings = (latestListingsRes.data ?? []) as ListingPreview[];
  const rawFoodVendors = (foodVendorsRes.data ?? []) as FoodVendorPreview[];

  const foodVendorIds = rawFoodVendors.map((v) => v.id);

  const [menuItemsRes, reviewsRes] = await Promise.all([
    foodVendorIds.length > 0
      ? supabase
          .from("vendor_menu_items")
          .select("vendor_id, name")
          .in("vendor_id", foodVendorIds)
          .eq("available", true)
          .limit(20)
      : Promise.resolve({ data: [] as { vendor_id: string; name: string }[] }),
    foodVendorIds.length > 0
      ? supabase.from("vendor_reviews").select("vendor_id, rating").in("vendor_id", foodVendorIds)
      : Promise.resolve({ data: [] as { vendor_id: string; rating: number }[] }),
  ]);

  const menuMap: Record<string, string[]> = {};
  for (const item of menuItemsRes.data ?? []) {
    if (!menuMap[item.vendor_id]) menuMap[item.vendor_id] = [];
    if (menuMap[item.vendor_id].length < 2) menuMap[item.vendor_id].push(item.name);
  }

  const ratingMap: Record<string, { avg: number; count: number }> = {};
  for (const r of reviewsRes.data ?? []) {
    const e = ratingMap[r.vendor_id];
    ratingMap[r.vendor_id] = e
      ? { avg: (e.avg * e.count + r.rating) / (e.count + 1), count: e.count + 1 }
      : { avg: r.rating, count: 1 };
  }

  const foodVendors = rawFoodVendors
    .map((v) => ({ ...v, _menuItems: menuMap[v.id] ?? [], _rating: ratingMap[v.id] }))
    .slice(0, 3);

  const listingIds = listings.map((l) => l.id);
  const savesRes =
    listingIds.length > 0
      ? await supabase
          .from("listing_stats")
          .select("listing_id, saves")
          .in("listing_id", listingIds)
      : { data: [] as { listing_id: string; saves: number }[] };

  const savesMap: Record<string, number> = {};
  for (const s of savesRes.data ?? []) {
    savesMap[s.listing_id] = Number(s.saves ?? 0);
  }

  return (
    <div className="pb-28 md:pb-10">
      {/* ── Greeting (mobile only) ─────────────────────────────── */}
      <section className="px-4 pt-2 pb-4 md:hidden">
        <p className="text-xs text-muted-foreground leading-tight">{greeting}</p>
        <h1 className="text-[17px] font-semibold text-foreground leading-tight">
          {firstName ? `${firstName} 👋` : "Welcome 👋"}
        </h1>
      </section>

      {/* ── Search ────────────────────────────────────────────── */}
      <section className="px-4 pb-5 md:pb-6">
        <Link
          href="/explore"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card/80 shadow-sm no-underline"
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Search listings, food, courses…</span>
        </Link>
      </section>

      {/* ── Hero banner ───────────────────────────────────────── */}
      <section className="px-4 pb-5">
        <div className="rounded-[20px] bg-[#130a3e] p-5 md:p-7">
          <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-widest mb-1.5">
            JABU Campus
          </p>
          <h2 className="text-[22px] md:text-3xl font-semibold text-white leading-snug mb-1">
            Find anything
            <br className="md:hidden" /> on campus.
          </h2>
          <p className="text-xs text-indigo-300 leading-relaxed mb-5">
            Phones, food, services &amp; more from students &amp; vendors.
          </p>
          <div className="flex gap-2.5 flex-wrap">
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff5c00] text-white text-xs font-semibold hover:bg-[#e05200] transition-colors no-underline"
            >
              Explore <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/post"
              className="inline-flex items-center px-4 py-2 rounded-xl border border-white/20 text-white/70 text-xs hover:bg-white/5 transition-colors no-underline"
            >
              Post a listing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Quick access ──────────────────────────────────────── */}
      <section className="px-4 pb-5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Quick access
        </p>
        <div className="grid grid-cols-4 gap-2 md:gap-3">
          {quickAccess.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1.5 no-underline group"
              >
                <div
                  className={cn(
                    "w-14 h-14 md:w-16 md:h-16 rounded-[18px] flex items-center justify-center transition-opacity group-hover:opacity-80",
                    item.bg,
                    item.color,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Category chips ────────────────────────────────────── */}
      <section className="pb-5">
        <p className="px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Categories
        </p>
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {categoryChips.map((chip, i) => (
            <Link
              key={chip.label}
              href={chip.href}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium no-underline transition-colors",
                i === 0
                  ? "bg-indigo-900 text-indigo-200"
                  : "border border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {chip.label}
            </Link>
          ))}
          <Link
            href="/explore"
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium border border-border bg-card text-muted-foreground hover:bg-accent no-underline transition-colors"
          >
            More <ChevronDown className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* ── Recent listings ───────────────────────────────────── */}
      <section className="px-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Recent listings
          </p>
          <Link
            href="/explore?sort=newest"
            className="flex items-center gap-0.5 text-[11px] text-[#ff5c00] no-underline"
          >
            See all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground">No listings yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first to post an item or service.
            </p>
            <Link
              href="/post"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background no-underline"
            >
              Post now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} saves={savesMap[l.id] as number | undefined} />
            ))}
          </div>
        )}
      </section>

      {/* ── Food vendors ──────────────────────────────────────── */}
      {foodVendors.length > 0 && (
        <section className="px-4 pb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Food vendors
            </p>
            <Link
              href="/food"
              className="flex items-center gap-0.5 text-[11px] text-[#ff5c00] no-underline"
            >
              See all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            {foodVendors.map((v) => {
              const open = v.accepts_orders === false ? false : isOpenNow({
                opens_at: v.opens_at,
                closes_at: v.closes_at,
                day_schedule: v.day_schedule as Parameters<typeof isOpenNow>[0]["day_schedule"],
              });
              const rating = v._rating;

              return (
                <Link
                  key={v.id}
                  href={`/vendors/${v.id}`}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:bg-accent transition-colors no-underline"
                >
                  {v.avatar_url ? (
                    <Image
                      src={v.avatar_url}
                      alt={v.name ?? "Vendor"}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-[14px] object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-[14px] bg-[#FAEEDA] flex items-center justify-center shrink-0 text-[#854F0B]">
                      <UtensilsCrossed className="h-5 w-5" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {v.name}
                      </span>
                      {open !== null && (
                        <span
                          className={cn(
                            "shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-md",
                            open ? "bg-[#EAF3DE] text-[#3B6D11]" : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {open ? "Open" : "Closed"}
                        </span>
                      )}
                    </div>

                    {v._menuItems && v._menuItems.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {v._menuItems.join(" · ")}
                      </p>
                    )}

                    <div className="flex items-center gap-1 mt-1">
                      {rating && (
                        <>
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs text-muted-foreground">
                            {rating.avg.toFixed(1)}
                          </span>
                        </>
                      )}
                      {v.accepts_delivery && (
                        <span className="text-xs text-muted-foreground">
                          {rating ? " · Delivery available" : "Delivery available"}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Study Hub banner ──────────────────────────────────── */}
      <section className="px-4 pb-5">
        <Link
          href="/study"
          className="block rounded-[18px] bg-[#EAF3DE] border border-[#97C459]/60 p-5 no-underline hover:bg-[#dceec8] transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold text-[#3B6D11] uppercase tracking-widest mb-1.5">
                Study Hub
              </p>
              <h3 className="text-base font-semibold text-[#173404] mb-0.5">Keep your streak! 🔥</h3>
              <p className="text-xs text-[#3B6D11]">Flashcards, MCQs, past questions</p>
            </div>
            <div className="w-11 h-11 rounded-[14px] bg-[#639922] flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-semibold text-[#3B6D11]">Open Study Hub</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#3B6D11]" />
          </div>
        </Link>
      </section>
    </div>
  );
}

// ── ListingCard ───────────────────────────────────────────────────────────────

function ListingCard({ listing: l, saves }: { listing: ListingPreview; saves?: number }) {
  const title = l.title ?? "Untitled listing";
  const img = (l.image_url ?? "").trim();
  const hasImg = img.length > 0;
  const lt = l.listing_type?.toLowerCase();
  const badge =
    lt === "new"
      ? { label: "New", bg: "bg-[#EAF3DE]", text: "text-[#3B6D11]" }
      : lt === "used"
        ? { label: "Used", bg: "bg-[#FAEEDA]", text: "text-[#633806]" }
        : null;

  return (
    <Link
      href={`/listing/${l.id}`}
      className="group overflow-hidden rounded-2xl border border-border bg-card hover:bg-accent/30 transition-colors no-underline"
    >
      <div className="relative h-[100px] w-full bg-secondary">
        {hasImg ? (
          <ListingImage src={img} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="p-2.5">
        <p className="text-[11px] font-semibold text-foreground leading-snug mb-0.5 line-clamp-2">
          {title}
        </p>
        <p className="text-[13px] font-semibold text-[#ff5c00] mb-1.5">
          {l.price !== null ? formatNaira(l.price) : l.price_label?.trim() || "Contact"}
        </p>
        <div className="flex items-center justify-between">
          {l.category && <span className="text-[9px] text-muted-foreground">{l.category}</span>}
          {badge && (
            <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded", badge.bg, badge.text)}>
              {badge.label}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}