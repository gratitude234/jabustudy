import type { Metadata } from "next";
import { isExamSprintOnlyMode } from "@/lib/systemMode";
import ExamChrome from "./_components/ExamChrome";

export const metadata: Metadata = {
  title: "Exam Sprint",
  description: "Timed supplementary CBT practice for JABU students.",
};

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <ExamChrome examOnlyMode={isExamSprintOnlyMode()}>{children}</ExamChrome>;
}
