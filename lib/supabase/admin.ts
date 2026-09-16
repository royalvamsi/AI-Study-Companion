import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Admin client — uses service role key.
 * NEVER expose this to the browser.
 * Only use in Inngest functions and server-side admin operations.
 * Uses the Database generic for full type safety.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
