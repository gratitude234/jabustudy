// lib/studySaved.ts
// Small helper used across Study pages for Save/Unsave.

import { supabase } from "@/lib/supabase";

export async function getAuthedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user?.id ?? null;
}

type ToggleArgs =
  | { itemType: "material"; materialId: string }
  | { itemType: "practice_set"; practiceSetId: string }
  | { itemType: "question"; questionId: string };

export async function toggleSaved(args: ToggleArgs): Promise<{ saved: boolean }> {
  const userId = await getAuthedUserId();
  if (!userId) throw new Error("You need to sign in to save items.");

  const itemType = args.itemType;
  const payload: any = { user_id: userId, item_type: itemType };
  if (itemType === "material") payload.material_id = args.materialId;
  if (itemType === "practice_set") payload.practice_set_id = args.practiceSetId;
  if (itemType === "question") payload.question_id = args.questionId;

  // Check if already saved
  let q = supabase
    .from("study_saved_items")
    .select("id")
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .limit(1);

  if (itemType === "material") q = q.eq("material_id", args.materialId);
  if (itemType === "practice_set") q = q.eq("practice_set_id", args.practiceSetId);
  if (itemType === "question") q = q.eq("question_id", args.questionId);

  const { data: existing, error: exErr } = await q;
  if (exErr) throw exErr;

  const existingId = (existing as any[])?.[0]?.id ? String((existing as any[])[0].id) : null;
  if (existingId) {
    const { error } = await supabase.from("study_saved_items").delete().eq("id", existingId);
    if (error) throw error;
    return { saved: false };
  }

  const { error } = await supabase.from("study_saved_items").insert(payload);
  if (error) throw error;
  return { saved: true };
}
