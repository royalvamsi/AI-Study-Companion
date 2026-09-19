import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { emitActivityEvent, ActivityEventType } from "@/lib/activity/events";
import {
  MAX_MATERIAL_FILE_SIZE,
  resolveCanonicalFileType,
  isValidUUID,
  isSafeFileName,
  validateStoragePath,
} from "@/lib/materials/validation";

/**
 * POST /api/projects/[projectId]/materials/finalize
 * Finalizes a direct client-to-storage material upload.
 * Receives metadata only (never the file content itself), validates storage path
 * and object existence, inserts the material record into the database, and fires Inngest.
 * Idempotent: safe to retry if network response was lost.
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

    if (!fileName || typeof fileName !== "string" || !isSafeFileName(fileName)) {
      return NextResponse.json(
        { error: "Valid fileName is required without dangerous path segments or separators" },
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

    // 6. Idempotency Check:
    // A material is idempotently reusable ONLY when the existing record matches the same logical upload:
    // - materialId
    // - authenticated user
    // - projectId
    // - exact filePath
    //
    // If materialId matches but filePath differs, this is NOT an idempotent retry;
    // it must return a conflict (409) rather than returning the existing material.
    // Similarly, if filePath is already referenced by an existing material with a different materialId,
    // it is also a conflict (409) and the existing storage object must never be overwritten/deleted.
    //
    // We execute separate .eq() lookups to avoid interpolating raw filePaths into PostgREST filter strings,
    // which can fail on filenames containing commas, parentheses, or filter delimiters.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: materialById } = await (supabase.from("materials") as any)
      .select()
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("id", materialId)
      .maybeSingle();

    if (materialById) {
      if (materialById.file_path === filePath) {
        // True idempotent retry: exact same upload (materialId, project_id, user_id, filePath)
        return NextResponse.json({ material: materialById }, { status: 200 });
      }
      // Same materialId but different filePath: conflict, not an idempotent retry
      return NextResponse.json(
        { error: "Conflict: a material with this ID already exists with a different file path" },
        { status: 409 }
      );
    }

    const { data: materialByPath } = await (supabase.from("materials") as any)
      .select()
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("file_path", filePath)
      .maybeSingle();

    if (materialByPath) {
      // Same filePath already referenced by an existing material (different materialId)
      return NextResponse.json(
        { error: "Conflict: this storage file path is already referenced by an existing material" },
        { status: 409 }
      );
    }

    // 7. Verify that the storage object actually exists at expected path
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

    // 8. Insert row into materials table
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
      console.error("[finalize] DB insert failed:", insertError);

      // Verify if a material record already references this exact filePath.
      // The authoritative condition for whether a storage object is referenced is exact file_path match.
      // A record with matching materialId but differing file_path does NOT reference this storage object.
      // Never delete a Storage object that is already referenced by an existing material record.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: referencingMaterial } = await (adminSupabase.from("materials") as any)
        .select()
        .eq("file_path", filePath)
        .maybeSingle();

      if (referencingMaterial) {
        if (
          referencingMaterial.id === materialId &&
          referencingMaterial.project_id === projectId &&
          referencingMaterial.user_id === user.id
        ) {
          // Idempotent recovery: material already exists for this exact upload, return safely
          return NextResponse.json({ material: referencingMaterial }, { status: 200 });
        }
        // Referencing material exists (e.g. different materialId or project), do NOT delete Storage
        return NextResponse.json(
          { error: `Failed to create record: ${insertError.message}` },
          { status: 500 }
        );
      }

      // Safe orphan cleanup: only clean up if no material record references the Storage object
      try {
        await adminSupabase.storage.from("materials").remove([filePath]);
      } catch (cleanupErr) {
        console.warn("[finalize] Failed to clean up orphaned storage object:", cleanupErr);
      }

      return NextResponse.json(
        { error: `Failed to create record: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 9. Fire Inngest event for background AI processing
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

/**
 * DELETE /api/projects/[projectId]/materials/finalize
 * Explicit safe-cleanup contract for orphaned storage objects.
 * Guarantees that a storage object is NEVER deleted if an existing material record references it.
 */
export async function DELETE(
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

    // 3. Read body
    let body: { materialId?: string; filePath?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const { materialId, filePath } = body;
    if (
      !materialId ||
      !filePath ||
      typeof materialId !== "string" ||
      typeof filePath !== "string"
    ) {
      return NextResponse.json(
        { error: "Valid materialId and filePath are required" },
        { status: 400 }
      );
    }

    // 4. Validate storage path
    const isPathValid = validateStoragePath({
      filePath,
      userId: user.id,
      projectId,
      materialId,
    });

    if (!isPathValid) {
      return NextResponse.json(
        { error: "Invalid or unauthorized storage file path" },
        { status: 400 }
      );
    }

    // 5. Check if any material record references this exact storage object path.
    // The authoritative condition for whether a storage object is referenced is exact file_path match.
    // A record with matching materialId but differing file_path does NOT reference this storage object.
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: referencingMaterial } = await (adminSupabase.from("materials") as any)
      .select("id")
      .eq("file_path", filePath)
      .maybeSingle();

    if (referencingMaterial) {
      // NEVER delete a storage object that is referenced by an existing material record
      return NextResponse.json(
        { error: "Cannot delete: storage object is referenced by an existing material record" },
        { status: 409 }
      );
    }

    // 6. Safe to clean up orphaned storage object
    await adminSupabase.storage.from("materials").remove([filePath]);

    return NextResponse.json(
      { success: true, message: "Orphaned storage object cleaned up" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[finalize-cleanup] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

