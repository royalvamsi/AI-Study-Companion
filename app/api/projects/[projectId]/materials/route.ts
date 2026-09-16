import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

/**
 * POST /api/projects/[projectId]/materials
 * Upload a PDF to a project — stores in Supabase Storage,
 * creates the materials row, then fires Inngest for processing.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createServerClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify project ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: project } = await (supabase.from("projects") as any)
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Generate unique storage path
    const materialId = crypto.randomUUID();
    const filePath = `${user.id}/${projectId}/${materialId}/${file.name}`;

    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("materials")
      .upload(filePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Create materials row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: material, error: insertError } = await (supabase.from("materials") as any)
      .insert({
        id: materialId,
        project_id: projectId,
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_type: "application/pdf",
        status: "queued",
      })
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded file
      await supabase.storage.from("materials").remove([filePath]);
      return NextResponse.json(
        { error: `Failed to create record: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Fire Inngest event to start processing
    try {
      await inngest.send({
        name: "material/uploaded",
        data: {
          materialId,
          projectId,
          userId: user.id,
          filePath,
          fileName: file.name,
        },
      });
    } catch (inngestError) {
      console.error("Failed to emit Inngest event:", inngestError);
      // The file was stored and material record created; do not fail the upload request
    }

    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    console.error("Material upload error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
