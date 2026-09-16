import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Auth callback — handles the redirect from Supabase email confirmation.
 * Exchanges the code for a session, then redirects to /dashboard.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
