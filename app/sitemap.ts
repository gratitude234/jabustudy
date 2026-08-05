import type { MetadataRoute } from "next";
import { buildExamSitemap } from "@/lib/examSprint/seo";
import { getPublishedExamSets } from "@/lib/examSprint/server";
import { isExamSprintOnlyMode } from "@/lib/systemMode";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const sets = await getPublishedExamSets();
    return buildExamSitemap(
      sets.map((set) => set.courseCode),
      { includeStudyPages: !isExamSprintOnlyMode() },
    );
  } catch {
    // Keep the public landing page discoverable even if the catalog database is
    // briefly unavailable when a crawler requests the sitemap.
    return buildExamSitemap([], { includeStudyPages: !isExamSprintOnlyMode() });
  }
}
