import type { MetadataRoute } from "next";
import { isExamSprintOnlyMode } from "@/lib/systemMode";

export default function robots(): MetadataRoute.Robots {
  const examOnlyMode = isExamSprintOnlyMode();
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: examOnlyMode ? ["/exam", "/exam/"] : "/",
        disallow: [
          ...(examOnlyMode ? ["/study", "/study/", "/notifications"] : []),
          "/study-admin/",
          "/api/",
          "/auth/",
          "/login",
          "/signup",
          "/notifications",
          "/offline",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
