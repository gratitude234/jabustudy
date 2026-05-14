import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return [
    { url: `${base}/study`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/study/library`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/study/practice`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/study/questions`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/study/tutors`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/study/leaderboard`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/study/gpa`, changeFrequency: "weekly", priority: 0.5 },
  ];
}
