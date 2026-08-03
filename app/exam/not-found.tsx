import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function ExamNotFound() {
  return (
    <div className="grid min-h-[55vh] place-items-center py-10">
      <div className="max-w-md text-center"><SearchX className="mx-auto h-9 w-9 text-muted-foreground" /><h1 className="mt-4 text-2xl font-black">Course not found</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">This course is not part of the current Exam Sprint catalogue.</p><Link href="/exam#courses" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground no-underline"><ArrowLeft className="h-4 w-4" /> See all courses</Link></div>
    </div>
  );
}
