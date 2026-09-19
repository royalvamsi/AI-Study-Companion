import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_MATERIAL_FILE_SIZE,
  resolveCanonicalFileType,
  generateStoragePath,
} from "@/lib/materials/validation";

/**
 * POST /api/projects/[projectId]/materials/upload-url
 * Initializes a direct client-to-storage material upload.
 * Validates user authentication, project ownership, file type, and file size (<= 50MB),
 * then creates a unique storage path and signed upload token.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createServerClient();

    // 1. Authenticate user
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

    // 3. Read and parse metadata JSON payload
    let body: { fileName?: string; fileType?: string; fileSize?: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const { fileName, fileType, fileSize } = body;

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    // 4. Validate canonical file type & extensions
    const resolvedFileType = resolveCanonicalFileType(fileName, fileType);
    if (!resolvedFileType) {
      return NextResponse.json(
        {
          error:
            "Only PDF (.pdf), Word (.docx), PowerPoint (.pptx), Markdown (.md), and plain text (.txt) files are supported",
        },
        { status: 400 }
      );
    }

    // 5. Validate file size (<= 50MB)
    if (typeof fileSize !== "number" || fileSize <= 0) {
      return NextResponse.json(
        { error: "Valid fileSize in bytes is required" },
        { status: 400 }
      );
    }

    if (fileSize > MAX_MATERIAL_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    // 6. Generate UUID material ID and storage path
    const materialId = crypto.randomUUID();
    const filePath = generateStoragePath(user.id, projectId, materialId, fileName);

    // 7. Generate signed upload URL and token using admin client
    const adminSupabase = createAdminClient();
    const { data: signedData, error: signError } = await adminSupabase.storage
      .from("materials")
      .createSignedUploadUrl(filePath);

    if (signError) {
      console.error("[upload-url] Failed to create signed upload URL:", signError);
      return NextResponse.json(
        { error: `Failed to initialize storage upload: ${signError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        materialId,
        filePath,
        signedUrl: signedData?.signedUrl ?? null,
        token: signedData?.token ?? null,
        path: signedData?.path ?? filePath,
        fileType: resolvedFileType,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[upload-url] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
