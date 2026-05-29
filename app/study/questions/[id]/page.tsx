// app/study/questions/[id]/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import QuestionDetailClient from "./QuestionDetailClient";

export async function generateMetadata({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await Promise.resolve(params);
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("study_questions")
    .select("title, body")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { title: "Question · JABU Study" };

  return {
    title: `${data.title} · JABU Q&A`,
    description:
      data.body?.slice(0, 160) ?? "View question and answers on JABU Study Hub.",
    openGraph: {
      title: data.title,
      description:
        data.body?.slice(0, 160) ?? "View question and answers on JABU Study Hub.",
      type: "article",
    },
  };
}

function QuestionDetailFallback() {
  return (
    <div className="space-y-4 pb-32 md:pb-28">
      <div className="animate-pulse rounded-2xl border border-border bg-background p-5 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-14 rounded-full bg-muted" />
          <div className="h-5 w-20 rounded-full bg-muted" />
        </div>
        <div className="h-5 w-3/4 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
      <div className="animate-pulse rounded-2xl border border-border bg-background p-5 space-y-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

// NOTE: In newer Next.js versions (e.g. 15+), `params` can be a Promise in Server Components.
export default async function QuestionDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  return (
    <Suspense fallback={<QuestionDetailFallback />}>
      <QuestionDetailClient id={id} />
    </Suspense>
  );
}
