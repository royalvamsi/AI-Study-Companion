import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { emitActivityEvent, ActivityEventType } from "@/lib/activity/events";
import {
  MAX_MATERIAL_FILE_SIZE,
  resolveCanonicalFileType,
  isValidUUID,
  validateStoragePath,
} from "@/lib/materials/validation";

/**
 * POST /api/projects/[projectId]/materials/finalize
 * Finalizes a direct client-to-storage material upload.
 * Receives metadata only (never the file content itself), validates storage path
 * and object existence, inserts the material record into the database, and fires Inngest.
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

    // 3. Read metadata payload
    let body: {
      materialId?: string;
      fileName?: string;
      filePath?: string;
      fileType?: string;
      fileSize?: number;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const { materialId, fileName, filePath, fileType, fileSize } = body;

    // 4. Validate metadata fields
    if (!materialId || !isValidUUID(materialId)) {
      return NextResponse.json(
        { error: "Valid UUID materialId is required" },
        { status: 400 }
      );
    }

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json(
        { error: "filePath is required" },
        { status: 400 }
      );
    }

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

    // 5. Strict storage path validation (must match authenticated user, project, and material ID)
    const isPathValid = validateStoragePath({
      filePath,
      userId: user.id,
      projectId,
      materialId,
      fileName,
    });

    if (!isPathValid) {
      return NextResponse.json(
        { error: "Invalid or unauthorized storage file path" },
        { status: 400 }
      );
    }

    // 6. Verify that the storage object actually exists at expected path
    const adminSupabase = createAdminClient();
    let fileExists = false;

    try {
      const { data: existsData } = await adminSupabase.storage
        .from("materials")
        .exists(filePath);
      fileExists = Boolean(existsData);
    } catch (existsErr) {
      console.warn("[finalize] exists() check threw, falling back to list():", existsErr);
    }

    if (!fileExists) {
      const folder = `${user.id}/${projectId}/${materialId}`;
      const pathFileName = filePath.split("/").slice(3).join("/");
      const { data: listData } = await adminSupabase.storage
        .from("materials")
        .list(folder);

      if (listData && Array.isArray(listData)) {
        fileExists = listData.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any) => item.name === pathFileName || item.name === fileName
        );
      }
    }

    if (!fileExists) {
      return NextResponse.json(
        { error: "Uploaded file not found in storage. Please upload again." },
        { status: 400 }
      );
    }

    // 7. Insert row into materials table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: material, error: insertError } = await (supabase.from("materials") as any)
      .insert({
        id: materialId,
        project_id: projectId,
        user_id: user.id,
        file_name: fileName,
        file_path: filePath,
        file_type: resolvedFileType,
        size_bytes: fileSize,
        status: "queued",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[finalize] DB insert failed, cleaning up storage object:", insertError);
      // Clean up orphaned storage object
      await adminSupabase.storage.from("materials").remove([filePath]);
      return NextResponse.json(
        { error: `Failed to create record: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 8. Fire Inngest event for background AI processing
    let finalMaterial = material;
    try {
      await inngest.send({
        name: "material/uploaded",
        data: {
          materialId,
          projectId,
          userId: user.id,
          filePath,
          fileName,
          fileType: resolvedFileType,
        },
      });
    } catch (inngestError) {
      console.error("[finalize] Failed to emit Inngest event:", inngestError);
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
        console.error("[finalize] Failed to update status after Inngest error:", updateError);
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
          fileName,
          error: failureReason,
        },
      });
    }

    return NextResponse.json({ material: finalMaterial }, { status: 201 });
  } catch (error) {
    console.error("[finalize] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
