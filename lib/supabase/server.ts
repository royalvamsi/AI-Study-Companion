import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  let authHeader: string | null = null;
  try {
    const reqHeaders = await headers();
    authHeader = reqHeaders.get("authorization");
  } catch {
    // headers() might not be available in some contexts
  }

  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies will be set by middleware
          }
        },
      },
    }
  );
}

// Alias for clarity in app routes
export { createClient as createServerClient };
