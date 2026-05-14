// app/study/materials/[id]/page.tsx
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MaterialDetailClient from "./MaterialDetailClient";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> };

// ─── Server-side data fetch ──────────────────────────────────────────────────

const getMaterial = cache(async (id: string) => {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("study_materials")
    .select(
      `id, title, description, material_type, session,
       approved, downloads, up_votes, down_votes,
       file_url, file_path, ai_summary,
       verified, featured, created_at, uploader_email, uploader_id,
       study_courses (
         id, course_code, course_title,
         level, semester, faculty, department
       )`
    )
    .eq("id", id)
    .eq("approved", true)
    .eq("upload_status", "live")
    .maybeSingle();

  if (error || !data) return null;
  return data;
});

// ─── Dynamic metadata for sharing ────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const m = await getMaterial(id);
  if (!m) return { title: "Material not found — JABU Study" };

  const course = (m.study_courses as any);
  const title = m.title ?? course?.course_code ?? "Study material";
  const desc = (m.description ?? (course ? `${course.course_code} · ${course.course_title}` : ""))
    || "Study material on JABU Study Hub";
  return {
    title: `${title} — JABU Study`,
    description: desc.slice(0, 160),
    alternates: { canonical: `/study/materials/${id}` },
    openGraph: {
      title,
      description: desc.slice(0, 160),
      type: "article",
      siteName: "Jabu Study",
    },
    twitter: {
      card: "summary",
      title,
      description: desc.slice(0, 160),
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function MaterialDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const m = await getMaterial(id);

  if (!m) notFound();

  const supabase = await createSupabaseServerClient();

  // Fetch related materials and saved state in parallel
  const courseId = (m.study_courses as any)?.id as string | undefined;

  const [relatedResult, userResult] = await Promise.all([
    courseId
      ? supabase
          .from("study_materials")
          .select("id,title,material_type,downloads,up_votes,file_path,created_at,study_courses:course_id(course_code)")
          .eq("approved", true)
          .eq("upload_status", "live")
          .eq("course_id", courseId)
          .neq("id", id)
          .order("downloads", { ascending: false })
          .limit(4)
      : Promise.resolve({ data: [] }),
    supabase.auth.getUser(),
  ]);

  const relatedMaterials = (relatedResult.data ?? []) as any[];

  let initialSaved = false;
  const userId = userResult.data?.user?.id;
  if (userId) {
    const { data: savedRow } = await supabase
      .from("study_saved_items")
      .select("id")
      .eq("user_id", userId)
      .eq("item_type", "material")
      .eq("material_id", id)
      .maybeSingle();
    initialSaved = !!savedRow;
  }

  return (
    <MaterialDetailClient
      material={m as any}
      initialSaved={initialSaved}
      relatedMaterials={relatedMaterials}
      fromCourse={from ?? null}
    />
  );
}
