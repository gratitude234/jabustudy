import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

if (!serviceRoleKey) {
  throw new Error(
    "[adminSupabase] SUPABASE_SERVICE_ROLE_KEY is not set. Check your .env.local file."
  );
}

function buildAdminClient(key: string) {
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false },
  });
}

export const adminSupabase = buildAdminClient(serviceRoleKey);

/**
 * Admin (service-role) Supabase client for SERVER-ONLY usage.
 * Bypasses RLS. Never import this in client components.
 */
export function createSupabaseAdminClient() {
  return adminSupabase;
}
