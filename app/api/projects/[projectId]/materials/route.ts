import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";
import { emitActivityEvent, ActivityEventType } from "@/lib/activity/events";

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

    // Validate file type (PDF, text, markdown)
    const lowerName = file.name.toLowerCase();
    let resolvedFileType: string | null = null;

    if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
      resolvedFileType = "application/pdf";
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/docx" ||
      lowerName.endsWith(".docx")
    ) {
      resolvedFileType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      file.type === "application/vnd.ms-powerpoint" ||
      file.type === "application/pptx" ||
      lowerName.endsWith(".pptx")
    ) {
      resolvedFileType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    } else if (
      file.type === "text/markdown" ||
      file.type === "text/x-markdown" ||
      lowerName.endsWith(".md") ||
      lowerName.endsWith(".markdown")
    ) {
      resolvedFileType = "text/markdown";
    } else if (
      file.type === "text/plain" ||
      lowerName.endsWith(".txt")
    ) {
      resolvedFileType = "text/plain";
    }

    if (!resolvedFileType) {
      return NextResponse.json(
        { error: "Only PDF (.pdf), Word (.docx), PowerPoint (.pptx), Markdown (.md), and plain text (.txt) files are supported" },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
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
        contentType: resolvedFileType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Create materials row with actual file_type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: material, error: insertError } = await (supabase.from("materials") as any)
      .insert({
        id: materialId,
        project_id: projectId,
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_type: resolvedFileType,
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
    let finalMaterial = material;
    try {
      await inngest.send({
        name: "material/uploaded",
        data: {
          materialId,
          projectId,
          userId: user.id,
          filePath,
          fileName: file.name,
          fileType: resolvedFileType,
        },
      });
    } catch (inngestError) {
      console.error("Failed to emit Inngest event:", inngestError);
      const failureReason = "Failed to start processing. Please try uploading again.";

      // Mark materials row as failed rather than leaving it stuck in queued
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedMaterial, error: updateError } = await (supabase.from("materials") as any)
        .update({
          status: "failed",
          error_message: failureReason,
        })
        .eq("id", materialId)
        .select()
        .single();

      if (updateError) {
        console.error("Failed to update material to failed status after Inngest error:", updateError);
        finalMaterial = {
          ...material,
          status: "failed",
          error_message: failureReason,
        };
      } else if (updatedMaterial) {
        finalMaterial = updatedMaterial;
      }

      await emitActivityEvent({
        projectId,
        userId: user.id,
        eventType: ActivityEventType.MATERIAL_FAILED,
        payload: {
          materialId,
          fileName: file.name,
          error: failureReason,
        },
      });
    }

    return NextResponse.json({ material: finalMaterial }, { status: 201 });
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
