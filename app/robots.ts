import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://jabumarket.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/study-admin/",
          "/api/",
          "/auth/",
          "/login",
          "/signup",
          "/me",
          "/my-listings",
          "/my-orders",
          "/saved",
          "/notifications",
          "/inbox/",
          "/vendor/",
          "/rider/",
          "/post",
          "/report",
          "/offline",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
