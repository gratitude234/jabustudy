import type { Metadata, MetadataRoute } from "next";

import {
  EXAM_COURSES,
  EXAM_DIAGNOSTIC_COOLDOWN_HOURS,
  EXAM_DIAGNOSTIC_QUESTION_COUNT,
  EXAM_MOCK_DURATION_MINUTES,
  EXAM_MOCK_QUESTION_COUNT,
  getExamSprintPricing,
  normalizeExamCourseCode,
  type ExamCourse,
} from "./config";
import { publicUrl } from "../publicUrl";

export const EXAM_SPRINT_SEO_TITLE = "JABU CBT Practice & Mock Exams | JabuStudy";
export const EXAM_SPRINT_SEO_DESCRIPTION =
  `Practise JABU CBT mocks with a free ${EXAM_DIAGNOSTIC_QUESTION_COUNT}-question diagnostic every ${EXAM_DIAGNOSTIC_COOLDOWN_HOURS} hours, corrections, weak-topic review and progress tracking on JabuStudy Exam Sprint.`;

export function examCourseSeoTitle(course: ExamCourse) {
  return `${course.code} CBT Mock Questions | JabuStudy`;
}

export function examCourseSeoDescription(course: ExamCourse) {
  return `Practise ${course.title} (${course.code}) with ${EXAM_MOCK_QUESTION_COUNT}-question timed CBT mocks, a free ${EXAM_DIAGNOSTIC_QUESTION_COUNT}-question diagnostic every ${EXAM_DIAGNOSTIC_COOLDOWN_HOURS} hours, corrections and progress tracking on JabuStudy.`;
}

export function examLandingMetadata(): Metadata {
  const url = publicUrl("/exam");
  return {
    title: { absolute: EXAM_SPRINT_SEO_TITLE },
    description: EXAM_SPRINT_SEO_DESCRIPTION,
    alternates: { canonical: url },
    category: "education",
    keywords: [
      "JABU CBT practice",
      "JABU mock exam",
      "JABU past questions",
      "supplementary exam practice",
      "university CBT practice",
    ],
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName: "JabuStudy",
      title: EXAM_SPRINT_SEO_TITLE,
      description: EXAM_SPRINT_SEO_DESCRIPTION,
      locale: "en_NG",
    },
    twitter: {
      card: "summary",
      title: EXAM_SPRINT_SEO_TITLE,
      description: EXAM_SPRINT_SEO_DESCRIPTION,
    },
  };
}

export function examCourseMetadata(course: ExamCourse): Metadata {
  const title = examCourseSeoTitle(course);
  const description = examCourseSeoDescription(course);
  const url = publicUrl(`/exam/${course.slug}`);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    category: "education",
    keywords: [
      `${course.code} CBT questions`,
      `${course.code} mock exam`,
      `${course.title} practice questions`,
      "JABU Exam Sprint",
    ],
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName: "JabuStudy",
      title,
      description,
      locale: "en_NG",
    },
    twitter: { card: "summary", title, description },
  };
}

export function examSprintStructuredData(readyCourses: readonly ExamCourse[]) {
  const url = publicUrl("/exam");
  const pricing = getExamSprintPricing();
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "JabuStudy Exam Sprint",
    url,
    description: EXAM_SPRINT_SEO_DESCRIPTION,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    inLanguage: "en-NG",
    provider: {
      "@type": "Organization",
      name: "JabuStudy",
      url: publicUrl("/"),
    },
    offers: [
      {
        "@type": "Offer",
        price: String(pricing.weeklyPriceNaira),
        priceCurrency: "NGN",
        description: "7-day Exam Sprint pass",
        url,
      },
      {
        "@type": "Offer",
        price: String(pricing.monthlyPriceNaira),
        priceCurrency: "NGN",
        description: "30-day Exam Sprint pass",
        url,
      },
    ],
    featureList: [
      `${EXAM_MOCK_QUESTION_COUNT}-question timed CBT mocks`,
      `${EXAM_MOCK_DURATION_MINUTES}-minute exam timer`,
      `Free ${EXAM_DIAGNOSTIC_QUESTION_COUNT}-question diagnostic every ${EXAM_DIAGNOSTIC_COOLDOWN_HOURS} hours`,
      "Answer corrections and weak-topic review",
    ],
    hasPart: readyCourses.map((course) => ({
      "@type": "Course",
      name: `${course.code}: ${course.title}`,
      url: publicUrl(`/exam/${course.slug}`),
      provider: { "@type": "Organization", name: "JabuStudy" },
    })),
  };
}

export function examCourseStructuredData(course: ExamCourse) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${course.code} CBT Practice: ${course.title}`,
    description: examCourseSeoDescription(course),
    url: publicUrl(`/exam/${course.slug}`),
    inLanguage: "en-NG",
    provider: {
      "@type": "Organization",
      name: "JabuStudy",
      url: publicUrl("/"),
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${EXAM_MOCK_DURATION_MINUTES}M`,
    },
  };
}

export function buildExamSitemap(
  readyCourseCodes: readonly string[],
  options: { includeStudyPages?: boolean } = {},
): MetadataRoute.Sitemap {
  const readyCodes = new Set(readyCourseCodes.map(normalizeExamCourseCode).filter(Boolean));
  const entries: MetadataRoute.Sitemap = [
    { url: publicUrl("/exam"), changeFrequency: "daily", priority: 1 },
    ...EXAM_COURSES.filter((course) => readyCodes.has(normalizeExamCourseCode(course.code))).map((course) => ({
      url: publicUrl(`/exam/${course.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];

  if (options.includeStudyPages) {
    entries.push(
      { url: publicUrl("/study"), changeFrequency: "weekly", priority: 0.8 },
      { url: publicUrl("/study/library"), changeFrequency: "weekly", priority: 0.7 },
      { url: publicUrl("/study/practice"), changeFrequency: "weekly", priority: 0.7 },
      { url: publicUrl("/study/questions"), changeFrequency: "weekly", priority: 0.6 },
    );
  }

  return entries;
}
