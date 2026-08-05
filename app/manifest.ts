import type { MetadataRoute } from "next";
import { isExamSprintOnlyMode } from "@/lib/systemMode";

export default function manifest(): MetadataRoute.Manifest {
  const examOnlyMode = isExamSprintOnlyMode();

  return {
    name: examOnlyMode ? "Exam Sprint by JabuStudy" : "JabuStudy",
    short_name: examOnlyMode ? "Exam Sprint" : "JabuStudy",
    description: examOnlyMode
      ? "Timed supplementary CBT practice and focused corrections for JABU students."
      : "Course materials, MCQs, Q&A, tutors, and study tools for JABU students.",
    id: examOnlyMode ? "/exam" : "/study",
    start_url: examOnlyMode ? "/exam" : "/study",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#F6F4FF",
    theme_color: "#5b35d5",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
