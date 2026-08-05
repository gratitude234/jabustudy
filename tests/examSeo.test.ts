import { afterEach, describe, expect, it } from "vitest";

import {
  buildExamSitemap,
  examCourseMetadata,
  EXAM_SPRINT_SEO_DESCRIPTION,
} from "../lib/examSprint/seo";
import { findExamCourse } from "../lib/examSprint/config";
import {
  DEFAULT_PUBLIC_SITE_URL,
  metadataBaseUrl,
  publicSiteOrigin,
  publicUrl,
} from "../lib/publicUrl";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("Exam Sprint search metadata", () => {
  it("uses the production domain when the deployment URL is missing or invalid", () => {
    expect(publicSiteOrigin({})).toBe(DEFAULT_PUBLIC_SITE_URL);
    expect(publicSiteOrigin({ NEXT_PUBLIC_SITE_URL: "not a URL" })).toBe(DEFAULT_PUBLIC_SITE_URL);
    expect(metadataBaseUrl({}).origin).toBe(DEFAULT_PUBLIC_SITE_URL);
  });

  it("creates absolute canonical metadata for an individual course", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.jabustudy.com/ignored/path";
    const course = findExamCourse("GNS 121")!;
    const metadata = examCourseMetadata(course);

    expect(metadata.title).toEqual({ absolute: "GNS 121 CBT Mock Questions | JabuStudy" });
    expect(metadata.description).toContain("Communication in English II");
    expect(metadata.alternates).toEqual({ canonical: "https://www.jabustudy.com/exam/gns-121" });
  });

  it("advertises the landing page and only courses with published banks", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const sitemap = buildExamSitemap(["GNS121", "BIO 101", "GNS 121"]);
    const urls = sitemap.map((entry) => entry.url);

    expect(urls).toEqual([
      publicUrl("/exam"),
      publicUrl("/exam/gns-121"),
      publicUrl("/exam/bio-101"),
    ]);
    expect(urls).not.toContain(publicUrl("/exam/chm-101"));
    expect(EXAM_SPRINT_SEO_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it("adds Study pages only when the normal product is enabled", () => {
    const sitemap = buildExamSitemap([], { includeStudyPages: true });
    expect(sitemap.map((entry) => entry.url)).toContain(publicUrl("/study"));
  });
});
