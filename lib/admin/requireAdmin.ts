import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminAuthResult = {
  userId: string;
};

/**
 * Verifies the current request has an authenticated user AND that user is in the `admins` table.
 * Uses the service-role client to check admin status (does not rely on RLS).
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  const userId = userData.user.id;

  const admin = createSupabaseAdminClient();
  const { data: adminRow, error: adminErr } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (adminErr) {
    throw Object.assign(new Error(adminErr.message || "Admin check failed"), { status: 500 });
  }

  if (!adminRow?.user_id) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  return { userId };
}
