// app/study/questions/[id]/page.tsx
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

// NOTE: In newer Next.js versions (e.g. 15+), `params` can be a Promise in Server Components.
export default async function QuestionDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  return <QuestionDetailClient id={id} />;
}
