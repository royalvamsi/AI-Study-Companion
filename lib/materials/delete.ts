import { isValidUUID } from "@/lib/materials/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DeleteMaterialParams {
  projectId: string;
  materialId: string;
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase?: SupabaseClient<any, "public", any>;
}

export interface DeleteMaterialResult {
  success: boolean;
  message?: string;
  error?: string;
  status: number;
  material?: {
    id: string;
    fileName: string;
  };
}

/**
 * Permanently deletes a study material and cleans up its storage object and database records.
 *
 * Security & Integrity guarantees:
 * 1. Validates UUID formats for projectId and materialId.
 * 2. Confirms project ownership (project must belong to authenticated user).
 * 3. Confirms material existence & ownership (material must belong to project and user).
 * 4. Derives storage path strictly from the verified DB record (never client-provided).
 * 5. Cleans up exact Storage object (idempotent if already deleted/missing).
 * 6. Deletes DB record (cascading material_chunks, concepts, and concept_mastery).
 * 7. Never leaks internal paths, SQL errors, or stack traces.
 */
export async function deleteMaterial({
  projectId,
  materialId,
  userId,
  supabase,
  adminSupabase,
}: DeleteMaterialParams): Promise<DeleteMaterialResult> {
  // 1. Validate ID formats
  if (!isValidUUID(projectId)) {
    return {
      success: false,
      error: "Invalid project ID format.",
      status: 400,
    };
  }

  if (!isValidUUID(materialId)) {
    return {
      success: false,
      error: "Invalid material ID format.",
      status: 400,
    };
  }

  if (!userId || typeof userId !== "string") {
    return {
      success: false,
      error: "Unauthorized.",
      status: 401,
    };
  }

  // 2. Verify project ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project, error: projectError } = await (supabase.from("projects") as any)
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    console.error("[deleteMaterial] Error verifying project:", projectError);
    return {
      success: false,
      error: "Unable to verify project. Please try again.",
      status: 500,
    };
  }

  if (!project || project.user_id !== userId) {
    return {
      success: false,
      error: "Project not found.",
      status: 404,
    };
  }

  // 3. Verify material existence and ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: material, error: materialError } = await (supabase.from("materials") as any)
    .select("id, project_id, user_id, file_path, file_name")
    .eq("id", materialId)
    .maybeSingle();

  if (materialError) {
    console.error("[deleteMaterial] Error fetching material:", materialError);
    return {
      success: false,
      error: "Unable to verify material. Please try again.",
      status: 500,
    };
  }

  if (!material || material.project_id !== projectId || material.user_id !== userId) {
    return {
      success: false,
      error: "Material not found.",
      status: 404,
    };
  }

  // 4. Safe Storage cleanup
  // Delete ONLY the exact storage path derived from the verified DB record
  const storageClient = adminSupabase ?? createAdminClient();
  const filePathToDelete = material.file_path;

  if (filePathToDelete && typeof filePathToDelete === "string" && filePathToDelete.trim().length > 0) {
    try {
      const { error: storageError } = await storageClient.storage
        .from("materials")
        .remove([filePathToDelete]);

      if (storageError) {
        console.error("[deleteMaterial] Failed to remove storage file:", storageError);
        return {
          success: false,
          error: "Failed to remove material file from storage. Please try again.",
          status: 500,
        };
      }
    } catch (err) {
      console.error("[deleteMaterial] Unexpected error removing storage file:", err);
      return {
        success: false,
        error: "Failed to remove material file from storage. Please try again.",
        status: 500,
      };
    }
  }

  // 5. Database record cleanup
  // Foreign keys ON DELETE CASCADE automatically clean material_chunks, concepts, and concept_mastery
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase.from("materials") as any)
    .delete()
    .eq("id", materialId)
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (deleteError) {
    console.error("[deleteMaterial] Database deletion failed:", deleteError);
    return {
      success: false,
      error: "Unable to delete material record. Please try again.",
      status: 500,
    };
  }

  return {
    success: true,
    message: `Material "${material.file_name}" was successfully deleted.`,
    status: 200,
    material: {
      id: material.id,
      fileName: material.file_name,
    },
  };
}
