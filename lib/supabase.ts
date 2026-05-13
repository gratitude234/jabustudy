import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client.
 * Uses cookies so that server Route Handlers can read the auth session.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
