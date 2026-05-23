// app/study/materials/[id]/practice/page.tsx
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import PracticeMaterialClient from "./PracticeMaterialClient";

type Props = { params: Promise<{ id: string }> };

export default async function MaterialPracticePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [materialResult, userResult] = await Promise.all([
    supabase
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
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!materialResult.data) notFound();

  const userId = userResult.data?.user?.id;
  if (!userId) {
    redirect(`/login?next=/study/materials/${id}/practice`);
  }

  const admin = createSupabaseAdminClient();

  const [creditsResult, sessionResult] = await Promise.all([
    admin
      .from("study_user_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("study_material_sessions")
      .select("id, total_questions, total_correct, batches, started_at, last_active_at, status")
      .eq("user_id", userId)
      .eq("material_id", id)
      .eq("status", "active")
      .gt("last_active_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("last_active_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const initialCredits =
    typeof creditsResult.data?.balance === "number" ? creditsResult.data.balance : 20;

  return (
    <PracticeMaterialClient
      material={materialResult.data as any}
      userId={userId}
      initialCredits={initialCredits}
      activeSession={sessionResult.data as any}
    />
  );
}
