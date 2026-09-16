import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

import { headers } from "next/headers";

/**
 * Standard API error response helper
 */
export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Verify the current session and return the user.
 * Returns null if not authenticated (caller should return 401).
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  let bearerToken: string | undefined;
  try {
    const reqHeaders = await headers();
    bearerToken = reqHeaders.get("authorization")?.replace(/^Bearer\s+/i, "");
  } catch {
    // headers() might not be available in some contexts
  }

  const {
    data: { user },
    error,
  } = await (bearerToken ? supabase.auth.getUser(bearerToken) : supabase.auth.getUser());

  if (error || !user) return null;
  return user;
}

/**
 * Verify that the authenticated user owns a project.
 * Returns the project if authorized, null otherwise.
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string
) {
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, space_id, name, description, learning_goal, user_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error || !project) return null;
  return project;
}

/**
 * Verify that the authenticated user owns a space.
 */
export async function verifySpaceOwnership(spaceId: string, userId: string) {
  const supabase = await createClient();
  const { data: space, error } = await supabase
    .from("spaces")
    .select("id, name, description, user_id")
    .eq("id", spaceId)
    .eq("user_id", userId)
    .single();

  if (error || !space) return null;
  return space;
}

/**
 * Verify the current user is an admin.
 */
export async function verifyAdminAccess(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (profile as any)?.is_admin === true;
}
