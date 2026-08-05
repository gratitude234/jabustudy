import type { MetadataRoute } from "next";
import { metadataBaseUrl } from "@/lib/publicUrl";
import { isExamSprintOnlyMode } from "@/lib/systemMode";

export default function robots(): MetadataRoute.Robots {
  const examOnlyMode = isExamSprintOnlyMode();
  const base = metadataBaseUrl().origin;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          ...(examOnlyMode ? ["/study", "/study/", "/notifications"] : []),
          "/exam/attempt/",
          "/exam/result/",
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
