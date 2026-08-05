import type { Metadata } from "next";
import ExamAttemptClient from "./ExamAttemptClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Timed mock in progress",
  robots: { index: false, follow: false, noarchive: true },
};

export default function ExamAttemptPage() {
  return <ExamAttemptClient />;
}
