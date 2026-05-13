import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    (process.env.NEXT_PUBLIC_SITE_URL ?? "https://jabumarket.com").replace(
      /\/$/,
      ""
    );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/study`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/food`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/vendors`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/delivery`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/couriers`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/study/practice`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/study/materials`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/study/questions`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/study/tutors`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/study/leaderboard`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/study/gpa`, changeFrequency: "weekly", priority: 0.5 },
  ];

  try {
    const supabase = await createSupabaseServerClient();

    const [listingsRes, vendorsRes] = await Promise.all([
      supabase
        .from("listings")
        .select("id, created_at")
        .eq("status", "active"),
      supabase
        .from("vendors")
        .select("id, created_at")
        .eq("verified", true),
    ]);

    const listingRoutes: MetadataRoute.Sitemap = (listingsRes.data ?? []).map(
      (row) => ({
        url: `${base}/listing/${row.id}`,
        lastModified: row.created_at ?? undefined,
        changeFrequency: "weekly",
        priority: 0.7,
      })
    );

    const vendorRoutes: MetadataRoute.Sitemap = (vendorsRes.data ?? []).map(
      (row) => ({
        url: `${base}/vendors/${row.id}`,
        lastModified: row.created_at ?? undefined,
        changeFrequency: "monthly",
        priority: 0.6,
      })
    );

    return [...staticRoutes, ...listingRoutes, ...vendorRoutes];
  } catch {
    return staticRoutes;
  }
}
