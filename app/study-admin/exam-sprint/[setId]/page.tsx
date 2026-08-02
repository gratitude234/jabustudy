import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PracticeSetEditorClient from "@/app/study/practice/[setId]/PracticeSetEditorClient";

export default async function ExamSprintSetPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  return (
    <div className="space-y-4">
      <Link href="/study-admin/exam-sprint" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary no-underline hover:underline"><ArrowLeft className="h-4 w-4" /> Exam Sprint dashboard</Link>
      <PracticeSetEditorClient setId={setId} />
    </div>
  );
}
