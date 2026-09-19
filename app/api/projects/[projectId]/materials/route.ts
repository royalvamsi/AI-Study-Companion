import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/projects/[projectId]/materials
 * Legacy multipart upload endpoint.
 * Direct multipart uploads through Next.js are deprecated in favor of direct
 * client-to-storage uploads via /upload-url and /finalize to eliminate Vercel payload limits.
 * Authenticates the caller first to preserve security and authorization boundaries.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createServerClient();

    // 1. Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify project ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: project } = await (supabase.from("projects") as any)
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 3. Reject multipart file transfer with informative redirection
    return NextResponse.json(
      {
        error:
          "Direct multipart file uploads through this endpoint are deprecated. Please initialize direct storage upload via /api/projects/[projectId]/materials/upload-url and complete via /api/projects/[projectId]/materials/finalize.",
      },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
